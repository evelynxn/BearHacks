"""
Jabra Speak2 75 — device detection, microphone recording, and speaker playback.

Usage (standalone test):
    python jabra.py record          # records 5 s, saves to test_recording.wav
    python jabra.py play <file.mp3> # plays an MP3 through the Jabra speaker
    python jabra.py info            # prints detected device info
"""

from __future__ import annotations

import io
import math
import os
import re
import struct
import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass
from typing import Optional

import pyaudio

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SAMPLE_RATE = 32_000       # Hz  — raw Jabra mic (device 14), no Windows processing
CHANNELS = 1               # mono
SAMPLE_WIDTH = 2           # bytes (int16)
CHUNK_FRAMES = 1024        # frames per read

SILENCE_RMS_THRESHOLD = float(os.environ.get("SILENCE_RMS_THRESHOLD", "500"))
SILENCE_TAIL_SECONDS  = float(os.environ.get("SILENCE_TAIL_SECONDS",  "2.5"))
MAX_RECORD_SECONDS    = float(os.environ.get("MAX_RECORDING_SECONDS", "60.0"))

JABRA_KEYWORDS = ("jabra",)   # case-insensitive substrings to match


# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------

@dataclass
class JabraDevices:
    input_index:  int         # pyaudio device index for mic
    output_index: int         # pyaudio device index for speaker
    alsa_hw:      str         # e.g. "hw:2,0"  — used for mpg123 / aplay
    display_name: str


def _is_jabra(name: str) -> bool:
    name_l = name.lower()
    return any(kw in name_l for kw in JABRA_KEYWORDS)


def _extract_hw(name: str) -> Optional[str]:
    """Pull 'hw:N,M' out of a pyaudio device name string if present."""
    m = re.search(r"hw:(\d+,\d+)", name)
    return f"hw:{m.group(1)}" if m else None


def find_jabra(pa: Optional[pyaudio.PyAudio] = None) -> JabraDevices:
    """
    Scan pyaudio devices for the Jabra.
    Raises RuntimeError if not found.
    """
    _own_pa = pa is None
    if _own_pa:
        pa = pyaudio.PyAudio()
    try:
        input_idx  = None
        output_idx = None
        alsa_hw    = None
        display    = None

        # First pass: prefer raw input at SAMPLE_RATE (avoids Windows echo-cancelled device)
        preferred_input = None
        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            name: str = info.get("name", "")
            if not _is_jabra(name):
                continue
            if info.get("maxInputChannels", 0) > 0 and int(info.get("defaultSampleRate", 0)) == SAMPLE_RATE:
                preferred_input = i
                break

        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            name: str = info.get("name", "")
            if not _is_jabra(name):
                continue

            display = display or name
            hw = _extract_hw(name)
            if hw and alsa_hw is None:
                alsa_hw = hw

            if info.get("maxInputChannels", 0) > 0 and input_idx is None:
                input_idx = preferred_input if preferred_input is not None else i
            if info.get("maxOutputChannels", 0) > 0 and output_idx is None:
                output_idx = i

        if input_idx is None or output_idx is None:
            _dump_devices(pa)
            raise RuntimeError(
                "Jabra Speak2 75 not found. "
                "Make sure it is plugged in and recognised by the OS "
                "(`aplay -l` should list a Jabra card)."
            )

        # Fallback hw string derived from the card number pyaudio reports
        if alsa_hw is None:
            info = pa.get_device_info_by_index(input_idx)
            card = info.get("hostApiDeviceIndex", 0)
            alsa_hw = f"hw:{card},0"

        return JabraDevices(
            input_index=input_idx,
            output_index=output_idx,
            alsa_hw=alsa_hw,
            display_name=display or "Jabra",
        )
    finally:
        if _own_pa:
            pa.terminate()


def _dump_devices(pa: pyaudio.PyAudio) -> None:
    print("[jabra] available audio devices:")
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        print(
            f"  [{i}] {info['name']!r:50s}  "
            f"in={info['maxInputChannels']}  out={info['maxOutputChannels']}"
        )


# ---------------------------------------------------------------------------
# Recording
# ---------------------------------------------------------------------------

def _rms(chunk: bytes) -> float:
    n = len(chunk) // SAMPLE_WIDTH
    if n == 0:
        return 0.0
    samples = struct.unpack(f"<{n}h", chunk)
    return math.sqrt(sum(s * s for s in samples) / n)


def record_vad(pa: pyaudio.PyAudio, device_index: int) -> bytes:
    """
    Open the Jabra mic, record until VAD silence or max duration.
    Returns raw WAV bytes (or empty bytes if no speech detected).
    """
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=CHUNK_FRAMES,
    )

    frames: list[bytes] = []
    silence_since: Optional[float] = None
    voice_seen = False
    import time
    start = time.monotonic()
    frame_dur = CHUNK_FRAMES / SAMPLE_RATE

    try:
        while True:
            chunk = stream.read(CHUNK_FRAMES, exception_on_overflow=False)
            frames.append(chunk)
            rms = _rms(chunk)
            elapsed = time.monotonic() - start

            if rms >= SILENCE_RMS_THRESHOLD:
                voice_seen = True
                silence_since = None
            else:
                if silence_since is None:
                    silence_since = time.monotonic()
                elif voice_seen and (time.monotonic() - silence_since) >= SILENCE_TAIL_SECONDS:
                    trim = int(SILENCE_TAIL_SECONDS / frame_dur)
                    if len(frames) > trim:
                        frames = frames[:-trim]
                    break

            if elapsed >= MAX_RECORD_SECONDS:
                print("[jabra] hit max recording duration")
                break
    finally:
        stream.stop_stream()
        stream.close()

    if not voice_seen:
        print("[jabra] no speech detected")
        return b""

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Playback
# ---------------------------------------------------------------------------

def play_mp3_bytes(mp3_bytes: bytes, alsa_hw: str) -> None:
    """
    Play MP3 bytes through the Jabra speaker.
    Uses pygame on Windows/dev, mpg123 on Linux/Pi.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(mp3_bytes)
        tmp_path = tmp.name
    try:
        import sys
        if sys.platform == "win32":
            import pygame
            pygame.mixer.init()
            pygame.mixer.music.load(tmp_path)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                pygame.time.wait(100)
            pygame.mixer.quit()
        else:
            subprocess.run(
                ["mpg123", "-q", "-a", alsa_hw, tmp_path],
                check=True,
            )
    except ImportError:
        print("[jabra] pygame not installed — run: pip install pygame")
    except FileNotFoundError:
        print("[jabra] mpg123 not found — run: sudo apt install mpg123")
    except Exception as exc:
        print(f"[jabra] playback failed: {exc}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# CLI test entry-point
# ---------------------------------------------------------------------------

def _cmd_info() -> None:
    pa = pyaudio.PyAudio()
    try:
        devices = find_jabra(pa)
        print(f"[jabra] found: {devices.display_name!r}")
        print(f"  input  device index : {devices.input_index}")
        print(f"  output device index : {devices.output_index}")
        print(f"  ALSA hw address     : {devices.alsa_hw}")
    finally:
        pa.terminate()


def _cmd_record() -> None:
    pa = pyaudio.PyAudio()
    try:
        devices = find_jabra(pa)
        print(f"[jabra] recording from {devices.display_name!r} — speak now…")
        wav = record_vad(pa, devices.input_index)
        if wav:
            with open("test_recording.wav", "wb") as f:
                f.write(wav)
            print(f"[jabra] saved {len(wav)} bytes → test_recording.wav")
        else:
            print("[jabra] nothing recorded")
    finally:
        pa.terminate()


def _cmd_play(path: str) -> None:
    devices = find_jabra()
    with open(path, "rb") as f:
        data = f.read()
    print(f"[jabra] playing {path!r} → {devices.alsa_hw}")
    play_mp3_bytes(data, devices.alsa_hw)
    print("[jabra] done")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "info"
    if cmd == "info":
        _cmd_info()
    elif cmd == "record":
        _cmd_record()
    elif cmd == "play":
        if len(sys.argv) < 3:
            print("usage: python jabra.py play <file.mp3>")
            sys.exit(1)
        _cmd_play(sys.argv[2])
    else:
        print(f"unknown command {cmd!r}  (info | record | play <file.mp3>)")
        sys.exit(1)

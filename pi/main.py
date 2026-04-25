"""
Punchi — Edge Agent.

Runs on a Raspberry Pi Zero 2 W with a ReSpeaker 2-Mics Pi HAT.

Listens for the "Hey Punchi" wakeword via Picovoice Porcupine, records the
follow-on utterance using RMS-based Voice Activity Detection, and POSTs the
.wav to the orchestrator. Maintains a WebSocket connection for LED state
updates and TTS playback commands.
"""

from __future__ import annotations

import io
import json
import math
import os
import struct
import subprocess
import tempfile
import threading
import time
import wave
from typing import List, Optional

import pvporcupine
import pyaudio
import requests
import websocket
from dotenv import load_dotenv

load_dotenv()

# ---------- Configuration ---------------------------------------------------

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:3000")
WS_URL = os.environ.get("WS_URL", "ws://localhost:3000/edge")

# TODO: replace with Auth0 Device Authorization Grant token once Phase 2 auth lands.
AUTH0_DEVICE_TOKEN = os.environ.get("AUTH0_DEVICE_TOKEN", "MOCK_TOKEN_FOR_NOW")
# TODO: drop this header once the orchestrator validates the bearer token.
USER_ID = os.environ.get("PUNCHI_USER_ID", "")

# Picovoice — get your key at https://console.picovoice.ai
PORCUPINE_ACCESS_KEY = os.environ.get("PORCUPINE_ACCESS_KEY", "")
PORCUPINE_KEYWORD_PATH = os.environ.get("PORCUPINE_KEYWORD_PATH") or None  # path to "Hey Punchi" .ppn
PORCUPINE_BUILTIN_KEYWORD = os.environ.get("PORCUPINE_BUILTIN_KEYWORD", "computer")  # fallback for dev

# VAD tuning
SILENCE_RMS_THRESHOLD = float(os.environ.get("SILENCE_RMS_THRESHOLD", 500))
SILENCE_TAIL_SECONDS = float(os.environ.get("SILENCE_TAIL_SECONDS", 2.5))
MAX_RECORDING_SECONDS = float(os.environ.get("MAX_RECORDING_SECONDS", 60.0))

# Audio format constants — Porcupine fixes the sample rate and frame length.
SAMPLE_WIDTH_BYTES = 2  # int16
CHANNELS = 1

# Network
UPLOAD_TIMEOUT_SECONDS = 30
WS_RECONNECT_DELAY_SECONDS = 5

AUTH_HEADERS = {"Authorization": f"Bearer {AUTH0_DEVICE_TOKEN}"}


# ---------- Hardware (LEDs + audio playback) --------------------------------

try:
    from apa102_pi.driver import apa102  # type: ignore
    _LED_DRIVER_AVAILABLE = True
except Exception:  # noqa: BLE001 — driver missing is fine on dev machines
    _LED_DRIVER_AVAILABLE = False


class Hardware:
    """ReSpeaker 2-Mics Pi HAT — three APA102 LEDs + I2S audio out."""

    NUM_LEDS = 3
    BRIGHTNESS = 12  # 0-31, keep low so it doesn't cook your retinas
    _strip = None
    _lock = threading.Lock()
    _animation_thread: Optional[threading.Thread] = None
    _stop_animation = threading.Event()

    COLORS = {
        "off": (0, 0, 0),
        "blue": (0, 0, 200),
        "cyan": (0, 200, 200),
        "green": (0, 200, 0),
        "red": (200, 0, 0),
        "white": (200, 200, 200),
        "yellow": (200, 200, 0),
        "purple": (150, 0, 150),
    }

    STATUS_MAP = {
        "idle": ("solid", "blue"),
        "listening": ("solid", "cyan"),
        "cyan": ("solid", "cyan"),
        "thinking": ("spin", "white"),
        "spinning_white": ("spin", "white"),
        "ok": ("solid", "green"),
        "error": ("solid", "red"),
        "speaking": ("breathe", "purple"),
    }

    @classmethod
    def init(cls) -> None:
        if not _LED_DRIVER_AVAILABLE:
            print("[hardware] apa102_pi not available — LED commands will be logged only.")
            return
        try:
            cls._strip = apa102.APA102(
                num_led=cls.NUM_LEDS,
                global_brightness=cls.BRIGHTNESS,
                order="rgb",
            )
            cls._strip.clear_strip()
        except Exception as exc:  # noqa: BLE001
            print(f"[hardware] APA102 init failed: {exc}")
            cls._strip = None

    @classmethod
    def shutdown(cls) -> None:
        cls._stop_current_animation()
        if cls._strip is not None:
            try:
                cls._strip.clear_strip()
                cls._strip.cleanup()
            except Exception:  # noqa: BLE001
                pass

    @classmethod
    def set_leds(cls, status: Optional[str]) -> None:
        cls._stop_current_animation()
        if not status:
            cls._set_solid("off")
            return
        if status in cls.STATUS_MAP:
            mode, color = cls.STATUS_MAP[status]
        elif status in cls.COLORS:
            mode, color = "solid", status
        else:
            print(f"[hardware] unknown LED status '{status}', defaulting to off")
            mode, color = "solid", "off"

        if mode == "spin":
            cls._start_animation(cls._spin_animation, color)
        elif mode == "breathe":
            cls._start_animation(cls._breathe_animation, color)
        else:
            cls._set_solid(color)

    @classmethod
    def _set_solid(cls, color_name: str) -> None:
        r, g, b = cls.COLORS.get(color_name, (0, 0, 0))
        if cls._strip is None:
            print(f"[led] solid {color_name}")
            return
        with cls._lock:
            for i in range(cls.NUM_LEDS):
                cls._strip.set_pixel(i, r, g, b)
            cls._strip.show()

    @classmethod
    def _spin_animation(cls, color_name: str) -> None:
        r, g, b = cls.COLORS.get(color_name, (200, 200, 200))
        idx = 0
        while not cls._stop_animation.is_set():
            with cls._lock:
                if cls._strip is not None:
                    cls._strip.clear_strip()
                    cls._strip.set_pixel(idx % cls.NUM_LEDS, r, g, b)
                    cls._strip.show()
            idx += 1
            time.sleep(0.18)

    @classmethod
    def _breathe_animation(cls, color_name: str) -> None:
        r, g, b = cls.COLORS.get(color_name, (150, 0, 150))
        step = 0
        while not cls._stop_animation.is_set():
            # Sine-wave brightness between 0.1 and 1.0
            scale = 0.1 + 0.9 * (0.5 + 0.5 * math.sin(step / 8.0))
            with cls._lock:
                if cls._strip is not None:
                    sr, sg, sb = int(r * scale), int(g * scale), int(b * scale)
                    for i in range(cls.NUM_LEDS):
                        cls._strip.set_pixel(i, sr, sg, sb)
                    cls._strip.show()
            step += 1
            time.sleep(0.05)

    @classmethod
    def _start_animation(cls, target, *args) -> None:
        cls._stop_animation.clear()
        thread = threading.Thread(target=target, args=args, daemon=True)
        cls._animation_thread = thread
        thread.start()

    @classmethod
    def _stop_current_animation(cls) -> None:
        if cls._animation_thread and cls._animation_thread.is_alive():
            cls._stop_animation.set()
            cls._animation_thread.join(timeout=0.5)
        cls._animation_thread = None

    @classmethod
    def play_audio(cls, mp3_url: str) -> None:
        """Download an MP3 and play it through the I2S DAC via mpg123."""
        tmp_path: Optional[str] = None
        try:
            with requests.get(
                mp3_url,
                headers=AUTH_HEADERS,
                stream=True,
                timeout=UPLOAD_TIMEOUT_SECONDS,
            ) as resp:
                resp.raise_for_status()
                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                    for chunk in resp.iter_content(chunk_size=4096):
                        if chunk:
                            tmp.write(chunk)
                    tmp_path = tmp.name
            subprocess.run(["mpg123", "-q", tmp_path], check=True)
        except FileNotFoundError:
            print("[hardware] mpg123 not installed — `sudo apt install mpg123`")
        except (requests.RequestException, subprocess.CalledProcessError) as exc:
            print(f"[hardware] audio playback failed: {exc}")
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


# ---------- WebSocket client ------------------------------------------------

class EdgeWebSocket:
    """Receives LED-state and play-summary commands from the orchestrator."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._ws: Optional[websocket.WebSocketApp] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True, name="edge-ws")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:  # noqa: BLE001
                pass

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self._ws = websocket.WebSocketApp(
                    self.url,
                    header=[f"Authorization: Bearer {AUTH0_DEVICE_TOKEN}"],
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                )
                self._ws.run_forever(ping_interval=30, ping_timeout=10)
            except Exception as exc:  # noqa: BLE001
                print(f"[ws] run_forever crashed: {exc}")
            if not self._stop.is_set():
                time.sleep(WS_RECONNECT_DELAY_SECONDS)

    @staticmethod
    def _on_open(_ws) -> None:
        print("[ws] connected")

    @staticmethod
    def _on_message(_ws, message: str) -> None:
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            print(f"[ws] non-JSON message ignored: {message[:120]}")
            return
        action = data.get("action")
        if action == "change_led":
            Hardware.set_leds(data.get("color"))
        elif action == "play_summary":
            url = data.get("url")
            if not url:
                return
            Hardware.set_leds("speaking")
            Hardware.play_audio(url)
            Hardware.set_leds("idle")
        else:
            print(f"[ws] unknown action: {action}")

    @staticmethod
    def _on_error(_ws, error) -> None:
        print(f"[ws] error: {error}")

    @staticmethod
    def _on_close(_ws, status_code, msg) -> None:
        print(f"[ws] closed ({status_code}): {msg}")


# ---------- Audio pipeline --------------------------------------------------

def compute_rms(chunk_bytes: bytes) -> float:
    """RMS amplitude of a 16-bit PCM mono chunk (0 .. ~32767)."""
    sample_count = len(chunk_bytes) // SAMPLE_WIDTH_BYTES
    if sample_count == 0:
        return 0.0
    samples = struct.unpack(f"<{sample_count}h", chunk_bytes)
    mean_square = sum(s * s for s in samples) / sample_count
    return math.sqrt(mean_square)


def frames_to_wav_bytes(frames: List[bytes], sample_rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH_BYTES)
        wf.setframerate(sample_rate)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


def record_with_vad(stream, frame_length: int, sample_rate: int) -> List[bytes]:
    """Read frames until SILENCE_TAIL_SECONDS of quiet or MAX_RECORDING_SECONDS elapsed.

    Returns the captured PCM frames with the trailing silence trimmed off.
    """
    frames: List[bytes] = []
    silence_started_at: Optional[float] = None
    voice_seen = False
    start_time = time.monotonic()
    frame_seconds = frame_length / sample_rate

    while True:
        try:
            chunk = stream.read(frame_length, exception_on_overflow=False)
        except IOError as exc:
            print(f"[audio] read error: {exc}")
            break

        frames.append(chunk)
        rms = compute_rms(chunk)
        elapsed = time.monotonic() - start_time

        if rms >= SILENCE_RMS_THRESHOLD:
            voice_seen = True
            silence_started_at = None
        else:
            if silence_started_at is None:
                silence_started_at = time.monotonic()
            elif voice_seen and (time.monotonic() - silence_started_at) >= SILENCE_TAIL_SECONDS:
                # Trim trailing silence so we don't ship dead air.
                trim_frames = int(SILENCE_TAIL_SECONDS / frame_seconds)
                if len(frames) > trim_frames:
                    frames = frames[:-trim_frames]
                break

        if elapsed >= MAX_RECORDING_SECONDS:
            print("[audio] hit MAX_RECORDING_SECONDS failsafe")
            break

    if not voice_seen:
        print("[audio] no speech detected after wakeword")
        return []
    return frames


def upload_wav(wav_bytes: bytes) -> bool:
    url = f"{ORCHESTRATOR_URL}/api/edge/audio"
    files = {"audio": ("recording.wav", wav_bytes, "audio/wav")}
    headers = dict(AUTH_HEADERS)
    if USER_ID:
        headers["x-user-id"] = USER_ID
    # TODO: orchestrator currently requires `transcript` — needs server-side STT
    # before this end-to-end flow works. Sending empty placeholder for now.
    data = {"transcript": ""}
    try:
        resp = requests.post(
            url,
            headers=headers,
            files=files,
            data=data,
            timeout=UPLOAD_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        print(f"[upload] network error: {exc}")
        Hardware.set_leds("error")
        return False

    if resp.status_code in (200, 202):
        print(f"[upload] orchestrator accepted ({resp.status_code})")
        Hardware.set_leds("ok")
        return True

    print(f"[upload] failed {resp.status_code}: {resp.text[:200]}")
    Hardware.set_leds("error")
    return False


def record_and_send_audio(stream, frame_length: int, sample_rate: int) -> None:
    Hardware.set_leds("listening")
    frames = record_with_vad(stream, frame_length, sample_rate)
    if not frames:
        Hardware.set_leds("idle")
        return

    Hardware.set_leds("thinking")
    wav_bytes = frames_to_wav_bytes(frames, sample_rate)
    upload_wav(wav_bytes)
    time.sleep(1.0)  # let the user see the result LED
    Hardware.set_leds("idle")


# ---------- Wakeword + main loop --------------------------------------------

def build_porcupine() -> pvporcupine.Porcupine:
    if not PORCUPINE_ACCESS_KEY:
        raise RuntimeError(
            "PORCUPINE_ACCESS_KEY env var must be set "
            "(get one at https://console.picovoice.ai)"
        )
    if PORCUPINE_KEYWORD_PATH and os.path.exists(PORCUPINE_KEYWORD_PATH):
        print(f"[wakeword] using custom keyword: {PORCUPINE_KEYWORD_PATH}")
        return pvporcupine.create(
            access_key=PORCUPINE_ACCESS_KEY,
            keyword_paths=[PORCUPINE_KEYWORD_PATH],
        )
    print(f"[wakeword] using built-in keyword: {PORCUPINE_BUILTIN_KEYWORD}")
    return pvporcupine.create(
        access_key=PORCUPINE_ACCESS_KEY,
        keywords=[PORCUPINE_BUILTIN_KEYWORD],
    )


def main() -> None:
    Hardware.init()
    Hardware.set_leds("idle")

    ws_client = EdgeWebSocket(WS_URL)
    ws_client.start()

    porcupine: Optional[pvporcupine.Porcupine] = None
    pa: Optional[pyaudio.PyAudio] = None
    stream = None

    try:
        porcupine = build_porcupine()
        pa = pyaudio.PyAudio()
        stream = pa.open(
            rate=porcupine.sample_rate,
            channels=CHANNELS,
            format=pyaudio.paInt16,
            input=True,
            frames_per_buffer=porcupine.frame_length,
        )
        print(
            f"[main] listening for wakeword "
            f"(rate={porcupine.sample_rate}, frame={porcupine.frame_length})"
        )

        while True:
            try:
                pcm_bytes = stream.read(porcupine.frame_length, exception_on_overflow=False)
            except IOError as exc:
                print(f"[main] stream read error: {exc}")
                time.sleep(0.5)
                continue

            sample_count = len(pcm_bytes) // SAMPLE_WIDTH_BYTES
            pcm = struct.unpack(f"<{sample_count}h", pcm_bytes)

            try:
                result = porcupine.process(pcm)
            except Exception as exc:  # noqa: BLE001
                print(f"[wakeword] process error: {exc}")
                continue

            if result >= 0:
                print("[wakeword] detected")
                record_and_send_audio(stream, porcupine.frame_length, porcupine.sample_rate)

    except KeyboardInterrupt:
        print("\n[main] shutting down")
    except Exception as exc:  # noqa: BLE001
        print(f"[main] fatal: {exc}")
        Hardware.set_leds("error")
    finally:
        if stream is not None:
            try:
                stream.stop_stream()
                stream.close()
            except Exception:  # noqa: BLE001
                pass
        if pa is not None:
            try:
                pa.terminate()
            except Exception:  # noqa: BLE001
                pass
        if porcupine is not None:
            try:
                porcupine.delete()
            except Exception:  # noqa: BLE001
                pass
        ws_client.stop()
        Hardware.shutdown()


if __name__ == "__main__":
    main()

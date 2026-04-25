"""
Punchi — Edge Agent.

Hardware:
  - Raspberry Pi 4 Model B
  - Jabra Speak2 75 (USB) — microphone + speaker
  - Grove LED on GPIO 12

States:
  IDLE            → always-on listen; routes to JOURNAL_ENTRY, READ_JOURNAL, or MAKE_POST
  AWAITING_CONFIRM→ after journal plays; waits for save/discard (30 s timeout → auto-save)

Usage:
  python main.py
"""

from __future__ import annotations

import os
import sys
import time
import datetime
import requests
import speech_recognition as sr
from dotenv import load_dotenv
from urllib.parse import unquote

from utils.jabra import find_jabra, play_mp3_bytes
from utils import led

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:3000")
USER_ID          = os.environ.get("PUNCHI_USER_ID", "")
HEADERS          = {"x-user-id": USER_ID}

WAKEWORDS     = ("punchi", "punchy", "punky", "punch", "punchie", "punche", "ponchi", "ponchy")
READ_TRIGGERS = ("read me my journal", "read my journal", "read journal",
                 "what's my journal", "whats my journal", "play my journal", "play journal")
POST_TRIGGERS = ("make a post", "make post", "post it", "post this")
SAVE_CONFIRMS = ("save", "post", "yes", "yep", "yeah", "do it", "confirm", "publish", "go ahead")
DISCARD_WORDS = ("no", "nope", "cancel", "discard", "delete", "don't", "dont", "stop")

LISTEN_TIMEOUT      = 5      # seconds to wait for speech to start
PHRASE_TIME_LIMIT   = 15     # max seconds per utterance
AMBIENT_CALIBRATE_S = 1.0    # ambient noise calibration on startup
CONFIRM_TIMEOUT_S   = 30.0   # auto-save after this many seconds of silence in AWAITING_CONFIRM


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _contains(text: str, triggers: tuple[str, ...]) -> bool:
    t = text.lower()
    return any(w in t for w in triggers)


def today() -> str:
    return datetime.date.today().isoformat()


# ---------------------------------------------------------------------------
# Backend calls
# ---------------------------------------------------------------------------

def speak(text: str, alsa_hw: str) -> None:
    """Convert text to speech via ElevenLabs and play it immediately."""
    try:
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/api/orchestrate/tts",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"text": text},
            timeout=15,
        )
        if resp.ok:
            play_mp3_bytes(resp.content, alsa_hw)
    except Exception as e:
        print(f"[tts] {e}")


def ingest_raw(wav_bytes: bytes, transcript: str) -> None:
    """Send an audio fragment + transcript to the orchestrator for storage."""
    try:
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/api/edge/audio",
            headers=HEADERS,
            files={"audio": ("recording.wav", wav_bytes, "audio/wav")},
            data={"transcript": transcript},
            timeout=30,
        )
        if resp.ok:
            print(f"[agent] stored — {resp.json().get('summary', {}).get('summary', '')[:60]}")
        else:
            print(f"[agent] edge/audio error {resp.status_code}: {resp.text[:120]}")
    except requests.RequestException as e:
        print(f"[agent] edge/audio request failed: {e}")


def fetch_preview(alsa_hw: str) -> str | None:
    """
    Synthesize today's journal narrative, store as draft (IS_READY=FALSE),
    play the audio, and return the narrative text.
    Returns None on error.
    """
    isodate = today()
    print(f"[agent] fetching journal preview for {isodate}…")
    led.set_state("thinking")
    speak("One moment.", alsa_hw)
    try:
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/api/orchestrate/preview",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"date": isodate},
            timeout=60,
        )
        if not resp.ok:
            print(f"[agent] preview error {resp.status_code}: {resp.text[:120]}")
            led.set_state("error")
            if resp.status_code == 404:
                speak("I don't have any entries for today yet.", alsa_hw)
            else:
                speak("Something went wrong. Try again in a moment.", alsa_hw)
            led.set_state("idle")
            return None

        narrative = unquote(resp.headers.get("X-Punchi-Narrative", ""))
        led.set_state("speaking")
        play_mp3_bytes(resp.content, alsa_hw)
        return narrative

    except requests.RequestException as e:
        print(f"[agent] preview request failed: {e}")
        led.set_state("error")
        speak("Can't reach the server right now.", alsa_hw)
        led.set_state("idle")
        return None


def do_publish(alsa_hw: str) -> None:
    """Flip IS_READY=TRUE on today's draft and play the ElevenLabs confirmation."""
    isodate = today()
    led.set_state("thinking")
    try:
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/api/orchestrate/publish",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"date": isodate},
            timeout=30,
        )
        if not resp.ok:
            print(f"[agent] publish error {resp.status_code}: {resp.text[:120]}")
            led.set_state("error")
            time.sleep(2)
        else:
            led.set_state("saving")
            play_mp3_bytes(resp.content, alsa_hw)
            time.sleep(1.5)
    except requests.RequestException as e:
        print(f"[agent] publish request failed: {e}")
        led.set_state("error")
        time.sleep(2)
    finally:
        led.set_state("idle")


def do_discard(alsa_hw: str) -> None:
    """Acknowledge discard verbally. Draft stays in DB as IS_READY=FALSE."""
    led.set_state("speaking")
    speak("Got it. I won't post that.", alsa_hw)
    led.set_state("idle")


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

STATE_IDLE    = "idle"
STATE_CONFIRM = "awaiting_confirm"


def run(devices) -> None:
    recognizer = sr.Recognizer()
    mic = sr.Microphone(device_index=devices.input_index, sample_rate=32000)

    print("[agent] calibrating ambient noise…")
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=AMBIENT_CALIBRATE_S)
    print(f"[agent] energy threshold: {recognizer.energy_threshold:.1f}")

    led.set_state("idle")
    print(f"[agent] listening for wakeword {WAKEWORDS} — Ctrl+C to quit\n")

    state            = STATE_IDLE
    confirm_deadline = 0.0

    while True:
        try:
            # ----------------------------------------------------------------
            # AWAITING_CONFIRM — journal was just played; wait for save/discard
            # ----------------------------------------------------------------
            if state == STATE_CONFIRM:
                remaining = confirm_deadline - time.monotonic()
                if remaining <= 0:
                    print("[agent] confirm timeout — auto-saving journal.")
                    do_publish(devices.alsa_hw)
                    state = STATE_IDLE
                    continue

                with mic as source:
                    try:
                        audio = recognizer.listen(
                            source,
                            timeout=min(remaining, LISTEN_TIMEOUT),
                            phrase_time_limit=PHRASE_TIME_LIMIT,
                        )
                    except sr.WaitTimeoutError:
                        continue

                try:
                    transcript = recognizer.recognize_google(audio)
                except (sr.UnknownValueError, sr.RequestError):
                    continue

                print(f"[confirm] heard: {transcript!r}")

                if _contains(transcript, SAVE_CONFIRMS):
                    print("[agent] saving journal…")
                    do_publish(devices.alsa_hw)
                    state = STATE_IDLE
                elif _contains(transcript, DISCARD_WORDS):
                    print("[agent] discarding (draft kept, IS_READY=FALSE).")
                    do_discard(devices.alsa_hw)
                    state = STATE_IDLE

                continue  # unrecognised utterance → keep waiting

            # ----------------------------------------------------------------
            # IDLE — always-on listen
            # ----------------------------------------------------------------
            with mic as source:
                try:
                    audio = recognizer.listen(
                        source,
                        timeout=LISTEN_TIMEOUT,
                        phrase_time_limit=PHRASE_TIME_LIMIT,
                    )
                except sr.WaitTimeoutError:
                    continue

            try:
                transcript = recognizer.recognize_google(audio)
            except sr.UnknownValueError:
                continue
            except sr.RequestError as e:
                print(f"[stt] request error: {e}")
                continue

            print(f"[stt] heard: {transcript!r}")

            has_wakeword = _contains(transcript, WAKEWORDS)
            has_read     = _contains(transcript, READ_TRIGGERS)

            # "read my journal" works without the wakeword prefix
            if not has_wakeword and not has_read:
                continue

            print("[agent] wakeword detected!")
            led.set_state("listening")

            if has_read:
                narrative = fetch_preview(devices.alsa_hw)
                if narrative:
                    print(f"[agent] journal played — waiting {CONFIRM_TIMEOUT_S}s for save/discard…")
                    state            = STATE_CONFIRM
                    confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
                else:
                    led.set_state("idle")

            elif _contains(transcript, POST_TRIGGERS):
                # Shortcut: preview + immediate publish (no confirm step)
                narrative = fetch_preview(devices.alsa_hw)
                if narrative:
                    do_publish(devices.alsa_hw)
                else:
                    led.set_state("idle")

            else:
                # Regular journal fragment — strip wakeword and ingest
                stripped = transcript.lower()
                for w in WAKEWORDS:
                    stripped = stripped.replace(w, "").strip(" .,!?")
                if len(stripped) < 5:
                    print("[agent] ignoring bare wakeword with no content.")
                    led.set_state("idle")
                else:
                    led.set_state("thinking")
                    ingest_raw(audio.get_wav_data(), transcript)
                    led.set_state("idle")

        except KeyboardInterrupt:
            print("\n[agent] shutting down.")
            break
        except Exception as e:
            print(f"[agent] unexpected error: {e}")
            led.set_state("error")
            time.sleep(2)
            led.set_state("idle")
            state = STATE_IDLE

    led.cleanup()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    if not USER_ID:
        sys.exit("[agent] PUNCHI_USER_ID env var is required.")
    devices = find_jabra()
    print(f"[agent] Jabra found — input {devices.input_index}, output {devices.alsa_hw}")
    run(devices)


if __name__ == "__main__":
    main()

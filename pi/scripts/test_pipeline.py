"""
End-to-end pipeline test.

STUB_MODE=True  → skips recording + Gemma, uses hardcoded values.
STUB_MODE=False → full live run (recording, STT, Gemma, Snowflake, ElevenLabs).

Run from the pi/ directory:
    python scripts/test_pipeline.py

Env vars (or .env):
    ORCHESTRATOR_URL   default: http://localhost:3000
    PUNCHI_USER_ID     default: test-user
"""

import os
import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:3000")
USER_ID          = os.environ.get("PUNCHI_USER_ID", "test-user")
TODAY            = datetime.date.today().isoformat()
HEADERS          = {"x-user-id": USER_ID}

# ---------------------------------------------------------------------------
# Toggle this to skip recording + Gemma API calls
# ---------------------------------------------------------------------------
STUB_MODE = False

STUB_TRANSCRIPT = (
    "Today was a really good day. I woke up early, went for a walk in the park, "
    "had a great lunch with a friend, and finished a project I've been working on. "
    "Feeling grateful and looking forward to tomorrow."
)

STUB_GEMMA_SUMMARY = {
    "summary": "A fulfilling day with a morning walk, lunch with a friend, and completing a project.",
    "themes": ["Productivity", "Gratitude", "Social Connection"],
    "highlights": ["Morning walk in the park", "Lunch with a friend", "Finished a project"]
}


# ---------------------------------------------------------------------------
# Step 1+2 — record + transcribe  (or stub)
# ---------------------------------------------------------------------------

def get_transcript() -> tuple[bytes, str, str]:
    if STUB_MODE:
        print("[1/4] STUB — skipping recording, using hardcoded transcript.")
        print(f"      Transcript: {STUB_TRANSCRIPT!r}")
        import io
        import wave
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(32000)
            wf.writeframes(b"")
        return buf.getvalue(), STUB_TRANSCRIPT, "hw:0,0"

    import speech_recognition as sr
    from utils.jabra import find_jabra
    devices = find_jabra()
    recognizer = sr.Recognizer()
    print(f"[1/4] Recording from device {devices.input_index} — speak now…")
    with sr.Microphone(device_index=devices.input_index, sample_rate=32000) as source:
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        audio = recognizer.listen(source, timeout=10, phrase_time_limit=15)
    wav_bytes = audio.get_wav_data()
    print(f"      Captured {len(wav_bytes):,} bytes.")
    print("[2/4] Transcribing…")
    transcript = recognizer.recognize_google(audio)
    print(f"      Transcript: {transcript!r}")
    return wav_bytes, transcript, devices.alsa_hw


# ---------------------------------------------------------------------------
# Step 3 — ingest audio + transcript → Snowflake
# ---------------------------------------------------------------------------

def ingest(wav_bytes: bytes, transcript: str) -> None:
    if STUB_MODE:
        print("[3/4] STUB — writing pre-baked summary to Snowflake via /debug/ingest…")
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/api/debug/ingest",
            headers={**HEADERS, "Content-Type": "application/json"},
            json={"transcript": transcript, "summary": STUB_GEMMA_SUMMARY},
            timeout=30,
        )
        if not resp.ok:
            print(f"      ✗ debug/ingest failed {resp.status_code}: {resp.text[:300]}")
            return
        print(f"      ✓ stored.")
        return

    print("[3/4] Sending to /api/edge/audio…")
    resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/edge/audio",
        headers=HEADERS,
        files={"audio": ("recording.wav", wav_bytes, "audio/wav")},
        data={"transcript": transcript},
        timeout=30,
    )
    if not resp.ok:
        print(f"      ✗ edge/audio failed {resp.status_code}: {resp.text[:300]}")
        return
    print(f"      ✓ stored. Gemma summary: {resp.json().get('summary', {})}")


# ---------------------------------------------------------------------------
# Step 4 — orchestrate/preview → ElevenLabs MP3
# ---------------------------------------------------------------------------

def get_audio() -> bytes:
    print("[4/4] Requesting journal narrative…")
    resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/orchestrate/preview",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"date": TODAY},
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f"orchestrate/preview failed {resp.status_code}: {resp.text[:300]}")
    from urllib.parse import unquote
    narrative = unquote(resp.headers.get("X-Punchi-Narrative", ""))
    if narrative:
        print(f"      Narrative: {narrative[:120]}…")
    print(f"      Received {len(resp.content):,} bytes of audio.")
    return resp.content


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    wav_bytes, transcript, alsa_hw = get_transcript()
    ingest(wav_bytes, transcript)
    mp3_bytes = get_audio()

    print("\n[▶] Playing through Jabra…")
    from utils.jabra import find_jabra, play_mp3_bytes
    devices = find_jabra()
    play_mp3_bytes(mp3_bytes, devices.alsa_hw)
    print("[✓] Done.")


if __name__ == "__main__":
    main()

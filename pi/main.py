"""
Stampi — Edge Voice Agent

Hardware:
  - Raspberry Pi 4 Model B (or Windows dev machine)
  - Jabra Speak2 75 (USB) — microphone + speaker
  - Grove LED on GPIO 12

Flow:
  1. Dormant: listen for wakeword ("stampy")
  2. Wakeword heard → listen for the NEXT full utterance (the actual command)
  3. Classify command via Gemma → execute intent
  4. Return to dormant

STT: Uses faster-whisper (local Whisper model) for high-quality transcription.
     Falls back to Google free STT if Whisper is unavailable.

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
from dataclasses import dataclass
from typing import Optional

import threading
from utils.jabra import find_jabra, play_mp3_bytes, stop_playback
from utils.stt import transcribe
from utils import led

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:3000")
USER_ID          = os.environ.get("PUNCHI_USER_ID", "")
HEADERS          = {"x-user-id": USER_ID}

# Wakewords — checked with word-boundary logic, not substring
WAKEWORDS = {"stampi", "stampy", "stampie", "stamp", "stumpy", "stompy", "stampe"}

# These are full-phrase triggers that can ALSO activate from dormant
READ_PHRASES  = ("read me my journal", "read my journal", "read journal",
                 "what's my journal", "whats my journal", "play my journal", "play journal")
CLEAR_PHRASES = ("clear my journal", "clear journal", "delete my journal", "reset my journal",
                 "delete all", "delete everything", "wipe my journal", "wipe everything",
                 "clear everything", "start over", "reset everything")

CONFIRM_YES = {"save", "post", "yes", "yep", "yeah", "confirm", "publish", "ahead", "sure", "do", "okay", "ok"}
CONFIRM_NO  = {"no", "nope", "cancel", "don't", "stop", "never"}

LISTEN_TIMEOUT      = 5
PHRASE_TIME_LIMIT   = 30
AMBIENT_CALIBRATE_S = 2.0
CONFIRM_TIMEOUT_S   = 30.0
COMMAND_LISTEN_TIMEOUT = 8


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PendingConfirmation:
  intent: str
  content: str
  iso_date: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _has_wakeword(text: str) -> bool:
  """Check if any wakeword appears as a word (not substring) in text."""
  words = set(text.lower().replace(",", " ").replace(".", " ").replace("'", " ").split())
  return bool(words & WAKEWORDS)


def _has_read(text: str) -> bool:
  t = text.lower()
  return any(p in t for p in READ_PHRASES)


def _has_clear(text: str) -> bool:
  t = text.lower()
  return any(p in t for p in CLEAR_PHRASES)


def _strip_wakeword(transcript: str) -> str:
  """Remove wakeword and common prefixes, return the cleaned command text."""
  t = transcript.strip()
  words = t.split()
  cleaned = []
  found_wake = False

  for w in words:
    w_lower = w.lower().rstrip(",.!?'")
    if not found_wake and w_lower in ("hey", "hi", "ok", "okay", "yo", "a"):
      continue
    if not found_wake and w_lower in WAKEWORDS:
      found_wake = True
      continue
    cleaned.append(w)

  result = " ".join(cleaned).strip().lstrip(",.!? ")
  return result if result else transcript.strip()


def today() -> str:
  return datetime.date.today().isoformat()


def log(tag: str, msg: str) -> None:
  ts = datetime.datetime.now().strftime("%H:%M:%S")
  print(f"[{ts}] [{tag}] {msg}")


# ---------------------------------------------------------------------------
# Audio capture (mic → sr.AudioData)
# ---------------------------------------------------------------------------

def _capture_audio(recognizer: sr.Recognizer, mic: sr.Microphone,
                   timeout: float = LISTEN_TIMEOUT,
                   phrase_limit: float = PHRASE_TIME_LIMIT) -> sr.AudioData | None:
  """Capture one utterance from mic. Returns AudioData or None on timeout."""
  with mic as source:
    try:
      return recognizer.listen(source, timeout=timeout, phrase_time_limit=phrase_limit)
    except sr.WaitTimeoutError:
      return None


def listen_once(recognizer: sr.Recognizer, mic: sr.Microphone,
                timeout: float = LISTEN_TIMEOUT,
                phrase_limit: float = PHRASE_TIME_LIMIT) -> str | None:
  """Capture + transcribe one utterance. Returns transcript or None."""
  audio = _capture_audio(recognizer, mic, timeout, phrase_limit)
  if audio is None:
    return None
  return transcribe(audio)


# ---------------------------------------------------------------------------
# Backend calls
# ---------------------------------------------------------------------------

def tts_speak(text: str, alsa_hw: str) -> None:
  log("tts", f"speaking: {text!r}")
  try:
    resp = requests.post(
      f"{ORCHESTRATOR_URL}/api/orchestrate/tts",
      headers={**HEADERS, "Content-Type": "application/json"},
      json={"text": text},
      timeout=15,
    )
    if resp.ok:
      play_mp3_bytes(resp.content, alsa_hw)
    else:
      log("tts", f"ERROR {resp.status_code}: {resp.text[:80]}")
  except Exception as e:
    log("tts", f"ERROR: {e}")


def classify_command(transcript: str, context: list[str]) -> Optional[dict]:
  log("api", f"classifying: {transcript!r}")
  log("api", f"  context: {context}")
  try:
    resp = requests.post(
      f"{ORCHESTRATOR_URL}/api/orchestrate/command",
      headers={**HEADERS, "Content-Type": "application/json"},
      json={"transcript": transcript, "context": context},
      timeout=30,
    )
    if not resp.ok:
      log("api", f"ERROR {resp.status_code}: {resp.text[:120]}")
      return None

    intent = resp.headers.get("X-Punchi-Intent", "unknown")
    needs_confirm = resp.headers.get("X-Punchi-Needs-Confirm", "false").lower() == "true"
    content = unquote(resp.headers.get("X-Punchi-Content", ""))

    log("api", f"RESULT: intent={intent}, needs_confirm={needs_confirm}, content={content!r}")
    return {
      "intent": intent,
      "content": content,
      "audio": resp.content,
      "needs_confirm": needs_confirm,
    }
  except requests.RequestException as e:
    log("api", f"REQUEST FAILED: {e}")
    return None


def fetch_journal_preview(alsa_hw: str) -> tuple[str, bytes] | tuple[None, None]:
  isodate = today()
  log("journal", f"fetching preview for {isodate}")
  try:
    resp = requests.post(
      f"{ORCHESTRATOR_URL}/api/orchestrate/preview",
      headers={**HEADERS, "Content-Type": "application/json"},
      json={"date": isodate},
      timeout=60,
    )
    if resp.status_code == 404:
      log("journal", "no entries for today")
      tts_speak("You don't have any journal entries for today yet.", alsa_hw)
      return None, None
    if not resp.ok:
      log("journal", f"ERROR {resp.status_code}: {resp.text[:120]}")
      tts_speak("Something went wrong fetching your journal.", alsa_hw)
      return None, None

    narrative = unquote(resp.headers.get("X-Punchi-Narrative", ""))
    log("journal", f"narrative ({len(narrative)} chars): {narrative[:100]}...")
    return narrative, resp.content

  except requests.RequestException as e:
    log("journal", f"REQUEST FAILED: {e}")
    tts_speak("Can't reach the server right now.", alsa_hw)
    return None, None


def execute_confirmation(pending: PendingConfirmation, alsa_hw: str) -> None:
  isodate = pending.iso_date
  log("exec", f"executing: {pending.intent} content={pending.content!r}")

  try:
    if pending.intent == "save_draft":
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/orchestrate/publish",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"date": isodate}, timeout=30,
      )
      if resp.ok:
        tts_speak("Done! Your journal has been saved.", alsa_hw)
      else:
        tts_speak("Sorry, something went wrong saving. Try again.", alsa_hw)

    elif pending.intent == "delete_latest":
      resp = requests.delete(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/latest",
        headers=HEADERS, timeout=15,
      )
      tts_speak("Done, I deleted your last entry." if resp.ok else "Sorry, couldn't delete that.", alsa_hw)

    elif pending.intent == "clear_all":
      resp = requests.delete(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}",
        headers=HEADERS, timeout=15,
      )
      if resp.ok:
        count = resp.json().get("deleted", 0)
        tts_speak("Your journal is already empty." if count == 0
                  else f"Done, I cleared {count} {'entry' if count == 1 else 'entries'}.", alsa_hw)
      else:
        tts_speak("Sorry, something went wrong.", alsa_hw)

    elif pending.intent == "delete_count":
      try:
        count = int(pending.content)
      except (ValueError, TypeError):
        tts_speak("Sorry, I didn't understand the number.", alsa_hw)
        return
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/delete-count",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"count": count}, timeout=15,
      )
      if resp.ok:
        deleted = resp.json().get("deleted", 0)
        tts_speak(f"Done, deleted {deleted} {'entry' if deleted == 1 else 'entries'}.", alsa_hw)
      else:
        tts_speak("Sorry, something went wrong.", alsa_hw)

    elif pending.intent == "delete_match":
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/delete-match",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"query": pending.content}, timeout=15,
      )
      if resp.ok:
        deleted = resp.json().get("deleted", 0)
        tts_speak("I couldn't find any matching entries." if deleted == 0
                  else f"Done, deleted {deleted} matching {'entry' if deleted == 1 else 'entries'}.", alsa_hw)
      else:
        tts_speak("Sorry, something went wrong.", alsa_hw)

  except requests.RequestException as e:
    log("exec", f"REQUEST FAILED: {e}")
    tts_speak("Can't reach the server right now.", alsa_hw)


# ---------------------------------------------------------------------------
# Interruptible playback
# ---------------------------------------------------------------------------

def play_interruptible(mp3_bytes: bytes, alsa_hw: str,
                       recognizer: sr.Recognizer, mic: sr.Microphone) -> str | None:
  """
  Play audio in background while listening for wakeword interrupt.
  Returns interrupt transcript if user says "Stampy ...", else None.
  """
  done = threading.Event()

  def _bg_play():
    play_mp3_bytes(mp3_bytes, alsa_hw)
    done.set()

  threading.Thread(target=_bg_play, daemon=True).start()

  while not done.is_set():
    audio = _capture_audio(recognizer, mic, timeout=1, phrase_limit=6)
    if audio is None:
      continue
    transcript = transcribe(audio)
    if transcript is None:
      continue

    if _has_wakeword(transcript):
      log("interrupt", f"wakeword during playback: {transcript!r}")
      stop_playback()
      done.wait(timeout=1)
      return transcript

  return None


# ---------------------------------------------------------------------------
# Process classified result (shared by normal + interrupt paths)
# ---------------------------------------------------------------------------

def _process_result(result: dict, clean: str, message_cache: list[str],
                    alsa_hw: str) -> Optional[PendingConfirmation]:
  """
  Handle a Gemma classification result.
  Returns PendingConfirmation if confirmation is needed, else None.
  """
  intent = result["intent"]
  content = result["content"]
  audio = result["audio"]
  needs_confirm = result["needs_confirm"]

  log("process", f"intent={intent}, needs_confirm={needs_confirm}")

  if intent == "ignore":
    log("process", "ignoring — not directed at Stampy")
    led.set_state("idle")
    return None

  elif intent == "read_journal":
    log("process", "Gemma says read_journal — fetching...")
    tts_speak("One moment, pulling up your journal.", alsa_hw)
    narrative, mp3_bytes = fetch_journal_preview(alsa_hw)
    if narrative and mp3_bytes:
      led.set_state("speaking")
      play_mp3_bytes(mp3_bytes, alsa_hw)
      tts_speak("Would you like me to save this to your account?", alsa_hw)
      return PendingConfirmation(intent="save_draft", content=narrative, iso_date=today())
    led.set_state("idle")
    return None

  elif needs_confirm:
    log("process", f"needs confirmation for {intent}")
    message_cache.append(clean)
    if len(message_cache) > 8:
      message_cache.pop(0)
    led.set_state("speaking")
    play_mp3_bytes(audio, alsa_hw)
    return PendingConfirmation(intent=intent, content=content, iso_date=today())

  elif intent == "journal_entry":
    log("process", f"journal entry saved! content: {content[:80]!r}")
    message_cache.append(clean)
    if len(message_cache) > 8:
      message_cache.pop(0)
    led.set_state("speaking")
    play_mp3_bytes(audio, alsa_hw)
    led.set_state("idle")
    return None

  else:
    log("process", f"other intent: {intent}")
    led.set_state("speaking")
    play_mp3_bytes(audio, alsa_hw)
    led.set_state("idle")
    return None


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run(devices) -> None:
  recognizer = sr.Recognizer()
  mic = sr.Microphone(device_index=devices.input_index, sample_rate=16000)

  # STT tuning — optimized for Whisper's 16kHz input
  recognizer.pause_threshold = 1.2
  recognizer.phrase_threshold = 0.2
  recognizer.non_speaking_duration = 0.6
  recognizer.dynamic_energy_threshold = True
  recognizer.dynamic_energy_adjustment_damping = 0.1
  recognizer.dynamic_energy_ratio = 1.3

  log("init", "calibrating ambient noise...")
  with mic as source:
    recognizer.adjust_for_ambient_noise(source, duration=AMBIENT_CALIBRATE_S)
  log("init", f"energy threshold: {recognizer.energy_threshold:.1f}")

  # Pre-load Whisper model so first command isn't slow
  log("init", "pre-loading STT model...")
  from utils.stt import _load_whisper
  _load_whisper()

  led.set_state("idle")
  log("init", f"wakewords: {WAKEWORDS}")
  log("init", "say 'Stampy' followed by your command. Ctrl+C to quit.\n")

  message_cache: list[str] = []
  pending: Optional[PendingConfirmation] = None
  confirm_deadline = 0.0

  while True:
    try:
      # ==================================================================
      # STATE: AWAITING CONFIRMATION
      # ==================================================================
      if pending:
        remaining = confirm_deadline - time.monotonic()
        if remaining <= 0:
          log("confirm", "timeout — cancelling")
          tts_speak("Okay, never mind.", devices.alsa_hw)
          led.set_state("idle")
          pending = None
          continue

        led.set_state("listening")
        transcript = listen_once(recognizer, mic, timeout=min(remaining, LISTEN_TIMEOUT))
        if not transcript:
          continue

        log("confirm", f"heard: {transcript!r}")
        words = set(transcript.lower().split())

        if words & CONFIRM_NO:
          log("confirm", "USER SAID NO")
          tts_speak("Got it, cancelled.", devices.alsa_hw)
          led.set_state("idle")
          pending = None
        elif words & CONFIRM_YES:
          log("confirm", "USER SAID YES")
          led.set_state("thinking")
          execute_confirmation(pending, devices.alsa_hw)
          led.set_state("idle")
          pending = None
        else:
          log("confirm", f"unclear: {transcript!r} — reprompting")
          tts_speak("Say yes to confirm, or no to cancel.", devices.alsa_hw)
        continue

      # ==================================================================
      # STATE: DORMANT — waiting for wakeword
      # ==================================================================
      led.set_state("idle")
      transcript = listen_once(recognizer, mic)
      if not transcript:
        continue

      has_wake  = _has_wakeword(transcript)
      has_read  = _has_read(transcript)
      has_clear = _has_clear(transcript)

      if not has_wake and not has_read and not has_clear:
        log("dormant", f"ignored: {transcript!r}")
        continue

      log("wake", f"{'='*50}")
      log("wake", f"ACTIVATED — raw: {transcript!r}")
      led.set_state("thinking")

      clean = _strip_wakeword(transcript)
      log("wake", f"cleaned: {clean!r}")

      # If user ONLY said the wakeword, listen for their actual command
      if len(clean) < 4 and not has_read and not has_clear:
        log("wake", "wakeword only — waiting for command...")
        led.set_state("listening")
        tts_speak("I'm listening.", devices.alsa_hw)
        cmd_transcript = listen_once(recognizer, mic, timeout=COMMAND_LISTEN_TIMEOUT)
        if not cmd_transcript:
          log("wake", "silence — going dormant")
          led.set_state("idle")
          continue
        log("wake", f"command: {cmd_transcript!r}")
        clean = _strip_wakeword(cmd_transcript)
        has_read  = _has_read(cmd_transcript)
        has_clear = _has_clear(cmd_transcript)
        led.set_state("thinking")

      # ================================================================
      # READ JOURNAL (interruptible)
      # ================================================================
      if has_read:
        log("intent", ">>> READ JOURNAL")
        tts_speak("One moment, pulling up your journal.", devices.alsa_hw)
        narrative, mp3_bytes = fetch_journal_preview(devices.alsa_hw)
        if narrative and mp3_bytes:
          log("intent", "playing narrative (say 'Stampy' to interrupt)...")
          led.set_state("speaking")
          interrupt = play_interruptible(mp3_bytes, devices.alsa_hw, recognizer, mic)
          if interrupt:
            log("interrupt", f"interrupted: {interrupt!r}")
            i_clean = _strip_wakeword(interrupt)
            if _has_clear(interrupt):
              tts_speak("Are you sure you want to clear all entries? Say yes or no.", devices.alsa_hw)
              pending = PendingConfirmation(intent="clear_all", content="", iso_date=today())
              confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
            elif _has_read(interrupt):
              log("interrupt", "re-read — skipping")
              led.set_state("idle")
            elif len(i_clean) >= 4:
              log("interrupt", f"classifying: {i_clean!r}")
              led.set_state("thinking")
              result = classify_command(i_clean, message_cache)
              if result:
                pending = _process_result(result, i_clean, message_cache, devices.alsa_hw)
                if pending:
                  confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
              else:
                led.set_state("idle")
            else:
              led.set_state("idle")
          else:
            log("intent", "playback done — offering save")
            tts_speak("Would you like me to save this to your account?", devices.alsa_hw)
            pending = PendingConfirmation(intent="save_draft", content=narrative, iso_date=today())
            confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
        else:
          led.set_state("idle")

      # ================================================================
      # CLEAR ALL
      # ================================================================
      elif has_clear:
        log("intent", ">>> CLEAR ALL")
        tts_speak("Are you sure you want to clear all entries? Say yes or no.", devices.alsa_hw)
        pending = PendingConfirmation(intent="clear_all", content="", iso_date=today())
        confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S

      # ================================================================
      # GEMMA CLASSIFICATION
      # ================================================================
      else:
        log("intent", f">>> CLASSIFYING: {clean!r}")
        result = classify_command(clean, message_cache)
        if not result:
          tts_speak("Something went wrong. Try again.", devices.alsa_hw)
          led.set_state("idle")
          continue
        pending = _process_result(result, clean, message_cache, devices.alsa_hw)
        if pending:
          confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S

    except KeyboardInterrupt:
      print()
      log("agent", "shutting down.")
      break
    except Exception as e:
      log("error", f"unexpected: {e}")
      import traceback
      traceback.print_exc()
      led.set_state("idle")
      time.sleep(1)

  led.cleanup()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
  if not USER_ID:
    sys.exit("[agent] PUNCHI_USER_ID env var is required. Set it in .env")
  log("init", f"user_id={USER_ID}")
  log("init", f"orchestrator={ORCHESTRATOR_URL}")
  devices = find_jabra()
  log("init", f"Jabra: input={devices.input_index}, output={devices.alsa_hw}")
  run(devices)


if __name__ == "__main__":
  main()

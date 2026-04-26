"""
Punchi — Edge Agent (Simplified two-state architecture).

Hardware:
  - Raspberry Pi 4 Model B
  - Jabra Speak2 75 (USB) — microphone + speaker
  - Grove LED on GPIO 12

States:
  LISTENING       → mic open, waiting for wakeword or read/clear triggers
  RESPONDING      → playing audio response, may await user confirmation for destructive actions

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
from utils import led

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:3000")
USER_ID          = os.environ.get("PUNCHI_USER_ID", "")
HEADERS          = {"x-user-id": USER_ID}

WAKEWORDS     = ("stampi", "stampy", "stampie", "stamp")
READ_TRIGGERS  = ("read me my journal", "read my journal", "read journal",
                  "what's my journal", "whats my journal", "play my journal", "play journal")
CLEAR_TRIGGERS = ("clear my journal", "clear journal", "delete my journal", "reset my journal",
                  "delete all", "delete everything", "wipe my journal", "wipe everything",
                  "clear everything", "start over", "reset everything")
SAVE_CONFIRMS = {"save", "post", "yes", "yep", "yeah", "confirm", "publish", "ahead", "sure", "do"}
DISCARD_WORDS = {"no", "nope", "cancel", "discard", "delete", "stop", "clear", "remove", "wipe"}

LISTEN_TIMEOUT      = 5      # seconds to wait for speech to start
PHRASE_TIME_LIMIT   = 30     # max seconds per utterance
AMBIENT_CALIBRATE_S = 2.0    # ambient noise calibration on startup (longer = better baseline)
CONFIRM_TIMEOUT_S   = 30.0   # auto-save/cancel after this many seconds of silence


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PendingConfirmation:
  """Tracks a confirmation request awaiting user response."""
  intent: str            # 'delete_latest', 'clear_all', 'delete_count', 'delete_match'
  content: str           # count as string, query string, or empty
  iso_date: str
  response_text: str     # the Gemma response to play


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

def _strip_wakeword(transcript: str) -> str:
  """Remove any wakeword from transcript (handles "hey stampy" or "stampy" anywhere early)."""
  t = transcript.lower().strip()
  # First, remove common speech prefixes
  for prefix in ("hey", "hi", "ok", "okay"):
    if t.startswith(prefix + " "):
      t = t[len(prefix):].strip()
      break
  # Then remove the actual wakeword
  for w in WAKEWORDS:
    if t.startswith(w):
      t = t[len(w):].lstrip(" ,'")
      break
  return t


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


def _play_interruptible(mp3_bytes: bytes, alsa_hw: str, recognizer: sr.Recognizer, mic: sr.Microphone) -> str | None:
  """
  Play audio in a background thread while listening for a wakeword interrupt.
  Returns the interrupt transcript if Stampy is called, else None.
  """
  done = threading.Event()

  def _play():
    play_mp3_bytes(mp3_bytes, alsa_hw)
    done.set()

  threading.Thread(target=_play, daemon=True).start()

  while not done.is_set():
    with mic as source:
      try:
        audio = recognizer.listen(source, timeout=1, phrase_time_limit=5)
      except sr.WaitTimeoutError:
        continue
    try:
      transcript = recognizer.recognize_google(audio, language="en-US")
    except (sr.UnknownValueError, sr.RequestError):
      continue
    if _contains(transcript, WAKEWORDS):
      print(f"[interrupt] wakeword heard during playback: {transcript!r}")
      stop_playback()
      done.wait(timeout=1)
      return transcript

  return None


def classify_and_execute(transcript: str, context_cache: list[str] | None = None) -> Optional[tuple[str, bytes, bool]]:
  """
  Call /orchestrate/command to classify intent and execute non-destructive actions.
  Returns (narrative, audio_bytes, needs_confirmation) or None on error.
  """
  try:
    resp = requests.post(
      f"{ORCHESTRATOR_URL}/api/orchestrate/command",
      headers={**HEADERS, "Content-Type": "application/json"},
      json={"transcript": transcript, "context": context_cache or []},
      timeout=30,
    )
    if not resp.ok:
      print(f"[command] error {resp.status_code}: {resp.text[:120]}")
      return None

    intent = resp.headers.get("X-Punchi-Intent", "unknown")
    needs_confirm = resp.headers.get("X-Punchi-Needs-Confirm", "false").lower() == "true"
    content = unquote(resp.headers.get("X-Punchi-Content", ""))

    print(f"[command] intent={intent}, needs_confirm={needs_confirm}, content={content!r}")
    return (intent, content, resp.content, needs_confirm)
  except requests.RequestException as e:
    print(f"[command] request failed: {e}")
    return None


def read_journal(alsa_hw: str) -> tuple[str, bytes] | tuple[None, None]:
  """
  Synthesize today's journal narrative and return (narrative_text, mp3_bytes).
  Does NOT play audio — caller handles playback so it can support interrupts.
  Returns (None, None) on error.
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
      return None, None

    narrative = unquote(resp.headers.get("X-Punchi-Narrative", ""))
    return narrative, resp.content

  except requests.RequestException as e:
    print(f"[agent] preview request failed: {e}")
    led.set_state("error")
    speak("Can't reach the server right now.", alsa_hw)
    led.set_state("idle")
    return None, None


def confirm_and_execute(pending: PendingConfirmation, alsa_hw: str) -> None:
  """
  Execute the action based on the pending confirmation intent.
  Plays appropriate feedback after.
  """
  isodate = pending.iso_date
  try:
    if pending.intent == 'save_draft':
      # Publish the draft journal
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/orchestrate/publish",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"date": isodate},
        timeout=30,
      )
      if resp.ok:
        speak("Done, I've saved your journal to your account.", alsa_hw)
      else:
        speak("Sorry, something went wrong saving your journal. Try again.", alsa_hw)

    elif pending.intent == 'delete_latest':
      resp = requests.delete(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/latest",
        headers=HEADERS,
        timeout=15,
      )
      if resp.ok:
        speak("Done, I've deleted your last entry from your journal.", alsa_hw)
      else:
        speak("Sorry, something went wrong deleting that entry. Try again.", alsa_hw)

    elif pending.intent == 'clear_all':
      resp = requests.delete(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}",
        headers=HEADERS,
        timeout=15,
      )
      if resp.ok:
        count = resp.json().get("deleted", 0)
        if count == 0:
          speak("There aren't any entries in your journal today.", alsa_hw)
        else:
          speak(f"Done, I've cleared {count} {'entry' if count == 1 else 'entries'} from your journal.", alsa_hw)
      else:
        speak("Sorry, something went wrong clearing your journal. Try again.", alsa_hw)

    elif pending.intent == 'delete_count':
      try:
        count = int(pending.content)
      except (ValueError, TypeError):
        speak("Sorry, something went wrong with that request. Try again.", alsa_hw)
        return
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/delete-count",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"count": count},
        timeout=15,
      )
      if resp.ok:
        deleted = resp.json().get("deleted", 0)
        speak(f"Done, I've deleted {deleted} {'entry' if deleted == 1 else 'entries'} from your journal.", alsa_hw)
      else:
        speak("Sorry, something went wrong deleting those entries. Try again.", alsa_hw)

    elif pending.intent == 'delete_match':
      resp = requests.post(
        f"{ORCHESTRATOR_URL}/api/fragments/{isodate}/delete-match",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"query": pending.content},
        timeout=15,
      )
      if resp.ok:
        deleted = resp.json().get("deleted", 0)
        if deleted == 0:
          speak("I couldn't find any entries matching that in your journal.", alsa_hw)
        else:
          speak(f"Done, I've deleted {deleted} {'entry' if deleted == 1 else 'entries'} matching that from your journal.", alsa_hw)
      else:
        speak("Sorry, something went wrong with that deletion. Try again.", alsa_hw)

  except requests.RequestException as e:
    print(f"[confirm] request failed: {e}")
    speak("Can't reach the server right now.", alsa_hw)


# ---------------------------------------------------------------------------
# Main event loop
# ---------------------------------------------------------------------------

def run(devices) -> None:
  recognizer = sr.Recognizer()
  mic = sr.Microphone(device_index=devices.input_index, sample_rate=32000)

  # --- STT tuning ---
  recognizer.pause_threshold = 1.5        # seconds of silence before phrase ends
  recognizer.phrase_threshold = 0.1        # min seconds of speech to count as a phrase (lower = catches short words)
  recognizer.non_speaking_duration = 0.8   # padding before/after speech (more context for Google)
  recognizer.dynamic_energy_threshold = True
  recognizer.dynamic_energy_adjustment_damping = 0.05   # slower drift so threshold doesn't climb mid-sentence
  recognizer.dynamic_energy_ratio = 1.2                 # less aggressive gating (default 1.5 clips quiet syllables)

  print("[agent] calibrating ambient noise…")
  with mic as source:
    recognizer.adjust_for_ambient_noise(source, duration=AMBIENT_CALIBRATE_S)
  print(f"[agent] energy threshold: {recognizer.energy_threshold:.1f}")

  led.set_state("idle")
  print(f"[agent] listening for wakeword {WAKEWORDS} — Ctrl+C to quit\n")

  pending_confirmation: Optional[PendingConfirmation] = None
  confirm_deadline = 0.0
  message_cache: list[str] = []  # Keep last 8 user inputs for context
  wait_for_wakeword = True        # Start dormant, activate on wakeword

  while True:
    try:

      # ----------------------------------------------------------------
      # Awaiting user confirmation for destructive action
      # ----------------------------------------------------------------
      if pending_confirmation:
        remaining = confirm_deadline - time.monotonic()
        if remaining <= 0:
          print("[agent] confirmation timeout — cancelling.")
          speak("Okay, never mind.", devices.alsa_hw)
          led.set_state("idle")
          pending_confirmation = None
          wait_for_wakeword = True
          continue

        led.set_state("listening")
        with mic as source:
          try:
            audio = recognizer.listen(
              source,
              timeout=min(remaining, LISTEN_TIMEOUT),
              phrase_time_limit=PHRASE_TIME_LIMIT
            )
          except sr.WaitTimeoutError:
            continue

        try:
          transcript = recognizer.recognize_google(audio, language="en-US")
        except (sr.UnknownValueError, sr.RequestError):
          continue

        print(f"[confirm] heard: {_strip_wakeword(transcript)!r}")
        words = set(transcript.lower().split())

        # Check DISCARD first so "don't delete" doesn't match "delete" in SAVE_CONFIRMS
        if words & DISCARD_WORDS:
          print("[agent] confirmation cancelled.")
          speak("Got it. I won't do that.", devices.alsa_hw)
          led.set_state("idle")
          pending_confirmation = None
          wait_for_wakeword = True
        elif words & SAVE_CONFIRMS:
          print("[agent] confirmation accepted — executing.")
          led.set_state("thinking")
          confirm_and_execute(pending_confirmation, devices.alsa_hw)
          led.set_state("idle")
          pending_confirmation = None
          wait_for_wakeword = True
        else:
          speak("Say yes to confirm or no to cancel.", devices.alsa_hw)

        continue

      # ----------------------------------------------------------------
      # Listening (dormant until wakeword, then open for commands)
      # ----------------------------------------------------------------
      if wait_for_wakeword:
        led.set_state("idle")
      else:
        led.set_state("listening")

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
        transcript = recognizer.recognize_google(audio, language="en-US")
      except sr.UnknownValueError:
        continue
      except sr.RequestError as e:
        print(f"[stt] request error: {e}")
        continue

      clean_log = _strip_wakeword(transcript)
      print(f"[stt] heard: {clean_log!r}")

      has_wakeword = _contains(transcript, WAKEWORDS)
      has_read     = _contains(transcript, READ_TRIGGERS)
      has_clear    = _contains(transcript, CLEAR_TRIGGERS)

      # --- Wakeword gate ---
      # If waiting for wakeword: only proceed if wakeword/read/clear detected
      if wait_for_wakeword:
        if has_wakeword or has_read or has_clear:
          wait_for_wakeword = False
          print("[agent] wakeword detected — session active!")
          led.set_state("thinking")
        else:
          # Dormant — ignore ambient speech
          continue
      else:
        # Session is active — process everything
        print("[agent] processing speech…")
        led.set_state("thinking")

      # ----------------------------------------------------------------
      # Read journal request (with interrupt support)
      # ----------------------------------------------------------------
      if has_read:
        narrative, mp3_bytes = read_journal(devices.alsa_hw)
        if narrative:
          led.set_state("speaking")
          interrupt = _play_interruptible(mp3_bytes, devices.alsa_hw, recognizer, mic)
          if interrupt:
            print(f"[agent] playback interrupted: {_strip_wakeword(interrupt)!r}")
            led.set_state("listening")
            if _contains(interrupt, CLEAR_TRIGGERS):
              speak("Are you sure you want to delete all entries for today? Say yes or no.", devices.alsa_hw)
              pending_confirmation = PendingConfirmation(
                intent='clear_all',
                content='',
                iso_date=today(),
                response_text=''
              )
              confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
            elif not _contains(interrupt, READ_TRIGGERS):
              clean = _strip_wakeword(interrupt)
              if len(clean) >= 5:
                led.set_state("thinking")
                result = classify_and_execute(clean, message_cache)
                if result:
                  intent, content, audio_bytes, needs_confirm = result
                  message_cache.append(clean)
                  if len(message_cache) > 8:
                    message_cache.pop(0)
                  if intent == 'journal_entry':
                    led.set_state("speaking")
                    play_mp3_bytes(audio_bytes, devices.alsa_hw)
                    wait_for_wakeword = True
                  elif needs_confirm:
                    pending_confirmation = PendingConfirmation(
                      intent=intent, content=content,
                      iso_date=today(), response_text=''
                    )
                    led.set_state("speaking")
                    play_mp3_bytes(audio_bytes, devices.alsa_hw)
                    confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
                  else:
                    wait_for_wakeword = True
            else:
              wait_for_wakeword = True
          else:
            # Journal played without interruption — ask to save
            speak("Should I save this to your account?", devices.alsa_hw)
            pending_confirmation = PendingConfirmation(
              intent='save_draft',
              content=narrative,
              iso_date=today(),
              response_text=''
            )
            confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
        else:
          wait_for_wakeword = True

      # ----------------------------------------------------------------
      # Clear all request (requires confirmation)
      # ----------------------------------------------------------------
      elif has_clear:
        speak("Are you sure you want to delete all entries for today? Say yes or no.", devices.alsa_hw)
        pending_confirmation = PendingConfirmation(
          intent='clear_all',
          content='',
          iso_date=today(),
          response_text=''
        )
        confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S

      # ----------------------------------------------------------------
      # All other speech → Gemma classification
      # ----------------------------------------------------------------
      else:
        clean = _strip_wakeword(transcript)
        if len(clean) < 3:
          print("[agent] too short, ignoring.")
          led.set_state("idle")
          wait_for_wakeword = True
        else:
          result = classify_and_execute(clean, message_cache)
          if result:
            intent, content, audio_bytes, needs_confirm = result

            # Overheard / unrelated speech — silently go dormant
            if intent == 'ignore':
              print("[agent] ignoring — not directed at Stampy.")
              wait_for_wakeword = True
              led.set_state("idle")
            elif needs_confirm:
              message_cache.append(clean)
              if len(message_cache) > 8:
                message_cache.pop(0)
              led.set_state("speaking")
              play_mp3_bytes(audio_bytes, devices.alsa_hw)
              pending_confirmation = PendingConfirmation(
                intent=intent, content=content,
                iso_date=today(), response_text=''
              )
              confirm_deadline = time.monotonic() + CONFIRM_TIMEOUT_S
            else:
              message_cache.append(clean)
              if len(message_cache) > 8:
                message_cache.pop(0)
              led.set_state("speaking")
              play_mp3_bytes(audio_bytes, devices.alsa_hw)
              # Intent completed — go dormant
              wait_for_wakeword = True
              led.set_state("idle")
          else:
            # API call failed
            speak("Something went wrong. Try again.", devices.alsa_hw)
            wait_for_wakeword = True
            led.set_state("idle")

    except KeyboardInterrupt:
      print("\n[agent] shutting down.")
      break
    except Exception as e:
      print(f"[agent] unexpected error: {e}")
      led.set_state("error")
      time.sleep(2)
      led.set_state("idle")
      wait_for_wakeword = True

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

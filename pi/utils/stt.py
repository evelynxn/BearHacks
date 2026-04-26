"""
Speech-to-text using faster-whisper (local Whisper model).

Falls back to Google free STT if faster-whisper is not available.

Usage:
    from utils.stt import transcribe
    text = transcribe(audio_data)  # sr.AudioData → str | None
"""

from __future__ import annotations

import io
import sys
import wave
import numpy as np
import speech_recognition as sr

# ---------------------------------------------------------------------------
# Try to load faster-whisper
# ---------------------------------------------------------------------------

_whisper_model = None
_whisper_available = False

def _load_whisper():
    global _whisper_model, _whisper_available
    if _whisper_model is not None:
        return
    try:
        from faster_whisper import WhisperModel
        # "base.en" is fast and accurate for English. ~150MB download on first run.
        # On Windows/Mac dev machines this runs in <1s. On Pi 4 it's ~2-3s.
        model_size = "base.en"
        print(f"[stt] loading Whisper model '{model_size}' (first run downloads ~150MB)...")
        _whisper_model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",  # fastest on CPU
        )
        _whisper_available = True
        print(f"[stt] Whisper model loaded successfully")
    except Exception as e:
        print(f"[stt] Whisper not available ({e}), falling back to Google STT")
        _whisper_available = False


def _audio_to_numpy(audio: sr.AudioData) -> np.ndarray:
    """Convert speech_recognition AudioData to float32 numpy array for Whisper."""
    raw = audio.get_raw_data(convert_rate=16000, convert_width=2)
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe(audio: sr.AudioData) -> str | None:
    """
    Transcribe audio using Whisper (preferred) or Google STT (fallback).
    Returns cleaned transcript string, or None if nothing detected.
    """
    _load_whisper()

    if _whisper_available and _whisper_model is not None:
        return _transcribe_whisper(audio)
    else:
        return _transcribe_google(audio)


def _transcribe_whisper(audio: sr.AudioData) -> str | None:
    """Transcribe using local faster-whisper model."""
    try:
        samples = _audio_to_numpy(audio)
        segments, info = _whisper_model.transcribe(
            samples,
            language="en",
            beam_size=3,
            best_of=3,
            vad_filter=True,           # skip silence segments
            vad_parameters=dict(
                min_silence_duration_ms=300,
            ),
            no_speech_threshold=0.5,   # filter out non-speech
        )
        texts = []
        for seg in segments:
            t = seg.text.strip()
            if t:
                texts.append(t)

        result = " ".join(texts).strip()
        if not result:
            return None
        return result
    except Exception as e:
        print(f"[stt] Whisper error: {e}")
        return None


def _transcribe_google(audio: sr.AudioData) -> str | None:
    """Fallback: Google free STT."""
    recognizer = sr.Recognizer()
    try:
        return recognizer.recognize_google(audio, language="en-US")
    except sr.UnknownValueError:
        return None
    except sr.RequestError as e:
        print(f"[stt] Google STT error: {e}")
        return None

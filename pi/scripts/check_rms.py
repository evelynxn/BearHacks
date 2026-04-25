"""
Dev script: verify SpeechRecognition can hear and transcribe the Jabra mic.

Run from the pi/ directory:
    python scripts/check_rms.py
"""

import speech_recognition as sr

r = sr.Recognizer()
with sr.Microphone(device_index=14, sample_rate=32000) as source:
    print("Calibrating for ambient noise (1 s)...")
    r.adjust_for_ambient_noise(source, duration=1)
    print(f"Energy threshold: {r.energy_threshold:.1f}")
    print("Speak now...")
    audio = r.listen(source, timeout=10, phrase_time_limit=10)

print("Transcribing...")
try:
    text = r.recognize_google(audio)
    print(f"Result: {text!r}")
except sr.UnknownValueError:
    print("Could not understand audio")
except sr.RequestError as e:
    print(f"STT request failed: {e}")

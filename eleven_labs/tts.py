import json
import os
import sys

from elevenlabs.client import ElevenLabs

API_KEY = os.environ.get("ELEVENLABS_API_KEY")
if not API_KEY:
    sys.exit("ELEVENLABS_API_KEY is not set; export it before running.")

VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "Z3R5wn05IrDiVCyEkUrK")
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

with open("test.json", "r", encoding="utf-8") as f:
    script = json.load(f)["script"]

client = ElevenLabs(api_key=API_KEY)
audio = client.text_to_speech.convert(
    text=script,
    voice_id=VOICE_ID,
    model_id=MODEL_ID,
)

with open("output.mp3", "wb") as f:
    for chunk in audio:
        f.write(chunk)

import os
import json
from elevenlabs.client import ElevenLabs

with open ("test.json", "r") as file:
    data = json.load(file)

script = data["script"]

client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))

# client = ElevenLabs(api_key="74dcac49a1994cd1bbe1a85e29f8634521fde624eb558d87d370e7cb21741462")

audio = client.text_to_speech.convert(
    text=script,
    voice_id="Z3R5wn05IrDiVCyEkUrK",
    model_id="eleven_multilingual_v2"
)

with open("output.mp3", "wb") as file:
    for chunk in audio:
        file.write(chunk)

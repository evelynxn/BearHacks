import os
import sounddevice as sd
from scipy.io.wavfile import write
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()
client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))


def record_and_transcribe(duration=15, output_file="journal_entries.txt"):
    SAMPLE_RATE = 44100

    # Record from the mic
    print(f"Recording for {duration} seconds... start talking!")
    recording = sd.rec(
        int(duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
    )
    sd.wait()
    print("Done recording.")

    audio_path = "recording.wav"
    write(audio_path, SAMPLE_RATE, recording)

    # Transcribe with ElevenLabs
    print("Transcribing...")
    with open(audio_path, "rb") as f:
        transcript = client.speech_to_text.convert(
            file=f,
            model_id="scribe_v1",
        )

    text = transcript.text
    print(f"\nYou said: {text}\n")

    # Save to text file
    with open(output_file, "w") as f:
        f.write(f"{text}\n")

    print(f"Saved to {output_file}.")
    return text
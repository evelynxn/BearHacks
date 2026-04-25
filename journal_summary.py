# this calls functions that take in voice input and then called a function which summarized the voice input along with an image

from voice_input import record_and_transcribe
import ollama

image_path = "flowers.jpeg"

#record voice and get transcript
day_summary = record_and_transcribe(duration=5)

#generate journal entry from transcript + image
print("\nGenerating journal entry...\n")

response = ollama.chat(
    model="gemma4:e4b",
    messages=[
        {
            "role": "system",
            "content": "You are a thoughtful journaling companion. Given a photo and a brief summary of someone's day, write a warm, reflective journal entry (4-6 sentences) that weaves together what's visible in the image with how they felt. Use a personal, first-person voice."
        },
        {
            "role": "user",
            "content": day_summary,
            "images": [image_path]
        }
    ]
)
print(response["message"]["content"])


import ollama

def generate_entry(day_summary, image_path):
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
    return response["message"]["content"]
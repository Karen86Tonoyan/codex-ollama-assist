from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def call_openai(prompt: str, model: str) -> str:
    """Call OpenAI API"""
    r = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content

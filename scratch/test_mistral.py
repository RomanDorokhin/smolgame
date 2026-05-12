
import requests
import os

api_key = "SWTtIPXZG5CUGtpYt6TVaIaTT4KykwmJ"
base_url = "https://api.mistral.ai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "model": "mistral-large-latest",
    "messages": [
        {"role": "user", "content": "Hello"}
    ],
    "stream": True,
    "stream_options": {"include_usage": True}
}

print("Testing with stream_options...")
response = requests.post(base_url, headers=headers, json=payload, stream=True)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")

payload_no_stream_options = {
    "model": "mistral-large-latest",
    "messages": [
        {"role": "user", "content": "Hello"}
    ],
    "stream": True
}

print("\nTesting without stream_options...")
response = requests.post(base_url, headers=headers, json=payload_no_stream_options, stream=True)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")


import requests
import os

api_key = "SWTtIPXZG5CUGtpYt6TVaIaTT4KykwmJ"
base_url = "https://api.mistral.ai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# Sample tool schema
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather in a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "The city and state, e.g. San Francisco, CA"},
                    "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
                },
                "required": ["location"]
            }
        }
    }
]

payload = {
    "model": "mistral-large-latest",
    "messages": [
        {"role": "user", "content": "What is the weather in Paris?"}
    ],
    "tools": tools,
    "tool_choice": "auto"
}

print("Testing Mistral with tools...")
response = requests.post(base_url, headers=headers, json=payload)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")
else:
    print("Success!")

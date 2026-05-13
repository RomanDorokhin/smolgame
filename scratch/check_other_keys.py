import os

keys = {
    "SambaNova": os.getenv("SAMBANOVA_API_KEY", ""),
    "Cerebras": os.getenv("CEREBRAS_API_KEY", ""),
    "Cohere": os.getenv("COHERE_API_KEY", "")
}

results = {}

# SambaNova
try:
    response = requests.get("https://api.sambanova.ai/v1/models", headers={"Authorization": f"Bearer {keys['SambaNova']}"})
    results["SambaNova"] = [m['id'] for m in response.json()['data']] if response.status_code == 200 else response.text
except Exception as e:
    results["SambaNova"] = str(e)

# Cerebras
try:
    response = requests.get("https://api.cerebras.ai/v1/models", headers={"Authorization": f"Bearer {keys['Cerebras']}"})
    results["Cerebras"] = [m['id'] for m in response.json()['data']] if response.status_code == 200 else response.text
except Exception as e:
    results["Cerebras"] = str(e)

# Cohere
try:
    response = requests.get("https://api.cohere.ai/v1/models", headers={"Authorization": f"Bearer {keys['Cohere']}"})
    results["Cohere"] = [m['name'] for m in response.json()['models']] if response.status_code == 200 else response.text
except Exception as e:
    results["Cohere"] = str(e)

print(json.dumps(results, indent=2))

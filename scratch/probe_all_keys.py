import requests, json, os

# Keys loaded from environment — set these before running:
# export MISTRAL_API_KEY=...
# export SAMBANOVA_API_KEY=...
# export CEREBRAS_API_KEY=...
# export LLM7_API_KEY=...
# export OPENROUTER_API_KEY=...
# export HF_API_KEY=...

KEYS = {
    "SambaNova":   (os.getenv("SAMBANOVA_API_KEY", ""),  "https://api.sambanova.ai/v1"),
    "Mistral":     (os.getenv("MISTRAL_API_KEY", ""),    "https://api.mistral.ai/v1"),
    "Cerebras":    (os.getenv("CEREBRAS_API_KEY", ""),   "https://api.cerebras.ai/v1"),
    "LLM7":        (os.getenv("LLM7_API_KEY", ""),       "https://api.llm7.io/v1"),
    "OpenRouter":  (os.getenv("OPENROUTER_API_KEY", ""), "https://openrouter.ai/api/v1"),
}

def probe(name, key, base_url, model):
    try:
        r = requests.post(f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": "Reply OK"}], "max_tokens": 5},
            timeout=15)
        return {"status": "✅ OK" if r.status_code == 200 else f"❌ {r.status_code}", "model": model}
    except Exception as e:
        return {"status": "❌ FAIL", "error": str(e)[:80]}

results = {}
for name, (key, url) in KEYS.items():
    if not key:
        results[name] = "⚠️  No key set (use env var)"
        continue
    model = {"Mistral": "mistral-small-latest", "Cerebras": "llama3.1-8b",
             "SambaNova": "Meta-Llama-3.3-70B-Instruct", "LLM7": "gpt-oss-20b",
             "OpenRouter": "mistralai/mistral-small-3.2-24b-instruct:free"}.get(name, "gpt-3.5-turbo")
    results[name] = probe(name, key, url, model)

print(json.dumps(results, indent=2, ensure_ascii=False))

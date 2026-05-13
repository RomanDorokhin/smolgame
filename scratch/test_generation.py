import requests, json, time, os

url = "http://localhost:3001/api/generate"

# Provider cascade — put your preferred provider first.
# Keys via env vars: MISTRAL_API_KEY, SAMBANOVA_API_KEY, etc.
tests = [
    {"provider": "mistral",   "apiKey": os.getenv("MISTRAL_API_KEY", ""),   "model": "mistral-small-latest"},
    {"provider": "sambanova", "apiKey": os.getenv("SAMBANOVA_API_KEY", ""), "model": "Meta-Llama-3.3-70B-Instruct"},
    {"provider": "cerebras",  "apiKey": os.getenv("CEREBRAS_API_KEY", ""),  "model": "llama3.1-8b"},
]

PROMPT = "Create a simple Phaser 3 game. Player is a glowing crystal. WASD movement with particle trail. Screen shake on click. Dark space background."

os.makedirs("diagnostics", exist_ok=True)

for t in tests:
    if not t["apiKey"]:
        print(f"⚠️  Skipping {t['provider']} — no API key set")
        continue
    name = f"{t['provider']}/{t['model']}"
    print(f"\n🔄 Testing {name}...")
    payload = {**t, "prompt": PROMPT}
    start = time.time()
    try:
        r = requests.post(url, json=payload, timeout=90)
        elapsed = time.time() - start
        if r.status_code == 200:
            result = r.json()
            code = result.get("code", "")
            fname = f"diagnostics/result_{t['provider']}.html"
            with open(fname, "w") as f:
                f.write(code)
            print(f"  ✅ SUCCESS in {elapsed:.1f}s — {len(code)} chars → {fname}")
            break
        else:
            print(f"  ❌ {r.status_code} in {elapsed:.1f}s: {r.text[:200]}")
    except Exception as e:
        print(f"  ❌ Exception: {e}")
    time.sleep(1)

print("\nDone.")

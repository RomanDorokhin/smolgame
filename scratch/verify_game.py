from playwright.sync_api import sync_playwright
import os

def check_game():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen to console
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logs.append(f"[ERROR] {err.message}"))

        file_path = "file://" + os.path.abspath("index.html")
        print(f"Checking: {file_path}")
        
        try:
            page.goto(file_path)
            # Wait a bit for JS to execute
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Failed to load: {e}")

        print("\n--- CONSOLE LOGS ---")
        for log in logs:
            print(log)
        print("--- END LOGS ---\n")
        
        browser.close()

if __name__ == "__main__":
    check_game()

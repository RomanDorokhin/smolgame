import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("pageerror", lambda exc: errors.append(f"PAGE ERROR: {exc}"))
        page.on("console", lambda msg: errors.append(f"CONSOLE ERROR: {msg.text}") if msg.type == "error" else None)

        print("Visiting game...")
        try:
            await page.goto("http://localhost:8080", wait_until="networkidle", timeout=5000)
            await asyncio.sleep(2)  # Wait for frames
        except Exception as e:
            print(f"Navigation failed: {e}")

        if errors:
            print("--- CONSOLE ERRORS FOUND ---")
            for err in errors:
                print(err)
            print("--- END ERRORS ---")
        else:
            print("No console errors detected.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

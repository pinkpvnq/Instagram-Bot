import asyncio
from playwright.async_api import async_playwright

async def test_browsers():
    async with async_playwright() as p:
        # Test Chromium
        print("Testing Chromium...")
        try:
            browser = await p.chromium.launch()
            await browser.close()
            print("✓ Chromium works!")
        except Exception as e:
            print(f"✗ Chromium error: {e}")

        # Test WebKit
        print("\nTesting WebKit...")
        try:
            browser = await p.webkit.launch()
            await browser.close()
            print("✓ WebKit works!")
        except Exception as e:
            print(f"✗ WebKit error: {e}")

        # Test Firefox
        print("\nTesting Firefox...")
        try:
            browser = await p.firefox.launch()
            await browser.close()
            print("✓ Firefox works!")
        except Exception as e:
            print(f"✗ Firefox error: {e}")

asyncio.run(test_browsers())

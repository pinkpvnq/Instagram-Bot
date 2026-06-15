import asyncio
from playwright.async_api import async_playwright
import os
from dotenv import load_dotenv

def create_env_file():
    env_content = """INSTAGRAM_USERNAME=your_username_here
INSTAGRAM_PASSWORD=your_password_here"""
    with open('.env', 'w') as f:
        f.write(env_content)
    print("Created .env file with credentials")

async def login_to_instagram():
    try:
        async with async_playwright() as p:
            # Launch browser with specific configuration
            browser = await p.webkit.launch(
                headless=False,
                slow_mo=100  # Increased delay between actions
            )
            
            # Create a new browser context
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15'
            )
            
            # Enable better logging
            page = await context.new_page()
            page.set_default_timeout(60000)  # Increased timeout to 60 seconds
            
            # Navigate to Instagram
            print("Navigating to Instagram...")
            await page.goto('https://www.instagram.com/', wait_until='networkidle')
            await asyncio.sleep(3)  # Wait for initial page load
            
            print("Going to login page...")
            await page.goto('https://www.instagram.com/accounts/login/', wait_until='networkidle')
            await asyncio.sleep(3)  # Wait for login page to stabilize

            print("Waiting for login form...")
            await page.wait_for_load_state('domcontentloaded')
            await asyncio.sleep(2)

            print("Filling login form...")
            # Fill username
            username_field = await page.wait_for_selector('input[name="username"]', state='visible', timeout=30000)
            if not username_field:
                raise Exception("Username field not found")
            await username_field.fill(os.getenv('INSTAGRAM_USERNAME'))
            await asyncio.sleep(1)
            
            # Fill password
            password_field = await page.wait_for_selector('input[name="password"]', state='visible', timeout=30000)
            if not password_field:
                raise Exception("Password field not found")
            await password_field.fill(os.getenv('INSTAGRAM_PASSWORD'))
            await asyncio.sleep(1)
            
            print("Clicking login button...")
            # Click login button
            login_button = await page.wait_for_selector('button[type="submit"]', state='visible', timeout=30000)
            if not login_button:
                raise Exception("Login button not found")
            await login_button.click()
            
            # Wait for navigation after login
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(3)

            print("Waiting for home icon...")
            try:
                await page.wait_for_selector('svg[aria-label="Главная"]', timeout=30000)
                print("Successfully logged in!")
                await asyncio.sleep(5)
            except Exception as e:
                print(f"Error while waiting for home icon: {e}")
                # Try to take a screenshot if something goes wrong
                try:
                    await page.screenshot(path='error_screenshot.png')
                    print("Saved error screenshot to error_screenshot.png")
                except:
                    pass
            finally:
                await context.close()
                await browser.close()
    except Exception as e:
        print(f"Error during login process: {e}")

if __name__ == "__main__":
    create_env_file()  # Если ты еще не создала .env файл
    load_dotenv()  # Загружаем переменные окружения
    asyncio.run(login_to_instagram())  # Запуск функции логина

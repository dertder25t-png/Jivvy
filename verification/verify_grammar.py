
from playwright.sync_api import sync_playwright

def verify_grammar_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # App running on 3001 according to logs
        page = browser.new_page()
        page.goto("http://localhost:3001")

        # Take screenshot of dashboard to verify header has settings
        try:
            page.wait_for_selector('header', timeout=10000)
            page.screenshot(path="verification/dashboard_header.png")
            print("Dashboard screenshot taken.")
        except Exception as e:
            print(f"Error waiting for header: {e}")
            # Dump page content if fails
            print(page.content())

        browser.close()

if __name__ == "__main__":
    verify_grammar_feature()

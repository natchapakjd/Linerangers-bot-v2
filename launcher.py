"""
LRG Bot Launcher - Entry point for the packaged application.
Opens the web interface in the default browser.
"""
import os
import sys
import time
import webbrowser
import threading
import uvicorn
from pathlib import Path

# Set production environment
os.environ["IS_PRODUCTION_BUILD"] = "true"
os.environ["LICENSE_BYPASS"] = "true"  # TODO: Set to "false" when online license is ready

def get_base_path():
    """Get the base path for the application (handles Nuitka and PyInstaller bundle)."""
    if "__compiled__" in dir():
        # Running as Nuitka compiled executable
        return Path(__file__).parent
    elif getattr(sys, 'frozen', False):
        # Running as PyInstaller compiled executable
        return Path(sys._MEIPASS)
    else:
        # Running as script
        return Path(__file__).parent

def open_browser_delayed(url: str, delay: float = 2.0):
    """Open browser after a delay to ensure server is ready."""
    time.sleep(delay)
    print(f"🌐 Opening browser: {url}")
    webbrowser.open(url)

def main():
    # Configuration
    host = "127.0.0.1"  # Localhost only for security
    port = 8000
    url = f"http://{host}:{port}"
    
    print("=" * 50)
    print("🤖 LRG Bot v2.0 - Line Rangers Automation")
    print("=" * 50)
    print(f"📡 Starting server at {url}")
    print("⏳ Please wait...")
    print("-" * 50)
    
    # Open browser in background thread
    browser_thread = threading.Thread(
        target=open_browser_delayed, 
        args=(url, 2.5),
        daemon=True
    )
    browser_thread.start()
    
    # Start the server
    try:
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            log_level="info",
            reload=False  # No reload in production
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
    except Exception as e:
        print(f"❌ Error: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

if __name__ == "__main__":
    main()

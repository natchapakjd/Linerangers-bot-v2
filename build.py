"""
Build script for LRG Bot - Creates a distributable .exe package.

Usage:
    python build.py

Requirements:
    pip install pyinstaller

Output:
    dist/LRG-Bot/LRG-Bot.exe
"""
import os
import sys
import shutil
import subprocess
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).parent
APP_DIR = ROOT_DIR / "app"
FRONTEND_ANGULAR_DIR = ROOT_DIR / "frontend-angular"
FRONTEND_DIST_DIR = FRONTEND_ANGULAR_DIR / "dist" / "lrg-bot-frontend" / "browser"
FRONTEND_OUTPUT_DIR = ROOT_DIR / "frontend"
DIST_DIR = ROOT_DIR / "dist"
BUILD_DIR = ROOT_DIR / "build"

def run_command(cmd: list, cwd: Path = None, check: bool = True):
    """Run a command and print output."""
    print(f"🔧 Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, shell=True)
    if check and result.returncode != 0:
        print(f"❌ Command failed with code {result.returncode}")
        sys.exit(1)
    return result

def step(message: str):
    """Print a step message."""
    print(f"\n{'='*60}")
    print(f"📦 {message}")
    print(f"{'='*60}\n")

def build_frontend():
    """Build Angular frontend for production."""
    step("Building Angular Frontend")
    
    # Check if npm is available
    if not shutil.which("npm"):
        print("❌ npm not found. Please install Node.js")
        sys.exit(1)
    
    # Install dependencies
    print("📥 Installing npm packages...")
    run_command(["npm", "install"], cwd=FRONTEND_ANGULAR_DIR)
    
    # Build for production
    print("🏗️ Building Angular app...")
    run_command(["npm", "run", "build", "--", "--configuration=production"], cwd=FRONTEND_ANGULAR_DIR)
    
    # Copy to frontend folder
    if FRONTEND_OUTPUT_DIR.exists():
        shutil.rmtree(FRONTEND_OUTPUT_DIR)
    
    if FRONTEND_DIST_DIR.exists():
        shutil.copytree(FRONTEND_DIST_DIR, FRONTEND_OUTPUT_DIR)
        print(f"✅ Frontend built and copied to {FRONTEND_OUTPUT_DIR}")
    else:
        print(f"⚠️ Build output not found at {FRONTEND_DIST_DIR}")
        print("   Trying alternative paths...")
        
        # Try alternative Angular output paths
        alt_paths = [
            FRONTEND_ANGULAR_DIR / "dist" / "browser",
            FRONTEND_ANGULAR_DIR / "dist",
        ]
        
        for alt_path in alt_paths:
            if alt_path.exists() and (alt_path / "index.html").exists():
                shutil.copytree(alt_path, FRONTEND_OUTPUT_DIR)
                print(f"✅ Frontend built and copied from {alt_path}")
                break
        else:
            print("❌ Could not find Angular build output")
            sys.exit(1)

def build_exe():
    """Build executable using PyInstaller."""
    step("Building Executable with PyInstaller")
    
    # Install pyinstaller if needed
    print("📥 Ensuring PyInstaller is installed...")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller", "-q"], shell=True)
    
    # Clean previous builds
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    
    # PyInstaller command using python -m
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=LRG-Bot",
        "--onedir",  # Create a folder with exe and dependencies
        "--console",  # Show console for debugging (change to --windowed for no console)
        "--noconfirm",
        # Add data files
        "--add-data=frontend;frontend",
        "--add-data=app;app",
        "--add-data=workflow_templates;workflow_templates",
        "--add-data=templates;templates",
        
        # ============ COLLECT ALL PACKAGES ============
        "--collect-all=fastapi",
        "--collect-all=starlette",
        "--collect-all=uvicorn",
        "--collect-all=pydantic",
        "--collect-all=pydantic_core",
        "--collect-all=sqlalchemy",
        "--collect-all=aiosqlite",
        "--collect-all=jose",
        "--collect-all=passlib",
        "--collect-all=bcrypt",
        "--collect-all=slowapi",
        "--collect-all=limits",
        "--collect-all=pyngrok",
        "--collect-all=qrcode",
        "--collect-all=loguru",
        "--collect-all=websockets",
        "--collect-all=python_multipart",
        "--collect-all=multipart",
        "--collect-all=dotenv",
        "--collect-all=pytesseract",
        "--collect-all=PIL",
        "--collect-all=cv2",
        "--collect-all=numpy",
        "--collect-all=h11",
        "--collect-all=httptools",
        "--collect-all=cryptography",
        
        # ============ HIDDEN IMPORTS - ALL PACKAGES ============
        # FastAPI & Starlette
        "--hidden-import=fastapi",
        "--hidden-import=fastapi.applications",
        "--hidden-import=fastapi.routing",
        "--hidden-import=fastapi.responses",
        "--hidden-import=fastapi.middleware",
        "--hidden-import=fastapi.middleware.cors",
        "--hidden-import=fastapi.staticfiles",
        "--hidden-import=starlette",
        "--hidden-import=starlette.applications",
        "--hidden-import=starlette.routing",
        "--hidden-import=starlette.responses",
        "--hidden-import=starlette.staticfiles",
        "--hidden-import=starlette.middleware",
        "--hidden-import=starlette.middleware.cors",
        
        # Pydantic
        "--hidden-import=pydantic",
        "--hidden-import=pydantic.fields",
        "--hidden-import=pydantic_core",
        
        # Uvicorn
        "--hidden-import=uvicorn",
        "--hidden-import=uvicorn.main",
        "--hidden-import=uvicorn.config",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.http.h11_impl",
        "--hidden-import=uvicorn.protocols.http.httptools_impl",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.protocols.websockets.wsproto_impl",
        "--hidden-import=uvicorn.protocols.websockets.websockets_impl",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=uvicorn.lifespan.off",
        
        # SQLAlchemy
        "--hidden-import=sqlalchemy",
        "--hidden-import=sqlalchemy.ext.asyncio",
        "--hidden-import=sqlalchemy.orm",
        "--hidden-import=sqlalchemy.pool",
        "--hidden-import=sqlalchemy.dialects.sqlite",
        "--hidden-import=aiosqlite",
        
        # OpenCV & Image Processing
        "--hidden-import=cv2",
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=numpy",
        "--hidden-import=pytesseract",
        
        # Logging & Utils
        "--hidden-import=loguru",
        "--hidden-import=loguru._logger",
        "--hidden-import=websockets",
        "--hidden-import=python_multipart",
        "--hidden-import=multipart",
        
        # JWT & Auth
        "--hidden-import=jose",
        "--hidden-import=jose.jwt",
        "--hidden-import=jose.jws",
        "--hidden-import=jose.jwk",
        "--hidden-import=jose.utils",
        "--hidden-import=jose.constants",
        "--hidden-import=jose.exceptions",
        "--hidden-import=jose.backends",
        "--hidden-import=jose.backends.cryptography_backend",
        "--hidden-import=passlib",
        "--hidden-import=passlib.hash",
        "--hidden-import=passlib.context",
        "--hidden-import=passlib.handlers",
        "--hidden-import=passlib.handlers.bcrypt",
        "--hidden-import=bcrypt",
        "--hidden-import=cryptography",
        "--hidden-import=cryptography.hazmat",
        "--hidden-import=cryptography.hazmat.primitives",
        
        # Rate Limiting
        "--hidden-import=slowapi",
        "--hidden-import=slowapi.util",
        "--hidden-import=slowapi.errors",
        "--hidden-import=slowapi.middleware",
        "--hidden-import=slowapi.extension",
        "--hidden-import=limits",
        "--hidden-import=limits.strategies",
        "--hidden-import=limits.storage",
        
        # Ngrok
        "--hidden-import=pyngrok",
        "--hidden-import=pyngrok.ngrok",
        "--hidden-import=pyngrok.conf",
        "--hidden-import=pyngrok.process",
        
        # QRCode
        "--hidden-import=qrcode",
        "--hidden-import=qrcode.main",
        "--hidden-import=qrcode.image",
        "--hidden-import=qrcode.image.pil",
        
        # Dotenv
        "--hidden-import=dotenv",
        "--hidden-import=dotenv.main",
        
        # HTTP libs
        "--hidden-import=h11",
        "--hidden-import=httptools",
        
        # Tkinter (for file dialogs) - builtin, need special handling
        "--hidden-import=tkinter",
        "--hidden-import=tkinter.filedialog",
        "--hidden-import=tkinter.messagebox",
        "--hidden-import=tkinter.ttk",
        "--hidden-import=tkinter.constants",
        "--hidden-import=_tkinter",
        
        # Entry point
        "launcher.py"
    ]
    
    print(f"🔧 Running PyInstaller...")
    result = subprocess.run(cmd, cwd=ROOT_DIR)
    if result.returncode != 0:
        print(f"❌ PyInstaller failed with code {result.returncode}")
        sys.exit(1)
    
    # Copy additional files
    dist_app_dir = DIST_DIR / "LRG-Bot"
    
    # Create .env file for production
    env_content = """# LRG Bot Configuration
LICENSE_BYPASS=true
IS_PRODUCTION_BUILD=true
SECRET_KEY=your-production-secret-key-here
"""
    (dist_app_dir / ".env").write_text(env_content)
    
    print(f"\n✅ Build complete!")
    print(f"📁 Output: {dist_app_dir}")
    print(f"🚀 Run: {dist_app_dir / 'LRG-Bot.exe'}")

def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║           LRG Bot Build Script v2.0                      ║
║           Building distributable package...              ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Build frontend
    build_frontend()
    
    # Step 2: Build executable
    build_exe()
    
    print("""
╔══════════════════════════════════════════════════════════╗
║                    BUILD COMPLETE! ✅                    ║
╠══════════════════════════════════════════════════════════╣
║  📁 Output folder: dist/LRG-Bot/                         ║
║  🚀 Executable:    dist/LRG-Bot/LRG-Bot.exe              ║
║                                                          ║
║  To distribute:                                          ║
║  1. Zip the entire dist/LRG-Bot folder                   ║
║  2. Send to customers                                    ║
║  3. They just double-click LRG-Bot.exe                   ║
╚══════════════════════════════════════════════════════════╝
    """)

if __name__ == "__main__":
    main()

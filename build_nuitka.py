"""
Build script for LRG Bot using Nuitka - Creates an obfuscated distributable .exe package.

Usage:
    python build_nuitka.py

Requirements:
    pip install nuitka ordered-set zstandard

Output:
    dist/LRG-Bot.dist/LRG-Bot.exe
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
    """Build executable using Nuitka."""
    step("Building Executable with Nuitka (Obfuscated)")
    
    # Check if nuitka is available
    try:
        subprocess.run([sys.executable, "-m", "nuitka", "--version"], 
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Nuitka not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "nuitka", "ordered-set", "zstandard"])
    
    # Clean previous builds
    nuitka_dist = ROOT_DIR / "LRG-Bot.dist"
    nuitka_build = ROOT_DIR / "LRG-Bot.build"
    nuitka_onefile = ROOT_DIR / "LRG-Bot.onefile-build"
    
    for dir_to_clean in [nuitka_dist, nuitka_build, nuitka_onefile, DIST_DIR]:
        if dir_to_clean.exists():
            shutil.rmtree(dir_to_clean)
            print(f"🗑️ Cleaned: {dir_to_clean}")
    
    # Nuitka command - using standalone mode (creates folder with dependencies)
    cmd = [
        sys.executable, "-m", "nuitka",
        
        # Output mode
        "--standalone",  # Create standalone folder with all dependencies
        # "--onefile",   # Uncomment for single file (slower startup)
        
        # Windows options
        "--windows-console-mode=attach",  # Show console output
        
        # Include data directories
        "--include-data-dir=frontend=frontend",
        "--include-data-dir=app=app", 
        "--include-data-dir=templates=templates",
        "--include-data-dir=workflow_templates=workflow_templates",
        
        # Include Python packages
        "--include-package=fastapi",
        "--include-package=starlette",
        "--include-package=uvicorn",
        "--include-package=pydantic",
        "--include-package=pydantic_core",
        "--include-package=sqlalchemy",
        "--include-package=aiosqlite",
        "--include-package=cv2",
        "--include-package=PIL",
        "--include-package=numpy",
        "--include-package=pytesseract",
        "--include-package=loguru",
        "--include-package=websockets",
        "--include-package=python_multipart",
        "--include-package=jose",
        "--include-package=passlib",
        "--include-package=bcrypt",
        "--include-package=cryptography",
        "--include-package=slowapi",
        "--include-package=limits",
        "--include-package=pyngrok",
        "--include-package=qrcode",
        "--include-package=dotenv",
        "--include-package=h11",
        "--include-package=httptools",
        "--include-package=multipart",
        
        # Plugins
        "--enable-plugin=anti-bloat",  # Reduce size
        # "--enable-plugin=upx",  # Compress with UPX (optional, need UPX installed)
        
        # Performance & protection
        "--lto=yes",  # Link-time optimization
        "--jobs=4",  # Parallel compilation
        
        # Output settings
        "--output-dir=dist",
        "--output-filename=LRG-Bot.exe",
        
        # Show progress
        "--show-progress",
        "--show-memory",
        
        # Entry point
        "launcher.py"
    ]
    
    print(f"🔧 Running Nuitka (this may take 5-15 minutes)...")
    print("⏳ Please wait, compiling Python to native code...")
    
    result = subprocess.run(cmd, cwd=ROOT_DIR)
    if result.returncode != 0:
        print(f"❌ Nuitka failed with code {result.returncode}")
        sys.exit(1)
    
    # Move output to final location
    dist_app_dir = DIST_DIR / "LRG-Bot.dist"
    if dist_app_dir.exists():
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
    else:
        # Check alternative location
        alt_dist = ROOT_DIR / "dist" / "launcher.dist"
        if alt_dist.exists():
            final_dist = DIST_DIR / "LRG-Bot"
            shutil.move(str(alt_dist), str(final_dist))
            env_content = """# LRG Bot Configuration
LICENSE_BYPASS=true
IS_PRODUCTION_BUILD=true
SECRET_KEY=your-production-secret-key-here
"""
            (final_dist / ".env").write_text(env_content)
            print(f"\n✅ Build complete!")
            print(f"📁 Output: {final_dist}")
            print(f"🚀 Run: {final_dist / 'LRG-Bot.exe'}")

def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║       LRG Bot Nuitka Build Script v1.0                   ║
║       Building OBFUSCATED distributable package...       ║
╠══════════════════════════════════════════════════════════╣
║  🔒 Nuitka compiles Python → C → Native Binary           ║
║  🛡️ Source code is NOT recoverable                      ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Build frontend
    build_frontend()
    
    # Step 2: Build executable with Nuitka
    build_exe()
    
    print("""
╔══════════════════════════════════════════════════════════╗
║                 BUILD COMPLETE! ✅                       ║
╠══════════════════════════════════════════════════════════╣
║  📁 Output folder: dist/LRG-Bot.dist/                    ║
║  🚀 Executable:    dist/LRG-Bot.dist/LRG-Bot.exe         ║
║                                                          ║
║  🔒 OBFUSCATION: Python source is compiled to native     ║
║     binary - cannot be decompiled back to Python!        ║
║                                                          ║
║  To distribute:                                          ║
║  1. Zip the entire dist/LRG-Bot.dist folder              ║
║  2. Send to customers                                    ║
║  3. They just double-click LRG-Bot.exe                   ║
╚══════════════════════════════════════════════════════════╝
    """)

if __name__ == "__main__":
    main()

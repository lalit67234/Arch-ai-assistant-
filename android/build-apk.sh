#!/bin/bash
set -e

echo "=========================================================="
echo "  ARCH Tactical AI Assistant — Native APK Packaging Script"
echo "  Target: Android 9 (API 28) through Android 14 (API 34)"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Step 1: Compiling web frontend production bundle..."
cd "$ROOT_DIR"
npm run build

echo "Step 2: Syncing production assets to Android asset directory..."
mkdir -p "$ROOT_DIR/android/app/src/main/assets/dist"
cp -r "$ROOT_DIR/dist/"* "$ROOT_DIR/android/app/src/main/assets/dist/"

echo "Step 3: Checking Android build prerequisites..."
if ! command -v java &> /dev/null; then
    echo "Notice: Java JDK 17+ is required to build the APK locally."
    echo "You can build the APK for ₹0 using the included GitHub Actions workflow:"
    echo "  .github/workflows/build-apk.yml"
    echo "Simply push this repository to GitHub and download the compiled APK from the Actions tab!"
    exit 0
fi

echo "Step 4: Compiling APK with Gradle..."
cd "$ROOT_DIR/android"
chmod +x gradlew || true
./gradlew assembleDebug

echo "=========================================================="
echo "  Build Complete!"
echo "  Output APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo "=========================================================="

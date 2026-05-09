#!/usr/bin/env bash
# MelodyScribe full build pipeline
# Usage: ./build.sh [--skip-backend] [--skip-frontend]
set -euo pipefail

SKIP_BACKEND=false
SKIP_FRONTEND=false

for arg in "$@"; do
  case "$arg" in
    --skip-backend)  SKIP_BACKEND=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "=== MelodyScribe Build ==="

# ── 1. PyInstaller ──────────────────────────────────────────────────
if [ "$SKIP_BACKEND" = false ]; then
  echo ""
  echo "▶ Building Python backend with PyInstaller..."
  cd "$BACKEND_DIR"

  if [ ! -d ".venv" ]; then
    echo "  Creating venv..."
    python3 -m venv .venv
  fi

  source .venv/bin/activate
  pip install --quiet pyinstaller

  pyinstaller melodyscribe.spec --clean --noconfirm

  echo "  Backend bundle: $BACKEND_DIR/dist/melodyscribe_server/"
  deactivate
fi

# ── 2. React + Electron build ────────────────────────────────────────
if [ "$SKIP_FRONTEND" = false ]; then
  echo ""
  echo "▶ Building frontend (React + Electron)..."
  cd "$FRONTEND_DIR"

  npm install
  npm run dist:mac

  echo "  Electron bundle: $FRONTEND_DIR/dist-electron/"
fi

echo ""
echo "✓ Build complete."

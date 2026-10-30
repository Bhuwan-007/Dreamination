#!/usr/bin/env bash
# scripts/fetch-animations.sh
set -euo pipefail

TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../packages/dream-player/public/animations" && pwd)"
mkdir -p "$TARGET_DIR"
touch "$TARGET_DIR/.gitkeep"

echo "Animation target directory prepared: $TARGET_DIR"


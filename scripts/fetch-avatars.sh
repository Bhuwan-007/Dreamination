#!/usr/bin/env bash
# scripts/fetch-avatars.sh
set -euo pipefail

TARGET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../packages/dream-player/public/avatars" && pwd)"
mkdir -p "$TARGET_DIR"
touch "$TARGET_DIR/.gitkeep"

echo "Avatar target directory prepared: $TARGET_DIR"
echo "Place 'traveler.glb' in $TARGET_DIR or let the player use PrimitivePuppet."


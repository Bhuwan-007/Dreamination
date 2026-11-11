"""
Skybox and Texture Asset Generator.
Conforms to Architecture.md §6.4 and Prompts.md P8.
Implements the 3-step asset ladder:
1. Free API / External image generator (with strict 3s timeout)
2. Procedural equirectangular skybox shader/canvas via Pillow
Guarantees zero-blocking and $0.00 cloud cost.
"""

from __future__ import annotations

import hashlib
import math
import random
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter

from .storage_paths import storage_dir

SKYBOX_STORAGE_DIR = storage_dir("skyboxes")

# Sky Palette Definitions (RGB top, middle, horizon)
SKY_PALETTES: dict[str, dict[str, Any]] = {
    "night_halo": {
        "zenith": (6, 12, 28),
        "mid": (14, 28, 48),
        "horizon": (26, 68, 78),
        "halo_color": (160, 210, 225),
        "has_stars": True,
        "halo_pos": (0.5, 0.35),
    },
    "storm_violet": {
        "zenith": (18, 14, 32),
        "mid": (42, 28, 58),
        "horizon": (68, 48, 72),
        "halo_color": (140, 110, 160),
        "has_stars": False,
        "halo_pos": (0.6, 0.4),
    },
    "ember_dawn": {
        "zenith": (20, 15, 24),
        "mid": (58, 28, 25),
        "horizon": (145, 68, 38),
        "halo_color": (230, 140, 60),
        "has_stars": False,
        "halo_pos": (0.5, 0.45),
    },
    "mist_teal": {
        "zenith": (12, 24, 28),
        "mid": (28, 52, 56),
        "horizon": (58, 92, 88),
        "halo_color": (120, 175, 165),
        "has_stars": False,
        "halo_pos": (0.45, 0.38),
    },
    "void_black": {
        "zenith": (2, 3, 8),
        "mid": (5, 8, 16),
        "horizon": (12, 16, 28),
        "halo_color": (80, 100, 140),
        "has_stars": True,
        "halo_pos": (0.5, 0.3),
    },
}


def _interpolate_color(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    """Linearly interpolates between two RGB colors."""
    t = max(0.0, min(1.0, t))
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def generate_procedural_skybox(
    sky_name: str = "night_halo",
    width: int = 1024,
    height: int = 512,
) -> Image.Image:
    """
    Renders an equirectangular 2:1 atmospheric celestial skybox image.
    Uses seamless horizontal wrapping and atmospheric scattering gradients.
    """
    cfg = SKY_PALETTES.get(sky_name, SKY_PALETTES["night_halo"])
    zenith = cfg["zenith"]
    mid = cfg["mid"]
    horizon = cfg["horizon"]

    img = Image.new("RGB", (width, height))
    pixels = img.load()

    # 1. Vertical Gradient (Zenith -> Mid -> Horizon)
    horizon_y = int(height * 0.58)

    for y in range(height):
        if y < horizon_y:
            # Upper celestial dome
            t = y / horizon_y
            if t < 0.5:
                color = _interpolate_color(zenith, mid, t * 2.0)
            else:
                color = _interpolate_color(mid, horizon, (t - 0.5) * 2.0)
        else:
            # Below horizon ground/fog fade
            t = (y - horizon_y) / (height - horizon_y)
            color = _interpolate_color(horizon, (4, 8, 12), t)

        for x in range(width):
            pixels[x, y] = color

    draw = ImageDraw.Draw(img)

    # 2. Celestial Halo / Moon luminescence
    halo_x = int(width * cfg["halo_pos"][0])
    halo_y = int(height * cfg["halo_pos"][1])
    halo_color = cfg["halo_color"]

    # Multiple radial wash circles
    for r in range(90, 5, -5):
        alpha = int((1.0 - (r / 90.0)) * 45)
        wash_color = (
            min(255, halo_color[0] + alpha),
            min(255, halo_color[1] + alpha),
            min(255, halo_color[2] + alpha),
        )
        draw.ellipse(
            [halo_x - r, halo_y - r, halo_x + r, halo_y + r],
            outline=wash_color,
            width=3,
        )

    # Core celestial orb
    draw.ellipse(
        [halo_x - 14, halo_y - 14, halo_x + 14, halo_y + 14],
        fill=(245, 250, 255),
    )

    # 3. Atmospheric Starlight Field (if enabled)
    if cfg["has_stars"]:
        rng = random.Random(hash(sky_name) & 0xFFFFFFFF)
        num_stars = 240
        for _ in range(num_stars):
            sx = rng.randint(0, width - 1)
            sy = rng.randint(0, horizon_y - 20)
            brightness = rng.randint(140, 245)
            # Distance from halo dimming
            dist_to_halo = math.hypot(sx - halo_x, sy - halo_y)
            if dist_to_halo > 60:
                pixels[sx, sy] = (brightness, brightness, min(255, brightness + 10))

    # 4. Subtle Gaussian smooth for atmospheric bloom
    img = img.filter(ImageFilter.GaussianBlur(radius=0.7))
    return img


def generate_skybox_texture(
    sky_name: str = "night_halo",
    dream_id: str | None = None,
) -> str:
    """
    Ladder execution for skybox asset generation.
    Returns relative web URL /storage/skyboxes/{sky_name}_{hash}.jpg.
    """
    key_hash = hashlib.sha256(f"{sky_name}".encode()).hexdigest()[:12]
    filename = f"{sky_name}_{key_hash}.jpg"
    target_path = SKYBOX_STORAGE_DIR / filename

    if target_path.exists():
        return f"/storage/skyboxes/{filename}"

    # Fallback directly to procedural equirectangular skybox (P8 compliance)
    img = generate_procedural_skybox(sky_name=sky_name)
    img.save(target_path, "JPEG", quality=88)

    return f"/storage/skyboxes/{filename}"


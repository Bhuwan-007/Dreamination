"""
Art stage for 2.5D living-ink dream films.

Produces, per scene:
  - an opaque painted backdrop (cloud image model if configured, else procedural ink),
  - a translucent mist layer and a foreground framing layer (procedural, alpha PNG) that
    give real parallax depth in the player,
  - one alpha cut-out per object the scene mentions,
and per cast member a full-body ink figure drawn from its FigureSpec.

Provider ladder (IMAGE_PROVIDER env):
  cloudflare   - Cloudflare Workers AI (CF_ACCOUNT_ID + CF_API_TOKEN). Free daily allowance.
  pollinations - image.pollinations.ai, no key. Opt-in only: prompts leave the machine.
  procedural   - local Pillow ink painting. Default when no cloud credentials exist.
Any provider failure falls back to procedural for that one image; nothing blocks a film.

Cast figures are always procedural so a recurring character is pixel-identical across
dreams (cloud models cannot guarantee that) and no description of a real person is sent out.
Every file is cached by a content hash of its inputs.
"""

from __future__ import annotations

import base64
import hashlib
import io
import math
import os
import random
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .storage_paths import storage_dir

FILM_DIR_NAME = "film"
ART_VERSION = "3"  # bump when drawing code changes so cached images are regenerated
STYLE_SUFFIX = (
    "ink wash painting, sumi-e brushwork, muted indigo, teal and lantern-gold palette, "
    "soft handmade paper texture, dreamlike, cinematic composition, no text, no watermark"
)
OBJECT_SUFFIX = (
    "single object, ink wash illustration, centered, isolated on a plain white background, "
    "no shadow on background, no text"
)

BACKDROP_SIZE = (1600, 900)
SS = 2  # supersampling factor for procedural drawing

# --------------------------------------------------------------------------------------
# Colour helpers
# --------------------------------------------------------------------------------------


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


def _mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


SKY_BY_TIME = {
    "night": ("#0B1220", "#1C3340", "#2E5560"),
    "dusk": ("#1E1830", "#5A3A4E", "#B0684A"),
    "dawn": ("#22304A", "#7A6A78", "#E0A877"),
    "day": ("#5F87A0", "#93AFB8", "#DCD6C0"),
    "timeless": ("#120F1A", "#2E2640", "#5B4C70"),
}

MOOD_TINT = {
    "fearful": ("#3A1E26", 0.35),
    "uneasy": ("#3A3326", 0.2),
    "melancholic": ("#1E2A3F", 0.3),
    "peaceful": ("#3F5A40", 0.18),
    "wonder": ("#4A4070", 0.15),
}

# --------------------------------------------------------------------------------------
# Cache + providers
# --------------------------------------------------------------------------------------


def _cache_key(*parts: Any) -> str:
    raw = "|".join(str(p) for p in (ART_VERSION, *parts))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def _save(img: Image.Image, name: str) -> str:
    path = storage_dir(FILM_DIR_NAME) / name
    img.save(path, "PNG", optimize=True) if name.endswith(".png") else img.convert("RGB").save(
        path, "JPEG", quality=86
    )
    return f"/storage/{FILM_DIR_NAME}/{name}"


def _cached(name: str) -> str | None:
    if (storage_dir(FILM_DIR_NAME) / name).exists():
        return f"/storage/{FILM_DIR_NAME}/{name}"
    return None


def active_provider() -> str:
    explicit = (os.getenv("IMAGE_PROVIDER") or "").strip().lower()
    if explicit in ("cloudflare", "pollinations", "procedural"):
        return explicit
    if os.getenv("CF_ACCOUNT_ID") and os.getenv("CF_API_TOKEN"):
        return "cloudflare"
    return "procedural"


def _cloud_image(prompt: str, seed: int, width: int, height: int) -> Image.Image | None:
    """Returns an RGB image from the configured cloud provider, or None on any failure."""
    provider = active_provider()
    if provider == "procedural" or os.getenv("PYTEST_CURRENT_TEST"):
        return None
    try:
        import httpx

        if provider == "cloudflare":
            account = os.environ["CF_ACCOUNT_ID"]
            model = os.getenv("CF_IMAGE_MODEL", "@cf/black-forest-labs/flux-1-schnell")
            resp = httpx.post(
                f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
                headers={"Authorization": f"Bearer {os.environ['CF_API_TOKEN']}"},
                json={"prompt": prompt, "steps": 6, "seed": seed},
                timeout=60.0,
            )
            resp.raise_for_status()
            if resp.headers.get("content-type", "").startswith("image/"):
                data = resp.content
            else:
                data = base64.b64decode(resp.json()["result"]["image"])
        else:  # pollinations (opt-in)
            from urllib.parse import quote

            resp = httpx.get(
                f"https://image.pollinations.ai/prompt/{quote(prompt)}",
                params={"width": width, "height": height, "seed": seed, "nologo": "true", "model": "flux"},
                timeout=90.0,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.content
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return _cover(img, width, height)
    except Exception:  # noqa: BLE001 - provider failure falls back to procedural
        return None


def _cover(img: Image.Image, width: int, height: int) -> Image.Image:
    """Scale and centre-crop to exactly width x height."""
    scale = max(width / img.width, height / img.height)
    img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    left = (img.width - width) // 2
    top = (img.height - height) // 2
    return img.crop((left, top, left + width, top + height))


def _remove_plain_background(img: Image.Image) -> Image.Image:
    """Flood-fill the near-white background from the borders and make it transparent."""
    rgb = img.convert("RGB")
    probe = rgb.copy()
    sentinel = (255, 0, 255)
    w, h = probe.size
    for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)):
        if probe.getpixel(xy) != sentinel:
            ImageDraw.floodfill(probe, xy, sentinel, thresh=48)
    arr = np.asarray(probe)
    bg = np.all(arr == np.array(sentinel, dtype=np.uint8), axis=-1)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bbox) if bbox else out


# --------------------------------------------------------------------------------------
# Procedural ink painting
# --------------------------------------------------------------------------------------


def _paper_grain(size: tuple[int, int], rng: np.random.Generator, strength: float = 0.06) -> np.ndarray:
    w, h = size
    noise = rng.normal(0.0, 1.0, (h // 4 + 1, w // 4 + 1)).astype(np.float32)
    img = Image.fromarray(((noise - noise.min()) / (np.ptp(noise) + 1e-6) * 255).astype(np.uint8))
    img = img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.5))
    return 1.0 - strength + strength * (np.asarray(img, dtype=np.float32) / 255.0)


def _vertical_gradient(w: int, h: int, stops: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)
    out = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        col = np.interp(ys, [s[0] for s in stops], [s[1][c] for s in stops])
        out[:, :, c] = col[:, None]
    return out


def _radial_glow(arr: np.ndarray, cx: float, cy: float, radius: float, color: tuple[int, int, int], strength: float) -> None:
    h, w, _ = arr.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    a = np.clip(1.0 - d, 0.0, 1.0) ** 2.2 * strength
    for c in range(3):
        arr[:, :, c] = arr[:, :, c] * (1 - a) + color[c] * a


def _ridge(rng: random.Random, w: int, base: float, amp: float, roughness: int, h: int) -> list[tuple[float, float]]:
    pts = [(0.0, float(h))]
    phase = [rng.uniform(0, math.tau) for _ in range(4)]
    freqs = [1.0, 2.3, 5.1, 11.7][:roughness]
    for i in range(0, w + 8, 8):
        x = i / w
        y = sum(math.sin(x * math.tau * f + phase[k]) / (k + 1) for k, f in enumerate(freqs))
        pts.append((float(i), base - amp * y))
    pts.append((float(w), float(h)))
    return pts


def paint_backdrop(
    setting_kind: str,
    time_of_day: str,
    mood: str,
    palette: dict[str, str],
    seed: int,
) -> Image.Image:
    """Opaque ink-wash backdrop whose composition depends on the scene's setting."""
    W, H = BACKDROP_SIZE[0] * SS, BACKDROP_SIZE[1] * SS
    rng = random.Random(seed)
    nrng = np.random.default_rng(seed)
    top, mid, low = (_hex(c) for c in SKY_BY_TIME.get(time_of_day, SKY_BY_TIME["night"]))
    tint, tint_amt = MOOD_TINT.get(mood, ("#000000", 0.0))
    top, mid, low = (_mix(c, _hex(tint), tint_amt) for c in (top, mid, low))
    horizon = {"water": 0.58, "interior": 0.7, "corridor": 0.62, "sky": 0.92, "void": 0.8}.get(setting_kind, 0.64)

    # Smooth fields (sky gradient, glows) are computed at quarter resolution and upscaled.
    q = 4
    qw, qh = W // q, H // q
    arr = _vertical_gradient(qw, qh, [(0.0, top), (horizon * 0.6, mid), (horizon, low), (1.0, _mix(low, top, 0.7))])

    # Celestial body
    cx, cy = W * rng.uniform(0.18, 0.82), H * rng.uniform(0.14, horizon * 0.45)
    if time_of_day in ("night", "timeless"):
        _radial_glow(arr, cx / q, cy / q, qw * 0.16, _hex(palette.get("glow", "#F3D998")), 0.35)
        _radial_glow(arr, cx / q, cy / q, qw * 0.028, (246, 240, 222), 1.0)
    elif setting_kind not in ("interior", "corridor"):
        _radial_glow(arr, cx / q, cy / q, qw * 0.22, _hex(palette.get("accent", "#E2B866")), 0.4)
        _radial_glow(arr, cx / q, cy / q, qw * 0.04, (250, 232, 190), 0.9)

    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").resize((W, H), Image.BICUBIC).convert("RGBA")

    # Stars
    if time_of_day in ("night", "timeless") and setting_kind not in ("interior", "corridor"):
        star_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(star_layer)
        for _ in range(260):
            x, y = rng.uniform(0, W), rng.uniform(0, H * horizon * 0.85)
            r = rng.choice([1, 1, 2, 2, 3]) * SS * 0.6
            a = rng.randint(90, 230)
            sd.ellipse([x - r, y - r, x + r, y + r], fill=(240, 236, 220, a))
        img = Image.alpha_composite(img, star_layer)

    ink = _hex(palette.get("ink", "#14181C"))
    accent = _hex(palette.get("accent", "#E2B866"))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    hy = H * horizon

    def far_col(depth: float) -> tuple[int, int, int, int]:
        c = _mix(low, ink, 0.25 + 0.6 * depth)
        return (*c, 255)

    if setting_kind in ("field", "mountain", "desert", "forest", "city", "void"):
        amp_scale = {"mountain": 0.22, "desert": 0.05, "void": 0.08}.get(setting_kind, 0.07)
        for k, depth in enumerate((0.15, 0.45, 0.75)):
            base = hy - H * (0.14 - 0.06 * k) * (1.6 if setting_kind == "mountain" else 1.0)
            pts = _ridge(rng, W, base, H * amp_scale * (1.0 - 0.25 * k), 2 if setting_kind == "desert" else 3, H)
            d.polygon(pts, fill=far_col(depth))
    if setting_kind == "forest":
        for k, depth in enumerate((0.35, 0.65, 0.95)):
            for _ in range(28 - 6 * k):
                x = rng.uniform(-40, W + 40)
                th = H * rng.uniform(0.16, 0.32) * (1 + 0.35 * k)
                tw = th * rng.uniform(0.22, 0.32)
                ground = hy + H * 0.05 * k
                d.polygon([(x, ground - th), (x - tw, ground), (x + tw, ground)], fill=far_col(depth))
    if setting_kind == "city":
        x = -10.0
        while x < W:
            bw = rng.uniform(W * 0.03, W * 0.08)
            bh = rng.uniform(H * 0.12, H * 0.42)
            d.rectangle([x, hy - bh, x + bw, H], fill=far_col(0.7))
            for wy in np.arange(hy - bh + 14 * SS, hy - 10 * SS, 22 * SS):
                for wx in np.arange(x + 8 * SS, x + bw - 8 * SS, 18 * SS):
                    if rng.random() < 0.28:
                        d.rectangle([wx, wy, wx + 6 * SS, wy + 9 * SS], fill=(*accent, rng.randint(120, 220)))
            x += bw + rng.uniform(2, 14) * SS
    if setting_kind == "water":
        water_top = _mix(low, ink, 0.45)
        d.rectangle([0, hy, W, H], fill=(*water_top, 235))
        for _ in range(70):
            y = rng.uniform(hy + 8 * SS, H)
            x = rng.uniform(0, W)
            L = rng.uniform(30, 160) * SS * (y - hy) / (H - hy + 1)
            d.line([(x, y), (x + L, y)], fill=(*_mix(low, (230, 230, 220), 0.4), rng.randint(40, 110)), width=2 * SS)
        d.rectangle([cx - W * 0.012, hy, cx + W * 0.012, H], fill=(*_hex(palette.get("glow", "#F3D998")), 60))
    if setting_kind in ("interior", "corridor"):
        wall = _mix(_mix(mid, low, 0.5), ink, 0.12)
        d.rectangle([0, 0, W, hy], fill=(*wall, 255))
        floor = _mix(low, ink, 0.4)
        d.rectangle([0, hy, W, H], fill=(*floor, 255))
        if setting_kind == "corridor":
            vx, vy = W * rng.uniform(0.42, 0.58), hy - H * 0.18
            for corner in ((0, 0), (W, 0), (0, H), (W, H)):
                d.line([corner, (vx, vy)], fill=(*ink, 200), width=3 * SS)
            for i in range(6):
                t = 0.18 + i * 0.13
                for side in (-1, 1):
                    x0 = vx + side * (W * 0.5) * (1 - t)
                    dh = H * 0.42 * (1 - t)
                    d.rectangle([min(x0, x0 + side * W * 0.04 * (1 - t)), vy + H * 0.3 * (1 - t) - dh,
                                 max(x0, x0 + side * W * 0.04 * (1 - t)), vy + H * 0.3 * (1 - t)],
                                fill=(*_mix(wall, ink, 0.5), 255))
                lx = vx
                ly = vy - H * 0.45 * (1 - t)
                d.ellipse([lx - 10 * SS * (1 - t) - 4, ly - 4, lx + 10 * SS * (1 - t) + 4, ly + 6],
                          fill=(*accent, 200))
        else:
            wx0, wy0 = W * rng.uniform(0.2, 0.55), H * 0.16
            ww, wh = W * 0.22, H * 0.36
            sky = Image.fromarray(np.clip(_vertical_gradient(int(ww), int(wh), [(0, top), (1, low)]), 0, 255).astype(np.uint8))
            layer.paste(sky.convert("RGBA"), (int(wx0), int(wy0)))
            d.rectangle([wx0, wy0, wx0 + ww, wy0 + wh], outline=(*ink, 255), width=10 * SS)
            d.line([(wx0 + ww / 2, wy0), (wx0 + ww / 2, wy0 + wh)], fill=(*ink, 255), width=6 * SS)
            d.line([(wx0, wy0 + wh / 2), (wx0 + ww, wy0 + wh / 2)], fill=(*ink, 255), width=6 * SS)
            for i in range(9):
                y = hy + (H - hy) * (i / 9) ** 1.6
                d.line([(0, y), (W, y)], fill=(*_mix(floor, ink, 0.4), 160), width=2 * SS)
    if setting_kind == "sky":
        for _ in range(14):
            x, y = rng.uniform(0, W), rng.uniform(H * 0.3, H)
            rw, rh = rng.uniform(W * 0.08, W * 0.22), rng.uniform(H * 0.04, H * 0.09)
            d.ellipse([x - rw, y - rh, x + rw, y + rh], fill=(*_mix(low, (235, 230, 220), 0.35), 150))
    if setting_kind == "void":
        # a pale dream-light at the horizon so figures read against the void
        glow_col = _hex(palette.get("mist", "#BDCEBC"))
        for r in range(12, 0, -1):
            rr = W * 0.05 * r
            d.ellipse([W / 2 - rr, hy - rr * 0.35, W / 2 + rr, hy + rr * 0.35], fill=(*glow_col, 9))
        for _ in range(5):
            x, y = rng.uniform(W * 0.1, W * 0.9), rng.uniform(H * 0.35, H * 0.7)
            rw = rng.uniform(W * 0.03, W * 0.07)
            d.polygon([(x - rw, y), (x + rw, y), (x + rw * 0.4, y + rw * 1.3), (x - rw * 0.3, y + rw * 1.1)],
                      fill=far_col(0.8))

    layer = layer.filter(ImageFilter.GaussianBlur(1.2 * SS))
    img = Image.alpha_composite(img, layer)

    # Low mist band at the horizon for atmospheric depth
    mist = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(mist)
    mist_col = _hex(palette.get("mist", "#BDCEBC"))
    for i in range(6):
        y = hy - H * 0.04 + i * H * 0.025
        md.rectangle([0, y, W, y + H * 0.02], fill=(*mist_col, 14))
    img = Image.alpha_composite(img, mist.filter(ImageFilter.GaussianBlur(18 * SS)))

    out = np.asarray(img.convert("RGB"), dtype=np.float32) * _paper_grain((W, H), nrng)[:, :, None]
    final = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    return final.resize(BACKDROP_SIZE, Image.LANCZOS)


def paint_mist_layer(palette: dict[str, str], seed: int) -> Image.Image:
    W, H = 1600, 900
    rng = random.Random(seed + 7)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col = _hex(palette.get("mist", "#BDCEBC"))
    for _ in range(9):
        y = rng.uniform(H * 0.45, H * 0.85)
        x = rng.uniform(-200, W)
        d.ellipse([x, y, x + rng.uniform(500, 1100), y + rng.uniform(40, 110)], fill=(*col, rng.randint(22, 46)))
    return img.filter(ImageFilter.GaussianBlur(28))


def paint_foreground_layer(setting_kind: str, palette: dict[str, str], seed: int) -> Image.Image:
    """Dark framing silhouettes at the frame's bottom and edges (alpha PNG)."""
    W, H = 1600 * SS, 900 * SS
    rng = random.Random(seed + 13)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink = (*_hex(palette.get("ink", "#14181C")), 245)
    if setting_kind in ("field", "water", "mountain", "desert", "forest", "void", "sky"):
        blades = 220 if setting_kind != "desert" else 40
        for _ in range(blades):
            x = rng.uniform(0, W)
            hgt = H * rng.uniform(0.04, 0.16) * (1.6 if setting_kind == "water" else 1.0)
            lean = rng.uniform(-40, 40) * SS
            d.polygon([(x - 5 * SS, H), (x + 5 * SS, H), (x + lean, H - hgt)], fill=ink)
        d.rectangle([0, H - 18 * SS, W, H], fill=ink)
    if setting_kind == "forest":
        for side in (0, 1):
            x = (-30 * SS if side == 0 else W - 120 * SS) + rng.uniform(-20, 20) * SS
            d.rectangle([x, 0, x + rng.uniform(110, 160) * SS, H], fill=ink)
    if setting_kind == "city":
        x = W * rng.choice([0.08, 0.9])
        d.rectangle([x - 9 * SS, H * 0.18, x + 9 * SS, H], fill=ink)
        d.ellipse([x - 34 * SS, H * 0.15, x + 34 * SS, H * 0.21], fill=(*_hex(palette.get("glow", "#F3D998")), 230))
        d.rectangle([0, H - 60 * SS, W, H - 52 * SS], fill=ink)
        for px in range(0, W, 70 * SS):
            d.rectangle([px, H - 60 * SS, px + 8 * SS, H], fill=ink)
    if setting_kind == "interior":
        for side in (0, 1):
            x0 = 0 if side == 0 else W - 230 * SS
            pts = [(x0, 0), (x0 + 230 * SS, 0)]
            for i in range(10):
                y = H * i / 9
                sway = math.sin(i * 0.9 + seed) * 30 * SS
                pts.append(((x0 + (120 if side == 0 else 110) * SS) + sway * (1 if side == 0 else -1), y))
            pts.append((x0 if side == 0 else W, H))
            d.polygon(pts if side == 0 else [(W, 0), (W - 230 * SS, 0)] + pts[2:-1] + [(W, H)], fill=ink)
    if setting_kind == "corridor":
        for x in (40 * SS, W - 150 * SS):
            d.rectangle([x, 0, x + 110 * SS, H], fill=ink)
    return img.filter(ImageFilter.GaussianBlur(1.0 * SS)).resize((1600, 900), Image.LANCZOS)


# ---- objects ----------------------------------------------------------------------------

# Words the procedural painter has a real drawing for (matched as substrings of the name).
DRAWABLE_KEYS = (
    "door", "gate", "locker", "arch", "window", "mirror", "clock", "watch", "tree", "flower", "rose",
    "stair", "step", "ladder", "balcony", "railing", "terrace", "boat", "ship", "canoe", "car", "bus", "train",
    "lamp", "lantern", "streetlight", "candle", "moon", "star", "balloon", "kite", "sun", "key", "house",
    "home", "cottage", "temple", "church", "tower", "lighthouse", "tent", "roof", "chair", "bench", "bed",
    "table", "desk", "piano", "swing", "book", "letter", "phone", "box", "suitcase", "bridge", "well",
    "fountain", "statue", "pillar", "column", "bell",
)


def is_drawable(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in DRAWABLE_KEYS)



def paint_object(name: str, palette: dict[str, str], seed: int) -> Image.Image:
    """Alpha cut-out of a drawable object; unknown objects become a glowing memory orb."""
    S = 512 * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink = (*_hex(palette.get("ink", "#14181C")), 255)
    acc_rgb = _hex(palette.get("accent", "#E2B866"))
    acc = (*acc_rgb, 255)
    glow = (*_hex(palette.get("glow", "#F3D998")), 255)
    soft = (*_mix(acc_rgb, _hex(palette.get("ink", "#14181C")), 0.55), 255)
    rng = random.Random(seed)
    n = name.lower()
    c = S / 2

    def key(*words: str) -> bool:
        return any(w in n for w in words)

    if key("door", "gate", "locker", "arch"):
        w, h = S * 0.42, S * 0.86
        x0, y0 = c - w / 2, S - h
        if key("arch", "gate"):
            d.rectangle([x0, y0 + w / 2, x0 + w, S], fill=ink)
            d.ellipse([x0, y0, x0 + w, y0 + w], fill=ink)
            d.rectangle([x0 + 22 * SS, y0 + w / 2, x0 + w - 22 * SS, S], fill=soft)
        else:
            d.rectangle([x0, y0, x0 + w, S], fill=ink)
            d.rectangle([x0 + 18 * SS, y0 + 18 * SS, x0 + w - 18 * SS, S], fill=soft)
            d.ellipse([x0 + w - 60 * SS, c, x0 + w - 36 * SS, c + 24 * SS], fill=glow)
    elif key("window", "mirror"):
        if key("mirror"):
            d.ellipse([c - S * 0.24, S * 0.08, c + S * 0.24, S * 0.86], fill=ink)
            d.ellipse([c - S * 0.2, S * 0.12, c + S * 0.2, S * 0.82], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
            d.line([(c - S * 0.1, S * 0.25), (c + S * 0.05, S * 0.6)], fill=(255, 255, 255, 140), width=10 * SS)
        else:
            d.rectangle([c - S * 0.3, S * 0.12, c + S * 0.3, S * 0.82], fill=ink)
            d.rectangle([c - S * 0.26, S * 0.16, c + S * 0.26, S * 0.78], fill=glow)
            d.line([(c, S * 0.16), (c, S * 0.78)], fill=ink, width=14 * SS)
            d.line([(c - S * 0.26, S * 0.47), (c + S * 0.26, S * 0.47)], fill=ink, width=14 * SS)
    elif key("clock", "watch"):
        r = S * 0.34
        d.ellipse([c - r, c - r, c + r, c + r], fill=ink)
        d.ellipse([c - r * 0.86, c - r * 0.86, c + r * 0.86, c + r * 0.86], fill=glow)
        for i in range(12):
            a = i / 12 * math.tau
            d.line([(c + math.cos(a) * r * 0.7, c + math.sin(a) * r * 0.7), (c + math.cos(a) * r * 0.8, c + math.sin(a) * r * 0.8)], fill=ink, width=6 * SS)
        if rng.random() < 0.5:  # dream clocks often have no hands
            d.line([(c, c), (c + r * 0.4, c - r * 0.3)], fill=ink, width=8 * SS)
            d.line([(c, c), (c - r * 0.1, c - r * 0.62)], fill=ink, width=6 * SS)
    elif key("tree"):
        d.polygon([(c - 24 * SS, S), (c + 24 * SS, S), (c + 12 * SS, S * 0.45), (c - 12 * SS, S * 0.45)], fill=ink)
        for _ in range(9):
            x, y = c + rng.uniform(-S * 0.25, S * 0.25), rng.uniform(S * 0.1, S * 0.5)
            r = rng.uniform(S * 0.1, S * 0.18)
            d.ellipse([x - r, y - r, x + r, y + r], fill=ink)
    elif key("flower", "rose"):
        d.line([(c, S), (c, S * 0.4)], fill=ink, width=10 * SS)
        for i in range(6):
            a = i / 6 * math.tau
            px, py = c + math.cos(a) * S * 0.09, S * 0.32 + math.sin(a) * S * 0.09
            d.ellipse([px - S * 0.07, py - S * 0.07, px + S * 0.07, py + S * 0.07], fill=acc)
        d.ellipse([c - S * 0.04, S * 0.28, c + S * 0.04, S * 0.36], fill=glow)
    elif key("stair", "step", "ladder", "balcony", "railing", "terrace"):
        if key("ladder"):
            d.line([(c - S * 0.14, S), (c - S * 0.1, 0)], fill=ink, width=14 * SS)
            d.line([(c + S * 0.14, S), (c + S * 0.1, 0)], fill=ink, width=14 * SS)
            for i in range(1, 9):
                y = S * i / 9
                d.line([(c - S * 0.13, y), (c + S * 0.13, y)], fill=ink, width=10 * SS)
        elif key("balcony", "railing", "terrace"):
            d.rectangle([S * 0.08, S * 0.82, S * 0.92, S * 0.9], fill=ink)
            d.rectangle([S * 0.08, S * 0.45, S * 0.92, S * 0.5], fill=ink)
            for x in np.linspace(S * 0.1, S * 0.9, 9):
                d.rectangle([x - 6 * SS, S * 0.5, x + 6 * SS, S * 0.82], fill=ink)
        else:
            pts = [(S * 0.08, S)]
            for i in range(7):
                x = S * 0.08 + i * S * 0.12
                y = S - (i + 1) * S * 0.12
                pts += [(x, y), (x + S * 0.12, y)]
            pts += [(S * 0.92, S)]
            d.polygon(pts, fill=ink)
    elif key("boat", "ship", "canoe"):
        d.polygon([(S * 0.08, S * 0.62), (S * 0.92, S * 0.62), (S * 0.74, S * 0.8), (S * 0.26, S * 0.8)], fill=ink)
        d.line([(c, S * 0.62), (c, S * 0.15)], fill=ink, width=8 * SS)
        d.polygon([(c + 6 * SS, S * 0.18), (c + 6 * SS, S * 0.56), (S * 0.8, S * 0.56)], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
    elif key("car", "bus", "train"):
        w = S * (0.86 if key("bus", "train") else 0.7)
        d.rounded_rectangle([c - w / 2, S * 0.42, c + w / 2, S * 0.76], radius=30 * SS, fill=ink)
        for i in range(4 if key("bus", "train") else 2):
            wx = c - w / 2 + 30 * SS + i * (w - 60 * SS) / (4 if key("bus", "train") else 2)
            d.rectangle([wx, S * 0.48, wx + w / 6, S * 0.58], fill=glow)
        for x in (c - w * 0.32, c + w * 0.32):
            d.ellipse([x - S * 0.07, S * 0.7, x + S * 0.07, S * 0.84], fill=ink)
    elif key("lamp", "lantern", "streetlight", "candle"):
        if key("candle"):
            d.rectangle([c - S * 0.06, S * 0.45, c + S * 0.06, S * 0.9], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
            d.ellipse([c - S * 0.03, S * 0.32, c + S * 0.03, S * 0.44], fill=glow)
        else:
            d.line([(c, S), (c, S * 0.25)], fill=ink, width=12 * SS)
            d.rectangle([c - S * 0.08, S * 0.12, c + S * 0.08, S * 0.3], fill=ink)
            d.rectangle([c - S * 0.06, S * 0.14, c + S * 0.06, S * 0.28], fill=glow)
    elif key("moon", "star", "balloon", "kite", "sun"):
        if key("star"):
            pts = []
            for i in range(10):
                a = -math.pi / 2 + i * math.pi / 5
                r = S * (0.36 if i % 2 == 0 else 0.15)
                pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
            d.polygon(pts, fill=glow)
        elif key("balloon"):
            d.ellipse([c - S * 0.2, S * 0.08, c + S * 0.2, S * 0.56], fill=acc)
            d.line([(c, S * 0.56), (c + 20 * SS, S)], fill=ink, width=4 * SS)
        elif key("kite"):
            d.polygon([(c, S * 0.06), (c + S * 0.22, S * 0.32), (c, S * 0.66), (c - S * 0.22, S * 0.32)], fill=acc)
            d.line([(c, S * 0.66), (c - 40 * SS, S)], fill=ink, width=4 * SS)
        else:
            d.ellipse([c - S * 0.34, c - S * 0.34, c + S * 0.34, c + S * 0.34], fill=glow)
            if key("moon"):
                d.ellipse([c - S * 0.18, c - S * 0.4, c + S * 0.46, c + S * 0.26], fill=(0, 0, 0, 0))
    elif key("key"):
        d.ellipse([S * 0.12, c - S * 0.14, S * 0.4, c + S * 0.14], outline=acc, width=26 * SS)
        d.rectangle([S * 0.38, c - 12 * SS, S * 0.88, c + 12 * SS], fill=acc)
        for x in (S * 0.72, S * 0.82):
            d.rectangle([x, c, x + 22 * SS, c + S * 0.12], fill=acc)
    elif key("house", "home", "cottage", "temple", "church", "tower", "lighthouse", "tent", "roof"):
        if key("tower", "lighthouse"):
            d.polygon([(c - S * 0.12, S), (c + S * 0.12, S), (c + S * 0.08, S * 0.18), (c - S * 0.08, S * 0.18)], fill=ink)
            d.rectangle([c - S * 0.08, S * 0.08, c + S * 0.08, S * 0.2], fill=glow)
        elif key("tent"):
            d.polygon([(c, S * 0.2), (S * 0.92, S), (S * 0.08, S)], fill=ink)
            d.polygon([(c, S * 0.5), (c + S * 0.1, S), (c - S * 0.1, S)], fill=glow)
        else:
            d.rectangle([S * 0.18, S * 0.48, S * 0.82, S], fill=ink)
            d.polygon([(S * 0.1, S * 0.5), (c, S * 0.14), (S * 0.9, S * 0.5)], fill=ink)
            d.rectangle([S * 0.28, S * 0.6, S * 0.4, S * 0.72], fill=glow)
            d.rectangle([S * 0.56, S * 0.68, S * 0.7, S], fill=soft)
    elif key("chair", "bench", "bed", "table", "desk", "piano", "swing"):
        top_y = S * (0.55 if key("bed", "bench") else 0.5)
        d.rectangle([S * 0.12, top_y, S * 0.88, top_y + S * 0.08], fill=ink)
        for x in (S * 0.16, S * 0.8):
            d.rectangle([x, top_y, x + S * 0.04, S], fill=ink)
        if key("chair"):
            d.rectangle([S * 0.12, S * 0.18, S * 0.18, top_y], fill=ink)
        if key("bed"):
            d.rectangle([S * 0.12, S * 0.4, S * 0.2, top_y], fill=ink)
            d.rectangle([S * 0.22, top_y - S * 0.06, S * 0.88, top_y], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
        if key("piano"):
            for x in np.linspace(S * 0.16, S * 0.84, 14):
                d.rectangle([x, top_y - S * 0.06, x + 10 * SS, top_y], fill=(240, 236, 226, 255))
    elif key("book", "letter", "phone", "box", "suitcase"):
        if key("letter"):
            d.rectangle([S * 0.18, S * 0.3, S * 0.82, S * 0.7], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
            d.line([(S * 0.18, S * 0.3), (c, S * 0.52), (S * 0.82, S * 0.3)], fill=ink, width=8 * SS)
        elif key("phone"):
            d.rounded_rectangle([c - S * 0.14, S * 0.15, c + S * 0.14, S * 0.85], radius=24 * SS, fill=ink)
            d.rectangle([c - S * 0.11, S * 0.22, c + S * 0.11, S * 0.74], fill=glow)
        else:
            d.rectangle([S * 0.2, S * 0.35, S * 0.8, S * 0.8], fill=ink)
            d.rectangle([S * 0.24, S * 0.39, S * 0.76, S * 0.76], fill=soft)
            if key("suitcase"):
                d.rectangle([c - S * 0.08, S * 0.27, c + S * 0.08, S * 0.35], outline=ink, width=10 * SS)
    elif key("bridge"):
        d.rectangle([0, S * 0.45, S, S * 0.52], fill=ink)
        d.arc([S * 0.12, S * 0.45, S * 0.88, S * 1.2], 180, 360, fill=ink, width=20 * SS)
        for x in np.linspace(S * 0.05, S * 0.95, 10):
            d.line([(x, S * 0.45), (x, S * 0.32)], fill=ink, width=6 * SS)
    elif key("well", "fountain"):
        d.ellipse([S * 0.14, S * 0.5, S * 0.86, S * 0.68], fill=ink)
        d.rectangle([S * 0.14, S * 0.59, S * 0.86, S * 0.9], fill=ink)
        d.ellipse([S * 0.2, S * 0.52, S * 0.8, S * 0.64], fill=(*_hex(palette.get("mist", "#BDCEBC")), 255))
    elif key("statue", "pillar", "column"):
        d.rectangle([c - S * 0.12, S * 0.12, c + S * 0.12, S * 0.92], fill=ink)
        d.rectangle([c - S * 0.18, S * 0.06, c + S * 0.18, S * 0.14], fill=ink)
        d.rectangle([c - S * 0.18, S * 0.9, c + S * 0.18, S], fill=ink)
    elif key("bell"):
        d.polygon([(c - S * 0.3, S * 0.8), (c + S * 0.3, S * 0.8), (c + S * 0.18, S * 0.3), (c - S * 0.18, S * 0.3)], fill=acc)
        d.ellipse([c - S * 0.18, S * 0.18, c + S * 0.18, S * 0.42], fill=acc)
        d.ellipse([c - S * 0.05, S * 0.78, c + S * 0.05, S * 0.88], fill=ink)
    else:
        r = S * 0.24
        tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        td = ImageDraw.Draw(tmp)
        td.ellipse([c - r * 1.6, c - r * 1.6, c + r * 1.6, c + r * 1.6], fill=(*acc_rgb, 70))
        img = Image.alpha_composite(img, tmp.filter(ImageFilter.GaussianBlur(30 * SS)))
        d = ImageDraw.Draw(img)
        d.ellipse([c - r, c - r, c + r, c + r], fill=glow)
        d.ellipse([c - r, c - r, c + r, c + r], outline=ink, width=8 * SS)

    out = img.resize((512, 512), Image.LANCZOS)
    bbox = out.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
    return out.crop(bbox) if bbox else out


# ---- figures ----------------------------------------------------------------------------


def paint_figure(figure: dict[str, Any], visibility: str, palette: dict[str, str]) -> Image.Image:
    """Full-body ink figure (alpha PNG, feet at the bottom edge) from a FigureSpec dict."""
    W, H = 420 * SS, 900 * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink_rgb = _hex(palette.get("ink", "#14181C"))
    ink = (*ink_rgb, 255)
    garment_rgb = _mix(_hex(figure.get("color", "#559CA9")), ink_rgb, 0.45)
    garment = (*garment_rgb, 255)
    skin = (*_mix((214, 196, 170), ink_rgb, 0.15), 255)
    kind = str(figure.get("kind", "human"))
    height = float(figure.get("height", 1.0))
    build = {"slight": 0.82, "average": 1.0, "broad": 1.22}.get(str(figure.get("build", "average")), 1.0)
    cx = W / 2

    if kind == "human":
        total = H * 0.86 * min(1.0, height / 1.25)
        top = H - total
        head_r = total * 0.075
        head_cy = top + head_r
        shoulder_y = top + total * 0.19
        hip_y = top + total * 0.53
        sw = total * 0.085 * build
        hw = total * 0.068 * build
        garment_kind = str(figure.get("garment", "plain"))

        # legs
        leg_w = total * 0.035 * build
        for side in (-1, 1):
            d.polygon([(cx + side * hw * 0.25 - leg_w, hip_y), (cx + side * hw * 0.25 + leg_w, hip_y),
                       (cx + side * hw * 0.42 + leg_w * 0.8, H), (cx + side * hw * 0.42 - leg_w * 0.8, H)], fill=ink)
        # torso / garment
        hem = {"coat": top + total * 0.78, "dress": H - total * 0.06, "robe": H - total * 0.02,
               "suit": hip_y + total * 0.04, "uniform": hip_y + total * 0.04, "plain": hip_y + total * 0.02}[garment_kind]
        flare = {"dress": 1.9, "robe": 1.6, "coat": 1.3}.get(garment_kind, 1.05)
        d.polygon([(cx - sw * 0.8, shoulder_y - total * 0.012), (cx + sw * 0.8, shoulder_y - total * 0.012),
                   (cx + sw, shoulder_y + total * 0.03), (cx + hw * 0.95, hip_y - total * 0.05),
                   (cx + hw * flare, hem), (cx - hw * flare, hem), (cx - hw * 0.95, hip_y - total * 0.05),
                   (cx - sw, shoulder_y + total * 0.03)], fill=garment)
        d.polygon([(cx - head_r * 0.45, shoulder_y - total * 0.012), (cx + head_r * 0.45, shoulder_y - total * 0.012),
                   (cx, shoulder_y + total * 0.06)], fill=ink)
        if garment_kind == "uniform":
            d.rectangle([cx - hw * 1.05, hip_y - total * 0.03, cx + hw * 1.05, hip_y], fill=ink)
        # arms
        arm_w = total * 0.026 * build * (1.5 if garment_kind == "robe" else 1.0)
        sleeve = (*_mix(garment_rgb, ink_rgb, 0.35), 255)
        for side in (-1, 1):
            sx = cx + side * (sw - arm_w * 0.2)
            hx = cx + side * (sw + arm_w * 1.3)
            d.polygon([(sx - arm_w, shoulder_y + total * 0.005), (sx + arm_w, shoulder_y + total * 0.005),
                       (hx + arm_w * 0.8, hip_y + total * 0.03), (hx - arm_w * 0.8, hip_y + total * 0.03)], fill=sleeve)
            d.ellipse([hx - arm_w * 0.9, hip_y + total * 0.02, hx + arm_w * 0.9, hip_y + total * 0.06], fill=skin if visibility == "full" else ink)
        # neck + head
        d.rectangle([cx - head_r * 0.35, head_cy + head_r * 0.6, cx + head_r * 0.35, shoulder_y + 2], fill=ink)
        face = skin if visibility == "full" else ink
        d.ellipse([cx - head_r * 0.85, head_cy - head_r, cx + head_r * 0.85, head_cy + head_r], fill=face)
        hair = str(figure.get("hair", "short"))
        if visibility == "hidden" or hair == "hood":
            d.polygon([(cx - head_r * 1.35, head_cy + head_r * 1.2), (cx, head_cy - head_r * 1.5),
                       (cx + head_r * 1.35, head_cy + head_r * 1.2)], fill=garment)
            d.ellipse([cx - head_r * 0.6, head_cy - head_r * 0.6, cx + head_r * 0.6, head_cy + head_r * 0.8], fill=ink)
        elif hair == "long":
            d.ellipse([cx - head_r * 1.0, head_cy - head_r * 1.15, cx + head_r * 1.0, head_cy + head_r * 0.2], fill=ink)
            d.polygon([(cx - head_r, head_cy - head_r * 0.2), (cx - head_r * 1.15, shoulder_y + total * 0.08),
                       (cx - head_r * 0.6, shoulder_y + total * 0.08)], fill=ink)
            d.polygon([(cx + head_r, head_cy - head_r * 0.2), (cx + head_r * 1.15, shoulder_y + total * 0.08),
                       (cx + head_r * 0.6, shoulder_y + total * 0.08)], fill=ink)
        elif hair == "curly":
            for i in range(7):
                a = math.pi + i * math.pi / 6
                hx, hy = cx + math.cos(a) * head_r * 0.85, head_cy + math.sin(a) * head_r * 0.9
                d.ellipse([hx - head_r * 0.38, hy - head_r * 0.38, hx + head_r * 0.38, hy + head_r * 0.38], fill=ink)
        elif hair == "short":
            d.chord([cx - head_r * 0.9, head_cy - head_r * 1.08, cx + head_r * 0.9, head_cy + head_r * 0.5], 180, 360, fill=ink)
        if visibility == "shadowed":
            rim = _hex(palette.get("glow", "#F3D998"))
            d.arc([cx - head_r * 0.85, head_cy - head_r, cx + head_r * 0.85, head_cy + head_r], 200, 320, fill=(*rim, 200), width=4 * SS)

        acc = str(figure.get("accessory", "none"))
        if acc == "hat":
            d.rectangle([cx - head_r * 1.5, head_cy - head_r * 0.75, cx + head_r * 1.5, head_cy - head_r * 0.55], fill=ink)
            d.rectangle([cx - head_r * 0.8, head_cy - head_r * 1.6, cx + head_r * 0.8, head_cy - head_r * 0.6], fill=ink)
        elif acc == "umbrella":
            hx = cx + sw + arm_w
            d.line([(hx, hip_y - total * 0.02), (hx, top - total * 0.06)], fill=ink, width=5 * SS)
            d.chord([hx - total * 0.24, top - total * 0.18, hx + total * 0.24, top + total * 0.06], 180, 360,
                    fill=(*_hex(figure.get("color", "#559CA9")), 255))
        elif acc == "cane":
            d.line([(cx + sw + arm_w, hip_y), (cx + sw + arm_w * 2.5, H)], fill=ink, width=6 * SS)
        elif acc == "bag":
            d.rectangle([cx - sw - arm_w * 3.2, hip_y - total * 0.03, cx - sw - arm_w * 0.6, hip_y + total * 0.07], fill=ink)
        elif acc == "lantern":
            lx, ly = cx + sw + arm_w * 1.4, hip_y + total * 0.06
            d.rectangle([lx - 18 * SS, ly, lx + 18 * SS, ly + 42 * SS], fill=(*_hex(palette.get("glow", "#F3D998")), 255))
        elif acc == "glasses" and visibility == "full":
            for side in (-1, 1):
                ex = cx + side * head_r * 0.35
                d.ellipse([ex - head_r * 0.25, head_cy - head_r * 0.15, ex + head_r * 0.25, head_cy + head_r * 0.2],
                          outline=ink, width=3 * SS)
    else:
        size = H * 0.42 * height
        base = H
        cx = W * 0.4  # leave room on the right for heads
        if kind in ("bird", "moth"):
            body_cy = base - size * 0.45
            d.ellipse([cx - size * 0.32, body_cy - size * 0.2, cx + size * 0.28, body_cy + size * 0.2], fill=garment)
            d.ellipse([cx + size * 0.12, body_cy - size * 0.38, cx + size * 0.4, body_cy - size * 0.1], fill=ink)
            d.polygon([(cx + size * 0.4, body_cy - size * 0.26), (cx + size * 0.55, body_cy - size * 0.22),
                       (cx + size * 0.4, body_cy - size * 0.18)], fill=(*_hex(palette.get("accent", "#E2B866")), 255))
            d.polygon([(cx - size * 0.1, body_cy - size * 0.05), (cx - size * 0.5, body_cy - size * 0.55),
                       (cx + size * 0.12, body_cy - size * 0.02)], fill=ink)
            if kind == "bird":
                for side in (-1, 1):
                    d.line([(cx + side * size * 0.06, body_cy + size * 0.18), (cx + side * size * 0.06, base)], fill=ink, width=4 * SS)
        elif kind == "fish":
            body_cy = base - size * 0.9
            d.ellipse([cx - size * 0.5, body_cy - size * 0.2, cx + size * 0.35, body_cy + size * 0.2], fill=garment)
            d.polygon([(cx - size * 0.45, body_cy), (cx - size * 0.75, body_cy - size * 0.22), (cx - size * 0.75, body_cy + size * 0.22)], fill=ink)
        elif kind == "snake":
            pts = [(cx - size * 0.6 + i * size * 0.06, base - size * 0.1 - math.sin(i * 0.6) * size * 0.08) for i in range(21)]
            d.line(pts, fill=garment, width=int(size * 0.08), joint="curve")
        else:  # quadrupeds: dog, wolf, cat, fox, deer, horse, rabbit, generic creature
            tall = 1.6 if kind in ("deer", "horse") else 1.0
            body_y = base - size * 0.42 * tall
            bw = size * (0.55 if kind != "cat" else 0.45)
            d.ellipse([cx - bw, body_y - size * 0.16, cx + bw * 0.8, body_y + size * 0.16], fill=garment)
            for lx in (cx - bw * 0.7, cx - bw * 0.4, cx + bw * 0.4, cx + bw * 0.65):
                d.rectangle([lx - size * 0.035, body_y, lx + size * 0.035, base], fill=ink)
            hx, hy = cx + bw * 0.95, body_y - size * (0.36 if tall > 1 else 0.2)
            d.line([(cx + bw * 0.55, body_y - size * 0.02), (hx, hy)], fill=garment, width=int(size * 0.14))
            d.ellipse([hx - size * 0.13, hy - size * 0.12, hx + size * 0.17, hy + size * 0.1], fill=ink)
            ear = size * (0.3 if kind == "rabbit" else 0.12)
            d.polygon([(hx - size * 0.06, hy - size * 0.08), (hx - size * 0.02, hy - size * 0.08 - ear), (hx + size * 0.04, hy - size * 0.08)], fill=ink)
            if kind in ("deer",):
                d.line([(hx, hy - size * 0.1), (hx - size * 0.1, hy - size * 0.38)], fill=ink, width=5 * SS)
                d.line([(hx + size * 0.05, hy - size * 0.1), (hx + size * 0.14, hy - size * 0.36)], fill=ink, width=5 * SS)
            tail = {"fox": 0.42, "wolf": 0.34, "cat": 0.4, "dog": 0.22}.get(kind, 0.18)
            d.line([(cx - bw, body_y - size * 0.05), (cx - bw - size * tail * 0.7, body_y - size * tail)], fill=garment, width=int(size * 0.07))

    # Soft lantern-coloured rim glow behind the figure so it separates from dark backdrops.
    alpha = img.getchannel("A")
    halo = Image.new("RGBA", img.size, (*_hex(palette.get("glow", "#F3D998")), 0))
    halo.putalpha(alpha.filter(ImageFilter.GaussianBlur(10 * SS)).point(lambda v: int(v * 0.35)))
    out = Image.alpha_composite(halo, img).resize((420, 900), Image.LANCZOS)
    bbox = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        out = out.crop((bbox[0], bbox[1], bbox[2], 900))  # keep feet on the bottom edge
    return out


# --------------------------------------------------------------------------------------
# Public API (cached)
# --------------------------------------------------------------------------------------


def backdrop_asset(prompt: str, setting_kind: str, time_of_day: str, mood: str, palette: dict[str, str], seed: int) -> dict[str, str]:
    provider = active_provider()
    name = f"bg_{_cache_key('bg', provider, prompt, setting_kind, time_of_day, mood, sorted(palette.items()), seed)}.jpg"
    cached = _cached(name)
    if cached:
        return {"url": cached, "provider": provider}
    img = _cloud_image(f"{prompt}. {STYLE_SUFFIX}", seed, *BACKDROP_SIZE)
    used = provider
    if img is None:
        used = "procedural"
        name = f"bg_{_cache_key('bg', 'procedural', prompt, setting_kind, time_of_day, mood, sorted(palette.items()), seed)}.jpg"
        cached = _cached(name)
        if cached:
            return {"url": cached, "provider": used}
        img = paint_backdrop(setting_kind, time_of_day, mood, palette, seed)
    return {"url": _save(img, name), "provider": used}


def depth_layers(setting_kind: str, palette: dict[str, str], seed: int) -> dict[str, str]:
    mist_name = f"mist_{_cache_key('mist', sorted(palette.items()), seed)}.png"
    fg_name = f"fg_{_cache_key('fg', setting_kind, sorted(palette.items()), seed)}.png"
    mist = _cached(mist_name) or _save(paint_mist_layer(palette, seed), mist_name)
    fg = _cached(fg_name) or _save(paint_foreground_layer(setting_kind, palette, seed), fg_name)
    return {"mist": mist, "foreground": fg}


def object_asset(name: str, palette: dict[str, str], seed: int) -> dict[str, Any]:
    provider = active_provider()
    if provider == "procedural" and not is_drawable(name):
        return {"skip": True, "provider": provider}
    fname = f"obj_{_cache_key('obj', provider, name, sorted(palette.items()), seed)}.png"
    cached = _cached(fname)
    if cached:
        with Image.open(storage_dir(FILM_DIR_NAME) / fname) as im:
            return {"url": cached, "provider": provider, "aspect": im.width / max(1, im.height)}
    img: Image.Image | None = None
    used = provider
    cloud = _cloud_image(f"{name}, {OBJECT_SUFFIX}, {STYLE_SUFFIX}", seed, 768, 768)
    if cloud is not None:
        img = _remove_plain_background(cloud)
    if img is None:
        if not is_drawable(name):
            return {"skip": True, "provider": "procedural"}
        used = "procedural"
        fname = f"obj_{_cache_key('obj', 'procedural', name, sorted(palette.items()), seed)}.png"
        cached = _cached(fname)
        if cached:
            with Image.open(storage_dir(FILM_DIR_NAME) / fname) as im:
                return {"url": cached, "provider": used, "aspect": im.width / max(1, im.height)}
        img = paint_object(name, palette, seed)
    return {"url": _save(img, fname), "provider": used, "aspect": img.width / max(1, img.height)}


def figure_asset(figure: dict[str, Any], visibility: str, palette: dict[str, str]) -> dict[str, Any]:
    fname = f"fig_{_cache_key('fig', sorted(figure.items()), visibility, sorted(palette.items()))}.png"
    path = storage_dir(FILM_DIR_NAME) / fname
    if path.exists():
        with Image.open(path) as im:
            return {"url": f"/storage/{FILM_DIR_NAME}/{fname}", "aspect": im.width / max(1, im.height)}
    img = paint_figure(figure, visibility, palette)
    return {"url": _save(img, fname), "aspect": img.width / max(1, img.height)}

#!/usr/bin/env python3
"""Rebuild public/brand and app tab icons from brand-src/*-raw.png."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:
    raise SystemExit("Pillow required: pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "brand-src"
OUT = ROOT / "public" / "brand"
APP = ROOT / "src" / "app"
INK = (22, 20, 31, 255)


def lift_from_black(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = max(r, g, b)
            if a < 8:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (
                    min(255, int(r * 255 / a)),
                    min(255, int(g * 255 / a)),
                    min(255, int(b * 255 / a)),
                    a,
                )
    return im


def crop_alpha(im: Image.Image, pad_ratio: float) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    pad = max(4, int(max(r - l, b - t) * pad_ratio))
    return im.crop(
        (max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad))
    )


def fit_square(im: Image.Image, size: int, bg=None) -> Image.Image:
    im = im.copy()
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg if bg else (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas


def fill_white_corners(im: Image.Image) -> Image.Image:
    """App icons are a rounded square on white. Tabs need a full black square."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def is_outer_white(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a < 250:
            return True
        hi, lo = max(r, g, b), min(r, g, b)
        if r > 200 and g > 200 and b > 200:
            return True
        return hi - lo < 22 and hi > 28

    seen = bytearray(w * h)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        if not is_outer_white(x, y):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 255)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
    bg.alpha_composite(im)
    return bg


def as_circle(im: Image.Image, size: int) -> Image.Image:
    """Tab favicon: circular disc, transparent outside so the tab shows a round icon."""
    hi = size * 4
    scaled = im.resize((hi, hi), Image.Resampling.LANCZOS)
    mask = Image.new("L", (hi, hi), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, hi - 1, hi - 1), fill=255)
    scaled.putalpha(mask)
    return scaled.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mark = crop_alpha(lift_from_black(Image.open(SRC / "mark-raw.png")), 0.10)
    word = crop_alpha(lift_from_black(Image.open(SRC / "wordmark-raw.png")), 0.06)
    mark.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    word.thumbnail((1600, 400), Image.Resampling.LANCZOS)
    mark.save(OUT / "mark.png", optimize=True)
    word.save(OUT / "wordmark.png", optimize=True)
    icon_raw = SRC / "app-icon-raw.png"
    tab = fill_white_corners(Image.open(icon_raw)) if icon_raw.exists() else None

    def save_square(size: int, dest: Path) -> None:
        src = tab if tab is not None else fit_square(mark, size, INK)
        src.resize((size, size), Image.Resampling.LANCZOS).save(dest, optimize=True)

    def save_round(size: int, dest: Path) -> None:
        src = tab if tab is not None else fit_square(mark, size, INK)
        as_circle(src, size).save(dest, optimize=True)

    save_round(32, OUT / "favicon.png")
    save_square(180, OUT / "apple-touch-icon.png")
    save_round(512, OUT / "icon-512.png")
    save_round(512, APP / "icon.png")
    save_square(180, APP / "apple-icon.png")
    if tab is not None:
        as_circle(tab, 48).save(
            APP / "favicon.ico",
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48)],
        )
    print("brand assets ready", mark.size, word.size)


if __name__ == "__main__":
    main()

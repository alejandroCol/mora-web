#!/usr/bin/env python3
"""Rebuild public/brand and app tab icons from brand-src/*-raw.png."""

from pathlib import Path

try:
    from PIL import Image
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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mark = crop_alpha(lift_from_black(Image.open(SRC / "mark-raw.png")), 0.10)
    word = crop_alpha(lift_from_black(Image.open(SRC / "wordmark-raw.png")), 0.06)
    mark.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    word.thumbnail((1600, 400), Image.Resampling.LANCZOS)
    mark.save(OUT / "mark.png", optimize=True)
    word.save(OUT / "wordmark.png", optimize=True)
    fit_square(mark, 32, INK).save(OUT / "favicon.png", optimize=True)
    fit_square(mark, 180, INK).save(OUT / "apple-touch-icon.png", optimize=True)
    fit_square(mark, 512, INK).save(OUT / "icon-512.png", optimize=True)
    fit_square(mark, 32, INK).save(APP / "icon.png", optimize=True)
    fit_square(mark, 180, INK).save(APP / "apple-icon.png", optimize=True)
    print("brand assets ready", mark.size, word.size)


if __name__ == "__main__":
    main()

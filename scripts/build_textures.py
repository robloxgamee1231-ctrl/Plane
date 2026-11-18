"""Seeded original tileable detail textures; Pillow and NumPy only."""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np, random, math
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "public/textures"
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(2201)
random.seed(2201)
for name, bias in [
    ("grass", (206, 212, 191)),
    ("sand", (226, 215, 196)),
    ("tarmac", (172, 177, 175)),
]:
    size = 512
    noise = rng.normal(0, 9, (size, size))
    coarse = (
        np.asarray(
            Image.fromarray(rng.integers(0, 255, (32, 32), dtype=np.uint8)).resize(
                (size, size), Image.Resampling.BICUBIC
            )
        )
        / 11.0
        - 10
    )
    xx, yy = np.meshgrid(np.arange(size), np.arange(size))
    bands = (
        np.sin((xx + yy * 0.16) * 2 * math.pi / 32) * 2.4
        if name == "grass"
        else np.cos((xx + yy * 0.24) * 2 * math.pi / 58) * 3 if name == "sand" else 0
    )
    a = np.stack([np.clip(b + noise + coarse + bands, 0, 255) for b in bias], axis=2).astype(
        np.uint8
    )
    im = Image.fromarray(a)
    g = ImageDraw.Draw(im)
    if name == "grass":
        for i in range(6000):
            x = random.randrange(size)
            y = random.randrange(size)
            g.line(
                (x, y, x + random.randrange(0, 3), y - random.randrange(2, 5)),
                fill=(
                    189 + random.randrange(22),
                    201 + random.randrange(20),
                    170 + random.randrange(22),
                ),
            )
    im.save(out / (name + ".webp"), quality=85)
# Original shaded cloud sprite. Layered soft volumes, entirely generated here.
w, h = 384, 160
xx, yy = np.meshgrid(np.arange(w), np.arange(h))
density = np.zeros((h, w))
light = np.zeros((h, w))
for i in range(55):
    t = random.uniform(0.12, 0.87)
    x = w * t
    y = h * (0.63 - 0.23 * math.sin(t * math.pi) + random.uniform(-0.08, 0.10))
    rx = random.uniform(16, 50)
    ry = random.uniform(12, 34)
    p = np.maximum(0, 1 - ((xx - x) / rx) ** 2 - ((yy - y) / ry) ** 2)
    v = p**0.67
    density = np.maximum(density, v)
    light = np.maximum(light, v * (1.07 - (yy - y) / ry * 0.31))
soft = (
    np.asarray(
        Image.fromarray(np.uint8(np.clip(density, 0, 1) * 255)).filter(
            ImageFilter.GaussianBlur(1.6)
        )
    )
    / 255
)
fine = (
    np.asarray(
        Image.fromarray(rng.integers(0, 255, (22, 45), dtype=np.uint8)).resize(
            (w, h), Image.Resampling.BICUBIC
        )
    )
    / 255
)
alpha = np.clip(soft * (1.01 - 0.36 * fine), 0, 1)
lum = (0.77 + 0.20 * np.clip(light, 0, 1) + 0.05 * fine) * 255
rgba = np.stack([lum * 0.995, lum, lum * 1.008, alpha * 255], axis=2).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba).save(out / "cumulus.webp", quality=92)

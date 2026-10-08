"""Build the wet / dry / mixed image folders from the 12-class waste dataset.

wet   = 'biological' (food scraps, peels, organic waste)
dry   = every other class (paper, cardboard, plastic, metal, glass, clothes, shoes, battery, trash)
mixed = synthetic: collages that contain at least one wet AND one dry item

Splitting happens BEFORE the mixed images are synthesised, and a mixed image only uses source
photos from its own split, so no photo leaks between train/val/test.

Usage: python prepare_data.py [--parquet data/raw/train.parquet] [--out data/prepared] [--seed 0]
"""
import argparse
import io
import random
import shutil
from pathlib import Path

import pyarrow.parquet as pq
from PIL import Image, ImageFilter

LABELS = ["battery", "biological", "brown-glass", "cardboard", "clothes", "green-glass",
          "metal", "paper", "plastic", "shoes", "trash", "white-glass"]
WET_CLASS = "biological"
SIZE = 256  # stored size; training crops to 224
SPLITS = {"train": 0.8, "val": 0.1, "test": 0.1}
MIXED_PER_WET = 2  # mixed images generated per wet image in each split


def load_images(parquet_path):
    table = pq.read_table(parquet_path).to_pydict()
    for img, lab in zip(table["image"], table["label"]):
        name = LABELS[lab]
        im = Image.open(io.BytesIO(img["bytes"])).convert("RGB")
        im.thumbnail((SIZE * 2, SIZE * 2))
        yield im, name


def fit_square(im, size=SIZE):
    """Center-crop to a square then resize."""
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    return im.resize((size, size), Image.BILINEAR)


def make_mixed(wets, drys, rng):
    """Collage 1-3 wet items and 1-3 dry items onto a ground-like background, overlapping like a pile."""
    n_wet, n_dry = rng.randint(1, 3), rng.randint(1, 3)
    items = [rng.choice(wets) for _ in range(n_wet)] + [rng.choice(drys) for _ in range(n_dry)]
    rng.shuffle(items)

    base = rng.choice(drys + wets)
    canvas = fit_square(base).filter(ImageFilter.GaussianBlur(rng.uniform(4, 10)))
    for it in items:
        side = rng.randint(int(SIZE * 0.40), int(SIZE * 0.70))
        patch = it.resize((side, side), Image.BILINEAR).rotate(rng.uniform(-35, 35), expand=True, resample=Image.BILINEAR)
        # soft elliptical mask so patches blend rather than look like pasted squares
        mask = Image.new("L", patch.size, 0)
        inner = Image.new("L", (int(patch.size[0] * 0.9), int(patch.size[1] * 0.9)), 255)
        mask.paste(inner, (int(patch.size[0] * 0.05), int(patch.size[1] * 0.05)))
        mask = mask.filter(ImageFilter.GaussianBlur(5))
        x = rng.randint(-side // 5, SIZE - side + side // 5)
        y = rng.randint(-side // 5, SIZE - side + side // 5)
        canvas.paste(patch, (x, y), mask)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parquet", default="data/raw/train.parquet")
    ap.add_argument("--out", default="data/prepared")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)

    items = {"wet": [], "dry": []}
    for im, name in load_images(args.parquet):
        items["wet" if name == WET_CLASS else "dry"].append(fit_square(im))
    print({k: len(v) for k, v in items.items()})

    split_items = {s: {"wet": [], "dry": []} for s in SPLITS}
    for cls, imgs in items.items():
        rng.shuffle(imgs)
        n, start = len(imgs), 0
        for i, (s, frac) in enumerate(SPLITS.items()):
            end = n if i == len(SPLITS) - 1 else start + int(n * frac)
            split_items[s][cls] = imgs[start:end]
            start = end

    for s, d in split_items.items():
        for cls in ("wet", "dry"):
            (out / s / cls).mkdir(parents=True, exist_ok=True)
            for i, im in enumerate(d[cls]):
                im.save(out / s / cls / f"{i:05d}.jpg", quality=92)
        (out / s / "mixed").mkdir(parents=True, exist_ok=True)
        for i in range(len(d["wet"]) * MIXED_PER_WET):
            make_mixed(d["wet"], d["dry"], rng).save(out / s / "mixed" / f"{i:05d}.jpg", quality=92)
        print(s, {c: len(list((out / s / c).glob("*.jpg"))) for c in ("wet", "dry", "mixed")})


if __name__ == "__main__":
    main()

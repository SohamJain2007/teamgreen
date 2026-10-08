"""Classify photos as dry / mixed / wet with the exported ONNX model.

Usage: python predict.py photo1.jpg [photo2.jpg ...] [--model model]
"""
import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


def preprocess(path, size, mean, std):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = size / min(w, h)
    im = im.resize((max(size, round(w * scale)), max(size, round(h * scale))), Image.BILINEAR)
    w, h = im.size
    l, t = (w - size) // 2, (h - size) // 2
    im = im.crop((l, t, l + size, t + size))
    x = (np.asarray(im, dtype=np.float32) / 255.0 - mean) / std
    return x.transpose(2, 0, 1)[None]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--model", default="model")
    args = ap.parse_args()

    meta = json.loads((Path(args.model) / "labels.json").read_text())
    sess = ort.InferenceSession(str(Path(args.model) / "waste.onnx"), providers=["CPUExecutionProvider"])
    mean, std = np.array(meta["mean"], np.float32), np.array(meta["std"], np.float32)
    for p in args.images:
        logits = sess.run(None, {"input": preprocess(p, meta["size"], mean, std)})[0][0]
        probs = np.exp(logits - logits.max())
        probs /= probs.sum()
        best = int(probs.argmax())
        detail = "  ".join(f"{c}={probs[i]:.2f}" for i, c in enumerate(meta["classes"]))
        print(f"{p}: {meta['classes'][best].upper()}  ({detail})")


if __name__ == "__main__":
    main()

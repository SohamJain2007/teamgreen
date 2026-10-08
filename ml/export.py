"""Export model/best.pt to ONNX (+ labels.json). Usage: python export.py [--out model]"""
import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models

MEAN, STD, IMG = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], 224
CLASSES = ["dry", "mixed", "wet"]

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="model")
out = Path(ap.parse_args().out)

model = models.mobilenet_v3_large()
model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(CLASSES))
model.load_state_dict(torch.load(out / "best.pt"))
model.eval()
torch.onnx.export(model, torch.zeros(1, 3, IMG, IMG), out / "waste.onnx",
                  input_names=["input"], output_names=["logits"],
                  dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17, dynamo=False)
(out / "labels.json").write_text(json.dumps({"classes": CLASSES, "size": IMG, "mean": MEAN, "std": STD}, indent=2))
print("exported", out / "waste.onnx")

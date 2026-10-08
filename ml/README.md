# Wet / dry / mixed waste classifier

MobileNetV3-Large (ImageNet-pretrained, fine-tuned on CPU), 3 classes: `dry`, `mixed`, `wet`.

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install pyarrow onnx onnxscript onnxruntime scikit-learn
# data/raw/train.parquet from https://huggingface.co/datasets/NeoAivara/Waste_Classification_data
python prepare_data.py   # builds data/prepared/{train,val,test}/{wet,dry,mixed}
python train.py          # ~28 min on 8 CPU cores; writes model/best.pt + test_report.txt
python export.py         # model/waste.onnx + labels.json
python predict.py photo.jpg
```

- wet = dataset class `biological`; dry = all other classes.
- **mixed is synthetic**: collages of 1-3 wet + 1-3 dry photos on a blurred background (no public mixed-waste set exists).
- Next.js serves it via `src/lib/waste.ts` and `POST /api/classify` (multipart `photo`). Override the model folder with `WASTE_MODEL_DIR`.

## Results (held-out test split, 1750 images)
Accuracy 99.6%; macro-F1 0.988; wet precision/recall 0.97/0.97.
**These numbers are optimistic.** The photos are clean single-item shots and "mixed" is a collage, so they measure
separation of this dataset, not of real Ranchi street garbage. Collect real labelled photos (put them in
`data/prepared/*/{wet,dry,mixed}` and retrain) before trusting it in production. Treat output as a suggestion.

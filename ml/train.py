"""Fine-tune MobileNetV3-Large to classify waste photos as dry / mixed / wet, (export with export.py).

Usage: python train.py [--data data/prepared] [--epochs 8] [--out model]
"""
import argparse
import time
from pathlib import Path

import torch
import torch.nn as nn
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, models, transforms

MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
IMG = 224


def loaders(data, batch, per_epoch):
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(IMG, scale=(0.55, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.05),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(IMG),
        transforms.CenterCrop(IMG),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    tr = datasets.ImageFolder(Path(data) / "train", train_tf)
    va = datasets.ImageFolder(Path(data) / "val", eval_tf)
    te = datasets.ImageFolder(Path(data) / "test", eval_tf)

    # balance classes: wet is far rarer than dry
    counts = torch.bincount(torch.tensor(tr.targets))
    w = (1.0 / counts.float())[torch.tensor(tr.targets)]
    sampler = WeightedRandomSampler(w, num_samples=per_epoch, replacement=True)
    kw = dict(batch_size=batch, num_workers=6, persistent_workers=True)
    return (tr, DataLoader(tr, sampler=sampler, **kw),
            DataLoader(va, **kw), DataLoader(te, **kw))


@torch.no_grad()
def predict(model, loader):
    model.eval()
    ys, ps = [], []
    for x, y in loader:
        ps += model(x).argmax(1).tolist()
        ys += y.tolist()
    return ys, ps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/prepared")
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--per-epoch", type=int, default=3200)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--out", default="model")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    torch.set_num_threads(8)
    out = Path(args.out)
    out.mkdir(exist_ok=True)

    tr, train_dl, val_dl, test_dl = loaders(args.data, args.batch, args.per_epoch)
    classes = tr.classes  # alphabetical: dry, mixed, wet
    print("classes:", classes, "train counts:", torch.bincount(torch.tensor(tr.targets)).tolist())

    model = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V2)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(classes))
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * len(train_dl))

    best = -1.0
    for ep in range(args.epochs):
        model.train()
        t0, tot = time.time(), 0.0
        for x, y in train_dl:
            opt.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            opt.step()
            sched.step()
            tot += loss.item() * len(y)
        ys, ps = predict(model, val_dl)
        f1 = f1_score(ys, ps, average="macro")
        print(f"epoch {ep + 1}/{args.epochs} loss {tot / args.per_epoch:.3f} val macro-F1 {f1:.4f} ({time.time() - t0:.0f}s)", flush=True)
        if f1 > best:
            best = f1
            torch.save(model.state_dict(), out / "best.pt")

    model.load_state_dict(torch.load(out / "best.pt"))
    ys, ps = predict(model, test_dl)
    report = classification_report(ys, ps, target_names=classes, digits=3)
    cm = confusion_matrix(ys, ps)
    print("\nTEST SET (rows = true, cols = predicted; order:", classes, ")")
    print(report)
    print(cm)
    (out / "test_report.txt").write_text(f"classes: {classes}\n\n{report}\n{cm}\n")

    print("now run: python export.py")

if __name__ == "__main__":
    main()

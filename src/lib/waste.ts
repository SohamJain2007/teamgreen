import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

/** Wet / dry / mixed waste classifier (MobileNetV3, trained in ml/). Lazy-loaded, one session per process. */
export type WasteType = 'dry' | 'mixed' | 'wet';
export type WasteResult = { label: WasteType; confidence: number; probs: Record<WasteType, number> };

const MODEL_DIR = process.env.WASTE_MODEL_DIR || path.join(process.cwd(), 'ml', 'model');

type Meta = { classes: WasteType[]; size: number; mean: number[]; std: number[] };
const g = globalThis as unknown as { __wasteModel?: Promise<{ session: ort.InferenceSession; meta: Meta }> };

function load() {
  g.__wasteModel ??= (async () => {
    const meta: Meta = JSON.parse(fs.readFileSync(path.join(MODEL_DIR, 'labels.json'), 'utf8'));
    const session = await ort.InferenceSession.create(path.join(MODEL_DIR, 'waste.onnx'));
    return { session, meta };
  })();
  return g.__wasteModel;
}

export async function classifyWaste(image: Buffer): Promise<WasteResult> {
  const { session, meta } = await load();
  const s = meta.size;
  // same preprocessing as training/eval: resize short side to s, centre-crop s x s, ImageNet normalise
  const { data } = await sharp(image, { failOn: 'none', limitInputPixels: 60_000_000 })
    .rotate()
    .resize(s, s, { fit: 'cover' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const plane = s * s;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = (data[i * 3 + c] / 255 - meta.mean[c]) / meta.std[c];
  }
  const out = await session.run({ input: new ort.Tensor('float32', input, [1, 3, s, s]) });
  const logits = Array.from(out.logits.data as Float32Array);
  const max = Math.max(...logits);
  const exp = logits.map((l) => Math.exp(l - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(meta.classes.map((c, i) => [c, exp[i] / sum])) as Record<WasteType, number>;
  const label = meta.classes.reduce((a, b) => (probs[a] >= probs[b] ? a : b));
  return { label, confidence: probs[label], probs };
}

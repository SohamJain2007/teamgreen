import sharp from 'sharp';

/**
 * Re-encodes every upload: auto-rotates, downsizes, compresses, and drops ALL metadata
 * (sharp strips EXIF/XMP/ICC unless asked to keep it). The GPS we store comes from the
 * browser geolocation the user explicitly allowed, never from the photo.
 */
export async function processPhoto(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  const base = () => sharp(input, { failOn: 'none', limitInputPixels: 60_000_000 }).rotate();
  const full = await base()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  const thumb = await base()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer();
  return { full, thumb };
}

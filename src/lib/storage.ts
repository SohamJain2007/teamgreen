import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Photo storage abstraction. Reports only ever hold a storage *key* (e.g. "AB12CD34.jpg").
 * To move to S3/R2: implement S3Storage below, set STORAGE_DRIVER=s3, and either
 * return public/CDN URLs from url() or keep proxying through /uploads/[...key].
 */
export interface PhotoStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  url(key: string): string;
}

const SAFE_KEY = /^[A-Za-z0-9_-]+\.jpg$/;
export const isSafeKey = (k: string) => SAFE_KEY.test(k);

class LocalStorage implements PhotoStorage {
  private dir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  private p(key: string) {
    if (!isSafeKey(key)) throw new Error('bad storage key');
    return path.join(this.dir, key);
  }
  async put(key: string, data: Buffer) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.p(key), data);
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.p(key));
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    await fs.rm(this.p(key), { force: true });
  }
  url(key: string) {
    return `/uploads/${key}`;
  }
}

class S3Storage implements PhotoStorage {
  // TODO: implement with @aws-sdk/client-s3 (PutObject/GetObject/DeleteObject) when moving off local disk.
  private nope(): never {
    throw new Error('S3 storage is not implemented yet. See src/lib/storage.ts');
  }
  put(): Promise<void> { return this.nope(); }
  get(): Promise<Buffer | null> { return this.nope(); }
  remove(): Promise<void> { return this.nope(); }
  url(): string { return this.nope(); }
}

const g = globalThis as unknown as { __safaiStorage?: PhotoStorage };
export function getStorage(): PhotoStorage {
  if (!g.__safaiStorage) g.__safaiStorage = process.env.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
  return g.__safaiStorage;
}

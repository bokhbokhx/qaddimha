import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "@/lib/env";

// تخزين خاص: الملفات خارج public ولا تُخدم إلا عبر تنزيل مصرح.
// واجهة قابلة للاستبدال بتخزين إنتاجي (S3 أو ما يماثله).
export interface Storage {
  put(prefix: string, data: Buffer, ext: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

function safeKey(key: string) {
  if (!/^[a-z0-9_-]+\/[a-z0-9_-]+\.[a-z0-9]+$/i.test(key)) throw new Error("مفتاح تخزين غير صالح");
  return key;
}

class LocalStorage implements Storage {
  constructor(private root: string) {}
  async put(prefix: string, data: Buffer, ext: string) {
    const key = `${prefix.replace(/[^a-z0-9_-]/gi, "")}/${randomBytes(16).toString("hex")}.${ext.replace(/[^a-z0-9]/gi, "")}`;
    const full = path.join(this.root, safeKey(key));
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return key;
  }
  async get(key: string) {
    return readFile(path.join(this.root, safeKey(key)));
  }
  async remove(key: string) {
    await rm(path.join(this.root, safeKey(key)), { force: true });
  }
}

export const storage: Storage = new LocalStorage(path.resolve(config.storageDir));

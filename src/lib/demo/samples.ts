import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SAMPLE_FILES } from "./content";

export const SAMPLES_DIR = path.join(process.cwd(), "samples");

let cache: Map<string, keyof typeof SAMPLE_FILES> | null = null;

/** بصمات ملفات المثال المعروفة — الوضع التجريبي لا يدّعي فهم غيرها */
export async function sampleHashes() {
  if (cache) return cache;
  const m = new Map<string, keyof typeof SAMPLE_FILES>();
  for (const [k, file] of Object.entries(SAMPLE_FILES)) {
    try {
      const buf = await readFile(path.join(SAMPLES_DIR, file));
      m.set(createHash("sha256").update(buf).digest("hex"), k as keyof typeof SAMPLE_FILES);
    } catch {
      // ملف غير موجود — يُتجاهل
    }
  }
  cache = m;
  return m;
}

export async function identifySample(sha256: string) {
  return (await sampleHashes()).get(sha256) ?? null;
}

export async function readSample(key: keyof typeof SAMPLE_FILES) {
  return readFile(path.join(SAMPLES_DIR, SAMPLE_FILES[key]));
}

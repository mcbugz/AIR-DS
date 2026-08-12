import { createHash } from 'node:crypto';

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Stable combined hash over named inputs (sorted by name). */
export function combinedHash(inputs: Map<string, Buffer>): string {
  const h = createHash('sha256');
  for (const name of [...inputs.keys()].sort()) {
    h.update(name);
    h.update('\0');
    h.update(inputs.get(name) as Buffer);
    h.update('\0');
  }
  return h.digest('hex');
}

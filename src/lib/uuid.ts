/**
 * UUID v7 (time-ordered) — client-generated IDs for LWW sync.
 * Uses crypto.getRandomValues when available.
 */
export function uuidv7(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // 48-bit unix timestamp in ms (big-endian)
  let ts = now;
  bytes[5] = ts & 0xff;
  ts = Math.floor(ts / 256);
  bytes[4] = ts & 0xff;
  ts = Math.floor(ts / 256);
  bytes[3] = ts & 0xff;
  ts = Math.floor(ts / 256);
  bytes[2] = ts & 0xff;
  ts = Math.floor(ts / 256);
  bytes[1] = ts & 0xff;
  ts = Math.floor(ts / 256);
  bytes[0] = ts & 0xff;

  // version 7
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // variant RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Application-level encryption for sensitive personal data — currently the
 * 13-digit national ID (see lib/thaiId.ts), which is sensitive personal data
 * under PDPA.
 *
 * Neon encrypts at rest at the disk level, but that does not protect a value
 * from anyone who can read a row: a DB dump, a support query, a leaked
 * connection string. Encrypting in the app means the plaintext only exists in
 * process memory, and only for code that deliberately calls decryptPii().
 *
 * FAIL CLOSED. If PII_ENCRYPTION_KEY is unset, encryptPii() throws rather than
 * returning plaintext. A missing key must break the write path loudly — the
 * one outcome worse than not storing the ID is storing it unprotected while
 * everything appears to work.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16;
const KEY_BYTES = 32;
/** Ciphertext prefix, so a future key rotation can tell formats apart. */
const FORMAT = "v1";

export class PiiKeyMissingError extends Error {
  constructor() {
    super(
      "PII_ENCRYPTION_KEY is not set — refusing to store sensitive data unencrypted. " +
        "Add a key to .env.local (64 hex chars, or any strong passphrase)."
    );
    this.name = "PiiKeyMissingError";
  }
}

export class PiiDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiDecryptError";
  }
}

// Derived once per process — scrypt is deliberately slow, so it must not run
// per row.
let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.PII_ENCRYPTION_KEY?.trim();
  if (!raw) throw new PiiKeyMissingError();

  // A 64-char hex string is already a full-entropy 32-byte key — use it as-is.
  // Anything else is treated as a passphrase and stretched with scrypt, so a
  // human-typed value still yields a valid key without silently weakening it.
  cachedKey = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : scryptSync(raw, "crm-pii-v1", KEY_BYTES);

  return cachedKey;
}

/** True when a key is configured. Callers use this to decide whether to offer
 * identity capture at all, rather than letting the write path throw. */
export function isPiiConfigured(): boolean {
  return Boolean(process.env.PII_ENCRYPTION_KEY?.trim());
}

/**
 * Returns `v1.<base64(iv || authTag || ciphertext)>`.
 *
 * The GCM auth tag makes this tamper-evident: a modified ciphertext fails to
 * decrypt rather than silently yielding wrong plaintext. A fresh random IV per
 * call means the same ID encrypts differently every time — so ciphertext
 * equality can never be used to test whether two customers share an ID.
 */
export function encryptPii(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${FORMAT}.${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptPii(stored: string): string {
  const key = resolveKey();

  const marker = `${FORMAT}.`;
  if (!stored.startsWith(marker)) {
    throw new PiiDecryptError("Unrecognised ciphertext format.");
  }

  const buf = Buffer.from(stored.slice(marker.length), "base64");
  if (buf.length <= IV_BYTES + TAG_BYTES) {
    throw new PiiDecryptError("Ciphertext is truncated.");
  }

  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered payload — never leak which.
    throw new PiiDecryptError("Could not decrypt — wrong key or altered data.");
  }
}

/** Test seam only: forget the derived key so a changed env var takes effect. */
export function resetPiiKeyCache(): void {
  cachedKey = null;
}

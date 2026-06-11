import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
// AUTH_TAG_LENGTH (16) is defined by AES-256-GCM specification

function getSalt(): string {
  const salt = process.env.ENCRYPTION_SALT;
  if (!salt) {
    throw new Error(
      "ENCRYPTION_SALT environment variable is required for credential encryption",
    );
  }
  return salt;
}

function deriveKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for credential encryption",
    );
  }

  return scryptSync(encryptionKey, getSalt(), 32);
}

// Cache the derived key at module level — avoids calling scryptSync on every encrypt/decrypt
const derivedKey = deriveKey();

function getKey(): Buffer {
  return derivedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted text format: expected iv:authTag:ciphertext",
    );
  }

  const ivHex = parts[0]!;
  const authTagHex = parts[1]!;
  const ciphertext = parts[2]!;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

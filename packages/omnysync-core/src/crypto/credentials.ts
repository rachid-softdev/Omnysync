/**
 * Credential Encryption Helpers
 *
 * Wraps encrypt/decrypt with JSON serialisation so credentials
 * can be stored as a single string column in the database while
 * carrying the IV and auth tag alongside the ciphertext.
 */
import { encrypt, decrypt } from "./index";

export interface EncryptedPayload {
  /** AES-256-GCM ciphertext (hex) */
  data: string;
  /** Encryption algorithm identifier for forward-compat */
  format: "aes-256-gcm";
}

export function encryptCredentials(plaintext: string): string {
  const data = encrypt(plaintext);
  const payload: EncryptedPayload = { data, format: "aes-256-gcm" };
  return JSON.stringify(payload);
}

export function decryptCredentials(stored: string): string {
  const payload: EncryptedPayload = JSON.parse(stored);

  if (payload.format !== "aes-256-gcm") {
    throw new Error(`Unsupported credential format: ${payload.format}`);
  }

  return decrypt(payload.data);
}

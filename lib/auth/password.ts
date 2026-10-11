import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const keyLength = 64;
const minimumLength = 8;

export function validatePassword(password: string) {
  if (password.length < minimumLength) throw new Error(`Use a password with at least ${minimumLength} characters.`);
}

export function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, keyLength).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, salt, expected] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, keyLength);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

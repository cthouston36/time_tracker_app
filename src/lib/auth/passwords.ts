import { randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";

const PASSWORD_HASH_VERSION = "scrypt-v1";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await deriveScryptKey(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    maxmem: SCRYPT_MAXMEM,
    p: SCRYPT_P,
    r: SCRYPT_R
  });

  return [
    PASSWORD_HASH_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    derivedKey.toString("base64url")
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [version, nValue, rValue, pValue, salt, hash] = passwordHash.split("$");

  if (version !== PASSWORD_HASH_VERSION || !nValue || !rValue || !pValue || !salt || !hash) {
    return false;
  }

  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const expectedKey = Buffer.from(hash, "base64url");
  const derivedKey = await deriveScryptKey(password, salt, expectedKey.length, {
    N: n,
    maxmem: SCRYPT_MAXMEM,
    p,
    r
  });

  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}

function deriveScryptKey(password: BinaryLike, salt: BinaryLike, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

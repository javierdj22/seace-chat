import crypto from "crypto";

const CREDENTIALS_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionSecret() {
  const secret = process.env.SEACE_CREDS_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing SEACE_CREDS_SECRET or BETTER_AUTH_SECRET for credential encryption.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSeaceCredentials(username: string, password: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionSecret(), iv);
  const payload = JSON.stringify({ username, password });

  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CREDENTIALS_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSeaceCredentials(value: string) {
  if (!value) {
    throw new Error("Missing credential payload.");
  }

  if (!value.startsWith(`${CREDENTIALS_VERSION}.`)) {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    const parts = decoded.split("|||");
    const username = parts[0];
    const password = parts.slice(1).join("|||");

    if (!username || !password) {
      throw new Error("Legacy credential payload is invalid.");
    }

    return { username, password, legacy: true };
  }

  const [, ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Encrypted credential payload is malformed.");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionSecret(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf-8");

  const parsed = JSON.parse(decrypted);
  if (!parsed?.username || !parsed?.password) {
    throw new Error("Encrypted credential payload is invalid.");
  }

  return { username: parsed.username, password: parsed.password, legacy: false };
}

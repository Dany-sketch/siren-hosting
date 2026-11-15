import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;

if (!process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY ||
    !process.env.BOT_OWNER_USER_ID) {
  throw new Error("Missing required server environment variables");
}

if (!encryptionKey || !/^[a-f0-9]{64}$/i.test(encryptionKey)) {
  throw new Error("Invalid session encryption key");
}

const key = Buffer.from(encryptionKey, "hex");

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export function encryptSession(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final()
  ]);

  return {
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("hex")
  };
}

export function decryptSession(payload) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "hex")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

export function isBotOwner(userId) {
  return userId === process.env.BOT_OWNER_USER_ID;
}

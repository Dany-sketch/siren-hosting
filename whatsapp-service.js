import makeWASocket, {
  DisconnectReason
} from "@whiskeysockets/baileys";

import pino from "pino";
import { createSessionStore } from "./session-store.js";
import { supabaseAdmin } from "./crypto-store.js";

let socket = null;
let status = "disconnected";

export function getWhatsAppStatus() {
  return status;
}

export async function startWhatsApp(phoneNumber) {
  if (socket) {
    throw new Error("A WhatsApp connection is already running");
  }

  const number = String(phoneNumber).replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(number)) {
    throw new Error("Invalid phone number");
  }

  const { state, saveCreds } = await createSessionStore();

  if (state.creds.registered) {
    throw new Error("WhatsApp is already registered");
  }

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["SIREN D MD", "Chrome", "1.0.0"]
  });

  socket = sock;
  status = "connecting";

  sock.ev.on("creds.update", saveCreds);

  return new Promise((resolve, reject) => {
    let requested = false;

    const timeout = setTimeout(() => {
      status = "disconnected";
      sock.end(new Error("Pairing timed out"));
      if (socket === sock) socket = null;
      reject(new Error("Pairing request timed out"));
    }, 30000);

    sock.ev.on("connection.update", async (update) => {
      if (
        update.connection === "connecting" &&
        !requested &&
        !state.creds.registered
      ) {
        requested = true;

        try {
          const code = await sock.requestPairingCode(number);
          clearTimeout(timeout);
          resolve(code);
        } catch {
          clearTimeout(timeout);
          status = "disconnected";
          if (socket === sock) socket = null;
          sock.end();
          reject(new Error("Could not generate pairing code"));
        }
      }

      if (update.connection === "open") {
        status = "connected";
      }

      if (update.connection === "close") {
        status = "disconnected";
        if (socket === sock) socket = null;

        if (
          update.lastDisconnect?.error?.output?.statusCode ===
          DisconnectReason.loggedOut
        ) {
          await supabaseAdmin
            .from("whatsapp_sessions")
            .delete()
            .eq("user_id", process.env.BOT_OWNER_USER_ID);
        }
      }
    });
  });
}

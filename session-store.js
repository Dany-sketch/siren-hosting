import {
  initAuthCreds,
  BufferJSON,
  proto
} from "@whiskeysockets/baileys";

import {
  supabaseAdmin,
  encryptSession,
  decryptSession
} from "./crypto-store.js";

const OWNER_ID = process.env.BOT_OWNER_USER_ID;

async function loadStoredState() {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("encrypted_state")
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const encrypted = JSON.parse(data.encrypted_state);
  const serialized = decryptSession(encrypted);

  return JSON.parse(serialized, BufferJSON.reviver);
}

async function saveStoredState(state) {
  const serialized = JSON.stringify(state, BufferJSON.replacer);
  const encrypted = encryptSession(serialized);

  const { error } = await supabaseAdmin
    .from("whatsapp_sessions")
    .upsert({
      user_id: OWNER_ID,
      encrypted_state: JSON.stringify(encrypted),
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

export async function createSessionStore() {
  const saved = await loadStoredState();

  const creds = saved?.creds || initAuthCreds();
  const memory = saved?.keys || {};

  const keys = {
    get: async (type, ids) => {
      const result = {};

      for (const id of ids) {
        let value = memory[type]?.[id];

        if (type === "app-state-sync-key" && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }

        if (value) result[id] = value;
      }

      return result;
    },

    set: async (data) => {
      for (const type in data) {
        memory[type] ||= {};

        for (const id in data[type]) {
          const value = data[type][id];

          if (value) {
            memory[type][id] = value;
          } else {
            delete memory[type][id];
          }
        }
      }

      await saveStoredState({ creds, keys: memory });
    }
  };

  return {
    state: { creds, keys },
    saveCreds: () => saveStoredState({ creds, keys: memory })
  };
}

import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { isBotOwner } from "./crypto-store.js";
import {
  startWhatsApp,
  getWhatsAppStatus
} from "./whatsapp-service.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://siren-d-md-hosting.vercel.app"
}));

app.use(express.json({ limit: "10kb" }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }

  const token = authorization.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired login" });
  }

  req.user = data.user;
  next();
}

function requireOwner(req, res, next) {
  if (!isBotOwner(req.user.id)) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "online", service: "SIREN D MD" });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email
    },
    isBotOwner: isBotOwner(req.user.id)
  });
});

app.get(
  "/api/whatsapp/status",
  authenticate,
  requireOwner,
  (req, res) => {
    res.json({ status: getWhatsAppStatus() });
  }
);

let lastPairRequest = 0;

app.post(
  "/api/whatsapp/pair",
  authenticate,
  requireOwner,
  async (req, res) => {
    if (Date.now() - lastPairRequest < 30000) {
      return res.status(429).json({
        error: "Please wait 30 seconds before trying again."
      });
    }

    const phoneNumber = req.body?.phoneNumber;

    if (
      typeof phoneNumber !== "string" ||
      !/^\+?\d{10,15}$/.test(phoneNumber)
    ) {
      return res.status(400).json({
        error: "Enter your phone number with country code."
      });
    }

    lastPairRequest = Date.now();

    try {
      const code = await startWhatsApp(phoneNumber);

      res.json({
        success: true,
        pairingCode: code
      });
    } catch {
      res.status(500).json({
        error: "Pairing could not start. Please try again."
      });
    }
  }
);

app.use(express.static("public"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SIREN D MD running on port ${PORT}`);
});

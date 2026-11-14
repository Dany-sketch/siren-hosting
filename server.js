import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "https://siren-d-md-hosting.vercel.app"
}));

app.use(express.json());

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

app.get("/api/health", (req, res) => {
  res.json({ status: "online", service: "SIREN D MD" });
});

app.get("/api/me", async (req, res) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Login required" });
  }

  const token = authorization.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired login" });
  }

  res.json({
    authenticated: true,
    user: {
      id: data.user.id,
      email: data.user.email
    }
  });
});

app.use(express.static("public"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SIREN D MD running on port ${PORT}`);
});

import express from "express";
import morgan from "morgan";
import fetch from "node-fetch";
import pino from "pino";

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

const PORT = process.env.PORT || 3000;
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || "";
const LINKFLOW_CALLBACK_URL = process.env.LINKFLOW_CALLBACK_URL;
const DMIN = Number(process.env.RANDOM_DELAY_MS_MIN || 45000);
const DMAX = Number(process.env.RANDOM_DELAY_MS_MAX || 120000);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

const okAuth = (req) => (req.headers.authorization || "") === WORKER_AUTH_TOKEN;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const randMs = () => DMIN + Math.floor(Math.random() * (DMAX - DMIN + 1));

app.get("/health", (_req, res) => res.json({ ok: true }));

async function callback(payload) {
  const body = JSON.stringify(payload);
  const r = await fetch(LINKFLOW_CALLBACK_URL, { method: "POST", headers: { "content-type": "application/json" }, body });
  if (!r.ok) logger.warn({ status: r.status }, "Callback non 2xx");
}

app.post("/worker/tasks/invite", async (req, res) => {
  if (!okAuth(req)) return res.status(401).json({ error: "Unauthorized" });
  const { task_id, profile_url } = req.body || {};
  if (!task_id || !profile_url) return res.status(400).json({ error: "task_id and profile_url required" });

  res.status(202).json({ accepted: true, task_id });

  await delay(randMs());
  await callback({ task_id, status: "sent", profile_url, sent_at: new Date().toISOString(), error: null });
});

app.post("/worker/tasks/message", async (req, res) => {
  if (!okAuth(req)) return res.status(401).json({ error: "Unauthorized" });
  const { task_id, profile_url, message } = req.body || {};
  if (!task_id || !profile_url || !message) return res.status(400).json({ error: "task_id, profile_url, message required" });

  res.status(202).json({ accepted: true, task_id });

  await delay(randMs());
  await callback({ task_id, status: "sent", profile_url, sent_at: new Date().toISOString(), error: null });
});

app.listen(PORT, () => logger.info({ PORT }, "Worker up"));



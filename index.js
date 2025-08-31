import express from "express";

const app = express();
app.use(express.json());

const REQUIRED_TOKEN = process.env.WORKER_AUTH_TOKEN || "";

// Healthcheck (no auth)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Middleware di autenticazione
app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!REQUIRED_TOKEN || token !== REQUIRED_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Endpoint /tasks (protetto)
app.post("/tasks", (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) {
    return res.status(400).json({ error: "Missing 'type'" });
  }
  const taskId = "task_" + Math.random().toString(36).slice(2, 10);
  res.status(202).json({
    taskId,
    status: "queued",
    received: { type, payload }
  });
});

// Endpoint status (facoltativo)
app.get("/tasks/:id", (req, res) => {
  res.json({ taskId: req.params.id, status: "processing" });
});

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Worker listening on ${PORT}`);
});

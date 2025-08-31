app.get("/", (_req, res) => {
  res.status(200).send("OK");
});


import express from "express";
import { withBrowser } from "./linkedinService.js";

const app = express();
app.use(express.json());

const REQUIRED_TOKEN = process.env.WORKER_AUTH_TOKEN || "";

// Health (pubblico)
app.get("/health", (_req, res) => res.status(200).send("OK"));

// Auth middleware per tutto il resto
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!REQUIRED_TOKEN || token !== REQUIRED_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Cerca profili LinkedIn reali
app.post("/search-profiles", async (req, res) => {
  const { query, location, limit = 10 } = req.body || {};
  if (!query) return res.status(400).json({ error: "Missing 'query'" });

  try {
    const data = await withBrowser(async ({ page }) => {
      const q = encodeURIComponent(query);
      const url = `https://www.linkedin.com/search/results/people/?keywords=${q}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      // scroll per caricare risultati
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 1200);
        await page.waitForTimeout(600 + Math.random() * 400);
      }

      const cards = page.locator("div.reusable-search__result-container");
      const count = await cards.count();
      const out = [];

      for (let i = 0; i < count && out.length < limit; i++) {
        const c = cards.nth(i);
        const name = (await c.locator('span[dir="ltr"]').first().innerText().catch(() => null))?.trim();
        const headline = (await c.locator("div.entity-result__primary-subtitle").first().innerText().catch(() => null))?.trim();
        const href = await c.locator("a.app-aware-link").first().getAttribute("href").catch(() => null);
        const profileUrl = normalizeProfileUrl(href);
        if (name && profileUrl) {
          out.push({
            id: profileUrl.split("/in/")[1]?.replace(/\/$/, ""),
            name, headline, profileUrl
          });
        }
      }
      return { results: out };
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

function normalizeProfileUrl(href) {
  if (!href) return null;
  const url = new URL(href, "https://www.linkedin.com");
  const s = url.toString();
  if (/^https:\/\/www\.linkedin\.com\/in\/[^\/?#]+\/?/.test(s)) return s.split("?")[0];
  return null;
}

// Invia richiesta di connessione
app.post("/connect", async (req, res) => {
  const { profileUrl, note } = req.body || {};
  if (!profileUrl) return res.status(400).json({ error: "Missing 'profileUrl'" });

  try {
    const data = await withBrowser(async ({ page }) => {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200 + Math.random() * 800);

      const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Connetti")').first();
      if (!(await connectBtn.count())) throw new Error("Connect button not found");
      await connectBtn.click();
      await page.waitForTimeout(500 + Math.random() * 500);

      if (note) {
        const addNoteBtn = page.locator('button:has-text("Add a note"), button:has-text("Aggiungi una nota")').first();
        if (await addNoteBtn.count()) {
          await addNoteBtn.click();
          await page.fill('textarea[name="message"]', note.slice(0, 280));
        }
      }
      const sendBtn = page.locator('button:has-text("Send"), button:has-text("Invia")').first();
      if (await sendBtn.count()) await sendBtn.click();
      await page.waitForTimeout(700 + Math.random() * 700);

      return { sent: true, requestId: "req_" + Math.random().toString(36).slice(2, 10) };
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Tick di campagna (processa N profili dalla coda)
app.post("/campaign/tick", async (req, res) => {
  const { campaignId } = req.body || {};
  if (!campaignId) return res.status(400).json({ error: "Missing 'campaignId'" });
  // Qui collegherai DB/queue reali. Placeholder:
  return res.json({ processed: 0, queued: 0, errors: 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Worker listening on ${PORT}`));

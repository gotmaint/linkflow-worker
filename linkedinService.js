// linkedinService.js
import { chromium } from "playwright";
import fs from "fs";

const STORAGE = "/tmp/linkedin-state.json"; // persiste la sessione tra run su Railway

export async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
      "--disable-blink-features=AutomationControlled"
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    storageState: fs.existsSync(STORAGE) ? STORAGE : undefined,
  });

  const page = await context.newPage();
  await page.waitForTimeout(400 + Math.random() * 600);

  try {
    await ensureLoggedIn(page, context);
    return await fn({ browser, context, page });
  } finally {
    try { await context.storageState({ path: STORAGE }); } catch {}
    await context.close();
    await browser.close();
  }
}

async function ensureLoggedIn(page, context) {
  const LI_AT = process.env.LI_AT || "";

  if (LI_AT) {
    await context.addCookies([{
      name: "li_at",
      value: LI_AT,
      domain: ".linkedin.com",   // <-- corretto
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }]);

    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    // se compare la topbar siamo dentro
    if (await page.locator('[data-test-global-nav-link="mynetwork"], nav.global-nav').count())
      return;
  }

  const email = process.env.LINKEDIN_EMAIL;
  const pass  = process.env.LINKEDIN_PASSWORD;
  if (!email || !pass) {
    throw new Error("No LinkedIn session: set LI_AT or LINKEDIN_EMAIL/LINKEDIN_PASSWORD.");
  }

  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  await page.fill('input#username', email);
  await page.fill('input#password', pass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  // se richiede 2FA blocchiamo con messaggio chiaro
  if (await page.locator('input[name="pin"], input[name="challengeResponse"]').count()) {
    throw new Error("2FA required: esegui 1 volta il login manuale/2FA e poi redeploy.");
  }
}

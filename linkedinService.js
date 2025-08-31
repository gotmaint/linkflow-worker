import { chromium } from "@playwright/test";
import fs from "fs";

const STORAGE = "/tmp/linkedin-state.json"; // sessione persistente su Railway

export async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    storageState: fs.existsSync(STORAGE) ? STORAGE : undefined
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400 + Math.random() * 600);

  try {
    await ensureLoggedIn(page, context);
    return await fn({ browser, context, page });
  } finally {
    await context.storageState({ path: STORAGE });
    await browser.close();
  }
}

async function ensureLoggedIn(page, context) {
  const li_at = process.env.LI_AT;
  if (li_at) {
    await context.addCookies([{
      name: "li_at",
      value: li_at,
      domain: ".www.linkedin.com",
      path: "/",
      httpOnly: true,
      secure: true
    }]);
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    const hasNav = await page.locator('[data-test-global-nav-link="mynetwork"]').count();
    if (hasNav) return; // sessione valida
  }
  const email = process.env.LINKEDIN_EMAIL;
  const pass = process.env.LINKEDIN_PASSWORD;
  if (!email || !pass) {
    throw new Error("No LinkedIn session: set LI_AT or LINKEDIN_EMAIL/PASSWORD.");
  }
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  await page.fill("#username", email);
  await page.fill("#password", pass);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle");

  if (await page.locator('input[name="pin"]').count()) {
    throw new Error("2FA required: complete 2FA once manually, then redeploy.");
  }
}

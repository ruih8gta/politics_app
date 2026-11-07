// README 用の画面写真を docs/screenshots/ に撮り直す:  npm run screenshot
// 必要なもの: Playwright（npm i -D playwright && npx playwright install chromium）
// HTTPS_PROXY が設定されていれば、Web フォントの取得に使う。
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "screenshots");
const PORT = 8790;
const BASE = `http://localhost:${PORT}/`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("ローカルサーバーが起動しませんでした");
}

async function open(browser, opts) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, ...opts });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__unifiedReady === true);
  page.assertNoErrors = () => {
    if (errors.length) throw new Error(errors.join("\n"));
  };
  return page;
}

async function go(page, route) {
  await page.click(`.app-nav [data-route="${route}"]`);
  await page.waitForTimeout(400);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  try {
    await waitForServer();
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "localhost" } } : {});
    const shot = (page, name, full = true) => page.screenshot({ path: path.join(OUT, name), fullPage: full });

    // PC（明るい配色）
    const pc = await open(browser, { viewport: { width: 1280, height: 900 }, colorScheme: "light" });
    await shot(pc, "overview.png");
    await go(pc, "map");
    await pc.click('[data-map-dataset="election"]');
    await pc.click('[data-pref="27"]'); // 2026衆院選で大阪を選んだ状態
    await pc.mouse.move(0, 0);
    await shot(pc, "map.png");
    await go(pc, "policy");
    await pc.click('[data-policy-page="issues"]');
    await pc.click('[data-issue-select="energy"]');
    await pc.mouse.move(0, 0);
    await shot(pc, "issues.png");
    await go(pc, "members");
    await shot(pc, "members.png");
    await go(pc, "leaders");
    await shot(pc, "leaders.png");
    await go(pc, "calendar");
    await shot(pc, "calendar.png");
    await go(pc, "overview");
    await pc.click('[data-help-for="overview"]');
    await pc.waitForTimeout(400);
    await shot(pc, "guide.png", false);
    pc.assertNoErrors();

    // ダークモード
    const dark = await open(browser, { viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    await shot(dark, "dark.png", false);
    dark.assertNoErrors();

    // スマホ
    const sp = await open(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
    await shot(sp, "mobile.png", false);
    await go(sp, "map");
    await sp.evaluate(() => window.scrollTo(0, document.querySelector(".map-panel").getBoundingClientRect().top + window.scrollY - 70));
    await sp.waitForTimeout(600);
    await shot(sp, "mobile-map.png", false);
    sp.assertNoErrors();

    await browser.close();
    console.log(`保存しました: ${path.relative(ROOT, OUT)}/`);
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

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
const URL = `http://localhost:${PORT}/`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("ローカルサーバーが起動しませんでした");
}

async function open(browser, opts) {
  const page = await browser.newPage(opts);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".pref");
  if (errors.length) throw new Error(errors.join("\n"));
  return page;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  try {
    await waitForServer();
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: "localhost" } } : {});

    // 全体（PC・スマホ）
    const pc = await open(browser, { viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    await pc.screenshot({ path: path.join(OUT, "desktop.png"), fullPage: true });
    const sp = await open(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, ignoreHTTPSErrors: true });
    await sp.screenshot({ path: path.join(OUT, "mobile.png") });

    // 各セクション（固定ヘッダーが重ならないよう、ヘッダーを隠してから撮る）
    await pc.addStyleTag({ content: ".site-header{display:none}" });
    await pc.setViewportSize({ width: 1200, height: 2400 });
    await pc.waitForTimeout(300);
    const shot = async (selector, name) => {
      const el = await pc.$(selector);
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(OUT, name) });
    };
    await pc.click('.pref[data-code="27"]'); // 大阪を選んだ状態
    await pc.mouse.move(0, 0);
    await shot("section:has(#h-nation)", "nation.png");
    await shot("#h-houses", "houses.png");
    await shot("section:has(#h-agenda)", "agenda.png");
    await pc.click("#tab-energy");
    await pc.mouse.move(0, 0);
    await shot("section:has(#h-issues)", "issues.png");

    await browser.close();
    console.log(`保存しました: ${path.relative(ROOT, OUT)}/`);
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

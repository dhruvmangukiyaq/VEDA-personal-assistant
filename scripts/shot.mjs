// Headless screenshots: full page 1920x1080 + stage panel clip.
// Run: node scripts/shot.mjs [outdir]  (dev server must run on :3000)
import puppeteer from "puppeteer-core";

const out = process.argv[2] || "/tmp/shots";
const EXE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath: EXE,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1920,1080", "--force-device-scale-factor=1", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(
  "window.__bustReady === true || document.querySelector('#stage canvas') !== null",
  { timeout: 20000 }
);
await new Promise((r) => setTimeout(r, 4500));
await page.screenshot({ path: `${out}/full.png` });
const el = await page.$("#stage");
if (el) await el.screenshot({ path: `${out}/stage.png` });
console.log("saved to", out);
await browser.close();

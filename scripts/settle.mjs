import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--window-size=1920,1080"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
const el = await p.$("#stage");
for (const s of [2, 5, 9]) {
  await new Promise((r) => setTimeout(r, s === 2 ? 2000 : s === 5 ? 3000 : 4000));
  await el.screenshot({ path: `/tmp/settle-${s}s.png` });
}
await b.close();
console.log("SETTLE_OK");

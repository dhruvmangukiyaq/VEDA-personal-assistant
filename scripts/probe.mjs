import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--window-size=1920,1080"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
for (let i = 0; i < 4; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const d = await p.evaluate("JSON.stringify(window.__sphereDbg || null)");
  console.log(`t=${(i+1)*2}s`, d);
}
await b.close();

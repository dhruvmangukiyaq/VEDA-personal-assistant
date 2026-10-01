import puppeteer from "puppeteer-core";
const EXE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const viewports = [
  [1440, 900],
  [1920, 1080],
  [1024, 768],
];
const b = await puppeteer.launch({
  executablePath: EXE, headless: "new",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
let allOk = true;
for (const [vw, vh] of viewports) {
  const p = await b.newPage();
  await p.setViewport({ width: vw, height: vh });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 6000)); // intro (1.2s) fully settled
  const el = await p.$("#stage");
  await el.screenshot({ path: `/tmp/ctr-${vw}x${vh}.png` });
  await p.close();
}
await b.close();
console.log("SHOTS_OK");

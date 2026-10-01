import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
    "--window-size=1920,1080"],
});
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 5000));
const el = await p.$("#stage");
await el.screenshot({ path: "/tmp/f1.png" });
await new Promise((r) => setTimeout(r, 1000));
await el.screenshot({ path: "/tmp/f2.png" });
await b.close();
console.log("FRAMES_OK");

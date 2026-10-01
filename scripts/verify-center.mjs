import puppeteer from "puppeteer-core";
const EXE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cfgs = [
  [1440, 900, 2], [1920, 1080, 2], [1024, 768, 2],
  [1440, 900, 1], [1920, 1080, 1], [1024, 768, 1],
];
const b = await puppeteer.launch({
  executablePath: EXE, headless: "new",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
let allOk = true;
for (const [vw, vh, dsf] of cfgs) {
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.setViewport({ width: vw, height: vh, deviceScaleFactor: dsf });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 6000));
  await p.keyboard.press("d");
  await new Promise((r) => setTimeout(r, 500));
  const el = await p.$("#stage");
  await el.screenshot({ path: `/tmp/v-${vw}x${vh}-dsf${dsf}.png` });
  const info = await p.evaluate(() => {
    const stage = document.querySelector("#stage").getBoundingClientRect();
    const dbg = document.body.innerText.match(/DBG ([^\n]+)/);
    return { stage: { w: stage.width, h: stage.height }, dbg: dbg ? dbg[1] : "NO_DBG", errs: (window.__errs || []).length };
  });
  // parse projCenter=XX,YY from dbg
  const m = info.dbg.match(/projCenter=([\d.]+),([\d.]+)/);
  let verdict = "NO_DBG";
  if (m) {
    const px = parseFloat(m[1]), py = parseFloat(m[2]);
    const dx = Math.abs(px - info.stage.w / 2) / info.stage.w * 100;
    const dy = Math.abs(py - info.stage.h / 2) / info.stage.h * 100;
    verdict = dx < 2 && dy < 2 ? "PASS" : "FAIL";
    if (verdict === "FAIL") allOk = false;
    console.log(`${vw}x${vh} dsf=${dsf}: proj=(${px},${py}) stage=(${info.stage.w.toFixed(0)},${info.stage.h.toFixed(0)}) off=(${dx.toFixed(2)}%,${dy.toFixed(2)}%) ${info.dbg.slice(0, 220)} -> ${verdict} errs=${errs.length} ${errs[0] || ""}`);
  } else {
    allOk = false;
    console.log(`${vw}x${vh} dsf=${dsf}: NO DEBUG OVERLAY`);
  }
  await p.close();
}
// resize test: load wide, shrink mid-session, re-check
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
await p.waitForFunction("document.querySelector('#stage canvas') !== null", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 5000));
await p.setViewport({ width: 1100, height: 800, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 2500));
await p.keyboard.press("d");
await new Promise((r) => setTimeout(r, 400));
const info = await p.evaluate(() => {
  const stage = document.querySelector("#stage").getBoundingClientRect();
  const dbg = document.body.innerText.match(/DBG ([^\n]+)/);
  return { stage: { w: stage.width, h: stage.height }, dbg: dbg ? dbg[1] : "NO_DBG" };
});
{
  const m = info.dbg.match(/projCenter=([\d.]+),([\d.]+)/);
  const px = parseFloat(m[1]), py = parseFloat(m[2]);
  const dx = Math.abs(px - info.stage.w / 2) / info.stage.w * 100;
  const dy = Math.abs(py - info.stage.h / 2) / info.stage.h * 100;
  const verdict = dx < 2 && dy < 2 ? "PASS" : "FAIL";
  if (verdict === "FAIL") allOk = false;
  console.log(`RESIZE 1920->1100x800 dsf=2: off=(${dx.toFixed(2)}%,${dy.toFixed(2)}%) -> ${verdict}`);
}
await b.close();
console.log(allOk ? "ALL_PASS" : "NEEDS_WORK");

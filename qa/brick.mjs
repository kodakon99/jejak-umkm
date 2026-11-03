// Seeds localStorage with an import whose row has a US-format date, then reloads twice.
import { spawn } from "node:child_process";
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--remote-debugging-port=9334", "--user-data-dir=" + process.cwd() + "/.profile", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch("http://127.0.0.1:9334/json")).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true })).result?.result?.value;
const go = async (p) => { await send("Page.navigate", { url: "http://localhost:3100" + p }); await sleep(2500); };
const row = (date, channel) => ({ date, channel, amount: 1000, item: "x", sig: date + channel, confidence: 0.9, source: { file: "x.xlsx", sheet: "S", cell: "B2" } });
const state = { imported: { excelFile: "x.xlsx", bankFile: "b.csv", rows: [row("2026-31-10", "cash"), row("2026-31-10", "qris")], mappings: [{ sheet: "S", kind: "sales", headerRow: 1, columns: {} }],
  bank: [{ line: 2, date: "2026-10-02", desc: "SETORAN TUNAI", amount: 1000, dir: "CR", kind: "cash_deposit", business: true, source: { file: "b.csv", line: 2 } }], confirmed: true }, resolutions: {} };
await go("/");
await ev(`localStorage.setItem("jejak-draft-v1", ${JSON.stringify(JSON.stringify(state))})`);
for (const p of ["/", "/cek", "/cocokkan", "/impor"]) { await go(p); console.log(p, "→", JSON.stringify((await ev("document.body.innerText")).slice(0, 160))); }
await ev(`localStorage.clear()`);
ws.close(); chrome.kill(); process.exit(0);

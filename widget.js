// Datorsalar – widget för Scriptable (iOS)
// Visar om Bifrost, Vanheim, Jotunheim, Gimle, Valhall, Glase och Alfheim är lediga just nu.
// Data: TimeEdit (LiU). Webbversion: https://philip4500.github.io/lediga-salar/

const ROOMS = [["Bifrost","264060.195"],["Vanheim","990784.195"],["Jotunheim","990783.195"],["Gimle","660753.195"],["Valhall","267189.195"],["Glase","660756.195"],["Alfheim","264001.195"]];
const PAGE = "https://philip4500.github.io/lediga-salar/";
const START = 7, END = 22;

const C = {
  bg:    Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e")),
  ink:   Color.dynamic(new Color("#000000"), new Color("#ffffff")),
  sec:   Color.dynamic(new Color("#3c3c43", 0.6), new Color("#ebebf5", 0.6)),
  fill:  Color.dynamic(new Color("#787880", 0.16), new Color("#787880", 0.32)),
  green: Color.dynamic(new Color("#34c759"), new Color("#30d158")),
  red:   Color.dynamic(new Color("#ff3b30"), new Color("#ff453a")),
  orange:Color.dynamic(new Color("#ff9500"), new Color("#ff9f0a")),
  blue:  Color.dynamic(new Color("#007aff"), new Color("#0a84ff")),
};

const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hm = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);

async function fetchData() {
  const now = new Date(), ds = iso(now), c = ds.replace(/-/g, "");
  const url = "https://cloud.timeedit.net/liu/web/schema/ri.json?h=t&sid=3&p=" + c + ".x," + c + ".x&objects=" + ROOMS.map(r => r[1]).join(",") + "&ox=0&types=0&fe=0";
  const j = await new Request(url).loadJSON();
  const H = j.columnheaders, li = H.indexOf("Lokal"), ti = H.indexOf("Undervisningstyp");
  const by = {}; ROOMS.forEach(([n]) => by[n] = []);
  for (const b of j.reservations || []) {
    const rooms = (b.columns[li] || "").split(",").map(s => s.trim());
    const s = b.startdate < ds ? 0 : mins(b.starttime), e = b.enddate > ds ? 1440 : mins(b.endtime);
    for (const [n] of ROOMS) if (rooms.includes(n)) by[n].push({ s, e, exam: /tentamen/i.test(b.columns[ti] || "") });
  }
  const nm = now.getHours() * 60 + now.getMinutes();
  return ROOMS.map(([n]) => {
    const L = by[n].sort((a, b) => a.s - b.s);
    const cur = L.find(b => b.s <= nm && nm < b.e);
    if (cur) {
      let end = cur.e; for (const b of L) if (b.s <= end && b.e > end) end = b.e;
      return { n, L, free: false, color: C.red, short: end >= 1440 ? "hela dagen" : "fr. " + hm(end), long: end >= 1440 ? "Bokad resten av dagen" : "Ledig från " + hm(end) };
    }
    const up = L.find(b => b.s > nm);
    if (!up) return { n, L, free: true, color: C.green, short: "resten", long: "Ledig resten av dagen" };
    return { n, L, free: true, color: up.s - nm <= 30 ? C.orange : C.green, short: "till " + hm(up.s), long: "Ledig till " + hm(up.s) };
  });
}

function dot(stack, color, size) {
  const d = stack.addStack(); d.size = new Size(size, size); d.cornerRadius = size / 2; d.backgroundColor = color;
}

function bar(L, nm, w, h) {
  const ctx = new DrawContext(); ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  const x = m => Math.max(0, Math.min(w, (m - START * 60) / ((END - START) * 60) * w));
  const isDark = Device.isUsingDarkAppearance();
  ctx.setFillColor(new Color("#787880", isDark ? 0.32 : 0.16));
  const p = new Path(); p.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); ctx.addPath(p); ctx.fillPath();
  for (const b of L) {
    const a = x(b.s), z = x(b.e); if (z <= a) continue;
    ctx.setFillColor(new Color(b.exam ? "#ff9500" : "#ff3b30", 0.9)); ctx.fillRect(new Rect(a, 0, z - a, h));
  }
  if (nm >= START * 60 && nm <= END * 60) { ctx.setFillColor(new Color(isDark ? "#0a84ff" : "#007aff")); ctx.fillRect(new Rect(x(nm) - 1, 0, 2, h)); }
  return ctx.getImage();
}

function header(w, rooms, compact) {
  const free = rooms.filter(r => r.free).length;
  const h = w.addStack(); h.centerAlignContent();
  const t = h.addText("Datorsalar"); t.font = Font.boldSystemFont(compact ? 15 : 17); t.textColor = C.ink;
  h.addSpacer();
  const f = h.addText(free + "/" + rooms.length + " lediga"); f.font = Font.semiboldSystemFont(compact ? 12 : 14); f.textColor = free ? C.green : C.red;
}

async function build() {
  const fam = config.widgetFamily || "large";
  const w = new ListWidget(); w.backgroundColor = C.bg; w.url = PAGE;
  w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
  let rooms;
  try { rooms = await fetchData(); }
  catch (e) { const t = w.addText("Kunde inte hämta schemat"); t.font = Font.systemFont(13); t.textColor = C.sec; return w; }
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();

  if (fam === "small") {
    w.setPadding(14, 14, 14, 14);
    const free = rooms.filter(r => r.free).length;
    const big = w.addText(String(free)); big.font = Font.boldRoundedSystemFont(40); big.textColor = free ? C.green : C.red;
    const s = w.addText("av " + rooms.length + " salar lediga"); s.font = Font.mediumSystemFont(12); s.textColor = C.sec;
    w.addSpacer();
    for (const r of rooms.filter(r => r.free).slice(0, 3)) {
      const row = w.addStack(); row.centerAlignContent(); dot(row, r.color, 7); row.addSpacer(5);
      const t = row.addText(r.n); t.font = Font.semiboldSystemFont(12); t.textColor = C.ink; t.lineLimit = 1;
      w.addSpacer(2);
    }
  } else if (fam === "medium") {
    w.setPadding(12, 16, 12, 16);
    header(w, rooms, true); w.addSpacer(8);
    const cols = w.addStack(); cols.spacing = 14;
    for (const part of [rooms.slice(0, 4), rooms.slice(4)]) {
      const col = cols.addStack(); col.layoutVertically(); col.spacing = 5;
      for (const r of part) {
        const row = col.addStack(); row.centerAlignContent(); row.size = new Size(0, 18);
        dot(row, r.color, 8); row.addSpacer(6);
        const t = row.addText(r.n); t.font = Font.semiboldSystemFont(13); t.textColor = C.ink; t.lineLimit = 1;
        row.addSpacer();
        const s = row.addText(r.short); s.font = Font.systemFont(12); s.textColor = C.sec; s.lineLimit = 1;
      }
    }
  } else {
    w.setPadding(16, 16, 14, 16);
    header(w, rooms, false); w.addSpacer(10);
    for (const r of rooms) {
      const row = w.addStack(); row.centerAlignContent();
      dot(row, r.color, 9); row.addSpacer(8);
      const t = row.addText(r.n); t.font = Font.semiboldSystemFont(15); t.textColor = C.ink;
      row.addSpacer();
      const s = row.addText(r.long); s.font = Font.systemFont(13); s.textColor = C.sec;
      w.addSpacer(4);
      const b = w.addStack(); b.addSpacer(17); const img = b.addImage(bar(r.L, nm, 280, 5)); img.imageSize = new Size(280, 5);
      w.addSpacer(8);
    }
    w.addSpacer();
    const f = w.addText("07–22 · uppdaterad " + hm(nm)); f.font = Font.systemFont(10); f.textColor = C.sec;
  }
  return w;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();

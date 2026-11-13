/* ═══════════════════════════════════════════════════════════════════════════════════════════
   FOSSIL32 · the Grug Digital fantasy console, on the site
   ───────────────────────────────────────────────────────────────────────────────────────────
   Every listed game is shown as a floating 3D cartridge box. Tapping a box:
     the page behind goes dark and out of focus (the box stays sharp) → the box flies to the middle → its side flap opens →
     the cartridge slides out and hovers on the left → the game panel (description, features,
     genre, Play) slides in on the right.
   Play: the cartridge drops into the FOSSIL32 console → the screen boots → the camera pushes
     into the screen → white flash → the real game opens.

   Built from the FOSSIL32 3D showcase (fossil32-showcase.html v2). Source of truth for a game's
   box is its entry in assets/games.js (title, subtitle, long, features, box{...}).

   Pages use it with:
     <link rel="stylesheet" href="…/assets/fossil32/fossil32.css">
     <script type="module" src="…/assets/fossil32/fossil32.js"></script>
     <a class="g-tile f32-tile" data-f32="<game id>" href="games/<id>/"><div class="f32-stage">…</div>…</a>
   (Grug.ui.boxTile(game) in grug.js writes that markup.) Elements with data-f32 are picked up
   automatically, also when added later. Without WebGL the links just work as plain links.

   The Games page shows them as a vertical carousel instead (Fossil32.rack, see RACK below); its Play button calls
   Fossil32.launch(id): the selected box opens, the cartridge slides out with a pool of light following it while the page
   drifts out of focus, and it goes straight into the console and the game.

   window.Fossil32 = { ok, open(id, fromEl?), boot(id), close(), rack(el, state), launch(id) }

   Build: tools/fossil32 → npm install && npm run build  (bundles three.js r170 into one file)
   Cartridge model: "Game Cartridge" by Pavel Kutejnikov (Drumdorf), CC BY 4.0, modified.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BASE = new URL("./", import.meta.url).href;          // …/assets/fossil32/
const ROOT = new URL("../../", import.meta.url).href;      // site root
const siteUrl = p => /^(https?:|data:|blob:)/.test(p || "") ? p : ROOT + String(p || "").replace(/^\/+/, "");
const GAMES = () => window.GRUG_GAMES || [];
// a mature game (games.js rating) only where Grug.age lets it show (an adult, not in shop or partner mode)
const mature = g => !!g && g.rating === "mature";
const canSee = g => !mature(g) || !!(window.Grug && window.Grug.age && window.Grug.age.canSee(g));
const gameById = id => GAMES().find(g => g.id === id && canSee(g));
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═════════════════ FONTS ═════════════════ */
// Registered under "F32 …" names so they never fight the site's own @font-face rules.
const FONT_FILES = {
  "Outfit": [[500, "outfit-latin-500-normal"], [700, "outfit-latin-700-normal"], [900, "outfit-latin-900-normal"]],
  "Mono": [[500, "jetbrains-mono-latin-500-normal"], [700, "jetbrains-mono-latin-700-normal"], [800, "jetbrains-mono-latin-800-normal"]],
  "Bungee": [[400, "bungee-latin-400-normal"]],
  "Luckiest Guy": [[400, "luckiest-guy-latin-400-normal"]],
  "Press Start 2P": [[400, "press-start-2p-latin-400-normal"]],
  "Titan One": [[400, "titan-one-latin-400-normal"]],
  "Bowlby One": [[400, "bowlby-one-latin-400-normal"]],
  "Righteous": [[400, "righteous-latin-400-normal"]]
};
const fontsReady = (async () => {
  const all = [];
  for (const [fam, list] of Object.entries(FONT_FILES)) for (const [w, file] of list) {
    try { const f = new FontFace("F32 " + fam, `url(${BASE}fonts/${file}.woff2) format("woff2")`, { weight: String(w) }); document.fonts.add(f); all.push(f.load().catch(() => {})); } catch (e) {}
  }
  await Promise.all(all);
})();
const titleFam = c => `"F32 ${FONT_FILES[c.font] ? c.font : "Bungee"}"`;

/* ═════════════════ COLOR ═════════════════ */
const INK = "#0B0D09", CREAM = "#F4F6EC", MUTED = "#8a917f";
function boxAccent(hex){
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl, THREE.SRGBColorSpace);
  if (hsl.l < 0.42) c.setHSL(hsl.h, Math.min(hsl.s, 0.6), 0.55, THREE.SRGBColorSpace);
  return "#" + c.getHexString(THREE.SRGBColorSpace);
}
function shade(hex, k){ const c = new THREE.Color(hex); return "#" + c.lerp(new THREE.Color(INK), k).getHexString(); }
function lighten(hex, k){ const c = new THREE.Color(hex); return "#" + c.lerp(new THREE.Color("#ffffff"), k).getHexString(); }

/* a game's box settings, with defaults */
function cfgOf(g){
  const b = g.box || {}, shell = b.shell || g.color || "#9BE338";
  return {
    id: g.id, game: g, title: g.title || "", subtitle: g.subtitle || "", description: g.long || g.blurb || "",
    code: b.code || "GD-0000", players: b.players || "1P", region: b.region || "", shell, accent: boxAccent(shell), rated: mature(g),
    font: b.font || "Bungee", fill: b.fill || ["#ffffff", lighten(shell, .2)], art: b.art || g.thumb, shots: (b.shots || []).slice(0, 3)
  };
}

/* ═════════════════ IMAGES ═════════════════ */
const imgCache = new Map();
const loadImg = src => { if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; })); return imgCache.get(src); };
let logoImg, dinoImg;
const common = Promise.all([loadImg(BASE + "logo.png"), loadImg(BASE + "dino.png"), fontsReady]).then(([l, d]) => { logoImg = l; dinoImg = d; });
async function gameImages(c){
  const art = c.art ? await loadImg(siteUrl(c.art)).catch(() => null) : null;
  const shots = (await Promise.all(c.shots.map(s => loadImg(siteUrl(s)).catch(() => null)))).filter(Boolean);
  return { art, shots };
}

/* ═════════════════ 2D BOX FACES (logical px: front/back 1920×1200) ═════════════════ */
const C128 = ["11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000","11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100","11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010","11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000","11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110","11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010","11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000","10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010","10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110","11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110","10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","1100011101011"];
function mk(w, h){ const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const font = (w, px, fam) => `${w} ${px}px ${fam === "mono" ? '"F32 Mono", monospace' : fam ? fam : '"F32 Outfit", sans-serif'}`;
function spaced(g, em, px){ try { g.letterSpacing = (em * px) + "px"; } catch(e){} }
function drawCover(g, img, x, y, w, h, pos){
  const [px, py] = (pos || "50% 50%").split(/\s+/).map(v => parseFloat(v) / 100);
  const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.drawImage(img, x + (w - dw) * (isNaN(px) ? .5 : px), y + (h - dh) * (isNaN(py) ? .5 : py), dw, dh); g.restore();
}
function rr(g, x, y, w, h, r){ g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function fitFont(g, text, weight, maxPx, minPx, maxW, fam, em){
  let px = maxPx;
  for (; px > minPx; px -= 2){ g.font = font(weight, px, fam); spaced(g, em || 0, px); if (g.measureText(text).width <= maxW) break; }
  return px;
}
function wordmark(g, A, xRight, baseline, maxPx, maxW, skew, shadow){
  const a = "FOSSIL", b = "32";
  const px = fitFont(g, a + b, 900, maxPx, 20, maxW, "", -0.02);
  g.font = font(900, px, ""); spaced(g, -0.02, px);
  const wa = g.measureText(a).width, wb = g.measureText(b).width;
  g.save(); g.translate(xRight, baseline); if (skew) g.transform(1, 0, Math.tan(-10 * Math.PI / 180), 1, 0, 0);
  const x0 = -(wa + wb);
  if (shadow) [[10, shade(A, .82)], [5, shade(A, .7)]].forEach(([o, col]) => { g.fillStyle = col; g.fillText(a, x0 + o, o); g.fillText(b, x0 + wa + o, o); });
  g.fillStyle = A; g.fillText(a, x0, 0); g.fillStyle = CREAM; g.fillText(b, x0 + wa, 0);
  g.restore(); spaced(g, 0, 1);
  return px;
}
function code128(text){
  const vals = [104];
  for (const ch of text){ const v = ch.charCodeAt(0) - 32; if (v >= 0 && v < 95) vals.push(v); }
  let sum = 104; for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103, 106);
  return vals.map(v => C128[v]).join("");
}
function barcodeCanvas(text, outW, outH){
  const bits = code128(text || " "), quiet = 10, m = 4;
  const W = (bits.length + quiet * 2) * m, H = Math.round(W * outH / outW);
  const c = mk(W, H), g = c.getContext("2d");
  g.fillStyle = INK;
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") g.fillRect((quiet + i) * m, 0, m, H);
  const mask = mk(W, H), mg = mask.getContext("2d"), band = Math.round(H * 0.30);
  const dh = H - band + 4, dw = dh * dinoImg.width / dinoImg.height;
  mg.drawImage(dinoImg, (W - dw) / 2, 0, dw, dh);
  mg.fillRect(quiet * m, H - band, W - quiet * m * 2, band);
  g.globalCompositeOperation = "destination-in"; g.drawImage(mask, 0, 0);
  return c;
}
function seal(g, A, ox, oy, size){
  const s = size / 200;
  const oct = (inset) => { const a = 58 + inset * 0.414, b = 200 - a, lo = inset, hi = 200 - inset; return [[a,lo],[b,lo],[hi,a],[hi,b],[b,hi],[a,hi],[lo,b],[lo,a]]; };
  const poly = (pts, col) => { g.beginPath(); pts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](ox + x * s, oy + y * s)); g.closePath(); g.fillStyle = col; g.fill(); };
  poly(oct(0), A); poly(oct(10), INK); poly(oct(18), CREAM);
  g.fillStyle = INK; g.fillRect(ox + 40 * s, oy + 56 * s, 120 * s, 3 * s); g.fillRect(ox + 40 * s, oy + 141 * s, 120 * s, 3 * s);
  g.textAlign = "center";
  g.font = font(900, 26 * s, ""); spaced(g, 4 / 26, 26 * s); g.fillText("GRUG", ox + 100 * s, oy + 49 * s);
  g.font = font(800, 13.5 * s, "mono"); spaced(g, 2 / 13.5, 13.5 * s); g.fillText("CERTIFIED", ox + 100 * s, oy + 166 * s);
  g.textAlign = "left"; spaced(g, 0, 1);
  g.drawImage(dinoImg, ox + 76 * s, oy + 66 * s, 48 * s, 66 * s);
}

/* the retro title logo: chunky display face, solid extrusion, ink outline, two-tone chrome gradient, tagline banner */
function retroTitle(g, c, x, top, maxW, maxPx){
  const fam = titleFam(c), text = (c.title || "").toUpperCase(), skew = Math.tan(-9 * Math.PI / 180);
  const fit = t => fitFont(g, t, 400, maxPx, 24, maxW, fam, 0.01);
  let lines = [text], px = fit(text);
  if (px < maxPx * 0.66 && text.includes(" ")){
    const w = text.split(" "); let best = null;
    for (let i = 1; i < w.length; i++){ const l = [w.slice(0, i).join(" "), w.slice(i).join(" ")], p = Math.min(fit(l[0]), fit(l[1])); if (!best || p > best.p) best = { l, p }; }
    if (best && best.p > px){ lines = best.l; px = best.p; }
  }
  const lh = px * 1.02, depth = Math.max(6, px * 0.1);
  g.save(); g.translate(x, top); g.transform(1, 0, skew, 1, 0, 0);
  g.font = font(400, px, fam); spaced(g, 0.01, px); g.lineJoin = "round"; g.miterLimit = 2;
  lines.forEach((ln, i) => {
    const by = px * 0.88 + i * lh;
    // solid extrusion
    for (let d = depth; d > 0; d -= 1.5){ g.lineWidth = px * 0.16; g.strokeStyle = INK; g.strokeText(ln, d * 0.55, by + d); g.fillStyle = shade(c.accent, .55); g.fillText(ln, d * 0.55, by + d); }
    g.lineWidth = px * 0.17; g.strokeStyle = INK; g.strokeText(ln, 0, by);
    const gr = g.createLinearGradient(0, by - px * 0.82, 0, by + px * 0.04);
    gr.addColorStop(0, lighten(c.fill[0], .35)); gr.addColorStop(.46, c.fill[0]); gr.addColorStop(.54, c.fill[1]); gr.addColorStop(1, shade(c.fill[1], .25));
    g.fillStyle = gr; g.fillText(ln, 0, by);
    g.lineWidth = Math.max(2, px * 0.025); g.strokeStyle = "rgba(255,255,255,.55)"; g.save(); g.beginPath(); g.rect(-50, by - px, 4000, px * 0.42); g.clip(); g.strokeText(ln, 0, by); g.restore();
  });
  let bottom = px * 0.88 + (lines.length - 1) * lh + depth + 12;
  if (c.subtitle){
    const sp = Math.round(Math.max(22, Math.min(38, px * 0.3))); g.font = font(800, sp, "mono"); spaced(g, .12, sp);
    const sub = c.subtitle.toUpperCase(), tw = g.measureText(sub).width, bx = 6, by = bottom + 10;
    g.fillStyle = INK; rr(g, bx + 6, by + 6, tw + sp * 1.4, sp * 1.75, 8); g.fill();
    g.fillStyle = c.accent; rr(g, bx, by, tw + sp * 1.4, sp * 1.75, 8); g.fill();
    g.fillStyle = INK; g.fillText(sub, bx + sp * 0.7, by + sp * 1.22);
    bottom = by + sp * 1.75;
  }
  g.restore(); spaced(g, 0, 1);
  return bottom;
}

function drawFront(g, c, im){
  const A = c.accent;
  g.fillStyle = INK; g.fillRect(0, 0, 1920, 1200);
  let x = 790; [250,180,120,70,36,18].forEach(w => { g.fillStyle = A; g.fillRect(x, 0, w, 20); x += w + 8; });
  if (im.art) drawCover(g, im.art, 0, 56, 1580, 950, "50% 50%");
  else { g.fillStyle = "#EEF2E6"; g.fillRect(0, 56, 1580, 950); }
  g.save(); g.beginPath(); g.rect(0, 56, 1580, 950); g.clip();
  retroTitle(g, c, 70, 96, 940, 168);
  g.restore();
  // sidebar
  const lw = 292, lh = lw * logoImg.height / logoImg.width; g.drawImage(logoImg, 1604, 94, lw, lh);
  g.font = font(800, 17, "mono"); spaced(g, .16, 17); g.fillStyle = A; g.fillText(c.code, 1608, 193);
  g.font = font(700, 17, "mono"); g.fillStyle = MUTED; g.fillText(c.region, 1608, 219); spaced(g, 0, 1);
  const rail = g.createLinearGradient(0, 206, 0, 1186); rail.addColorStop(0, "rgba(0,0,0,0)"); rail.addColorStop(.08, A + "66"); rail.addColorStop(1, A + "66");
  g.fillStyle = rail; g.fillRect(1866, 206, 2, 980);
  g.fillStyle = A; [174,286,392,490,580,660,732,796,852,900,942,978,1010,1038,1062,1084,1104].forEach(y => g.fillRect(1861, 56 + y, 12, 12));
  g.fillRect(1890, 601, 30, 150);
  g.save(); g.translate(1905, 676); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle";
  g.font = font(800, 17, "mono"); spaced(g, .14, 17); g.fillStyle = INK; g.fillText(c.players, 0, 1); g.restore(); spaced(g, 0, 1);
  [1,1,1,1,1, 0,1,1,1,0, 0,0,1,0,0].forEach((v, i) => { if (v) g.fillRect(1632 + (i % 5) * 15, 706 + Math.floor(i / 5) * 15, 12, 12); });
  if (c.rated){   // a mature game: a plain "18+" label on the box (no imagery)
    g.fillStyle = CREAM; rr(g, 1602, 772, 112, 76, 10); g.fill();
    g.fillStyle = INK; g.textAlign = "center"; g.font = font(800, 42, "mono"); g.fillText("18+", 1658, 826); g.textAlign = "left";
  }
  g.fillStyle = CREAM; rr(g, 1602, 870, 250, 318, 10); g.fill();
  g.save(); rr(g, 1602, 870, 250, 318, 10); g.clip(); g.fillStyle = A; g.fillRect(1602, 870, 250, 8); g.restore();
  g.imageSmoothingEnabled = false; g.drawImage(barcodeCanvas(c.code, 226, 258), 1614, 892, 226, 258); g.imageSmoothingEnabled = true;
  g.fillStyle = INK; g.textAlign = "center"; g.font = font(800, 19, "mono"); spaced(g, .32, 19);
  g.fillText(c.code, 1727 + 3, 1173); g.textAlign = "left"; spaced(g, 0, 1);
  seal(g, A, 22, 1020, 170);
  wordmark(g, A, 1560, 1136, 150, 930, true, true);
  g.save(); g.translate(1560, 1183); g.transform(1, 0, Math.tan(-10 * Math.PI / 180), 1, 0, 0);
  g.font = font(800, 26, "mono"); spaced(g, .42, 26); g.fillStyle = CREAM; g.textAlign = "right";
  const tag = "DIGITAL FANTASY CONSOLE"; g.fillText(tag, 11, 0);
  const tw = g.measureText(tag).width; g.fillStyle = A; g.fillRect(-tw - 16 - 120 + 11, -14, 120, 6);
  g.restore(); spaced(g, 0, 1); g.textAlign = "left";
}
function wrapLines(g, text, maxW){
  const out = [];
  for (const para of String(text || "").split(/\n/)){
    const words = para.split(/\s+/).filter(Boolean); let line = "";
    if (!words.length){ out.push(""); continue; }
    for (const w of words){ const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line){ out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
function drawBack(g, c, im){
  const A = c.accent;
  g.fillStyle = INK; g.fillRect(0, 0, 1920, 1200);
  let x = 1920 - 790; [250,180,120,70,36,18].forEach(w => { x -= w; g.fillStyle = A; g.fillRect(x, 0, w, 20); x -= 8; });
  const L = 96, colW = 1010;
  const lw = 300, lh = lw * logoImg.height / logoImg.width; g.drawImage(logoImg, L, 88, lw, lh);
  const title = (c.title || "").toUpperCase(), fam = titleFam(c);
  const tpx = fitFont(g, title, 400, 104, 40, colW, fam, 0.01);
  g.font = font(400, tpx, fam); spaced(g, 0.01, tpx); g.fillStyle = CREAM; g.fillText(title, L, 300);
  let y = 300;
  if (c.subtitle){ g.font = font(700, 28, "mono"); spaced(g, .14, 28); g.fillStyle = A; g.fillText(c.subtitle.toUpperCase(), L + 2, y + 56); y += 56; }
  y += 46; g.font = font(700, 20, "mono"); spaced(g, .1, 20); let cx = L;
  [c.code, c.players, c.region, c.game.kind && c.game.kind.toUpperCase(), c.rated && "18+"].filter(Boolean).forEach(t => {
    const w = g.measureText(t).width + 30; g.strokeStyle = "#3a4230"; g.lineWidth = 2; rr(g, cx, y, w, 40, 6); g.stroke();
    g.fillStyle = "#a3ab97"; g.fillText(t, cx + 15, y + 28); cx += w + 12; });
  spaced(g, 0, 1);
  y += 96; g.fillStyle = A; g.fillRect(L, y - 40, 90, 6);
  g.font = font(500, 36, ""); g.fillStyle = "#cfd5c3";
  const lines = wrapLines(g, c.description, colW), lineH = 54, maxLines = Math.max(1, Math.floor((1010 - y) / lineH));
  lines.slice(0, maxLines).forEach((ln, i) => {
    let t = ln; if (i === maxLines - 1 && lines.length > maxLines){ while (t && g.measureText(t + "…").width > colW) t = t.slice(0, -1); t += "…"; }
    g.fillText(t, L, y + i * lineH);
  });
  wordmark(g, A, L + 430, 1128, 84, 430, true, false);
  g.font = font(800, 16, "mono"); spaced(g, .32, 16); g.fillStyle = MUTED; g.fillText("DIGITAL FANTASY CONSOLE", L, 1166); spaced(g, 0, 1);
  const SW = 620, SH = 349, gap = 34, X = 1920 - 96 - SW;
  const shots = im.shots.slice(0, 3), n = shots.length || 1;
  const top = (1200 - (n * SH + (n - 1) * gap)) / 2;
  for (let i = 0; i < n; i++){
    const sx = X + (i % 2 ? -26 : 0), sy = top + i * (SH + gap);
    g.save(); g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 30; g.shadowOffsetY = 10;
    g.fillStyle = "#151a10"; rr(g, sx - 6, sy - 6, SW + 12, SH + 12, 10); g.fill(); g.restore();
    g.fillStyle = A; rr(g, sx - 6, sy - 6, SW + 12, SH + 12, 10); g.fill();
    if (shots[i]){ g.save(); rr(g, sx, sy, SW, SH, 5); g.clip(); drawCover(g, shots[i], sx, sy, SW, SH); g.restore(); }
    else if (im.art){ g.save(); rr(g, sx, sy, SW, SH, 5); g.clip(); drawCover(g, im.art, sx, sy, SW, SH); g.restore(); }
    g.fillStyle = INK; rr(g, sx - 6, sy + SH - 40, 62, 46, [0, 8, 0, 10]); g.fill();
    g.fillStyle = A; g.font = font(800, 22, "mono"); g.fillText("0" + (i + 1), sx + 8, sy + SH - 8);
  }
}
function drawSpine(cv, c, scale){
  const g = cv.getContext("2d"), w = cv.width / scale, h = cv.height / scale, vertical = h > w;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.save(); g.fillStyle = INK; g.fillRect(0, 0, w, h);
  if (vertical){ g.translate(w, 0); g.rotate(Math.PI / 2); }
  const W = vertical ? h : w, H = vertical ? w : h;
  g.fillStyle = c.accent; g.fillRect(0, 0, 26, H); g.fillRect(W - 26, 0, 26, H);
  wordmark(g, c.accent, 60 + 380, H * 0.68, H * 0.5, 380, false, false);
  const title = (c.title || "").toUpperCase(), maxW = W - 60 - 380 - 130, fam = titleFam(c);
  const px = fitFont(g, title, 400, H * 0.34, 10, maxW, fam, .03);
  g.font = font(400, px, fam); spaced(g, .03, px); g.fillStyle = CREAM; g.textAlign = "right"; g.fillText(title, W - 70, H * 0.5 + px * 0.36);
  g.restore(); spaced(g, 0, 1); g.textAlign = "left";
}
const LABEL = { u0:0.4453, u1:0.7432, v0:0.7080, v1:0.9400, vFrontTop:0.876 };
function drawLabel(label, frontCv, c){
  const g = label.getContext("2d"), W = label.width, H = label.height;
  const topH = Math.round(H * (LABEL.v1 - LABEL.vFrontTop) / (LABEL.v1 - LABEL.v0));
  g.fillStyle = INK; g.fillRect(0, 0, W, H);
  g.fillStyle = c.accent; g.fillRect(0, topH - 10, W, 10);
  const px = Math.round(topH * 0.42); g.font = font(900, px, ""); spaced(g, -0.02, px);
  const tw = g.measureText("FOSSIL32").width; spaced(g, 0, 1);
  wordmark(g, c.accent, W / 2 + tw / 2, topH * 0.62, px, W, false, false);
  const pad = 26, fx = pad, fy = topH + pad * 0.6, fw = W - pad * 2, fh = H - topH - pad * 1.6;
  const ar = 1920 / 1200, dw = Math.min(fw, fh * ar), dh = dw / ar;
  g.drawImage(frontCv, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
}
/* draws a full set of faces at `scale` (1 = full res) into the given canvases */
function drawFaces(set, c, im){
  const s = set.scale;
  let g = set.front.getContext("2d"); g.setTransform(s, 0, 0, s, 0, 0); drawFront(g, c, im);
  g = set.back.getContext("2d"); g.setTransform(s, 0, 0, s, 0, 0); drawBack(g, c, im);
  drawSpine(set.spineV, c, s); drawSpine(set.spineH, c, s);
  if (set.label) drawLabel(set.label, set.front, c);
}
function faceSet(scale, withLabel, labelScale){
  const S = v => Math.round(v * scale), L = labelScale || 1;
  return { scale, front: mk(S(1920), S(1200)), back: mk(S(1920), S(1200)), spineV: mk(S(336), S(1600)), spineH: mk(S(1600), S(210)), label: withLabel ? mk(Math.round(1490 * L), Math.round(1160 * L)) : null };
}

/* ═════════════════ RENDERER ═════════════════ */
// every 3D view here (tiles, the Games rack, the unbox stage) renders at half the screen's resolution so phones stay smooth
const RES = 0.5;
const DPR = () => Math.min(devicePixelRatio || 1, 2) * RES;
// the one exception: the Games page's rack of boxes (Fossil32.rack) renders at full resolution while the boxes sit in it.
// The boxes are cheap on geometry next to the site's other 3D; the unbox, cartridge and console overlay stay at half.
const RACK_RES = 1;
const RACK_DPR = () => Math.min(devicePixelRatio || 1, 2) * RACK_RES;
let renderer = null, ANISO = 1;
try {
  const cv = document.createElement("canvas");
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); renderer.toneMapping = THREE.NeutralToneMapping; renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
} catch (e) { renderer = null; }

function ctex(c){ const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; }
const BW = 3.2, BH = 2.0, BD = 0.42, R = 0.06;
const boxGeo = renderer ? new RoundedBoxGeometry(BW, BH, BD, 5, R) : null;
function boxMaterials(set){
  const T = { front: ctex(set.front), back: ctex(set.back), spineV: ctex(set.spineV), spineH: ctex(set.spineH) };
  const mats = [T.spineV, T.spineV, T.spineH, T.spineH, T.front, T.back].map(map => new THREE.MeshStandardMaterial({ map, roughness: .46, metalness: 0 }));
  return { T, mats };
}
function lightRig(scene, accent, shadows){
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6; pm.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f25, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-4, 6, 7); scene.add(key);
  if (shadows){ key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); }
  const rim = new THREE.DirectionalLight(new THREE.Color(accent || "#9BE338"), 2.0); rim.position.set(5, 3, -6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6); fill.position.set(6, -1, 4); scene.add(fill);
  return { key, rim, fill };
}

/* ═════════════════ SHELF: floating boxes inside page tiles ═════════════════ */
const shelf = { scene: null, cam: null, items: new Set(), bufW: 0, bufH: 0, rig: null };
if (renderer){
  shelf.scene = new THREE.Scene(); shelf.rig = lightRig(shelf.scene, "#ffffff", false); shelf.rig.rim.intensity = 1.2;
  shelf.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
}
const SHELF_FOV = 28;
function shelfCamFor(cam, aspect, w, h){
  const half = Math.tan(THREE.MathUtils.degToRad(SHELF_FOV / 2));
  const d = Math.max(((h || BH) * 1.3) / 2 / half, ((w || BW) * 1.12) / 2 / half / aspect);
  cam.fov = SHELF_FOV; cam.aspect = aspect; cam.position.set(0, d * 0.07, d); cam.lookAt(0, -0.02, 0); cam.updateProjectionMatrix();
  return cam;
}
const io = renderer ? new IntersectionObserver(es => es.forEach(e => { const it = e.target.__f32; if (it) it.visible = e.isIntersecting; }), { rootMargin: "120px" }) : null;
const ro = renderer ? new ResizeObserver(es => es.forEach(e => { const it = e.target.__f32it; if (it){ const r = e.contentRect; it.w = r.width; it.h = r.height; } })) : null;

async function mount(el){
  if (el.__f32 || !renderer) return;
  const id = el.dataset.f32, g = gameById(id); if (!g) return;
  const stage = el.querySelector(".f32-stage") || el;
  const it = { el, stage, id, c: cfgOf(g), visible: false, w: stage.clientWidth, h: stage.clientHeight, phase: Math.random() * 10, hx: 0, hy: 0, tx: 0, ty: 0, lift: 0, hover: false, ready: false };
  el.__f32 = it; stage.__f32it = it;
  const cv = document.createElement("canvas"); cv.className = "f32-cv"; cv.setAttribute("aria-hidden", "true"); stage.appendChild(cv);
  it.cv = cv; it.ctx = cv.getContext("2d");
  stage.style.setProperty("--f32-c", it.c.accent);
  io.observe(el); ro.observe(stage);
  el.addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; const r = stage.getBoundingClientRect(); it.tx = (e.clientX - r.left) / r.width - .5; it.ty = (e.clientY - r.top) / r.height - .5; it.hover = true; });
  el.addEventListener("pointerleave", () => { it.tx = it.ty = 0; it.hover = false; });
  el.addEventListener("click", e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (e.target.closest("[data-f32-skip]")) return;
    e.preventDefault(); open(id, it);
  });
  await common;
  const im = await gameImages(it.c);
  const group = new THREE.Group(); group.visible = false;
  if (el.dataset.f32Kind === "cart"){
    // a bare cartridge (the home page): the game's label on plastic in its shell colour, centred on its own middle
    const A = await cartAssets().catch(() => null); if (!A){ it.cv.remove(); el.__f32 = null; return; }
    const set = faceSet(0.5, true, 0.5); drawFaces(set, it.c, im);
    const T = { label: ctex(set.label) }, shell = { value: new THREE.Color(it.c.shell) }, mat = cartMaterial(A, T.label, shell);
    const holder = cartHolder(A, mat, false), size = new THREE.Vector3(), mid = new THREE.Vector3();
    holder.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(holder); bb.getSize(size); bb.getCenter(mid);
    holder.position.sub(mid); group.add(holder);
    Object.assign(it, { kind: "cart", set, T, mats: [mat], box: holder, fw: size.x, fh: size.y });
  } else {
    const set = faceSet(0.5, false); drawFaces(set, it.c, im);
    const { T, mats } = boxMaterials(set);
    const box = new THREE.Mesh(boxGeo, mats); group.add(box);
    Object.assign(it, { set, T, mats, box });
  }
  shelf.scene.add(group);
  Object.assign(it, { group, ready: true });
  el.classList.add("f32-on");
  shelf.items.add(it);
  kick();
}
function unmount(it){
  shelf.items.delete(it); io && io.unobserve(it.el); ro && ro.unobserve(it.stage);
  if (it.group){ shelf.scene.remove(it.group); it.mats.forEach(m => m.dispose()); Object.values(it.T).forEach(t => t.dispose()); }
  it.cv && it.cv.remove(); it.el.__f32 = null;
}
function poseShelf(it, t, dt){
  const k = 1 - Math.exp(-dt * 6);
  it.hx += (it.tx - it.hx) * k; it.hy += (it.ty - it.hy) * k; it.lift += ((it.hover ? 1 : 0) - it.lift) * k;
  const sway = Math.sin(t * 0.8 + it.phase) * 0.16;
  it.yaw = -0.3 + sway * (1 - it.lift * 0.6) + it.hx * 0.7;
  it.group.rotation.set(0.05 + it.hy * 0.35, it.yaw, Math.sin(t * .7 + it.phase) * .012);
  it.group.position.set(0, Math.sin(t * 1.1 + it.phase) * 0.06 + it.lift * 0.08, it.lift * 0.25);
  it.stage.style.setProperty("--f32-bob", (Math.sin(t * 1.1 + it.phase) * 0.5 + 0.5 + it.lift).toFixed(3));
}
function renderShelf(t, dt){
  const dpr = DPR();
  let needW = 0, needH = 0; const list = [];
  for (const it of shelf.items){
    if (!it.el.isConnected){ unmount(it); continue; }
    if (!it.visible || !it.ready || it.hidden || it.w < 4 || it.h < 4) continue;
    const pw = Math.round(it.w * dpr), ph = Math.round(it.h * dpr); it.pw = pw; it.ph = ph;
    needW = Math.max(needW, pw); needH = Math.max(needH, ph); list.push(it);
  }
  if (!list.length) return false;
  if (needW > shelf.bufW || needH > shelf.bufH){ shelf.bufW = Math.max(needW, shelf.bufW); shelf.bufH = Math.max(needH, shelf.bufH); renderer.setSize(shelf.bufW, shelf.bufH, false); }
  renderer.shadowMap.enabled = false; renderer.setScissorTest(true);
  for (const it of list){
    poseShelf(it, t, dt);
    shelf.items.forEach(o => o.group && (o.group.visible = o === it));
    shelfCamFor(shelf.cam, it.pw / it.ph, it.fw, it.kind === "cart" ? it.fh * 1.2 : it.fh);   // a cartridge leaves room above and below for its tags
    shelf.rig.rim.color.set(it.c.accent);
    renderer.setViewport(0, 0, it.pw, it.ph); renderer.setScissor(0, 0, it.pw, it.ph);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(shelf.scene, shelf.cam);
    if (it.cv.width !== it.pw || it.cv.height !== it.ph){ it.cv.width = it.pw; it.cv.height = it.ph; }
    it.ctx.clearRect(0, 0, it.pw, it.ph);
    it.ctx.drawImage(renderer.domElement, 0, shelf.bufH - it.ph, it.pw, it.ph, 0, 0, it.pw, it.ph);
  }
  renderer.setScissorTest(false);
  return true;
}

/* ═════════════════ RACK: the Games page's vertical carousel of boxes ═════════════════
   Fossil32.rack(el, state) draws every game in state.ids as a column of floating boxes inside `el`. The page owns the
   scrolling: it sets state.pos (a float index, animated, any size) and the rack follows it every frame. The list loops:
   pos wraps around state.ids, so the last game sits just above the first. The box at the rounded pos is the selected one:
   centred, big, facing the viewer; the others shrink back along an arc and fade out.
   rack.pick(clientX, clientY) → the index of the box under the pointer (or -1). Fossil32.launch(id) plays from it. */
const rack = { el: null, cv: null, ctx: null, state: null, scene: null, cam: null, rig: null, items: [], w: 0, h: 0, ready: false,
  hx: 0, hy: 0, tx: 0, ty: 0, accent: new THREE.Color("#8aa6ff"), ray: renderer ? new THREE.Raycaster() : null };
const RACK_FOV = 30;
function rackLayout(o){
  // o = this box's offset from the selected one (…-2, -1, 0, 1, 2… and everything in between while scrolling)
  const a = Math.abs(o), s = Math.sign(o), a1 = Math.min(a, 1), a2 = Math.max(0, a - 1);
  return {
    y: -s * (a1 * BH * 1.16 + a2 * BH * 0.92),
    x: -0.42 * Math.pow(Math.min(a, 2.6), 1.3),
    z: -1.1 * Math.min(a, 3.4),
    scale: 1 - 0.3 * a1 - 0.07 * Math.min(a2, 2),
    yaw: -0.3 - 0.26 * a1 - 0.05 * a2,
    pitch: 0.06 + 0.13 * Math.max(-2, Math.min(2, o)),
    fade: a < 1.7 ? 1 : Math.max(0, 1 - (a - 1.7) / 1.3)
  };
}
const wrapIdx = (i, n) => ((i % n) + n) % n;
const wrapOff = (o, n) => { o = wrapIdx(o, n); return o >= n / 2 ? o - n : o; };   // shortest way round the loop
function rackCam(){
  const aspect = rack.w / Math.max(1, rack.h), half = Math.tan(THREE.MathUtils.degToRad(RACK_FOV / 2));
  // the selected box takes ~56% of the width, or ~30% of the height, whichever comes first
  const ph = rack.w > innerWidth * 0.75;   // phones (the rack spans the screen above the details): the rack is short and wide, so the box can take more of the width (and keeps clear of the rail on the right)
  const d = Math.max(BW / (ph ? 0.66 : 0.56) / 2 / half / aspect, BH / (ph ? 0.42 : 0.3) / 2 / half), cx = ph ? 0.32 : -0.25;
  rack.cam.fov = RACK_FOV; rack.cam.aspect = aspect; rack.cam.position.set(cx, d * 0.035, d); rack.cam.lookAt(cx, 0, 0); rack.cam.updateProjectionMatrix();
}
async function mountRack(el, state){
  if (!renderer) return null;
  if (rack.el) unmountRack();
  rack.el = el; rack.state = state; rack.items = [];
  rack.scene = new THREE.Scene(); rack.rig = lightRig(rack.scene, "#ffffff", false); rack.rig.rim.intensity = 1.6;
  rack.rig.key.intensity = 2.1;
  rack.cam = new THREE.PerspectiveCamera(RACK_FOV, 1, 0.1, 100);
  const cv = document.createElement("canvas"); cv.className = "f32-rackcv"; cv.setAttribute("aria-hidden", "true"); el.appendChild(cv);
  rack.cv = cv; rack.ctx = cv.getContext("2d");
  const r = el.getBoundingClientRect(); rack.w = r.width; rack.h = r.height;
  rack.ro = new ResizeObserver(es => es.forEach(e => { rack.w = e.contentRect.width; rack.h = e.contentRect.height; kick(); })); rack.ro.observe(el);
  el.addEventListener("pointermove", rack.onMove = e => { if (e.pointerType !== "mouse") return; const b = el.getBoundingClientRect(); rack.tx = (e.clientX - b.left) / b.width - .5; rack.ty = (e.clientY - b.top) / b.height - .5; });
  el.addEventListener("pointerleave", rack.onLeave = () => { rack.tx = rack.ty = 0; });
  await common;
  // the boxes nearest the start come first, so the page fills in from the middle out
  const order = state.ids.map((id, i) => i).sort((a, b) => Math.abs(wrapOff(a - state.pos, state.ids.length)) - Math.abs(wrapOff(b - state.pos, state.ids.length)));
  for (const i of order){
    if (rack.el !== el) return null;
    const g = gameById(state.ids[i]); if (!g) continue;
    const c = cfgOf(g), im = await gameImages(c);
    const set = faceSet(0.5, false); drawFaces(set, c, im);
    const { T, mats } = boxMaterials(set);
    mats.forEach(m => { m.transparent = true; });
    const group = new THREE.Group(), box = new THREE.Mesh(boxGeo, mats); box.userData.index = i; group.add(box);
    rack.scene.add(group);
    rack.items[i] = { i, id: g.id, c, set, T, mats, group, box, phase: Math.random() * 10, away: false, shown: 0 };
    rack.ready = true; el.classList.add("f32-rack-on"); kick();
  }
  return rack;
}
function unmountRack(){
  if (!rack.el) return;
  rack.ro && rack.ro.disconnect();
  rack.el.removeEventListener("pointermove", rack.onMove); rack.el.removeEventListener("pointerleave", rack.onLeave);
  rack.items.forEach(it => { if (!it) return; it.mats.forEach(m => m.dispose()); Object.values(it.T).forEach(t => t.dispose()); });
  rack.cv && rack.cv.remove(); rack.el = null; rack.items = []; rack.ready = false;
}
function poseRack(t, dt){
  const st = rack.state, k = 1 - Math.exp(-dt * 6), still = reduceMotion();
  rack.hx += (rack.tx - rack.hx) * k; rack.hy += (rack.ty - rack.hy) * k;
  const n = st.ids.length, sel = wrapIdx(Math.round(st.pos), n);
  for (const it of rack.items){
    if (!it) continue;
    const o = wrapOff(it.i - st.pos, n), L = rackLayout(o), focus = Math.max(0, 1 - Math.abs(o));
    it.shown += (1 - it.shown) * Math.min(1, dt * 5);
    const sway = still ? 0 : Math.sin(t * 0.8 + it.phase) * 0.12 * (0.4 + focus * 0.6);
    const bob = still ? 0 : Math.sin(t * 1.1 + it.phase) * 0.05;
    it.group.visible = !it.away && L.fade > 0.01;
    it.group.position.set(L.x, L.y + bob, L.z);
    it.group.scale.setScalar(L.scale * (0.92 + 0.08 * it.shown));
    it.group.rotation.set(L.pitch + rack.hy * 0.3 * focus, L.yaw + sway + rack.hx * 0.6 * focus, Math.sin(t * .7 + it.phase) * .012);
    const op = L.fade * it.shown;
    it.mats.forEach(m => { m.opacity = op; m.depthWrite = op > 0.6; });
    if (it.i === sel) rack.accent.lerp(new THREE.Color(it.c.accent), Math.min(1, dt * 4));
  }
  rack.rig.rim.color.copy(rack.accent);
}
function renderRack(t, dt){
  if (!rack.el || !rack.ready || !rack.el.isConnected || rack.w < 4 || rack.h < 4) return false;
  const dpr = RACK_DPR(), pw = Math.round(rack.w * dpr), ph = Math.round(rack.h * dpr);
  if (pw > shelf.bufW || ph > shelf.bufH){ shelf.bufW = Math.max(pw, shelf.bufW); shelf.bufH = Math.max(ph, shelf.bufH); renderer.setSize(shelf.bufW, shelf.bufH, false); }
  poseRack(t, dt); rackCam();
  renderer.shadowMap.enabled = false; renderer.setScissorTest(true);
  renderer.setViewport(0, 0, pw, ph); renderer.setScissor(0, 0, pw, ph);
  renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(rack.scene, rack.cam);
  renderer.setScissorTest(false);
  if (rack.cv.width !== pw || rack.cv.height !== ph){ rack.cv.width = pw; rack.cv.height = ph; }
  rack.ctx.clearRect(0, 0, pw, ph);
  rack.ctx.drawImage(renderer.domElement, 0, shelf.bufH - ph, pw, ph, 0, 0, pw, ph);
  return true;
}
function rackPick(x, y){
  if (!rack.el || !rack.ready) return -1;
  const b = rack.el.getBoundingClientRect();
  rack.ray.setFromCamera(new THREE.Vector2(((x - b.left) / b.width) * 2 - 1, -((y - b.top) / b.height) * 2 + 1), rack.cam);
  const hits = rack.ray.intersectObjects(rack.items.filter(it => it && it.group.visible).map(it => it.box), false);
  return hits.length ? hits[0].object.userData.index : -1;
}
/* where the selected box sits on screen, framed the way the overlay's first frame expects (a 4:3 "tile" around it) */
function rackFrom(it){
  const b = rack.el.getBoundingClientRect();
  it.group.updateMatrixWorld(true);
  const p = v => { v.applyMatrix4(it.group.matrixWorld).project(rack.cam); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; };
  const c = p(new THREE.Vector3(0, 0, 0)), l = p(new THREE.Vector3(-BW / 2, 0, 0)), r = p(new THREE.Vector3(BW / 2, 0, 0));
  const w = Math.hypot(r.x - l.x, r.y - l.y) * 1.12, h = w * 3 / 4;
  return { rect: { x: c.x - w / 2, y: c.y - h / 2, w, h }, rot: it.group.rotation.clone(), y: 0 };
}
function launch(id){
  const it = rack.items.find(x => x && x.id === id);
  if (!it || !renderer){ const g = gameById(id); if (g) location.href = siteUrl(g.game || g.play); return; }
  const from = rackFrom(it);
  open(id, null, { launch: true, from, onAway: () => { it.away = true; }, onBack: () => { it.away = false; it.shown = 0.4; } });
}

/* ═════════════════ OVERLAY: dark focus stage, unbox, game panel, console boot ═════════════════ */
const ov = { el: null, active: false, scene: null, cam: null, c: null, it: null, phase: "", t: 0, tStart: 0, built: false };
const ease = { io: k => k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2, in: k => k*k, out: k => 1 - Math.pow(1 - k, 3),
  back: k => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); } };
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CAM_HOME = { pos: new THREE.Vector3(0.35, 0.5, 8.1), target: new THREE.Vector3(0.15, -0.1, 0.2) };
const FLY = 0.8, UNBOX_END = 4.5, PANEL_AT = 3.9, LAUNCH_AT = 3.3;
// snappier: the unbox runs this much faster when launching straight into a game, and the console boot runs this much faster always
const LAUNCH_SPEED = 1.35, BOOT_SPEED = 1.75;
let O = null;   // overlay 3D objects, built on first open

function buildOverlayDom(){
  const el = document.createElement("div"); el.className = "f32-ov"; el.hidden = true; el.tabIndex = -1; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="f32-white"></div><div class="f32-focus"></div><div class="f32-gl"></div>
    <section class="f32-panel" aria-live="polite"></section>
    <button class="f32-close" type="button" aria-label="Close">✕</button>
    <button class="f32-skip" type="button">Skip ▸▸</button>
    <button class="f32-bootskip" type="button" aria-label="Skip the boot sequence and play now"><span class="f32-bootskip-k">SKIP</span><span class="f32-bootskip-s">straight to the game ▸▸</span></button>
    <div class="f32-flash"></div>
    <div class="f32-credit">Cartridge model by Pavel Kutejnikov (Drumdorf), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, modified</div>`;
  document.body.appendChild(el);
  el.querySelector(".f32-close").onclick = () => close(true);
  el.querySelector(".f32-skip").onclick = () => skip();
  el.querySelector(".f32-bootskip").onclick = () => { if (ov.phase === "boot" && boot && !boot.went){ boot.went = true; go(ov.c); } };
  // Space or Enter during the boot also skips it
  el.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && ov.phase === "boot" && boot && !boot.went){ e.preventDefault(); boot.went = true; go(ov.c); } });
  el.querySelector(".f32-gl").addEventListener("click", () => { if (!ov.launch && (ov.phase === "fly" || ov.phase === "unbox")) skip(); });
  el.addEventListener("keydown", e => { if (e.key === "Escape") close(true); });
  // keep the page underneath still (without hiding its scrollbar, which would shift the tiles)
  const stop = e => { if (!e.target.closest(".f32-panel")) e.preventDefault(); };
  el.addEventListener("wheel", stop, { passive: false }); el.addEventListener("touchmove", stop, { passive: false });
  ov.el = el;
}
function panelHtml(c){
  const g = c.game, G = window.Grug;
  let stats = "";
  try { const p = G && G.points ? G.points().find(x => x.game.id === g.id) : null;
    const best = G && G.profile ? Math.max(+(G.profile.stats.best[g.app] || 0), p ? p.best : 0) : 0;
    const bits = []; if (p && p.points) bits.push(`<b>${G.fmt(p.points)}</b> points`); if (best) bits.push(`best <b>${G.fmt(best)}</b>`);
    if (bits.length) stats = `<div class="f32-stats">${bits.join(" · ")}</div>`; } catch (e) {}
  const chips = (c.rated ? `<span class="g-rated" title="For players 18 and over">18+</span>` : "") + [g.kind, g.original ? "Grug Original" : g.partner, g.place].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
  const feats = (g.features || []).map(f => `<li>${esc(f)}</li>`).join("");
  const live = g.status === "live" || g.status === "legacy";
  return `<div class="f32-eyebrow">FOSSIL32 · ${esc(c.code)} · ${esc(c.players)}${c.region ? " · " + esc(c.region) : ""}${g.status === "legacy" ? " · CLASSIC" : g.status !== "live" ? " · DEMO" : ""}${c.rated ? " · 18+" : ""}</div>
    <h2 class="f32-title">${esc(c.title || "")}</h2>
    ${c.subtitle ? `<div class="f32-sub">${esc(c.subtitle)}</div>` : ""}
    <div class="f32-chips">${chips}</div>
    <p class="f32-desc">${esc(g.long || g.blurb || "")}</p>
    ${feats ? `<h3 class="f32-h">Features</h3><ul class="f32-feats">${feats}</ul>` : ""}
    ${stats}
    <div class="f32-actions">
      <a class="f32-more" href="${esc(siteUrl("games/" + g.id + "/"))}">Game page</a>
      <button class="f32-play" type="button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2l14 8-14 8z" fill="currentColor"/></svg>${live ? "PLAY" : "PLAY DEMO"}</button>
    </div>`;
}

async function buildOverlay3D(){
  if (O) return O;
  const scene = new THREE.Scene(), rig = lightRig(scene, "#ffffff", true); rig.key.position.set(-2.5, 9, 5);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.11 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.55; floor.receiveShadow = true; scene.add(floor);
  const set = faceSet(1, true);
  const T = { front: ctex(set.front), back: ctex(set.back), spineV: ctex(set.spineV), spineH: ctex(set.spineH), label: ctex(set.label) };
  const interior = ctex((() => { const c = mk(256, 1024), g = c.getContext("2d");
    g.fillStyle = INK; g.fillRect(0, 0, 256, 1024);
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "#020301"); gr.addColorStop(.5, "#0d1109"); gr.addColorStop(1, "#020301");
    g.fillStyle = gr; g.fillRect(18, 18, 220, 988); return c; })());
  const show = new THREE.Group(); scene.add(show);
  const boxMats = [interior, T.spineV, T.spineH, T.spineH, T.front, T.back].map(map => new THREE.MeshStandardMaterial({ map, roughness: .46, metalness: 0 }));
  const box = new THREE.Mesh(boxGeo, boxMats); box.castShadow = box.receiveShadow = true; show.add(box);
  const hinge = new THREE.Group(); hinge.position.set(BW / 2 - 0.002, 0, -BD / 2 + 0.03); box.add(hinge);
  const flapMats = [0,1,2,3,4,5].map(i => new THREE.MeshStandardMaterial({ color: i === 0 ? 0xffffff : 0x0b0d09, map: i === 0 ? T.spineV : null, roughness: .46 }));
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.016, BH - 0.1, BD - 0.06, 2, 0.006), flapMats);
  flap.position.set(0.01, 0, (BD - 0.06) / 2); flap.castShadow = true; hinge.add(flap);
  // the closed right spine sits over the flap until the flap opens
  O = { scene, rig, cam, floor, set, T, show, box, boxMats, hinge, flap, flapMats, cart: null, con: null };
  return O;
}
const shellUniform = { value: new THREE.Color("#9BE338") };
/* the cartridge model and its textures, loaded once and shared by the overlay and the home page's cartridges */
let cartAssetsP = null;
function cartAssets(){
  if (cartAssetsP) return cartAssetsP;
  const lt = (src, srgb) => new Promise((res, rej) => new THREE.TextureLoader().load(src, t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = ANISO; res(t); }, undefined, rej));
  cartAssetsP = Promise.all([lt(BASE + "cart-base.jpg", true), lt(BASE + "cart-pack.png", false), lt(BASE + "cart-normal.jpg", false), lt(BASE + "cart-orm.jpg", false),
    fetch(BASE + "cartridge.obj").then(r => r.text())]).then(([base, pack, normal, orm, objText]) => {
      const obj = new OBJLoader().parse(objText);
      obj.traverse(o => { if (o.isMesh) o.geometry.computeVertexNormals(); });
      return { base, pack, normal, orm, obj };
    });
  cartAssetsP.catch(() => { cartAssetsP = null; });
  return cartAssetsP;
}
/* a cartridge material: the plastic in `shell` (a {value: Color} uniform), the game's label from `labelTex` */
function cartMaterial(A, labelTex, shell){
  const mat = new THREE.MeshStandardMaterial({ map: A.base, normalMap: A.normal, aoMap: A.orm, roughnessMap: A.orm, metalnessMap: A.orm, roughness: 1, metalness: 1 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { packMap: { value: A.pack }, labelMap: { value: labelTex }, shellColor: shell, labelRect: { value: new THREE.Vector4(LABEL.u0, LABEL.v0, LABEL.u1, LABEL.v1) } });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D packMap; uniform sampler2D labelMap; uniform vec3 shellColor; uniform vec4 labelRect;`)
      .replace("#include <map_fragment>", `
        vec3 pk = texture2D(packMap, vMapUv).rgb;
        vec3 col = mix(texture2D(map, vMapUv).rgb, shellColor * pk.r * 2.0, pk.g);
        vec2 luv = clamp((vMapUv - labelRect.xy) / (labelRect.zw - labelRect.xy), 0.0, 1.0);
        col = mix(col, texture2D(labelMap, luv).rgb, pk.b);
        diffuseColor.rgb *= col;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, pk.b);
        roughnessFactor = mix(roughnessFactor, clamp(roughnessFactor, 0.28, 0.6), pk.g);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
        metalnessFactor *= (1.0 - max(pk.b, pk.g));`);
  };
  return mat;
}
function cartHolder(A, mat, shadows){
  const obj = A.obj.clone();
  obj.traverse(o => { if (o.isMesh){ o.material = mat; o.castShadow = o.receiveShadow = !!shadows; } });
  obj.position.set(0.15, -4.08, 0);
  const pivot = new THREE.Group(); pivot.add(obj); pivot.rotation.y = Math.PI / 2;
  const holder = new THREE.Group(); holder.add(pivot); holder.scale.setScalar(0.128);
  return holder;
}
async function buildCartridge(){
  if (O.cart) return O.cart;
  const A = await cartAssets();
  const holder = cartHolder(A, cartMaterial(A, O.T.label, shellUniform), true); holder.visible = false;
  O.show.add(holder); O.cart = holder; return holder;
}

/* console (from the showcase v2) */
const K = 0.0322, SLOT = { x: 11.16, z: 10.04, top: 131.36 };
const CART_W = 1.536 / K, CART_T = 0.294 / K, CART_HALF_H = 0.522;
const CON_CAM = [
  { pos: new THREE.Vector3(6.6, 5.0, 13.4), target: new THREE.Vector3(0, 1.75, 0.6) },
  { pos: new THREE.Vector3(4.6, 3.8, 10.6), target: new THREE.Vector3(0, 1.45, 0.7) },
  { pos: new THREE.Vector3(0, 1.1, 9.0),    target: new THREE.Vector3(0, 0.8, 2.4) }
];
async function buildConsole(){
  if (O.con) return O.con;
  const group = new THREE.Group(); group.visible = false; O.scene.add(group);
  group.scale.setScalar(K); const baseY = -1.55 + 0.45 * K; group.position.set(-SLOT.x * K, baseY, -SLOT.z * K);
  const mat = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x161a12, roughness: .5, clearcoat: .4, clearcoatRoughness: .35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0b0d09, roughness: .7 }),
    accent: new THREE.MeshPhysicalMaterial({ color: 0x9BE338, roughness: .38, clearcoat: .5, clearcoatRoughness: .3 }),
    knob: new THREE.MeshStandardMaterial({ color: 0x2a2f25, roughness: .35, metalness: .4 }),
    led: new THREE.MeshBasicMaterial({ color: 0x1a2014 }),
    hole: new THREE.MeshBasicMaterial({ color: 0x000000 })
  };
  const screenC = mk(768, 457), screenT = ctex(screenC), screenMat = new THREE.MeshBasicMaterial({ map: screenT, toneMapped: false });
  const sideC = mk(1400, 260), sideT = ctex(sideC);
  const SCREEN = { center: new THREE.Vector3(), size: new THREE.Vector3() };
  const gltf = await new GLTFLoader().loadAsync(BASE + "console.glb");
  const root = gltf.scene; group.add(root);
  const byName = { Cube: "body", Cube001: "accent", Cube002: "accent", Cylinder002: "accent", Cylinder: "knob", Cube007: "led" };
  let screenMesh;
  root.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
    if (o.name === "Cube006"){ o.material = screenMat; o.castShadow = false; screenMesh = o; } else o.material = mat[byName[o.name] || "dark"]; });
  group.updateMatrixWorld(true);
  if (screenMesh){
    const g = screenMesh.geometry, pos = g.attributes.position, v = new THREE.Vector3(), wb = new THREE.Box3().setFromObject(screenMesh);
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i).applyMatrix4(screenMesh.matrixWorld);
      uv[i*2] = (v.x - wb.min.x) / (wb.max.x - wb.min.x); uv[i*2+1] = (v.y - wb.min.y) / (wb.max.y - wb.min.y); }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    wb.getCenter(SCREEN.center); wb.getSize(SCREEN.size);
  }
  const sx = SLOT.x, sz = SLOT.z, base = SLOT.top - 0.4, H = 3.6, top = base + H;
  const housing = new THREE.Mesh(new RoundedBoxGeometry(CART_W + 12, H, CART_T + 12, 3, 1.4), mat.body);
  housing.position.set(sx, base + H / 2, sz); housing.castShadow = housing.receiveShadow = true; group.add(housing);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(CART_W + 2.4, CART_T + 2.4), mat.hole);
  hole.rotation.x = -Math.PI / 2; hole.position.set(sx, top + 0.02, sz); group.add(hole);
  const lipW = 1.1, ow = CART_W + 2.4 + lipW * 2, od = CART_T + 2.4 + lipW * 2;
  [[0, (od - lipW) / 2, ow, lipW], [0, -(od - lipW) / 2, ow, lipW], [(ow - lipW) / 2, 0, lipW, od], [-(ow - lipW) / 2, 0, lipW, od]].forEach(([dx, dz, w, d]) => {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), mat.accent); lip.position.set(sx + dx, top + 0.2, sz + dz); group.add(lip); });
  group.updateMatrixWorld(true);
  const slotTopW = new THREE.Vector3(0, top, 0).applyMatrix4(group.matrixWorld).y;
  const lw = 40, lh = lw * logoImg.height / logoImg.width;
  const logoT = new THREE.Texture(logoImg); logoT.colorSpace = THREE.SRGBColorSpace; logoT.anisotropy = ANISO; logoT.needsUpdate = true;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ map: logoT, transparent: true, roughness: .5 }));
  logo.position.set(-16, 123.4, 82.82); group.add(logo);
  const sideMat = new THREE.MeshStandardMaterial({ map: sideT, transparent: true, roughness: .45 });
  [[64.58, Math.PI / 2], [-42.36, -Math.PI / 2]].forEach(([x, ry]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(76, 76 * sideC.height / sideC.width), sideMat);
    m.position.set(x, 30, 27); m.rotation.y = ry; group.add(m); });
  O.con = { group, mat, screenC, screenT, sideC, sideT, SCREEN, slotTopW, baseY, noiseC: mk(192, 114) };
  return O.con;
}
function paintConsole(c){
  const con = O.con; con.mat.accent.color.set(c.shell);
  const g = con.sideC.getContext("2d"); g.clearRect(0, 0, con.sideC.width, con.sideC.height);
  const h = con.sideC.height; wordmark(g, c.accent, con.sideC.width - 10, h * 0.7, h * 0.72, con.sideC.width - 40, true, false); con.sideT.needsUpdate = true;
}
const tintCache = new Map();
function tinted(img, col){
  const key = col + img.width; if (tintCache.has(key)) return tintCache.get(key);
  const c = mk(img.width, img.height), g = c.getContext("2d");
  g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c); return c;
}
function drawScreen(c, state, t){
  const con = O.con, g = con.screenC.getContext("2d"), W = con.screenC.width, H = con.screenC.height, A = c.accent;
  g.fillStyle = "#040604"; g.fillRect(0, 0, W, H);
  if (state === "static"){
    const n = con.noiseC.getContext("2d"), id = n.createImageData(con.noiseC.width, con.noiseC.height);
    for (let i = 0; i < id.data.length; i += 4){ const v = Math.random() * 255 | 0; id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 255; }
    n.putImageData(id, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(con.noiseC, 0, 0, W, H); g.imageSmoothingEnabled = true;
  } else if (state === "boot"){
    const a = Math.min(1, t / 0.35);
    g.globalAlpha = a; g.fillStyle = INK; g.fillRect(0, 0, W, H);
    const dh = H * 0.36, dw = dh * dinoImg.width / dinoImg.height, rise = (1 - ease.out(Math.min(1, t / 0.6))) * 30;
    g.drawImage(tinted(dinoImg, A), W / 2 - dw / 2, H * 0.12 + rise, dw, dh);
    wordmark(g, A, W / 2 + 175, H * 0.67, 96, 360, true, true);
    g.fillStyle = MUTED; g.textAlign = "center"; g.font = font(800, 15, "mono"); spaced(g, .4, 15);
    g.fillText("GRUG DIGITAL", W / 2 + 3, H * 0.77); spaced(g, 0, 1);
    const k = Math.min(1, Math.max(0, (t - 0.5) / 1.3));
    g.strokeStyle = "#2c3324"; g.lineWidth = 2; g.strokeRect(W / 2 - 140, H * 0.84, 280, 14);
    g.fillStyle = A; g.fillRect(W / 2 - 137, H * 0.84 + 3, 274 * k, 8);
    if (k >= 1){ g.fillStyle = CREAM; g.font = font(700, 14, "mono"); spaced(g, .2, 14); g.fillText((c.title || "").toUpperCase(), W / 2, H * 0.95); spaced(g, 0, 1); }
    g.textAlign = "left"; g.globalAlpha = 1;
  }
  g.fillStyle = "rgba(0,0,0,.22)"; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  const vg = g.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, W*0.62); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const gl = g.createLinearGradient(0, 0, W * 0.6, H); gl.addColorStop(0, "rgba(255,255,255,.07)"); gl.addColorStop(.5, "rgba(255,255,255,0)");
  g.fillStyle = gl; g.fillRect(0, 0, W, H);
  con.screenT.needsUpdate = true;
}

/* ── overlay timeline ── */
const tmpV = new THREE.Vector3(), focusV = new THREE.Vector3(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
const camFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() }, camNow = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
const narrow = () => innerWidth < innerHeight * 0.95;
function setBoxOpacity(o){ O.boxMats.concat(O.flapMats).forEach(m => { m.transparent = o < 1; m.opacity = o; m.depthWrite = o > 0.5; }); }
function unboxCam(){   // where the camera ends up: the cartridge left of centre (or above centre on a tall screen)
  O.cart.getWorldPosition(focusV);
  const n = narrow();
  // with the game panel: the cartridge sits left of centre (above it on a tall screen); launching: right in the middle
  tmpV.copy(focusV).add(ov.launch ? new THREE.Vector3(0.25, 0, 0) : n ? new THREE.Vector3(0, -1.0, 0) : new THREE.Vector3(1.2, 0, 0));
  return { target: tmpV.clone(), pos: tmpV.clone().add(new THREE.Vector3(0.12, 0.3, n ? 6.6 : 5.4)) };
}
function poseUnbox(t){
  const turn = ease.io(seg(t, 0.2, 1.0)) - ease.io(seg(t, 2.7, 4.1));
  O.show.position.set(0, 0, 0); O.show.rotation.set(0, -0.62 * turn, 0);
  const drop = seg(t, 2.5, 3.4);
  O.box.visible = drop < 1;
  O.box.position.set(0, 0.1 + (drop ? -ease.in(drop) * 4.2 : Math.sin(t * 1.1) * 0.03), 0);
  O.box.rotation.set(-ease.in(drop) * 0.45, 0, ease.in(drop) * 0.12);
  setBoxOpacity(1 - Math.pow(drop, 1.4));
  O.hinge.rotation.y = ease.back(seg(t, 0.9, 1.6)) * 1.95;
  const cart = O.cart; cart.visible = true;
  const slide = ease.io(seg(t, 1.45, 2.55)), rise = ease.io(seg(t, 2.6, 3.8)), after = Math.max(0, t - 3.8);
  cart.position.set(2.55 * slide, 0.1 + rise * 0.12 + (after ? Math.sin(after * 1.2) * 0.05 : 0), 0);
  cart.rotation.set(0, Math.sin(after * 0.8) * 0.18 * Math.min(1, after), 0);
  const k = ease.io(seg(t, 2.6, 4.3)), end = unboxCam();
  camNow.target.lerpVectors(camFrom.target, end.target, k);
  camNow.pos.lerpVectors(camFrom.pos, end.pos, k);
}
let boot = null;
function poseBoot(t){
  // 0 → 0.8: bridge (console rises, cartridge glides over, camera swings round); then the showcase console timeline
  t *= BOOT_SPEED;   // the whole boot runs faster (players found it drawn out)
  const con = O.con, c = ov.c, B = 0.8, cart = O.cart;
  const inY = con.slotTopW - 0.42 + CART_HALF_H;
  const rise = ease.out(seg(t, 0, 0.7));
  con.group.visible = true; con.group.position.y = con.baseY - (1 - rise) * 3.2;
  O.box.visible = false; O.show.rotation.set(0, 0, 0); O.show.position.set(0, 0, 0);
  const tc = t - B;
  // console-timeline pose of the cartridge
  const k = ease.io(seg(tc, 0.4, 1.5)), push = ease.in(seg(tc, 1.5, 1.8)), settle = Math.sin(seg(tc, 1.8, 2.05) * Math.PI) * 0.025;
  const hover = (1 - k) * Math.sin(Math.max(0, tc) * 2.2) * 0.05;
  const px = 0, py = lerp(inY + 1.45, inY + 0.4, k) - push * 0.4 + settle + hover, pz = lerp(0.35, 0, k);
  const rx = lerp(0.18, 0, k), ry = lerp(0.7, 0, k), rz = lerp(-0.12, 0, k);
  if (t < B){ const b = ease.io(seg(t, 0, B));
    cart.position.set(lerp(boot.cp.x, px, b), lerp(boot.cp.y, py, b), lerp(boot.cp.z, pz, b));
    cart.rotation.set(lerp(boot.cr.x, rx, b), lerp(boot.cr.y, ry, b), lerp(boot.cr.z, rz, b));
  } else { cart.position.set(px, py, pz); cart.rotation.set(rx, ry, rz); }
  const on = tc > 1.95;
  con.mat.led.color.set(on ? c.accent : "#1a2014");
  drawScreen(c, !on ? "off" : tc < 2.25 ? "static" : "boot", tc - 2.25);
  const n = narrow(), sc = con.SCREEN.center, half = Math.tan(THREE.MathUtils.degToRad(ov.cam.fov / 2));
  const fill = Math.min((con.SCREEN.size.y / 2) / half, (con.SCREEN.size.x / 2) / (half * ov.cam.aspect)) * 0.86;
  if (t < B){ const b = ease.io(seg(t, 0, B)); vA.lerpVectors(boot.camPos, CON_CAM[0].pos, b); vB.lerpVectors(boot.camTarget, CON_CAM[0].target, b); }
  else if (tc < 2.1){ const k2 = ease.io(seg(tc, 0, 2.1)); vA.lerpVectors(CON_CAM[0].pos, CON_CAM[1].pos, k2); vB.lerpVectors(CON_CAM[0].target, CON_CAM[1].target, k2); }
  else if (tc < 3.3){ const k2 = ease.io(seg(tc, 2.1, 3.3)); vA.lerpVectors(CON_CAM[1].pos, CON_CAM[2].pos, k2); vB.lerpVectors(CON_CAM[1].target, CON_CAM[2].target, k2); }
  else { const k2 = Math.pow(seg(tc, 3.3, 4.3), 2.4); vA.lerpVectors(CON_CAM[2].pos, new THREE.Vector3(sc.x, sc.y, sc.z + fill), k2); vB.lerpVectors(CON_CAM[2].target, sc, k2); }
  if (n && t >= B) vA.z += 2.5 * (1 - seg(tc, 3.3, 4.3));
  camNow.pos.copy(vA); camNow.target.copy(vB);
  const f = tc < 4.1 ? 0 : Math.min(1, (tc - 4.1) / 0.2);
  ov.el.querySelector(".f32-flash").style.opacity = f;
  if (tc >= 4.3 && !boot.went){ boot.went = true; go(c); }
}
function go(c){
  const g = c.game, href = siteUrl(g.game || g.play);
  try { dispatchEvent(new CustomEvent("fossil32:play", { detail: { id: g.id, href } })); } catch (e) {}
  location.href = href;
}

function sizeOverlay(){
  const dpr = DPR(), w = innerWidth, h = innerHeight;
  renderer.setSize(Math.round(w * dpr), Math.round(h * dpr), false);
  ov.cam.aspect = w / h; ov.cam.fov = w / h < 1 ? 46 : 30; ov.cam.updateProjectionMatrix();
}
function renderOverlay(now){
  const t = (now - ov.tStart) / 1000, dpr = DPR(), W = innerWidth, H = innerHeight;
  const full = { x: 0, y: 0, w: W, h: H };
  let rect = full;
  if (ov.phase === "fly" && ov.cartFly){
    // a bare cartridge from the home page: it glides from its tile to where the unbox leaves it, then the panel comes in
    const k = ease.io(seg(t, 0, FLY)), r0 = ov.fromRect;
    rect = { x: lerp(r0.x, 0, k), y: lerp(r0.y, 0, k), w: lerp(r0.w, W, k), h: lerp(r0.h, H, k) };
    ov.cam.aspect = rect.w / rect.h; ov.cam.fov = lerp(SHELF_FOV, W / H < 1 ? 46 : 30, k); ov.cam.updateProjectionMatrix();
    poseUnbox(UNBOX_END); O.box.visible = false;
    const end = unboxCam(); new THREE.Box3().setFromObject(O.cart).getCenter(focusV);   // the tile framed the cartridge's middle
    shelfCamFor(ov.tileCam, r0.w / r0.h, ov.fromSize.w, ov.fromSize.h * 1.2);
    vA.copy(ov.tileCam.position).add(focusV); vB.copy(focusV).add(new THREE.Vector3(0, -0.02, 0));
    camNow.pos.lerpVectors(vA, end.pos, k); camNow.target.lerpVectors(vB, end.target, k);
    const r = ov.fromRot; O.cart.rotation.set(lerp(r.x, O.cart.rotation.x, k), lerp(r.y, O.cart.rotation.y, k), lerp(r.z, O.cart.rotation.z, k));
    if (t >= FLY){ ov.phase = "panel"; ov.tStart = now - UNBOX_END * 1000; sizeOverlay(); showPanel(); }
  } else if (ov.phase === "fly"){
    const k = ease.io(seg(t, 0, FLY)), r0 = ov.fromRect;
    rect = { x: lerp(r0.x, 0, k), y: lerp(r0.y, 0, k), w: lerp(r0.w, W, k), h: lerp(r0.h, H, k) };
    ov.cam.aspect = rect.w / rect.h; ov.cam.fov = lerp(SHELF_FOV, W / H < 1 ? 46 : 30, k); ov.cam.updateProjectionMatrix();
    // camera: from the tile's framing to the home shot
    shelfCamFor(ov.tileCam, r0.w / r0.h);
    camNow.pos.lerpVectors(ov.tileCam.position, CAM_HOME.pos, k);
    camNow.target.lerpVectors(new THREE.Vector3(0, -0.02, 0), CAM_HOME.target, k);
    const r = ov.fromRot; O.show.rotation.set(0, 0, 0);
    O.box.position.set(0, lerp(ov.fromY, 0.1, k), 0); O.box.rotation.set(lerp(r.x, 0, k), lerp(r.y, 0, k), lerp(r.z, 0, k));
    O.cart.visible = false;
    if (t >= FLY){ ov.phase = "unbox"; ov.tStart = now; camFrom.pos.copy(CAM_HOME.pos); camFrom.target.copy(CAM_HOME.target); sizeOverlay(); }
  } else if (ov.phase === "unbox" || ov.phase === "panel"){
    const tu = ov.launch ? t * LAUNCH_SPEED : t;
    poseUnbox(ov.phase === "panel" ? Math.max(tu, UNBOX_END) : tu);
    if (ov.launch){ if (tu >= LAUNCH_AT) startBoot(); }
    else if (ov.phase === "unbox" && t >= PANEL_AT){ ov.phase = "panel"; ov.tStart = now - PANEL_AT * 1000; showPanel(); }
  } else if (ov.phase === "boot"){
    poseBoot(t);
  }
  ov.cam.position.copy(camNow.pos); ov.cam.lookAt(camNow.target);
  O.rig.rim.color.set(ov.c.accent);
  // the pool of light that follows the cartridge (the box, before it's out), so the eye goes with it
  (O.cart.visible ? O.cart : O.box).getWorldPosition(focusV);
  ov.cam.updateMatrixWorld(); focusV.project(ov.cam);
  const fx = rect.x + (focusV.x + 1) / 2 * rect.w, fy = rect.y + (1 - focusV.y) / 2 * rect.h;
  ov.fx = ov.fx == null ? fx : lerp(ov.fx, fx, 0.25); ov.fy = ov.fy == null ? fy : lerp(ov.fy, fy, 0.25);
  ov.el.style.setProperty("--f32-fx", ov.fx.toFixed(1) + "px"); ov.el.style.setProperty("--f32-fy", ov.fy.toFixed(1) + "px");
  renderer.shadowMap.enabled = true;
  const bh = Math.round(H * dpr);
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, Math.round(W * dpr), bh); renderer.setScissor(0, 0, Math.round(W * dpr), bh);
  renderer.setClearColor(0x000000, 0); renderer.clear();
  const vx = Math.round(rect.x * dpr), vy = bh - Math.round((rect.y + rect.h) * dpr), vw = Math.round(rect.w * dpr), vh = Math.round(rect.h * dpr);
  renderer.setViewport(vx, vy, vw, vh); renderer.setScissor(vx, vy, vw, vh);
  renderer.render(O.scene, ov.cam);
  renderer.setScissorTest(false);
}
function showPanel(){
  const p = ov.el.querySelector(".f32-panel");
  ov.el.classList.add("f32-panel-on");
  ov.el.querySelector(".f32-skip").hidden = true;
}
function skip(){
  if (ov.launch){ go(ov.c); return; }     // launching: skip straight to the game
  if (ov.phase === "fly"){ ov.phase = "unbox"; camFrom.pos.copy(CAM_HOME.pos); camFrom.target.copy(CAM_HOME.target); sizeOverlay(); }
  if (ov.phase === "unbox"){ ov.tStart = performance.now() - UNBOX_END * 1000; }
}

let opening = false;
async function prepare(c){
  await common; await buildOverlay3D();
  const im = await gameImages(c);
  drawFaces(O.set, c, im); Object.values(O.T).forEach(t => t.needsUpdate = true);
  shellUniform.value.set(c.shell);
  await Promise.all([buildCartridge(), buildConsole()]);
  paintConsole(c);
  O.con.group.visible = false; O.con.mat.led.color.set("#1a2014"); drawScreen(c, "off", 0);
}
async function open(id, it, opts){
  const g = gameById(id); if (!g) return;
  if (!renderer){ location.href = siteUrl(opts && opts.play ? (g.game || g.play) : "games/" + g.id + "/"); return; }
  if (opening || ov.active) return; opening = true;
  if (!ov.el) buildOverlayDom();
  const c = cfgOf(g); ov.c = c;
  // get everything ready first, so the box never disappears behind the white while models load
  if (it && it.el) it.el.classList.add("f32-wait");
  try { await prepare(c); } catch (e) { console.warn("FOSSIL32:", e); opening = false; it && it.el && it.el.classList.remove("f32-wait"); location.href = siteUrl("games/" + g.id + "/"); return; }
  if (it && it.el) it.el.classList.remove("f32-wait");
  ov.el.style.setProperty("--f32-accent", c.accent); ov.el.style.setProperty("--f32-shell", c.shell);
  ov.el.querySelector(".f32-panel").innerHTML = panelHtml(c);
  ov.el.querySelector(".f32-panel .f32-play").onclick = () => startBoot();
  ov.el.classList.remove("f32-panel-on", "f32-on", "f32-booting"); ov.el.querySelector(".f32-flash").style.opacity = 0;
  ov.el.querySelector(".f32-skip").hidden = false;
  ov.launch = !!(opts && opts.launch); ov.onBack = opts && opts.onBack; ov.fx = ov.fy = null;
  ov.el.classList.toggle("f32-launch", ov.launch);
  ov.el.querySelector(".f32-skip").textContent = ov.launch ? "Skip to game ▸▸" : "Skip ▸▸";
  ov.el.hidden = false; document.documentElement.classList.add("f32-lock");
  void ov.el.offsetWidth; ov.el.classList.add("f32-on");           // white fades in while the box flies
  ov.cam = O.cam; ov.tileCam = ov.tileCam || new THREE.PerspectiveCamera();
  ov.el.querySelector(".f32-gl").appendChild(renderer.domElement); renderer.domElement.className = "f32-glcv";
  sizeOverlay();
  O.hinge.rotation.y = 0; O.box.visible = true; setBoxOpacity(1); O.cart.visible = false; O.show.rotation.set(0, 0, 0);
  ov.it = it || null;
  const from = opts && opts.from;
  const rect = from ? { left: from.rect.x, top: from.rect.y, width: from.rect.w, height: from.rect.h, bottom: from.rect.y + from.rect.h } : it && it.stage ? it.stage.getBoundingClientRect() : null;
  if (rect && rect.width > 10 && rect.bottom > 0 && rect.top < innerHeight && !reduceMotion()){
    ov.fromRect = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    ov.fromRot = from ? from.rot : it.group ? it.group.rotation.clone() : new THREE.Euler(0, -0.3, 0);
    ov.fromY = from ? from.y : it.group ? it.group.position.y : 0;
    ov.phase = "fly"; ov.cartFly = !!(it && it.kind === "cart");
    if (ov.cartFly){ ov.fromSize = { w: it.fw, h: it.fh }; poseUnbox(UNBOX_END); O.cart.updateMatrixWorld(true); }
    if (it){ it.hidden = true; it.el.classList.add("f32-away"); }
    if (opts && opts.onAway) opts.onAway();
  } else { ov.phase = "unbox"; ov.cartFly = false; camFrom.pos.copy(CAM_HOME.pos); camFrom.target.copy(CAM_HOME.target);
    if (it && it.kind === "cart"){ ov.phase = "panel"; ov.tStart = performance.now() - UNBOX_END * 1000; showPanel(); } }
  if (ov.phase !== "panel") ov.tStart = performance.now();
  if (reduceMotion()) ov.tStart -= UNBOX_END * 1000;
  ov.active = true; opening = false;
  if (!(opts && (opts.noHistory || opts.launch))) try { history.pushState({ f32: id }, "", "#box/" + id); ov.pushed = true; } catch (e) {}
  if (opts && opts.play){ ov.phase = "panel"; ov.tStart = performance.now() - UNBOX_END * 1000; poseUnbox(UNBOX_END); startBoot(true); }
  kick();
  setTimeout(() => { try { ov.el.focus({ preventScroll: true }); } catch (e) {} }, 50);
}
function startBoot(direct){
  if (ov.phase === "boot") return;
  { const G = window.Grug, g = ov.c && ov.c.game;
    if (G && G.onboard && g && G.onboard.needed()){ G.onboard.start(siteUrl(g.game || g.play)); return; } }
  if (reduceMotion()){ go(ov.c); return; }
  O.cart.updateMatrixWorld(true);
  boot = { cp: O.cart.position.clone(), cr: O.cart.rotation.clone(), camPos: camNow.pos.clone(), camTarget: camNow.target.clone(), went: false };
  if (direct){ const e = unboxCam(); boot.camPos.copy(e.pos); boot.camTarget.copy(e.target); }
  ov.el.classList.remove("f32-panel-on"); ov.el.classList.add("f32-booting");
  ov.phase = "boot"; ov.tStart = performance.now();
}
function close(fromUser){
  if (!ov.active) return;
  ov.active = false; ov.phase = "";
  ov.el.classList.remove("f32-on", "f32-panel-on", "f32-booting");
  document.documentElement.classList.remove("f32-lock");
  if (ov.it){ ov.it.hidden = false; ov.it.el.classList.remove("f32-away"); try { ov.it.el.focus({ preventScroll: true }); } catch (e) {} }
  if (ov.onBack){ try { ov.onBack(); } catch (e) {} ov.onBack = null; }
  setTimeout(() => { if (!ov.active){ ov.el.hidden = true; renderer.domElement.remove(); } }, 320);
  if (fromUser && ov.pushed && history.state && history.state.f32){ ov.pushed = false; history.back(); }
  ov.pushed = false;
  shelf.bufW = shelf.bufH = 0;   // the overlay resized the shared canvas
  kick();
}
addEventListener("popstate", () => { if (ov.active && !(history.state && history.state.f32)){ ov.pushed = false; close(false); } });
addEventListener("pageshow", e => { if (e.persisted && ov.active){ ov.pushed = false; close(false); } });
addEventListener("resize", () => { if (ov.active && ov.phase !== "fly") sizeOverlay(); });
addEventListener("keydown", e => { if (ov.active && e.key === "Escape") close(true); });

/* ═════════════════ LOOP ═════════════════ */
let last = performance.now(), running = false, idleFrames = 0;
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  let busy = false;
  if (ov.active && O) { renderOverlay(now); busy = true; }
  else if (!document.hidden){ const a = renderShelf(now / 1000, dt), b = renderRack(now / 1000, dt); busy = a || b; }
  idleFrames = busy ? 0 : idleFrames + 1;
  if (idleFrames > 30){ running = false; return; }
  requestAnimationFrame(loop);
}
function kick(){ if (!running && renderer){ running = true; last = performance.now(); requestAnimationFrame(loop); } }
document.addEventListener("visibilitychange", kick);
document.addEventListener("scroll", kick, { passive: true });

/* ═════════════════ BOOT ═════════════════ */
function scan(root){ (root.querySelectorAll ? root.querySelectorAll("[data-f32]") : []).forEach(el => mount(el)); if (root.dataset && root.dataset.f32) mount(root); }
function start(){
  if (!renderer){ document.documentElement.classList.add("f32-nogl"); window.Fossil32 = { ok: false, open: (id, el, o) => open(id, null, o), boot: id => open(id, null, { play: true }), close() {}, rack: () => null, launch: id => launch(id), pick: () => -1 }; return; }
  window.Fossil32 = { ok: true, open: (id, el) => open(id, el && el.__f32 ? el.__f32 : (el && el.closest && el.closest("[data-f32]") ? el.closest("[data-f32]").__f32 : null)), boot: id => open(id, null, { play: true }), close: () => close(true),
    rack: (el, state) => mountRack(el, state), pick: (x, y) => rackPick(x, y), launch: id => launch(id), kick };
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && scan(n)))).observe(document.body, { childList: true, subtree: true });
  // deep link: …#box/<id>
  const m = /^#box\/([\w-]+)/.exec(location.hash);
  if (m && gameById(m[1])){ try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} open(m[1], null); }
  // warm the cartridge + console in the background so the first tap is quick
  const warm = () => { common.then(buildOverlay3D).then(() => Promise.all([buildCartridge(), buildConsole()])).catch(() => {}); };
  ("requestIdleCallback" in window) ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
  document.dispatchEvent(new CustomEvent("fossil32:ready"));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

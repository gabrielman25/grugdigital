#!/usr/bin/env node
/* Grug · link previews (Discord, iMessage, Slack, X…)
   Writes the Open Graph / Twitter / oEmbed tags into every Grug original's store page (games/<id>/index.html) and
   play page (play/<dir>/index.html), between the <!-- grug:og --> markers, plus assets/oembed/<id>.json.
   Reads assets/games.js, so run it again after adding a game or changing a title, blurb, tags or box art:

       node tools/og/build.js

   Only Grug originals (original: true) get a rich preview: a business's game is a demonstration and must not be
   advertised outside the site (CLAUDE.md, "Frozen").

   What Discord shows, top to bottom: the provider (oEmbed provider_name), the author (oEmbed author_name), the title
   (og:title, linked), the description (og:description, newlines kept), then the big picture (og:image with
   twitter:card summary_large_image). The coloured stripe on the left is meta theme-color (theme.js replaces it at
   runtime, so changing it here doesn't touch the browser bar). Discord caches a link's preview for a while: to see a
   change straight away, paste the link with a throwaway query on the end (…/games/runway/?v=2).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = 'https://grugdigital.com';
const START = '<!-- grug:og (written by tools/og/build.js; edit the game in assets/games.js and rerun) -->';
const END = '<!-- /grug:og -->';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/games.js'), 'utf8'), ctx);
const GAMES = ctx.window.GRUG_GAMES.filter(g => g.original && g.listed !== false);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\n/g, '&#10;');
const abs = p => SITE + '/' + String(p).replace(/^\/+/, '');
const players = p => String(p || '1P').replace(/P$/i, '');

function imageSize(file) {
  // JPEG: walk the markers to the first SOF; PNG: IHDR.
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}

function tags(g, pageUrl) {
  const name = g.appTitle || g.title;
  const art = (g.box && g.box.art) || g.thumb;
  const size = imageSize(path.join(ROOT, art));
  // The stats block under the blurb: Discord shows these lines as written (it can't draw Roblox-style columns from tags).
  const stats = [
    'Genre: ' + g.kind.replace(/^./, c => c.toUpperCase()),
    'Players: ' + players(g.box && g.box.players),
    'Free in your browser'
  ].join(' · ');
  const desc = g.blurb + '\n\n' + stats + (g.tags && g.tags.length ? '\nTags: ' + g.tags.join(', ') : '');
  const lines = [
    START,
    `<meta name="description" content="${esc(g.blurb)}">`,
    `<meta property="og:site_name" content="Grug Digital">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta property="og:title" content="${esc(name)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:image" content="${esc(abs(art))}">`,
    size ? `<meta property="og:image:width" content="${size.w}"><meta property="og:image:height" content="${size.h}">` : '',
    `<meta property="og:image:alt" content="${esc(name + ' box art')}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="${esc(g.color)}">`,
    `<link rel="alternate" type="application/json+oembed" href="${esc(abs('assets/oembed/' + g.id + '.json'))}" title="${esc(name)}">`,
    END
  ].filter(Boolean);
  return lines.join('\n');
}

function oembed(g) {
  return JSON.stringify({
    version: '1.0',
    type: 'link',
    title: g.appTitle || g.title,
    provider_name: 'Grug Digital',
    provider_url: SITE + '/',
    author_name: 'A Grug Original',
    author_url: abs('games/')
  }, null, 2) + '\n';
}

function inject(file, block) {
  let html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf(START.slice(0, 14)), b = html.indexOf(END);
  if (a >= 0 && b > a) {
    html = html.slice(0, a) + block + html.slice(b + END.length);
  } else {
    // First run: the block replaces the page's own description and theme-color, and goes after <title>.
    html = html.replace(/\n<meta name="description"[^>]*>/, '').replace(/\n<meta name="theme-color"[^>]*>/, '');
    html = html.replace(/(<title>[^<]*<\/title>)/, '$1\n' + block);
  }
  fs.writeFileSync(file, html);
}

fs.mkdirSync(path.join(ROOT, 'assets/oembed'), { recursive: true });
for (const g of GAMES) {
  const pages = [
    ['games/' + g.id + '/index.html', abs('games/' + g.id + '/')],
    [g.play.replace(/\/?$/, '/') + 'index.html', abs(g.play.replace(/\/?$/, '/'))]
  ];
  for (const [rel, url] of pages) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.warn('missing ' + rel); continue; }
    inject(file, tags(g, url));
    console.log('wrote ' + rel);
  }
  fs.writeFileSync(path.join(ROOT, 'assets/oembed', g.id + '.json'), oembed(g));
}

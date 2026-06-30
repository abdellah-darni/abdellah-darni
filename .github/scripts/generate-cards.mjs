// Generates "card" images for the latest blog posts and rewrites a section of
// the README to embed them. Runs in GitHub Actions; no server required.
//
// For each post it fetches the page, reads og:image + description, composites a
// card as SVG, and rasterises to PNG (PNG renders reliably on GitHub, whereas
// repo-committed SVGs with embedded images are handled inconsistently).
//
// Env:
//   FEED_URL    RSS feed URL (required)
//   SITE_LABEL  text shown bottom-right of each card (default: feed hostname)
//   OUT_DIR     where PNGs are written (default: assets/blog)
//   POST_COUNT  number of cards (default: 3)
//   README      README path to rewrite (default: README.md)

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------- layout ----------
const W = 260, H = 340, PAD = 18, HERO_H = 180, RADIUS = 14;
const BG = '#0d1117';
const FONT = 'DejaVu Sans, sans-serif';

// ---------- text helpers ----------
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (s) => String(s).replace(/[&<>"']/g, (c) => ENT[c]);

function wrap(text, maxChars, maxLines) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    // mark truncation if more text remained
    const used = lines.join(' ').length;
    if (used < String(text).replace(/\s+/g, ' ').trim().length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && last.length > maxChars - 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s.,;:]+$/, '') + '\u2026';
    }
  }
  return lines;
}

function tspans(lines, x, dy) {
  return lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : dy}">${escapeXml(l)}</tspan>`)
    .join('');
}

// ---------- card svg ----------
function buildCardSVG({ title, description, date, site, heroDataUri }) {
  const titleLines = wrap(title || '', 22, 2);
  const descLines = wrap(description || '', 38, 3);
  const titleY = HERO_H + 30;
  const descY = titleY + titleLines.length * 21 + 16;
  const hero = heroDataUri
    ? `<image href="${heroDataUri}" x="0" y="0" width="${W}" height="${HERO_H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#noimg)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<clipPath id="card"><rect width="${W}" height="${H}" rx="${RADIUS}"/></clipPath>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.4" stop-color="${BG}" stop-opacity="0"/>
<stop offset="1" stop-color="${BG}" stop-opacity="1"/>
</linearGradient>
<linearGradient id="noimg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#161b22"/><stop offset="1" stop-color="#0d1117"/>
</linearGradient>
</defs>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="${BG}"/>
${hero}
<rect x="0" y="0" width="${W}" height="${HERO_H}" fill="url(#fade)"/>
<text x="${PAD}" y="${titleY}" font-family="${FONT}" font-size="17" font-weight="700" fill="#f2f2f2">${tspans(titleLines, PAD, 21)}</text>
<text x="${PAD}" y="${descY}" font-family="${FONT}" font-size="11.5" fill="#9aa0a6">${tspans(descLines, PAD, 16)}</text>
<text x="${PAD}" y="${H - 18}" font-family="${FONT}" font-size="10" fill="#6b7280">${escapeXml(date || '')}</text>
<text x="${W - PAD}" y="${H - 18}" text-anchor="end" font-family="${FONT}" font-size="10" fill="#6b7280">${escapeXml(site || '')}</text>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${RADIUS}" fill="none" stroke="#30363d"/>
</svg>`;
}

// ---------- feed + page parsing ----------
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    };
    items.push({
      title: decode(stripTags(pick('title'))),
      link: pick('link'),
      description: decode(stripTags(pick('description'))),
      pubDate: pick('pubDate'),
    });
  }
  return items;
}

const stripTags = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#8217;|&rsquo;/g, '\u2019');
}

function metaContent(html, attr, val) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${val}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? decode(m[1]) : '';
}

function fmtDate(s) {
  const d = new Date(s);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'blog-cards-bot' } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

async function fetchImageDataUri(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'blog-cards-bot' } });
    if (!r.ok) return null;
    const type = r.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3_000_000) return null; // skip absurdly large images
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// ---------- readme ----------
function rewriteReadme(readme, links, outDir) {
  const cards = links
    .map((href, i) => `<a href="${escapeXml(href)}"><img src="${outDir}/card-${i + 1}.png" width="250" alt="${escapeXml(href)}" /></a>`)
    .join('\n&nbsp;\n');
  const block = `<!-- BLOG-CARDS:START -->\n<p>\n${cards}\n</p>\n<!-- BLOG-CARDS:END -->`;
  const re = /<!-- BLOG-CARDS:START -->[\s\S]*?<!-- BLOG-CARDS:END -->/;
  if (!re.test(readme)) throw new Error('BLOG-CARDS markers not found in README');
  return readme.replace(re, block);
}

// ---------- main ----------
async function main() {
  const FEED = process.env.FEED_URL;
  if (!FEED) throw new Error('FEED_URL is required');
  const SITE = process.env.SITE_LABEL || new URL(FEED).hostname;
  const OUT = process.env.OUT_DIR || 'assets/blog';
  const COUNT = Number(process.env.POST_COUNT || 3);
  const READMEPATH = process.env.README || 'README.md';

  const { Resvg } = await import('@resvg/resvg-js');
  mkdirSync(OUT, { recursive: true });

  const items = parseFeed(await fetchText(FEED)).slice(0, COUNT);
  if (!items.length) throw new Error('no items parsed from feed');

  const links = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let ogImage = '', desc = it.description;
    try {
      const html = await fetchText(it.link);
      ogImage = metaContent(html, 'property', 'og:image') || metaContent(html, 'name', 'twitter:image');
      desc = metaContent(html, 'property', 'og:description') || metaContent(html, 'name', 'description') || it.description;
      if (ogImage) ogImage = new URL(ogImage, it.link).href;
    } catch (e) { console.warn(`page fetch failed for ${it.link}: ${e.message}`); }

    const heroDataUri = ogImage ? await fetchImageDataUri(ogImage) : null;
    const svg = buildCardSVG({
      title: it.title, description: desc, date: fmtDate(it.pubDate), site: SITE, heroDataUri,
    });
    const png = new Resvg(svg, {
      fitTo: { mode: 'zoom', value: 2 },
      font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
    }).render().asPng();
    writeFileSync(`${OUT}/card-${i + 1}.png`, png);
    links.push(it.link);
    console.log(`card-${i + 1}: ${it.title}${heroDataUri ? '' : ' (no hero image)'}`);
  }

  const updated = rewriteReadme(readFileSync(READMEPATH, 'utf8'), links, OUT);
  writeFileSync(READMEPATH, updated);
  console.log(`updated ${READMEPATH} with ${links.length} cards`);
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) main().catch((e) => { console.error(e); process.exit(1); });

export { buildCardSVG, wrap, parseFeed, rewriteReadme, metaContent };

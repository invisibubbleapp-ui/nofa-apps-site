'use strict';
/*
 * Post-build checks. Zero dependencies.
 * Reads every generated file in dist/ and reports errors and warnings:
 * HTML structure, head tags, headings, links, JSON-LD, FAQ match,
 * facts consistency, writing rules, sitemap and llms.txt.
 */
const fs = require('fs');
const path = require('path');
const { textOf, decodeEntities } = require('./markdown');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const BLOCK_IN_P = new Set(['address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function urlPathOf(outDir, file) {
  let rel = '/' + path.relative(outDir, file).split(path.sep).join('/');
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  return rel;
}

/** Map a site path ("/apps/x/", "/404.html") to a file in dist, or null. */
function fileFor(outDir, p) {
  const clean = decodeURIComponent(p.split('#')[0].split('?')[0]);
  const rel = clean.endsWith('/') ? clean + 'index.html' : clean;
  const f = path.join(outDir, ...rel.split('/').filter(Boolean));
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

function attrs(s) {
  const out = {};
  const dupes = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const k = m[1].toLowerCase();
    if (k in out) dupes.push(k);
    out[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return { map: out, dupes };
}

function validateSite({ outDir, site, apps, pages }) {
  const errors = [];
  const warnings = [];
  const err = (f, msg) => errors.push(f + ': ' + msg);
  const warn = (f, msg) => warnings.push(f + ': ' + msg);

  const pageInfo = new Map(pages.map((p) => [p.path, p]));
  const files = walk(outDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const docs = new Map(); // site path -> { ids, file }
  const titles = new Map();
  const descs = new Map();
  const links = [];
  let orgJson = null;
  let orgFile = null;

  const knownPackages = new Set(apps.map((a) => a.packageName));
  const knownEmails = new Set([site.email, ...apps.map((a) => a.contactEmail)]);
  const knownPrices = new Set(apps.flatMap((a) => a.offers.map((o) => o.display)));
  const freeDayLive = apps.some((a) => a.freeFirstDay === true);

  for (const file of htmlFiles) {
    const sitePath = urlPathOf(outDir, file);
    const short = sitePath;
    const info = pageInfo.get(sitePath) || {};
    const isArticle = info.kind === 'article';
    const html = fs.readFileSync(file, 'utf8');
    const ids = new Set();

    // --- Structure.
    if (!/^<!doctype html>/i.test(html)) err(short, 'missing <!doctype html>');
    if (!/<html lang="[a-z-]+"/i.test(html)) err(short, 'missing <html lang>');
    if (!/<meta charset="utf-8">/i.test(html)) err(short, 'missing <meta charset>');
    if (!/<meta name="viewport"/i.test(html)) err(short, 'missing viewport meta');

    const stack = [];
    const tagRe = /<!--[\s\S]*?-->|<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>|<(\/?)([a-zA-Z][\w-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
    let m;
    const counts = { h1: 0, title: 0 };
    let lastHeading = 1;
    const jsonld = [];
    while ((m = tagRe.exec(html))) {
      if (m[0].startsWith('<!--')) continue;
      if (m[1]) {
        const a = attrs(m[2]).map;
        if (m[1] === 'script' && a.type === 'application/ld+json') jsonld.push(m[3]);
        else if (m[1] === 'script') warn(short, 'contains a <script> that is not JSON-LD');
        continue;
      }
      const closing = m[4] === '/';
      const tag = m[5].toLowerCase();
      if (closing) {
        if (VOID.has(tag)) { err(short, 'closing tag for void element </' + tag + '>'); continue; }
        const top = stack.pop();
        if (top !== tag) { err(short, 'mismatched </' + tag + '>, expected </' + (top || 'nothing') + '>'); if (top) stack.push(top); }
        continue;
      }
      const { map: a, dupes } = attrs(m[6]);
      if (dupes.length) err(short, '<' + tag + '> has duplicate attributes: ' + dupes.join(', '));
      if (a.id !== undefined) {
        if (!a.id) err(short, 'empty id on <' + tag + '>');
        if (ids.has(a.id)) err(short, 'duplicate id "' + a.id + '"');
        ids.add(a.id);
      }
      if (stack[stack.length - 1] === 'p' && BLOCK_IN_P.has(tag)) err(short, '<' + tag + '> inside <p>');
      if (tag === 'a') {
        if (stack.includes('a')) err(short, 'nested <a>');
        if (a.href === undefined) err(short, '<a> without href');
        else links.push({ from: sitePath, href: a.href, short });
        if (a.target === '_blank' && !/noopener/.test(a.rel || '')) warn(short, 'target=_blank without rel=noopener');
      }
      if (tag === 'img') {
        if (a.alt === undefined) err(short, '<img> without alt: ' + a.src);
        if (!a.width || !a.height) warn(short, '<img> without width/height: ' + a.src);
        if (a.src) links.push({ from: sitePath, href: a.src, short, asset: true });
      }
      if (tag === 'link' && a.href && (a.rel === 'stylesheet' || /icon/.test(a.rel || '') || a.rel === 'preload')) links.push({ from: sitePath, href: a.href, short, asset: true });
      if (/^h[1-6]$/.test(tag)) {
        const lvl = Number(tag[1]);
        if (lvl === 1) counts.h1++;
        if (lvl > lastHeading + 1) warn(short, 'heading level skips from h' + lastHeading + ' to h' + lvl);
        lastHeading = lvl;
      }
      if (tag === 'title') counts.title++;
      if (!VOID.has(tag) && !m[0].endsWith('/>')) stack.push(tag);
    }
    if (stack.length) err(short, 'unclosed tags: ' + stack.join(' > '));
    if (counts.h1 !== 1) err(short, 'expected exactly one <h1>, found ' + counts.h1);
    if (counts.title !== 1) err(short, 'expected exactly one <title>, found ' + counts.title);

    // --- Head tags.
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1];
    const canonical = (html.match(/<link rel="canonical" href="([^"]*)">/) || [])[1];
    const ogUrl = (html.match(/<meta property="og:url" content="([^"]*)">/) || [])[1];
    const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
    if (!title || !title.trim()) err(short, 'missing <title>');
    else {
      const t = decodeEntities(title);
      if (t.length > 70) warn(short, 'title is ' + t.length + ' characters (aim for 70 or fewer)');
      if (titles.has(t)) err(short, 'title duplicates ' + titles.get(t));
      titles.set(t, short);
    }
    if (!desc || !desc.trim()) err(short, 'missing meta description');
    else {
      const d = decodeEntities(desc);
      if (d.length > 170) warn(short, 'meta description is ' + d.length + ' characters (aim for 170 or fewer)');
      if (d.length < 50) warn(short, 'meta description is short (' + d.length + ' characters)');
      if (descs.has(d)) err(short, 'meta description duplicates ' + descs.get(d));
      descs.set(d, short);
    }
    if (!noindex) {
      const expected = site.url + sitePath;
      if (canonical !== expected) err(short, 'canonical is "' + canonical + '", expected "' + expected + '"');
      if (ogUrl !== expected) err(short, 'og:url does not match canonical');
      for (const prop of ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:image']) {
        if (!new RegExp('<meta property="' + prop + '" content="[^"]+">').test(html)) err(short, 'missing ' + prop);
      }
      if (!/class="updated"[^>]*>[\s\S]*?<time datetime="\d{4}-\d{2}-\d{2}">/.test(html)) err(short, 'missing visible "Last updated" date');
    }

    // --- JSON-LD.
    if (!jsonld.length) err(short, 'no JSON-LD');
    const nodes = [];
    for (const block of jsonld) {
      let data;
      try { data = JSON.parse(block); } catch (e) { err(short, 'invalid JSON-LD: ' + e.message); continue; }
      if (data['@context'] !== 'https://schema.org') err(short, 'JSON-LD @context must be https://schema.org');
      nodes.push(...(data['@graph'] || [data]));
    }
    const ofType = (t) => nodes.filter((n) => n['@type'] === t);
    const ids2 = new Set(nodes.map((n) => n['@id']).filter(Boolean));
    const org = ofType('Organization');
    if (org.length !== 1) err(short, 'expected one Organization node, found ' + org.length);
    else {
      const j = JSON.stringify(org[0]);
      if (orgJson === null) { orgJson = j; orgFile = short; } else if (j !== orgJson) err(short, 'Organization JSON-LD differs from ' + orgFile);
    }
    const checkRef = (ref, where) => { if (ref && ref['@id'] && !ids2.has(ref['@id'])) err(short, where + ' points to missing @id ' + ref['@id']); };
    for (const n of nodes) {
      if (!n['@type']) err(short, 'JSON-LD node without @type');
      if (n.publisher) checkRef(n.publisher, n['@type'] + '.publisher');
      if (n.aggregateRating || n.review) err(short, n['@type'] + ' must not include ratings or reviews');
    }
    for (const app of ofType('SoftwareApplication')) {
      for (const k of ['name', 'operatingSystem', 'applicationCategory', 'offers', 'publisher', 'url', 'downloadUrl']) if (!app[k]) err(short, 'SoftwareApplication missing ' + k);
      for (const o of [].concat(app.offers || [])) if (!o.price || !o.priceCurrency) err(short, 'Offer missing price or priceCurrency');
    }
    for (const a of ofType('Article')) {
      for (const k of ['headline', 'description', 'datePublished', 'dateModified', 'author', 'publisher', 'mainEntityOfPage']) if (!a[k]) err(short, 'Article missing ' + k);
      if (a.headline && a.headline.length > 110) warn(short, 'Article headline over 110 characters');
    }
    for (const b of ofType('BreadcrumbList')) {
      (b.itemListElement || []).forEach((it, k) => { if (it.position !== k + 1 || !it.name || !it.item) err(short, 'BreadcrumbList item ' + (k + 1) + ' is incomplete'); });
    }
    if (sitePath !== '/' && !noindex && !ofType('BreadcrumbList').length) err(short, 'inner page without BreadcrumbList');

    // --- FAQ: JSON-LD must match the visible text exactly.
    const visible = textOf(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, ''));
    const hasFaqHeading = /<h2 id="(faq|frequently-asked-questions)[\w-]*">/.test(html);
    const faq = ofType('FAQPage');
    if (hasFaqHeading && !faq.length) err(short, 'visible FAQ but no FAQPage JSON-LD');
    if (faq.length && !hasFaqHeading) err(short, 'FAQPage JSON-LD but no visible FAQ');
    const h3s = new Set([...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((x) => textOf(x[1])));
    for (const f of faq) {
      for (const q of f.mainEntity || []) {
        if (!h3s.has(q.name)) err(short, 'FAQ question not visible as written: "' + q.name + '"');
        const ans = q.acceptedAnswer && q.acceptedAnswer.text;
        if (!ans || !visible.includes(ans)) err(short, 'FAQ answer not visible as written for "' + q.name + '"');
      }
    }

    // --- Facts and writing rules (checked on visible text).
    const isLegal = info.kind === 'legal'; // pages with exactText: true, such as the privacy policy
    const strictText = !isArticle && !isLegal; // text kept exactly as written: only warn there
    const flag = (msg) => (strictText ? err : warn)(short, msg);
    if (visible.includes('—')) flag('contains an em dash');
    for (const re of [/guarantee/i, /#1\b/, /number one/i, /\bcures?\b/i, /\bcured\b/i]) {
      const hit = visible.match(re);
      if (hit) flag('contains banned claim word "' + hit[0] + '"');
    }
    const textAndHtml = visible + ' ' + html;
    for (const p of textAndHtml.match(/com\.nofaapplications(?:\.[a-z][a-z0-9_]*)+/g) || []) if (!knownPackages.has(p)) err(short, 'unknown package name ' + p);
    for (const e of textAndHtml.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) if (!knownEmails.has(e.replace(/\.$/, '')) && !e.includes('example')) err(short, 'unknown email ' + e);
    for (const r of visible.match(/Rs\.? ?\d+(?:,\d{3})*/g) || []) if (!knownPrices.has(r)) flag('price "' + r + '" does not match app data');
    for (const id of html.match(/play\.google\.com\/store\/apps\/details\?id=\w+(?:\.\w+)+/g) || []) {
      const pkg = id.split('id=')[1];
      if (!knownPackages.has(pkg)) err(short, 'Play link for unknown package ' + pkg);
    }
    const nameHit = visible.match(/Invisibubble:(?! Scroll Timer)\s*\S*/);
    if (nameHit) err(short, 'app name written differently: "' + nameHit[0] + '"');
    if (!freeDayLive && !isLegal && /(first|free) 24 hours? (are |is )?free|24 hours free|free first day|first day (is )?free|free trial/i.test(visible)) err(short, 'mentions a free first day, but freeFirstDay is false');
    if (!isArticle && /free trial/i.test(visible)) err(short, 'uses the words "free trial" (say "first 24 hours free" instead)');
    if (/\bTODO\b/.test(visible) && !noindex) warn(short, 'page shows a visible TODO marker');
    if (/\{\{|\}\}/.test(visible)) err(short, 'unresolved {{placeholder}}');

    docs.set(sitePath, { ids, file: short });
  }

  // --- Links.
  for (const l of links) {
    let href = l.href;
    if (href.startsWith(site.url + '/')) href = href.slice(site.url.length);
    if (/^(mailto:|tel:)/.test(href)) continue;
    if (/^https?:\/\//.test(href)) {
      if (/^http:\/\//.test(href)) warn(l.short, 'insecure http link ' + href);
      continue;
    }
    if (href.startsWith('#')) {
      if (!docs.get(l.from).ids.has(decodeURIComponent(href.slice(1)))) err(l.short, 'broken anchor ' + href);
      continue;
    }
    if (!href.startsWith('/')) { err(l.short, 'relative link "' + href + '" (use root-relative paths)'); continue; }
    const target = href.split('#')[0].split('?')[0];
    if (!l.asset && !target.endsWith('/') && !/\.[a-z0-9]+$/i.test(target)) { err(l.short, 'link without trailing slash ' + href); continue; }
    const f = fileFor(outDir, target);
    if (!f) { err(l.short, 'broken link ' + href); continue; }
    const hash = href.split('#')[1];
    if (hash) {
      const d = docs.get(target);
      if (d && !d.ids.has(decodeURIComponent(hash))) err(l.short, 'broken anchor ' + href);
    }
  }

  // --- Sitemap, robots, llms.txt.
  const sitemapFile = path.join(outDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapFile)) err('sitemap.xml', 'missing');
  else {
    const xml = fs.readFileSync(sitemapFile, 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
    if ((xml.match(/<url>/g) || []).length !== (xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length) err('sitemap.xml', 'every <url> needs a <lastmod>');
    for (const loc of locs) if (!loc.startsWith(site.url + '/') || !fileFor(outDir, loc.slice(site.url.length))) err('sitemap.xml', 'bad <loc> ' + loc);
    for (const p of pages) if (p.indexable && !locs.includes(site.url + p.path)) err('sitemap.xml', 'missing page ' + p.path);
  }
  const robots = path.join(outDir, 'robots.txt');
  if (!fs.existsSync(robots) || !fs.readFileSync(robots, 'utf8').includes('Sitemap: ' + site.url + '/sitemap.xml')) err('robots.txt', 'missing or has no Sitemap line');
  const llms = path.join(outDir, 'llms.txt');
  if (!fs.existsSync(llms)) err('llms.txt', 'missing');
  else {
    for (const x of fs.readFileSync(llms, 'utf8').matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
      if (x[1].startsWith(site.url) && !fileFor(outDir, x[1].slice(site.url.length))) err('llms.txt', 'broken link ' + x[1]);
    }
  }
  for (const f of ['404.html', 'CNAME']) if (!fs.existsSync(path.join(outDir, f))) err(f, 'missing');

  return { errors, warnings, htmlCount: htmlFiles.length, linkCount: links.length };
}

module.exports = { validateSite };

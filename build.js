#!/usr/bin/env node
'use strict';
/*
 * Nofa Applications site builder.
 * Plain Node (18 or newer), zero dependencies.
 *
 *   node build.js            build into dist/ and run all checks
 *   node build.js --strict   same, but remaining TODO markers count as errors
 *
 * Inputs:
 *   site.json                       developer facts, navigation
 *   templates/*.html                shared layout, header, footer
 *   assets/                         shared CSS, fonts, icons
 *   pages/*.md                      developer-level pages
 *   apps/<slug>/app.json            one data file per app (all app facts)
 *   apps/<slug>/pages/*.md          the app's pages (index.md is the app home)
 *   articles/content/*.md           articles with front matter
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { renderMarkdown, escapeHtml, textOf, slugify } = require('./lib/markdown');
const { parseFrontMatter } = require('./lib/frontmatter');
const { validateSite } = require('./lib/validate');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const STRICT = process.argv.includes('--strict');

const errors = [];
const todos = [];
const fail = (msg) => errors.push(msg);

/* ------------------------------------------------------------ helpers */

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => {
  try { return JSON.parse(read(p)); } catch (e) { throw new Error(p + ': ' + e.message); }
};
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const attr = (s) => escapeHtml(s);

function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

function copyDir(src, dest, skip = () => false) {
  if (!fs.existsSync(src)) return;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (skip(e.name, s)) continue;
    if (e.isDirectory()) copyDir(s, d, skip);
    else { fs.mkdirSync(dest, { recursive: true }); fs.copyFileSync(s, d); }
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }
function showDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
}
const timeTag = (iso) => '<time datetime="' + iso + '">' + showDate(iso) + '</time>';
const maxDate = (...ds) => ds.filter(Boolean).sort().pop();

function get(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** A tiny template filler used by Markdown pages and HTML templates. */
function fill(str, ctx, where) {
  // {{#if key}} ... {{else}} ... {{/if}}
  str = str.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, k, yes, no) => (get(ctx, k) ? yes : no || ''));
  // {{url:page}} or {{url:app/page}}: link to an app page, checked at build time.
  str = str.replace(/\{\{url:([\w-]+)(?:\/([\w-]+))?\}\}/g, (m, a, b) => {
    const appSlug = b ? a : ctx.app && ctx.app.slug;
    const pageSlug = b || a;
    const app = ctx.apps.find((x) => x.slug === appSlug);
    const page = app && app.pages.find((p) => p.slug === pageSlug);
    if (!page) { fail(where + ': ' + m + ' does not match any app page'); return '#'; }
    return page.path;
  });
  // {{article:slug}}: link to an article, checked at build time.
  str = str.replace(/\{\{article:([\w-]+)\}\}/g, (m, slug) => {
    const a = ctx.articles.find((x) => x.slug === slug);
    if (!a) { fail(where + ': ' + m + ' does not match any article'); return '#'; }
    return a.path;
  });
  // {{key.path}} values. {{> component}} is left for later.
  str = str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
    const v = get(ctx, k);
    if (v === undefined || v === null || typeof v === 'object') { fail(where + ': unknown placeholder ' + m); return m; }
    return String(v);
  });
  return str;
}

/** Collect TODO markers from HTML comments and ":::todo" boxes. */
function collectTodos(src, where) {
  for (const m of src.matchAll(/<!--\s*TODO:?\s*([\s\S]*?)-->/g)) todos.push(where + ': ' + m[1].replace(/\s+/g, ' ').trim());
}

/* -------------------------------------------------------------- load */

const site = readJson('site.json');
site.url = site.url.replace(/\/+$/, '');
const ORG_ID = site.url + '/#organization';
const WEBSITE_ID = site.url + '/#website';

function loadMd(rel) {
  const src = read(rel);
  const { data, body, hasFrontMatter } = parseFrontMatter(src);
  if (!hasFrontMatter) fail(rel + ': missing front matter');
  return { data, body, rel };
}

function requireFields(obj, fields, where) {
  for (const f of fields) if (obj[f] === undefined || obj[f] === '') fail(where + ': missing "' + f + '"');
}

// Apps: every folder in apps/ with an app.json.
const apps = [];
for (const dir of fs.existsSync(path.join(ROOT, 'apps')) ? fs.readdirSync(path.join(ROOT, 'apps')).sort() : []) {
  const rel = 'apps/' + dir + '/app.json';
  if (!exists(rel)) continue;
  const app = readJson(rel);
  requireFields(app, ['slug', 'name', 'shortName', 'developer', 'platform', 'operatingSystem', 'applicationCategory', 'packageName', 'contactEmail', 'playUrl', 'summary', 'oneLiner', 'offers', 'lastUpdated', 'facts', 'icon', 'order'], rel);
  if (app.slug !== dir) fail(rel + ': "slug" must equal the folder name "' + dir + '"');
  if (!isDate(app.lastUpdated)) fail(rel + ': lastUpdated must be YYYY-MM-DD');
  if (app.playUrl !== 'https://play.google.com/store/apps/details?id=' + app.packageName) fail(rel + ': playUrl does not match packageName');
  if (app.developer !== site.name) fail(rel + ': developer must equal site.json name "' + site.name + '"');
  app.path = '/apps/' + app.slug + '/';
  app.url = site.url + app.path;
  app.iconUrl = app.path + app.icon;
  app.iconSmallUrl = app.path + (app.iconSmall || app.icon);
  app.offerByKey = Object.fromEntries(app.offers.map((o) => [o.key, o]));
  app.freeFirstDay = app.freeFirstDay === true;
  // Values that change when the free first day is live. Ignored while the flag is off.
  if (app.freeFirstDay && app.freeFirstDayOverrides) Object.assign(app, app.freeFirstDayOverrides);
  delete app.freeFirstDayOverrides;
  app.permissions = app.permissions || [];
  app.permissionSummary = app.permissions.map((p) => p.label + ' (' + p.android.join(', ') + ')').join('; ');
  app.pages = [];
  const pagesDir = 'apps/' + dir + '/pages';
  for (const f of fs.existsSync(path.join(ROOT, pagesDir)) ? fs.readdirSync(path.join(ROOT, pagesDir)).filter((x) => x.endsWith('.md')) : []) {
    const md = loadMd(pagesDir + '/' + f);
    const slug = f.replace(/\.md$/, '');
    requireFields(md.data, ['title', 'h1', 'description', 'navLabel', 'dateModified', 'order'], md.rel);
    app.pages.push({ ...md, slug, path: slug === 'index' ? app.path : app.path + slug + '/', kind: 'app-page', app });
  }
  app.pages.sort((a, b) => a.data.order - b.data.order);
  if (!app.pages.find((p) => p.slug === 'index')) fail(pagesDir + ': missing index.md (the app home)');
  apps.push(app);
}
apps.sort((a, b) => a.order - b.order);

// Articles: articles/content/*.md, newest first.
const articles = [];
const artDir = 'articles/content';
for (const f of fs.existsSync(path.join(ROOT, artDir)) ? fs.readdirSync(path.join(ROOT, artDir)).filter((x) => x.endsWith('.md')) : []) {
  const md = loadMd(artDir + '/' + f);
  requireFields(md.data, ['title', 'slug', 'description', 'datePublished', 'dateModified', 'author'], md.rel);
  if (md.data.slug && md.data.slug !== f.replace(/\.md$/, '')) fail(md.rel + ': file name must be <slug>.md');
  if (md.data.slug && md.data.slug !== slugify(md.data.slug)) fail(md.rel + ': slug must be lowercase words joined by hyphens');
  for (const k of ['datePublished', 'dateModified']) if (!isDate(md.data[k])) fail(md.rel + ': ' + k + ' must be YYYY-MM-DD');
  if (md.data.relatedApp && !apps.find((a) => a.slug === md.data.relatedApp)) fail(md.rel + ': relatedApp "' + md.data.relatedApp + '" is not an app folder');
  articles.push({ ...md, slug: md.data.slug, path: '/articles/' + md.data.slug + '/', kind: 'article' });
}
articles.sort((a, b) => (b.data.datePublished + b.data.slug).localeCompare(a.data.datePublished + a.data.slug));

// Developer-level pages: pages/*.md.
const devPages = [];
for (const f of fs.readdirSync(path.join(ROOT, 'pages')).filter((x) => x.endsWith('.md'))) {
  const md = loadMd('pages/' + f);
  const name = f.replace(/\.md$/, '');
  requireFields(md.data, ['title', 'h1', 'description', 'dateModified'], md.rel);
  const p = name === 'home' ? '/' : name === '404' ? '/404.html' : '/' + name + '/';
  devPages.push({ ...md, slug: name, path: p, kind: 'dev-page' });
}

const ctxBase = { site, apps, articles, hasArticles: articles.length > 0, appCount: apps.length };

/* -------------------------------------------------------- components */

function playButton(app) {
  return '<p class="cta"><a class="btn" href="' + attr(app.playUrl) + '">Get ' + escapeHtml(app.shortName) + ' on Google Play</a>' +
    '<span class="cta-note">' + escapeHtml(app.platform) + '. Package: <code>' + escapeHtml(app.packageName) + '</code></span></p>';
}

function factsTable(app) {
  const rows = app.facts.filter((f) => !f.onlyIf || get({ app }, f.onlyIf)).map((f) => {
    const value = fill(f.value, { ...ctxBase, app }, 'apps/' + app.slug + '/app.json facts');
    return '<tr><th scope="row">' + escapeHtml(f.label) + '</th><td>' + linkify(escapeHtml(value)) + '</td></tr>';
  });
  return '<div class="table-wrap"><table class="facts">\n<caption>Facts about ' + escapeHtml(app.name) + ', last updated ' + showDate(app.lastUpdated) + '</caption>\n<thead><tr><th scope="col">Fact</th><th scope="col">Value</th></tr></thead>\n<tbody>\n' + rows.join('\n') + '\n</tbody>\n</table></div>';
}

function linkify(s) {
  return s.replace(/https:\/\/[^\s<]+/g, (u) => '<a href="' + u + '">' + u + '</a>')
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.]+[a-z])/g, (_, pre, e) => pre + '<a href="mailto:' + e + '">' + e + '</a>');
}

function appCards() {
  return '<ul class="cards">\n' + apps.map((a) => '<li class="card">' +
    '<img src="' + attr(a.iconSmallUrl) + '" alt="' + attr(a.shortName) + ' app icon" width="64" height="64">' +
    '<div><h3><a href="' + a.path + '">' + escapeHtml(a.name) + '</a></h3><p>' + escapeHtml(a.oneLiner) + '</p>' +
    '<p class="card-meta">' + escapeHtml(a.platform) + ' · <a href="' + a.path + 'facts/">Fact sheet</a> · <a href="' + attr(a.playUrl) + '">Google Play</a></p></div></li>').join('\n') + '\n</ul>';
}

function articleList(list, level = 3) {
  const h = 'h' + level;
  return '<ul class="article-list">\n' + list.map((a) => '<li><' + h + '><a href="' + a.path + '">' + escapeHtml(a.data.title) + '</a></' + h + '>' +
    '<p class="meta">Published ' + timeTag(a.data.datePublished) + (a.data.dateModified !== a.data.datePublished ? '. Updated ' + timeTag(a.data.dateModified) : '') + '</p>' +
    '<p>' + escapeHtml(a.data.description) + '</p></li>').join('\n') + '\n</ul>';
}

function appPageList(app, exceptPath) {
  return '<ul class="link-list">\n' + app.pages.filter((p) => p.path !== exceptPath).map((p) => '<li><a href="' + p.path + '">' + escapeHtml(p.data.h1) + '</a></li>').join('\n') + '\n</ul>';
}

const COMPONENTS = {
  playButton: (c) => playButton(c.app),
  factsTable: (c) => factsTable(c.app),
  appList: () => appCards(),
  articleList: () => articleList(articles, 2),
  latestArticles: () => articleList(articles.slice(0, 5)),
  appPages: (c) => appPageList(c.app, c.page.path),
  permissionsTable: (c) => permissionsTable(c.app),
};

/** Permission table from app.json "permissions". The same reasons must appear in the privacy policy. */
function permissionsTable(app) {
  return '<div class="table-wrap"><table>\n<thead><tr><th scope="col">Permission</th><th scope="col">Android name</th><th scope="col">Why ' + escapeHtml(app.shortName) + ' needs it</th></tr></thead>\n<tbody>\n' +
    app.permissions.map((p) => '<tr><th scope="row">' + escapeHtml(p.label) + '</th><td>' + p.android.map((n) => '<code>' + escapeHtml(n) + '</code>').join(', ') + '</td><td>' + escapeHtml(p.reason) + '</td></tr>').join('\n') +
    '\n</tbody>\n</table></div>';
}

function applyComponents(html, ctx, where) {
  // The Markdown step escapes ">" to "&gt;", so accept both.
  return html.replace(/(?:<p>)?\{\{(?:>|&gt;)\s*(\w+)\s*\}\}(?:<\/p>)?/g, (m, name) => {
    if (!COMPONENTS[name]) { fail(where + ': unknown component ' + m); return ''; }
    if (['playButton', 'factsTable', 'appPages', 'permissionsTable'].includes(name) && !ctx.app) { fail(where + ': ' + name + ' needs an app page'); return ''; }
    return COMPONENTS[name](ctx);
  });
}

/* --------------------------------------------------------- JSON-LD */

const orgNode = () => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: site.name,
  url: site.url + '/',
  email: site.email,
  ...(site.sameAs && site.sameAs.length ? { sameAs: site.sameAs } : {}),
});

function appNode(app) {
  return {
    '@type': 'SoftwareApplication',
    '@id': app.url + '#app',
    name: app.name,
    alternateName: app.shortName,
    description: app.summary,
    operatingSystem: app.operatingSystem,
    applicationCategory: app.applicationCategory,
    url: app.url,
    downloadUrl: app.playUrl,
    installUrl: app.playUrl,
    sameAs: [app.playUrl],
    identifier: app.packageName,
    image: site.url + app.iconUrl,
    publisher: { '@id': ORG_ID },
    author: { '@id': ORG_ID },
    offers: app.offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      description: o.description,
      price: o.price,
      priceCurrency: o.currency,
      url: app.playUrl,
    })),
  };
}

// A short reference to an app, for pages that do not carry the full node.
const appRef = (app) => ({ '@type': 'SoftwareApplication', '@id': app.url + '#app', name: app.name });

function breadcrumbNode(url, crumbs) {
  return {
    '@type': 'BreadcrumbList',
    '@id': url + '#breadcrumb',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: site.url + c.path })),
  };
}

/** Extract the visible FAQ (h2 "FAQ", then h3 questions) from rendered HTML. */
function extractFaq(html) {
  const start = html.search(/<h2 id="(faq|frequently-asked-questions)[\w-]*">/);
  if (start < 0) return [];
  let section = html.slice(start).replace(/^<h2[^>]*>[\s\S]*?<\/h2>/, '');
  const next = section.search(/<h2[\s>]/);
  if (next >= 0) section = section.slice(0, next);
  const parts = section.split(/(?=<h3[\s>])/).filter((p) => p.startsWith('<h3'));
  return parts.map((p) => {
    const q = p.match(/^<h3[^>]*>([\s\S]*?)<\/h3>/);
    return { q: textOf(q[1]), a: textOf(p.slice(q[0].length)) };
  }).filter((x) => x.q && x.a);
}

/**
 * Articles often write FAQ questions as a bold line with the answer on the next line:
 *   **What is X?**
 *   X is ...
 * Inside the FAQ section only, turn each of these into <h3>question</h3><p>answer</p>.
 * The words stay exactly the same; only the markup changes, so the FAQ is detected.
 */
function faqBoldToHeadings(html) {
  const start = html.search(/<h2 id="(faq|frequently-asked-questions)[\w-]*">/);
  if (start < 0) return html;
  const headEnd = html.indexOf('</h2>', start) + 5;
  let rest = html.slice(headEnd);
  const next = rest.search(/<h2[\s>]/);
  const section = next >= 0 ? rest.slice(0, next) : rest;
  const after = next >= 0 ? rest.slice(next) : '';
  const used = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  const converted = section.replace(/<p><strong>([^<]*\?)<\/strong>(?:<br>)?\n([\s\S]*?)<\/p>/g, (_, q, a) => {
    let id = slugify(q) || 'question';
    while (used.has(id)) id += '-2';
    used.add(id);
    return '<h3 id="' + id + '">' + q + '</h3>\n<p>' + a + '</p>';
  });
  return html.slice(0, headEnd) + converted + after;
}

function faqNode(url, faq) {
  return {
    '@type': 'FAQPage',
    '@id': url + '#faq',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/* ---------------------------------------------------------- layout */

const tpl = {
  layout: read('templates/layout.html'),
  header: read('templates/header.html'),
  footer: read('templates/footer.html'),
};
const cssHash = crypto.createHash('sha256').update(read('assets/styles.css')).digest('hex').slice(0, 10);

function navHtml(currentPath) {
  return site.nav.map((n) => {
    const active = n.path === '/' ? currentPath === '/' : currentPath.startsWith(n.path);
    return '<li><a href="' + n.path + '"' + (active ? ' aria-current="' + (currentPath === n.path ? 'page' : 'true') + '"' : '') + '>' + escapeHtml(n.label) + '</a></li>';
  }).join('');
}

function footerColumns() {
  const col = (title, items) => '<div class="footer-col"><h2 class="footer-title">' + escapeHtml(title) + '</h2><ul>' +
    items.map((i) => '<li><a href="' + i.path + '">' + escapeHtml(i.label) + '</a></li>').join('') + '</ul></div>';
  const cols = [col(site.name, site.footerLinks)];
  for (const a of apps) cols.push(col(a.shortName, a.pages.map((p) => ({ path: p.path, label: p.data.navLabel }))));
  if (articles.length) cols.push(col('Articles', [...articles.slice(0, 5).map((a) => ({ path: a.path, label: a.data.title })), { path: '/articles/', label: 'All articles' }]));
  return cols.join('\n');
}
const FOOTER_COLUMNS = footerColumns();

function breadcrumbHtml(crumbs) {
  return '<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>' + crumbs.map((c, i) =>
    '<li>' + (i === crumbs.length - 1 ? '<a href="' + c.path + '" aria-current="page">' + escapeHtml(c.name) + '</a>' : '<a href="' + c.path + '">' + escapeHtml(c.name) + '</a>') + '</li>').join('') + '</ol></nav>';
}

function appSubnav(app, currentPath) {
  return '<nav class="subnav" aria-label="' + attr(app.shortName) + ' pages"><ul>' + app.pages.map((p) =>
    '<li><a href="' + p.path + '"' + (p.path === currentPath ? ' aria-current="page"' : '') + '>' + escapeHtml(p.data.navLabel) + '</a></li>').join('') + '</ul></nav>';
}

/**
 * page: {
 *   path, title, description, h1Html, bodyHtml, dateModified, datePublished?, author?,
 *   crumbs?, app?, kind, noindex?, ogType?, extraNodes?, beforeBody?, afterBody?
 * }
 */
function renderPage(page) {
  const url = site.url + page.path;
  const faq = extractFaq(page.bodyHtml);
  const graph = [orgNode()];
  if (page.path === '/') graph.push({ '@type': 'WebSite', '@id': WEBSITE_ID, url: site.url + '/', name: site.name, publisher: { '@id': ORG_ID }, inLanguage: site.language });
  if (!page.noindex) {
    graph.push({
      '@type': page.webPageType || 'WebPage',
      '@id': url + '#webpage',
      url,
      name: page.title,
      description: page.description,
      inLanguage: site.language,
      dateModified: page.dateModified,
      ...(page.datePublished ? { datePublished: page.datePublished } : {}),
      isPartOf: { '@type': 'WebSite', '@id': WEBSITE_ID, url: site.url + '/', name: site.name },
      publisher: { '@id': ORG_ID },
      ...(page.about ? { about: page.about } : {}),
      ...(page.crumbs ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}),
    });
  }
  graph.push(...(page.extraNodes || []));
  if (page.crumbs) graph.push(breadcrumbNode(url, page.crumbs));
  if (faq.length) graph.push(faqNode(url, faq));
  const jsonld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');

  const ogImage = site.url + (page.app ? page.app.iconUrl : site.defaultOgImage);
  const head = [
    '<meta property="og:type" content="' + (page.ogType || 'website') + '">',
    '<meta property="og:site_name" content="' + attr(site.name) + '">',
    '<meta property="og:title" content="' + attr(page.ogTitle || page.title) + '">',
    '<meta property="og:description" content="' + attr(page.description) + '">',
    '<meta property="og:url" content="' + attr(url) + '">',
    '<meta property="og:image" content="' + attr(ogImage) + '">',
    '<meta property="og:image:alt" content="' + attr(page.app ? page.app.shortName + ' app icon' : site.defaultOgImageAlt) + '">',
    '<meta name="twitter:card" content="summary">',
  ];
  if (page.ogType === 'article') {
    head.push('<meta property="article:published_time" content="' + page.datePublished + '">');
    head.push('<meta property="article:modified_time" content="' + page.dateModified + '">');
  }

  const meta = page.metaHtml || '<p class="updated">Last updated ' + timeTag(page.dateModified) + '</p>';
  const main = [
    page.crumbs ? breadcrumbHtml(page.crumbs) : '',
    page.app ? appSubnav(page.app, page.path) : '',
    '<article class="prose">',
    '<header class="page-head">' + (page.icon ? '<img class="page-icon" src="' + attr(page.icon.src) + '" alt="' + attr(page.icon.alt) + '" width="72" height="72">' : '') + '<h1>' + page.h1Html + '</h1>' + (page.noindex ? '' : meta) + '</header>',
    page.beforeBody || '',
    page.bodyHtml,
    '</article>',
    page.afterBody || '',
  ].filter(Boolean).join('\n');

  const vars = {
    lang: site.language,
    title: escapeHtml(page.title),
    description: attr(page.description),
    canonical: page.noindex ? '' : '<link rel="canonical" href="' + attr(url) + '">',
    robots: page.noindex ? '<meta name="robots" content="noindex">' : '',
    og: page.noindex ? '' : head.join('\n'),
    favicon: page.app ? '<link rel="icon" type="image/png" href="' + attr(page.app.iconSmallUrl) + '">' : '<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">',
    themeColor: site.themeColor,
    cssHash,
    jsonld,
    bodyAttrs: page.app && page.app.accentColor ? ' class="app-' + page.app.slug + '" style="--accent: ' + attr(page.app.accentColor) + '"' : '',
    header: tpl.header.replace('{{siteName}}', escapeHtml(site.name)).replace('{{nav}}', navHtml(page.path)),
    main,
    footer: tpl.footer
      .replace('{{columns}}', FOOTER_COLUMNS)
      .replace(/\{\{siteName\}\}/g, escapeHtml(site.name))
      .replace(/\{\{email\}\}/g, escapeHtml(site.email))
      .replace('{{footerNote}}', escapeHtml(site.footerNote)),
  };
  return tpl.layout.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : (fail('templates/layout.html: unknown slot ' + m), '')));
}

/* ---------------------------------------------------------- build */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const built = []; // { path, kind, indexable, lastmod }

function emit(page) {
  const html = renderPage(page);
  write(page.path.endsWith('.html') ? page.path : page.path + 'index.html', html);
  built.push({ path: page.path, kind: page.kind, indexable: !page.noindex, lastmod: page.dateModified, title: page.title, description: page.description });
}

function mdToHtml(md, ctx, where) {
  collectTodos(md.body, where);
  const filled = fill(md.body, ctx, where);
  const html = renderMarkdown(filled, {
    rowHeaders: true,
    reservedIds: ['main'],
    onBox: (kind, title, body) => { if (kind === 'todo') todos.push(where + ': ' + (title || body.split('\n')[0]).trim()); },
  });
  if (/<h1[\s>]/.test(html)) fail(where + ': use the "h1" front-matter field instead of a "# " heading');
  return applyComponents(html, ctx, where);
}

// A privacy policy page with "policyFor: <app slug>" must list every permission in app.json
// with the same Android names and the same reason, word for word.
for (const p of devPages.filter((x) => x.data.policyFor)) {
  const app = apps.find((a) => a.slug === p.data.policyFor);
  if (!app) { fail(p.rel + ': policyFor "' + p.data.policyFor + '" is not an app'); continue; }
  const text = p.body.replace(/\s+/g, ' ');
  for (const perm of app.permissions) {
    if (!text.includes(perm.reason)) fail(p.rel + ': the reason for "' + perm.label + '" differs from app.json');
    for (const n of perm.android) if (!text.includes('`' + n + '`')) fail(p.rel + ': permission ' + n + ' from app.json is missing');
  }
  for (const n of text.match(/`([A-Z_]{4,}|com\.android\.[\w.]+)`/g) || []) {
    if (!app.permissions.some((perm) => perm.android.includes(n.slice(1, -1)))) fail(p.rel + ': permission ' + n + ' is not in app.json');
  }
}

// Developer pages.
const crumbHome = { name: 'Home', path: '/' };
for (const p of devPages) {
  let dateModified = p.data.dateModified;
  if (p.slug === 'home') dateModified = maxDate(dateModified, ...apps.map((a) => a.lastUpdated), ...articles.map((a) => a.data.dateModified));
  if (p.slug === 'apps') dateModified = maxDate(dateModified, ...apps.map((a) => a.lastUpdated));
  if (p.slug === 'articles') dateModified = maxDate(dateModified, ...articles.map((a) => a.data.dateModified));
  const ctx = { ...ctxBase, page: p };
  const isHome = p.slug === 'home';
  const is404 = p.slug === '404';
  emit({
    path: p.path,
    kind: p.data.exactText ? 'legal' : p.kind, // exactText: legal text kept word for word
    title: p.data.title,
    description: p.data.description,
    h1Html: escapeHtml(p.data.h1),
    bodyHtml: mdToHtml(p, ctx, p.rel),
    dateModified,
    noindex: is404,
    webPageType: p.data.schemaType,
    crumbs: isHome || is404 ? null : [crumbHome, { name: p.data.breadcrumb || p.data.h1, path: p.path }],
    extraNodes: isHome || p.slug === 'apps' ? [{
      '@type': 'ItemList',
      '@id': site.url + p.path + '#apps',
      name: 'Apps by ' + site.name,
      itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: a.url, name: a.name })),
    }] : p.slug === 'articles' && articles.length ? [{
      '@type': 'ItemList',
      '@id': site.url + p.path + '#articles',
      name: 'Articles by ' + site.name,
      itemListElement: articles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: site.url + a.path, name: a.data.title })),
    }] : [],
  });
}

// App pages.
for (const app of apps) {
  const appCrumbs = [crumbHome, { name: 'Apps', path: '/apps/' }, { name: app.shortName, path: app.path }];
  const related = articles.filter((a) => a.data.relatedApp === app.slug);
  for (const p of app.pages) {
    const ctx = { ...ctxBase, app, page: p };
    const isHome = p.slug === 'index';
    const withAppNode = isHome || p.slug === 'facts';
    const relatedBox = related.length
      ? '<aside class="related" aria-labelledby="related-reading"><h2 id="related-reading">Related reading</h2>' + articleList(related) + '</aside>'
      : '';
    emit({
      path: p.path,
      kind: p.kind,
      app,
      title: p.data.title,
      description: p.data.description,
      h1Html: escapeHtml(p.data.h1),
      bodyHtml: mdToHtml(p, ctx, p.rel),
      dateModified: maxDate(p.data.dateModified, isHome || p.slug === 'facts' || p.slug === 'pricing' ? app.lastUpdated : null),
      crumbs: isHome ? appCrumbs : [...appCrumbs, { name: p.data.navLabel, path: p.path }],
      about: appRef(app),
      icon: isHome ? { src: app.iconSmallUrl, alt: app.shortName + ' app icon' } : null,
      extraNodes: withAppNode ? [appNode(app)] : [],
      afterBody: relatedBox,
    });
  }
}

// Articles.
for (const a of articles) {
  const where = a.rel;
  let body = renderMarkdown(a.body, { reservedIds: ['main'] }); // article text is never templated or changed
  let h1Html = escapeHtml(a.data.title);
  const h1 = body.match(/<h1 id="[^"]*">([\s\S]*?)<\/h1>\n?/);
  if (h1) { h1Html = h1[1]; body = body.replace(h1[0], ''); }
  body = faqBoldToHeadings(body);
  if (/<h1[\s>]/.test(body)) {
    fail(where + ': the article has more than one "# " heading. Only one h1 is allowed per page.');
  }
  const h2s = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  const words = textOf(body).split(' ').length;
  const toc = h2s.length >= 4 || (words > 1200 && h2s.length >= 2)
    ? '<nav class="toc" aria-labelledby="toc-title"><h2 id="toc-title" class="toc-title">Contents</h2><ol>' + h2s.map((h) => '<li><a href="#' + h[1] + '">' + h[2] + '</a></li>').join('') + '</ol></nav>'
    : '';
  const app = a.data.relatedApp ? apps.find((x) => x.slug === a.data.relatedApp) : null;
  const relatedBox = app
    ? '<aside class="related" aria-labelledby="related-app"><h2 id="related-app">Related: ' + escapeHtml(app.name) + '</h2>' + appPageList(app, null) + '</aside>'
    : '';
  const isOrgAuthor = a.data.author === site.name;
  const authorNode = isOrgAuthor ? { '@id': ORG_ID } : { '@type': 'Person', name: a.data.author, ...(a.data.authorUrl ? { url: a.data.authorUrl } : {}) };
  const url = site.url + a.path;
  const updated = a.data.dateModified !== a.data.datePublished;
  const titleTag = (a.data.title + ' | ' + site.name).length <= 70 ? a.data.title + ' | ' + site.name : a.data.title;
  emit({
    path: a.path,
    kind: 'article',
    app: null,
    title: titleTag,
    ogTitle: a.data.title,
    description: a.data.description,
    h1Html,
    bodyHtml: body,
    dateModified: a.data.dateModified,
    datePublished: a.data.datePublished,
    ogType: 'article',
    metaHtml: '<p class="byline">By ' + (a.data.authorUrl ? '<a href="' + attr(a.data.authorUrl) + '">' + escapeHtml(a.data.author) + '</a>' : escapeHtml(a.data.author)) +
      '. Published ' + timeTag(a.data.datePublished) + '.</p><p class="updated">Last updated ' + timeTag(a.data.dateModified) + (updated ? '' : '') + '</p>',
    beforeBody: toc,
    crumbs: [crumbHome, { name: 'Articles', path: '/articles/' }, { name: a.data.title, path: a.path }],
    about: app ? appRef(app) : null,
    extraNodes: [{
      '@type': 'Article',
      '@id': url + '#article',
      headline: textOf(h1Html),
      description: a.data.description,
      datePublished: a.data.datePublished,
      dateModified: a.data.dateModified,
      author: authorNode,
      publisher: { '@id': ORG_ID },
      mainEntityOfPage: { '@id': url + '#webpage' },
      image: site.url + (app ? app.iconUrl : site.defaultOgImage),
      inLanguage: site.language,
      ...(app ? { about: appRef(app) } : {}),
    }],
    afterBody: relatedBox,
  });
}

/* ------------------------------------------------- static + crawl files */

copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
for (const app of apps) {
  copyDir(path.join(ROOT, 'apps', app.slug), path.join(OUT, 'apps', app.slug), (name) => name === 'app.json' || name === 'pages' || name.endsWith('.md'));
}
fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(OUT, 'CNAME'));
write('.nojekyll', '');

// sitemap.xml
const indexable = built.filter((b) => b.indexable).sort((a, b) => a.path.localeCompare(b.path));
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  indexable.map((b) => '  <url>\n    <loc>' + escapeHtml(site.url + b.path) + '</loc>\n    <lastmod>' + b.lastmod + '</lastmod>\n  </url>').join('\n') + '\n</urlset>\n');

// robots.txt
const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended'];
write('robots.txt', '# robots.txt for ' + site.url + '\n# Every crawler may read every page.\n\nUser-agent: *\nAllow: /\n\n' +
  bots.map((b) => 'User-agent: ' + b + '\nAllow: /\n').join('\n') + '\nSitemap: ' + site.url + '/sitemap.xml\n');

// llms.txt
{
  const L = [];
  L.push('# ' + site.name, '', '> ' + site.llmsSummary, '');
  L.push('Contact: ' + site.email, 'Website: ' + site.url + '/', '');
  for (const app of apps) {
    L.push('## ' + app.name, '');
    L.push(app.summary, '');
    L.push('- Developer: ' + app.developer);
    L.push('- Platform: ' + app.platform);
    L.push('- Package name: ' + app.packageName);
    L.push('- Price: ' + app.offers.map((o) => o.display + ' ' + o.label).join('; '));
    if (app.freeFirstDay) L.push('- ' + app.freeFirstDayText);
    L.push('- Google Play: ' + app.playUrl);
    L.push('- Contact: ' + app.contactEmail, '');
    for (const p of app.pages) L.push('- [' + p.data.h1 + '](' + site.url + p.path + '): ' + p.data.description);
    L.push('');
  }
  if (articles.length) {
    L.push('## Articles', '');
    for (const a of articles) L.push('- [' + a.data.title + '](' + site.url + a.path + '): ' + a.data.description);
    L.push('');
  }
  L.push('## About the developer', '');
  for (const p of devPages.filter((x) => ['about', 'contact', 'privacy-policy'].includes(x.slug))) L.push('- [' + p.data.h1 + '](' + site.url + p.path + '): ' + p.data.description);
  L.push('');
  write('llms.txt', L.join('\n'));
}

/* ----------------------------------------------------------- checks */

const pagesForCheck = built.map((b) => ({ path: b.path, kind: b.kind, indexable: b.indexable }));
const result = errors.length ? { errors: [], warnings: [], htmlCount: 0, linkCount: 0 } : validateSite({ outDir: OUT, site, apps, pages: pagesForCheck });
const allErrors = [...errors, ...result.errors];
if (STRICT) allErrors.push(...todos.map((t) => 'TODO left: ' + t));

const line = '-'.repeat(64);
console.log(line);
console.log('Built ' + built.length + ' pages into dist/ (' + apps.length + ' app' + (apps.length === 1 ? '' : 's') + ', ' + articles.length + ' article' + (articles.length === 1 ? '' : 's') + ').');
console.log('Checked ' + result.htmlCount + ' HTML files and ' + result.linkCount + ' links.');
for (const app of apps) console.log('Free first day line for ' + app.shortName + ': ' + (app.freeFirstDay ? 'SHOWN ("' + app.freeFirstDayText + '")' : 'hidden (freeFirstDay is false)'));
if (result.warnings.length) {
  console.log('\nWarnings (' + result.warnings.length + '):');
  for (const w of result.warnings) console.log('  ! ' + w);
}
if (todos.length && !STRICT) {
  console.log('\nTODO markers still to fill in (' + todos.length + '):');
  for (const t of todos) console.log('  - ' + t);
}
if (allErrors.length) {
  console.log('\nErrors (' + allErrors.length + '):');
  for (const e of allErrors) console.log('  x ' + e);
  console.log(line);
  process.exitCode = 1;
} else {
  console.log('\nNo errors.');
}
console.log('\nREMINDER: publish each article on ' + site.domain + ' FIRST. Then post copies');
console.log('elsewhere (Medium and others) with a clear link back to the original page.');
console.log(line);

#!/usr/bin/env node
'use strict';
/*
 * Move finished articles from incoming-articles/ into articles/content/.
 * Zero dependencies.
 *
 *   node tools/import-articles.js            preview only: shows the slug, title and
 *                                            description it would use. Changes nothing.
 *   node tools/import-articles.js --apply    writes articles/content/<slug>.md and
 *                                            removes the file from incoming-articles/
 *
 * Options:
 *   --date=YYYY-MM-DD   datePublished and dateModified (default: today)
 *   --author="Name"     author (default: the developer name in site.json)
 *
 * The article text is never changed. The tool only adds a front-matter block on
 * top, then checks that the text below it is byte for byte the original.
 * Edit the front matter by hand afterwards if you want a different slug, title
 * or description (rename the file to match a new slug).
 */
const fs = require('fs');
const path = require('path');
const { parseFrontMatter, stringifyFrontMatter } = require('../lib/frontmatter');
const { slugify } = require('../lib/markdown');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'incoming-articles');
const OUT = path.join(ROOT, 'articles', 'content');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const opt = (name) => (args.find((a) => a.startsWith('--' + name + '=')) || '').split('=').slice(1).join('=') || null;

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
const apps = fs.readdirSync(path.join(ROOT, 'apps'))
  .filter((d) => fs.existsSync(path.join(ROOT, 'apps', d, 'app.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', d, 'app.json'), 'utf8')));
const now = new Date();
const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
const date = opt('date') || today;
const author = opt('author') || site.name;

const plain = (s) => s
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\((?:[^()\s]|\([^()\s]*\))*\)/g, '$1')
  .replace(/[*`~]/g, '')
  .replace(/(^|\W)_+|_+(?=\W|$)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// Words that read badly at the end of a URL.
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'at', 'by', 'from', 'your', 'its']);

/** A short, clean slug: the main title (before a colon), up to 7 words, without filler words at the ends. */
function makeSlug(title) {
  let main = title.split(/[:|?]/)[0];
  if (main.trim().split(/\s+/).length < 3) main = title;
  let words = slugify(main).split('-').filter(Boolean);
  while (words.length > 3 && STOP.has(words[words.length - 1])) words.pop();
  if (words.length > 7) words = words.slice(0, 7);
  while (words.length > 3 && STOP.has(words[words.length - 1])) words.pop();
  return words.join('-');
}

/** First real paragraph (not a heading, disclosure, quote, list or note), cut to about 155 characters at a sentence or word. */
function makeDescription(body) {
  const paras = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paras) {
    if (/^(#|>|[-*+] |\d+[.)] |\||<|---|:::)/.test(p)) continue;
    const t = plain(p);
    if (/^(disclosure|note|editor|updated|published|by )/i.test(t) || t.length < 60) continue;
    if (t.length <= 160) return t;
    const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
    let out = '';
    for (const s of sentences) { if ((out + s).trim().length > 160) break; out += s; }
    if (out.trim().length >= 60) return out.trim();
    return t.slice(0, 155).replace(/\s+\S*$/, '') + '...';
  }
  return '';
}

if (!fs.existsSync(IN)) { console.log('No incoming-articles/ folder.'); process.exit(0); }
const files = fs.readdirSync(IN).filter((f) => f.toLowerCase().endsWith('.md'));
if (!files.length) { console.log('No .md files in incoming-articles/.'); process.exit(0); }

const plans = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(IN, f), 'utf8');
  const { data, body, hasFrontMatter } = parseFrontMatter(raw);
  const h1 = (body.match(/^#\s+(.+?)\s*#*\s*$/m) || [])[1];
  const title = data.title || (h1 ? plain(h1) : plain(body.split('\n').find((l) => l.trim()) || f));
  const fm = {
    title,
    slug: data.slug || makeSlug(title),
    description: data.description || makeDescription(body),
    datePublished: data.datePublished || date,
    dateModified: data.dateModified || date,
    author: data.author || author,
  };
  const related = data.relatedApp || (apps.find((a) => new RegExp('\\b' + a.shortName + '\\b', 'i').test(body)) || {}).slug;
  if (related) fm.relatedApp = related;
  for (const [k, v] of Object.entries(data)) if (!(k in fm)) fm[k] = v;
  plans.push({ file: f, raw, body: hasFrontMatter ? body : raw, fm });
}

console.log(APPLY ? 'Importing articles:\n' : 'Preview (nothing is changed). Run again with --apply to import.\n');
for (const p of plans) {
  console.log('File:         incoming-articles/' + p.file);
  console.log('Slug:         ' + p.fm.slug + '   ->  ' + site.url + '/articles/' + p.fm.slug + '/');
  console.log('Title:        ' + p.fm.title);
  console.log('Description:  ' + p.fm.description + '  (' + p.fm.description.length + ' characters)');
  console.log('Dates:        published ' + p.fm.datePublished + ', modified ' + p.fm.dateModified);
  console.log('Author:       ' + p.fm.author);
  console.log('Related app:  ' + (p.fm.relatedApp || '(none)'));
  if (!p.fm.description) console.log('  ! No description found. Add one by hand in the front matter.');
  const target = path.join(OUT, p.fm.slug + '.md');
  if (fs.existsSync(target)) console.log('  ! articles/content/' + p.fm.slug + '.md already exists. It will not be overwritten.');
  console.log('');

  if (APPLY && !fs.existsSync(target)) {
    fs.mkdirSync(OUT, { recursive: true });
    const out = stringifyFrontMatter(p.fm) + p.body;
    fs.writeFileSync(target, out);
    const check = parseFrontMatter(fs.readFileSync(target, 'utf8'));
    if (check.body !== p.body) {
      fs.unlinkSync(target);
      console.log('  x Text check failed for ' + p.file + '. Nothing was moved.');
      process.exitCode = 1;
      continue;
    }
    fs.unlinkSync(path.join(IN, p.file));
    console.log('  Moved to articles/content/' + p.fm.slug + '.md (text unchanged).\n');
  }
}
if (APPLY) console.log('Next: run "node build.js".');

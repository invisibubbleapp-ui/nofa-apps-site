'use strict';
/*
 * Minimal Markdown converter. Zero dependencies.
 * Supports: ATX and setext headings (with ids), paragraphs, hard line breaks,
 * ordered and unordered lists (nested), links, autolinks, bare URLs, images,
 * bold, italics, strikethrough, inline code, fenced code, blockquotes,
 * tables (with alignment), horizontal rules, HTML comment and HTML block
 * pass-through, and ":::name ... :::" boxes (used for TODO markers).
 *
 * It never changes the wording of the source text. It only wraps it in HTML.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
}

/** Visible plain text of an HTML fragment, whitespace collapsed. */
function textOf(html) {
  // Block-level tags become spaces, so "<td>a</td><td>b</td>" reads "a b".
  const spaced = String(html).replace(/<\/?(?:p|div|li|ul|ol|h[1-6]|tr|td|th|table|thead|tbody|caption|br|hr|blockquote|section|article|header|footer|nav|aside|main|pre)\b[^>]*>/gi, ' ');
  return decodeEntities(stripTags(spaced)).replace(/\s+/g, ' ').trim();
}

function slugify(s) {
  return decodeEntities(stripTags(String(s)))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------------------------------------------------------------- inline */

function trimUrl(url) {
  // Drop trailing punctuation that is almost never part of a URL.
  let tail = '';
  while (/[.,:;!?'"*_]$/.test(url) || (url.endsWith(')') && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length)) {
    tail = url.slice(-1) + tail;
    url = url.slice(0, -1);
  }
  return [url, tail];
}

function inline(text) {
  const stash = [];
  return restore(fmt(String(text), stash, false), stash);
}

// Formats inline Markdown. Finished HTML pieces are parked in `stash` and
// replaced by markers, so later steps cannot touch them.
function fmt(text, stash, inLink) {
  const keep = (html) => '\u0000' + (stash.push(html) - 1) + '\u0000';
  let s = text;

  // Inline code first, so nothing inside it is formatted.
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, code) => keep('<code>' + escapeHtml(code.trim()) + '</code>'));
  // Backslash escapes.
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|>~<])/g, (_, c) => keep(escapeHtml(c)));
  // Inline HTML comments are dropped.
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // Images.
  s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g, (_, alt, src, title) =>
    keep('<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '"' + (title ? ' title="' + escapeHtml(title) + '"' : '') + ' loading="lazy">'));
  // Links. Link text may contain formatting and one level of brackets.
  if (!inLink) {
    s = s.replace(/\[((?:[^\[\]\u0000]|\[[^\]]*\]|\u0000\d+\u0000)*)\]\(\s*<?((?:[^()\s>]|\([^()\s]*\))*)>?(?:\s+"([^"]*)")?\s*\)/g, (_, label, href, title) =>
      keep('<a href="' + escapeHtml(href) + '"' + (title ? ' title="' + escapeHtml(title) + '"' : '') + '>' + fmt(label, stash, true) + '</a>'));
    // Autolinks <https://...> and <name@example.com>.
    s = s.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => keep('<a href="' + escapeHtml(u) + '">' + escapeHtml(u) + '</a>'));
    s = s.replace(/<([^@\s<>]+@[^@\s<>]+\.[a-z]{2,})>/gi, (_, e) => keep('<a href="mailto:' + escapeHtml(e) + '">' + escapeHtml(e) + '</a>'));
    // Bare URLs.
    s = s.replace(/\bhttps?:\/\/[^\s<>\u0000]+/g, (m) => {
      const [url, tail] = trimUrl(m);
      return keep('<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>') + tail;
    });
  }

  s = escapeHtml(s);

  // Emphasis.
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>');
  s = s.replace(/(^|[^*\w])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_(?=[^\s_])([\s\S]*?[^\s_])_(?![_\w])/g, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  // Hard line breaks: two trailing spaces or a trailing backslash.
  s = s.replace(/( {2,}|\\)\n/g, '<br>\n');

  return s;
}

function restore(s, stash) {
  let prev;
  do {
    prev = s;
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
  } while (s !== prev);
  return s;
}

/* ----------------------------------------------------------------- blocks */

const RE = {
  blank: /^\s*$/,
  fence: /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/,
  box: /^:::\s*([a-z][\w-]*)\s*(.*)$/i,
  boxEnd: /^:::\s*$/,
  atx: /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/,
  hr: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}> ?/,
  list: /^( {0,12})([-*+]|\d{1,9}[.)])(?:\s+(.*)|\s*$)/,
  htmlBlock: /^ {0,3}<(?:!--|\/?(?:div|section|aside|figure|figcaption|table|thead|tbody|tr|td|th|details|summary|p|ul|ol|li|nav|header|footer|iframe|pre|h[1-6]|dl|dt|dd|hr|br|img)\b)/i,
  tableSep: /^\s*\|?\s*:?-{1,}:?\s*(?:\|\s*:?-{1,}:?\s*)*\|?\s*$/,
};

function isBlockStart(line, next) {
  return RE.fence.test(line) || RE.box.test(line) || RE.atx.test(line) || RE.hr.test(line) ||
    RE.quote.test(line) || RE.htmlBlock.test(line) ||
    /^ {0,3}([-*+]|1[.)])\s+\S/.test(line) ||
    (line.includes('|') && next !== undefined && RE.tableSep.test(next) && next.includes('-'));
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|') && !r.endsWith('\\|')) r = r.slice(0, -1);
  const cells = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (c === '\\' && r[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') inCode = !inCode;
    if (c === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function render(src, ctx) {
  const lines = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return blocks(lines, ctx);
}

function heading(level, raw, ctx) {
  const html = inline(raw);
  let id = slugify(html) || 'section';
  if (/^\d/.test(id)) id = 'section-' + id; // ids should start with a letter
  if (ctx.ids.has(id)) {
    let n = 2;
    while (ctx.ids.has(id + '-' + n)) n++;
    id = id + '-' + n;
  }
  ctx.ids.add(id);
  return '<h' + level + ' id="' + id + '">' + html + '</h' + level + '>';
}

function blocks(lines, ctx) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;

    if (RE.blank.test(line)) { i++; continue; }

    // Fenced code.
    if ((m = line.match(RE.fence))) {
      const fence = m[1];
      const lang = m[2];
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) body.push(lines[i++]);
      i++;
      out.push('<pre><code' + (lang ? ' class="language-' + escapeHtml(lang) + '"' : '') + '>' + escapeHtml(body.join('\n')) + '</code></pre>');
      continue;
    }

    // ::: boxes (for example ":::todo Confirm the permission list").
    if ((m = line.match(RE.box))) {
      const kind = m[1].toLowerCase();
      const title = m[2].trim();
      const body = [];
      let depth = 1;
      i++;
      while (i < lines.length) {
        if (RE.box.test(lines[i])) depth++;
        else if (RE.boxEnd.test(lines[i])) { depth--; if (depth === 0) break; }
        body.push(lines[i++]);
      }
      i++;
      if (ctx.onBox) ctx.onBox(kind, title, body.join('\n'));
      const label = kind === 'todo' ? '<p class="box-label">TODO' + (title ? ': ' + inline(title) : '') + '</p>' :
        (title ? '<p class="box-label">' + inline(title) + '</p>' : '');
      out.push('<div class="box box-' + kind + '"' + (kind === 'todo' ? ' role="note"' : '') + '>' + label + blocks(body, ctx) + '</div>');
      continue;
    }

    // ATX heading.
    if ((m = line.match(RE.atx))) {
      out.push(heading(m[1].length, m[2] || '', ctx));
      i++;
      continue;
    }

    // Horizontal rule.
    if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

    // HTML comments and HTML blocks pass through untouched until a blank line.
    if (RE.htmlBlock.test(line)) {
      const body = [];
      if (/^ {0,3}<!--/.test(line)) {
        while (i < lines.length) { body.push(lines[i]); if (lines[i].includes('-->')) { i++; break; } i++; }
        continue; // comments are not published
      }
      while (i < lines.length && !RE.blank.test(lines[i])) body.push(lines[i++]);
      out.push(body.join('\n'));
      continue;
    }

    // Blockquote.
    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && !RE.blank.test(lines[i])) {
        if (RE.quote.test(lines[i])) body.push(lines[i].replace(RE.quote, ''));
        else if (isBlockStart(lines[i], lines[i + 1])) break;
        else body.push(lines[i]);
        i++;
        // A blank line followed by another ">" line continues the quote.
        if (i < lines.length - 1 && RE.blank.test(lines[i]) && RE.quote.test(lines[i + 1])) { body.push(''); i++; }
      }
      out.push('<blockquote>\n' + blocks(body, ctx) + '\n</blockquote>');
      continue;
    }

    // Table.
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && !RE.blank.test(lines[i]) && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const al = (k) => (aligns[k] ? ' style="text-align:' + aligns[k] + '"' : '');
      let t = '<div class="table-wrap"><table>\n<thead><tr>' + head.map((c, k) => '<th scope="col"' + al(k) + '>' + inline(c) + '</th>').join('') + '</tr></thead>\n<tbody>\n';
      for (const r of rows) {
        t += '<tr>' + head.map((_, k) => {
          const cell = inline(r[k] || '');
          // A bold first cell reads as a row header.
          return k === 0 && ctx.rowHeaders ? '<th scope="row"' + al(k) + '>' + cell + '</th>' : '<td' + al(k) + '>' + cell + '</td>';
        }).join('') + '</tr>\n';
      }
      t += '</tbody>\n</table></div>';
      out.push(t);
      continue;
    }

    // List.
    if ((m = line.match(RE.list))) {
      const res = list(lines, i, ctx);
      out.push(res.html);
      i = res.next;
      continue;
    }

    // Paragraph (with setext heading support).
    const para = [line];
    i++;
    let setext = 0;
    while (i < lines.length && !RE.blank.test(lines[i])) {
      if (/^ {0,3}=+\s*$/.test(lines[i])) { setext = 1; i++; break; }
      if (/^ {0,3}-+\s*$/.test(lines[i])) { setext = 2; i++; break; }
      if (isBlockStart(lines[i], lines[i + 1])) break;
      para.push(lines[i++]);
    }
    const text = para.map((l, k) => (k === para.length - 1 ? l.trim() : l.replace(/^\s+/, ''))).join('\n');
    if (setext) out.push(heading(setext, text, ctx));
    else out.push('<p>' + inline(text) + '</p>');
  }
  return out.join('\n');
}

function list(lines, i, ctx) {
  const first = lines[i].match(RE.list);
  const ordered = /\d/.test(first[2]);
  const base = first[1].length;
  const delim = first[2].slice(-1);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let loose = false;
  let cur = null;
  const sameKind = (mm) => mm && mm[1].length === base && /\d/.test(mm[2]) === ordered && (ordered || mm[2] === delim);

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(RE.list);
    if (sameKind(m)) {
      cur = { lines: [m[3] || ''], indent: m[1].length + m[2].length + 1 };
      items.push(cur);
      i++;
      continue;
    }
    if (RE.blank.test(line)) {
      let j = i;
      while (j < lines.length && RE.blank.test(lines[j])) j++;
      if (j >= lines.length) { i = j; break; }
      const nm = lines[j].match(RE.list);
      const ind = lines[j].match(/^ */)[0].length;
      if (sameKind(nm)) { loose = true; i = j; continue; }
      if (ind >= cur.indent) { for (let k = i; k < j; k++) cur.lines.push(''); loose = true; i = j; continue; }
      break;
    }
    const ind = line.match(/^ */)[0].length;
    if (ind > base) { cur.lines.push(line.slice(Math.min(ind, cur.indent))); i++; continue; }
    if (m || isBlockStart(line, lines[i + 1])) break;
    cur.lines.push(line.trim()); // lazy continuation
    i++;
  }

  const tag = ordered ? 'ol' : 'ul';
  const attrs = ordered && startNum !== 1 ? ' start="' + startNum + '"' : '';
  const body = items.map((it) => {
    let html = blocks(it.lines, ctx);
    if (!loose) html = html.replace(/<p>([\s\S]*?)<\/p>/g, '$1');
    return '<li>' + html + '</li>';
  }).join('\n');
  return { html: '<' + tag + attrs + '>\n' + body + '\n</' + tag + '>', next: i };
}

/**
 * Render Markdown to HTML.
 * options.onBox(kind, title, body): called for every ":::kind" box.
 * options.rowHeaders: render the first cell of each table body row as <th scope="row">.
 */
function renderMarkdown(src, options = {}) {
  const ctx = { ids: new Set(options.reservedIds || []), onBox: options.onBox, rowHeaders: !!options.rowHeaders };
  return render(src, ctx);
}

module.exports = { renderMarkdown, inline, escapeHtml, decodeEntities, stripTags, textOf, slugify };

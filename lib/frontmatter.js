'use strict';
/*
 * Tiny front-matter reader and writer.
 * Format: the file starts with a line "---", then "key: value" lines, then "---".
 * Values may be plain text or a JSON string in double quotes.
 * The body after the closing "---" line is returned byte for byte.
 */

function parseFrontMatter(src) {
  const text = String(src).replace(/^﻿/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { data: {}, body: text, hasFrontMatter: false };
  const data = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 1) throw new Error('Bad front-matter line: "' + raw + '"');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"')) value = JSON.parse(value);
    else if (value === 'true' || value === 'false') value = value === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    data[key] = value;
  }
  return { data, body: text.slice(m[0].length), hasFrontMatter: true };
}

function formatValue(v) {
  if (typeof v !== 'string') return String(v);
  return /^[\w ,.()'/-]*$/.test(v) && v.trim() === v && v !== '' && !/^(true|false|-?\d+(\.\d+)?)$/.test(v) ? v : JSON.stringify(v);
}

function stringifyFrontMatter(data) {
  return '---\n' + Object.entries(data).map(([k, v]) => k + ': ' + formatValue(v)).join('\n') + '\n---\n';
}

module.exports = { parseFrontMatter, stringifyFrontMatter };

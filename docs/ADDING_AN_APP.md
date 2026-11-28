# Adding an app or an article

Everything is built by `node build.js`. You never edit HTML by hand. The developer home, the `/apps/` page, the footer, the sitemap, llms.txt and all JSON-LD update on their own.

---

## Add a new app

### 1. Create the folder

Pick a short, lowercase slug. It becomes the URL `/apps/<slug>/` and must never change.

```
apps/<slug>/
  app.json
  icon.png        1024 x 1024, used for Open Graph and JSON-LD
  icon-128.png    128 x 128, shown on pages and as the favicon
  pages/
    index.md      the app home (required)
    ...           one .md file per page
```

The easiest start is to copy `apps/invisibubble/` and change it.

### 2. Fill in `app.json`

This is the **only** place the app's facts are typed. Pages pull them in with placeholders, so the facts are the same on every page.

| Field | Meaning |
| --- | --- |
| `slug` | Same as the folder name |
| `order` | Position in app lists (1 = first) |
| `name` | Full app name exactly as on Google Play |
| `shortName` | Short name for menus and buttons |
| `developer` | Must equal `name` in `site.json` |
| `platform` | Plain text, for example `Android only` |
| `operatingSystem` | For JSON-LD, for example `Android` |
| `applicationCategory` | schema.org category, for example `UtilitiesApplication` |
| `packageName` | Google Play package name |
| `contactEmail` | Support email |
| `playUrl` | Must be `https://play.google.com/store/apps/details?id=<packageName>` |
| `accentColor` | The app's accent for links and hover. Sets `--accent` on its pages and on articles about it. Must reach 4.5:1 contrast on `#121317` |
| `accentStrongColor` | Fill colour for buttons and highlights (`--accent-strong`). Often the same as `accentColor` |
| `onAccentColor` | Text colour on `accentStrongColor` (`--on-accent-strong`). Must reach 4.5:1 contrast on it |
| `icon`, `iconSmall` | File names of the icons in the app folder |
| `lastUpdated` | `YYYY-MM-DD`. Change it whenever a fact changes |
| `oneLiner` | One or two sentences for app cards |
| `summary` | Two sentences: what the app is and what it does. Used in JSON-LD and llms.txt |
| `offers` | Prices. Each has `key`, `name`, `label`, `description`, `price`, `currency`, `display` (for example `Rs 100`) |
| `facts` | Rows of the fact-sheet table. `value` may use placeholders. `onlyIf` hides a row unless a field is true |
| `permissions` | Every permission in the released app's merged manifest: `label`, `android` (list of Android names) and `reason` (one plain sentence or two). Feeds the safety page table and the privacy policy table |
| `noPermissions` | One sentence naming sensitive permissions the app does not have (for example camera, microphone, location) |
| `storedData` | Everything the app saves on the phone: `label` and `detail`. Feeds the privacy policy's "Data stored on your device" list |
| `practices` | `noAccount`, `noTrackingSdks`, `noPersonalDataServer`, `noDataSale`: set `true` only if the app's own privacy policy says so. The `/privacy-policy/` overview shows a statement only when every app sets it to `true` |

You can add any other field (for example `timerOptions`) and use it in pages as `{{app.timerOptions}}`.

### 3. Write the pages

Each page is a Markdown file with front matter:

```
---
title: "The <title> tag, unique, about 60 characters"
h1: "The visible page heading"
description: "Meta description, unique, 120 to 160 characters."
navLabel: Short menu label
order: 2
dateModified: 2026-11-18
---

Answer the page's question in the first two sentences.

## Details

...

## FAQ

### A question, written exactly as people ask it?

The answer, in plain sentences.
```

- The file name is the URL: `pages/pricing.md` becomes `/apps/<slug>/pricing/`. `index.md` is the app home.
- Do not write a `# ` heading. The `h1` field is the only h1.
- A section headed `## FAQ` with `### ` questions becomes FAQPage JSON-LD automatically, matching the visible text.
- Pages named `index` and `facts` get the full SoftwareApplication JSON-LD.
- Every app **must** have `pages/privacy-policy.md`. The build fails without it. See "The app's privacy policy" below.

**Placeholders you can use in app pages:**

| Placeholder | Result |
| --- | --- |
| `{{app.name}}`, `{{app.packageName}}`, ... | Any field from `app.json` |
| `{{app.offerByKey.lifetime.display}}` | A price, by offer `key` |
| `{{site.email}}`, `{{site.name}}` | Fields from `site.json` |
| `{{url:pricing}}` | Link to a page of the same app (checked at build time) |
| `{{url:otherapp/facts}}` | Link to a page of another app |
| `{{article:my-article-slug}}` | Link to an article (checked at build time) |
| `{{#if app.freeFirstDay}}...{{else}}...{{/if}}` | Text shown only when a field is true |
| `{{> playButton}}` | Google Play button |
| `{{> factsTable}}` | The full fact-sheet table from `facts` |
| `{{> appPages}}` | List of the app's pages |

**Markers:**

- `<!-- TODO: something to confirm -->` is not published. The build lists it.
- A `:::todo Title` ... `:::` box **is shown on the page** with a dashed border, and the build lists it. Use it only where the reader must see that something is missing.
- `:::steps` ... `:::` around a numbered list shows it as step cards.

### The app's privacy policy

Create `apps/<slug>/pages/privacy-policy.md`. It is published at `/apps/<slug>/privacy-policy/`. Use that URL as the privacy policy URL in the Play Console. It is added to the app's menu, the footer, the sitemap, llms.txt and the `/privacy-policy/` overview automatically.

Start from `apps/invisibubble/pages/privacy-policy.md` and fill in, from the real app (not from memory):

1. **Data practices:** what the app stores on the phone (`storedData` in `app.json`), backups, every network request and what it sends, purchases, what you do not do, children, retention and deletion.
2. **Permissions:** every permission in the merged release manifest, including ones added by libraries, in `permissions` in `app.json`. Put `{{> policyPermissionsTable}}` in the policy and `{{> permissionsTable}}` on the safety page; both come from the same data.
3. **Contact:** `contactEmail` in `app.json`, shown with `{{app.contactEmail}}`.

Front matter: `navLabel: Privacy Policy`, `exactText: true` (legal text: the writing-rule checks only warn) and `dateModified`. **The "Last updated" date is manual:** change `dateModified` in this file whenever the policy text changes. It does not change when `app.json` changes.

The build fails if the policy's permission table or stored-data list does not match `app.json` word for word, or names a permission that `app.json` does not list.

### 4. Build and check

```
node build.js
```

Fix every error it prints. Then run `node tools/serve.js` and look at the pages at http://localhost:8080.

### 5. Publish

Commit and push to `main`. GitHub Actions builds and publishes the site.

---

## Add an article

### 1. Put the file in `incoming-articles/`

Save the finished article as a `.md` file. Start it with a `# Title` line. Keep the disclosure line, the Sources list and the footer line in the text.

### 2. Preview the slug, title and description

```
node tools/import-articles.js
```

This changes nothing. It shows the slug (URL), title, description, dates, author and related app it would use.

### 3. Import

```
node tools/import-articles.js --apply
node tools/import-articles.js --apply --date=2026-11-20 --author="Your Name"
```

This moves the file to `articles/content/<slug>.md` and adds a front-matter block on top:

```
---
title: "Article title"
slug: article-slug
description: "One or two sentences, 120 to 160 characters."
datePublished: 2026-11-20
dateModified: 2026-11-20
author: Nofa Applications
relatedApp: invisibubble
---
```

The article text below the front matter is not changed. The tool checks this byte for byte.

You can edit the front matter by hand afterwards. If you change the `slug`, rename the file to match. After the article is published, never change its slug.

Optional fields: `authorUrl` (a link for the author's name).

### 4. What the build does with an article

- URL: `/articles/<slug>/`. Listed newest first on `/articles/`, on the home page, in the footer, the sitemap and llms.txt.
- The `# Title` line in the text becomes the page's only h1. Only one `# ` heading is allowed.
- Shows the author, publish date and "Last updated" date.
- Adds a table of contents when the article has 4 or more `## ` sections, or is long.
- Adds a "Related" box with links to the related app's pages (from `relatedApp`).
- Adds Article JSON-LD, and FAQPage JSON-LD only if the article has a `## FAQ` section with `### ` questions.
- Article text is never filled with placeholders, so it stays exactly as written. The build only warns (does not fail) about em dashes or claim words inside articles, because their text is kept as is. It does fail if an article mentions a free first day while the flag is off.

### 5. Link app pages to the article

In app pages, link relevant words with `[words]({{article:<slug>}})`. App pages with a matching `relatedApp` also list the article in a "Related reading" box automatically.

### 6. Publish here first

Push to `main` and wait for the site to update. Only then post copies on Medium and other sites, each with a link back to the original page on nofa-apps.store.

### Supported Markdown

Headings (`#` to `######`), paragraphs, line breaks (two spaces at the end of a line), `-` / `*` / `1.` lists (nested by indenting), `[links](https://...)`, bare URLs, `**bold**`, `*italics*`, `` `code` ``, `> blockquotes`, tables with `|`, `---` rules, and fenced code blocks.

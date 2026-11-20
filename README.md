# nofa-apps.store

The website of **Nofa Applications**. It is plain static HTML, built by one small Node script with zero dependencies.

The goal is to make this site the clearest and most accurate source of facts about our apps, so search and answer engines can find and quote it correctly.

## Build and preview

You need Node 18 or newer. Nothing to install.

```
node build.js            # builds dist/ and runs all checks
node build.js --strict   # same, but any TODO left in the content counts as an error
node tools/serve.js      # preview dist/ at http://localhost:8080
```

The build checks the HTML structure, titles and descriptions, the single h1 per page, every internal link and anchor, JSON-LD, that FAQ JSON-LD matches the visible text, that prices, package name, email and app name match the app data, the writing rules (no em dashes, no "guaranteed" or "#1"), the sitemap and llms.txt. It prints every TODO that is still open.

## Where things live

| Path | What it is |
| --- | --- |
| `site.json` | Developer facts (name, URL, email), navigation, footer |
| `apps/<slug>/app.json` | All facts for one app. The only place app facts are typed |
| `apps/<slug>/pages/*.md` | The app's pages. `index.md` is the app home |
| `pages/*.md` | Developer pages: home, apps, articles, about, contact, privacy policy, 404 |
| `articles/content/*.md` | Articles (Markdown with front matter) |
| `incoming-articles/` | Drop new articles here, then run the import tool |
| `templates/` | Shared layout, header and footer |
| `assets/` | Shared CSS, font, favicon |
| `lib/` | Markdown converter, front-matter reader, checks |
| `tools/` | Article import tool, local preview server |
| `dist/` | The built site. Do not edit; it is rebuilt every time |
| `docs/ADDING_AN_APP.md` | How to add an app or an article |

URLs never change once published. File names in `apps/<slug>/pages/` and the article `slug` decide the URLs, so do not rename them.

## Free first day

The free first 24 hours is not mentioned anywhere while `"freeFirstDay": false` in `apps/invisibubble/app.json`. When it goes live, set it to `true` and rebuild. The line "New users get their first 24 hours free." then appears on the app home FAQ, pricing page, fact sheet and llms.txt. The build fails if the free day is mentioned while the flag is `false`.

---

## Hosting on GitHub Pages

### Important: keep the existing config repo safe

A released build of Invisibubble reads `free_day_config.json` from the **invisibubble-config** repo. This site must not change where that file is served from.

- Put this site in a **new, separate repository**, for example `nofa-apps-site`.
- **Do not** use the repository named `<your-username>.github.io` for this site. If that "user site" gets a custom domain, GitHub moves all your other project sites (including `invisibubble-config`) under that domain and redirects the old addresses. That could break the released app.
- Do not touch `invisibubble-config` or `free_day_config.json`.

### 1. Create the repository and push

1. On GitHub, create a new repository (for example `nofa-apps-site`). Public is fine.
2. Push this folder to its `main` branch. `dist/` is ignored by git; GitHub builds it.

### 2. Turn on GitHub Pages with Actions

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs on every push to `main`. It runs `node build.js` and publishes `dist/`. If the build finds errors, nothing is published.

### 3. Add DNS records at your domain registrar

Add these records for `nofa-apps.store`:

| Type | Host / Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<your-github-username>.github.io` |

Optional, for IPv6:

| Type | Host / Name | Value |
| --- | --- | --- |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Remove any other A, AAAA or CNAME records for `@` and `www` (for example a registrar "parking" record). The `www` CNAME points to `<your-github-username>.github.io` with no repository name.

### 4. Set the custom domain and HTTPS

1. In **Settings > Pages > Custom domain**, enter `nofa-apps.store` and click **Save**. (The `CNAME` file in this folder holds the same domain. With GitHub Actions deploys, the setting in this box is what counts.)
2. Wait for the DNS check to pass. DNS changes can take from a few minutes up to 24 hours.
3. Tick **Enforce HTTPS**. If the box is greyed out, GitHub is still issuing the certificate. Check again later.
4. Recommended: verify the domain in your GitHub account (**Settings > Pages > Verified domains**, in your *account* settings). This stops anyone else from using your domain on GitHub Pages.

Check that both `https://nofa-apps.store/` and `https://www.nofa-apps.store/` open the site.

### 5. After the site is live

- Submit `https://nofa-apps.store/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Put `https://nofa-apps.store/apps/invisibubble/` as the website on the Play Store listing, and `https://nofa-apps.store/privacy-policy/` as the privacy policy URL once the real policy text is on that page.
- Publish articles here first. Then post copies on Medium and other sites with a link back to the original article page.

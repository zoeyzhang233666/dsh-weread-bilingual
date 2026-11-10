# dsh-weread-bilingual

[中文](./README.md) | [English](./README.en.md)

WeChat Reading (**微信读书**) bilingual reader for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Read Chinese books in the **right sidebar**, see English sentence-by-sentence with a **plugin-selectable DSH model route**, and keep Weread reading time in sync. Built for **learning English in a context you actually care about**.

> **Install name (copy this into the DSH plugin marketplace / installer):**
>
> ```text
> dsh-weread-bilingual
> ```

## Features

- Weread shelf + chapter reader in the DSH right sidebar
- **WeChat QR login** (no DevTools Cookie copy; auto-refresh while valid)
- Side-by-side Chinese / English rows
- Display modes: **Hover** (translate on hover), Bilingual, Source, Translation
- Translation themes (plain / dashed / highlight / quote / weak / mask)
- Space to pause auto-translate (in bilingual modes)
- Export the current chapter as a bilingual Markdown table (**Save MD**)
- **Translation model:** pick provider/model on the shelf (plugin-local; auto-skips keyless official routes)
- Reading-time heartbeats via Weread `/web/book/read`

## Requirements

- DeepSeek Harness `0.2.x` (`>=0.2.1-rc.5 <0.3.0`)
- Node.js 24.9+
- A WeChat Reading account (QR login, or manual Cookie)
- A configured DSH model route

## Install

Published on npm: [`dsh-weread-bilingual`](https://www.npmjs.com/package/dsh-weread-bilingual).

> This is a **DSH plugin**, not a global CLI. Do **not** use plain `npm install -g`.  
> Install it through DSH’s plugin installer (which downloads the package from npm).

### Plugin marketplace / Desktop

1. Open DSH **plugin marketplace / plugin installer**.
2. Search or paste: `dsh-weread-bilingual`
3. Install, then **fully restart** DeepSeek Harness Desktop (or restart `dsh web` and hard-refresh).

### CLI (recommended — installs from npm)

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual
```

```sh
dsh plugin --profile web add -w dsh-weread-bilingual
```

Pin a version:

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual@0.1.10
```

To upgrade: run the same `add` again (or update in the marketplace), then restart DSH.

### From GitHub (track repo HEAD, or try a branch)

```sh
dsh plugin --profile desktop add -w github:zoeyzhang233666/dsh-weread-bilingual
```

### Local development

```sh
git clone https://github.com/zoeyzhang233666/dsh-weread-bilingual.git
cd dsh-weread-bilingual
npm install
npm run build
dsh plugin --profile desktop add -w "d:/weread-bilingual-dsh"
```

Replace the last path with your local checkout.

## Use

1. Open the right sidebar guide and choose **Weread Bilingual** / **微信读书双语**.
2. Click **Generate QR**, scan with WeChat and confirm (Cookie stays in this DSH profile; manual Cookie paste remains as fallback).
3. Open a book from the shelf.
4. Default **Hover** mode: hover a sentence to translate (saves tokens). Switch **Mode** / **Theme** in the toolbar as needed.
5. **Save MD** exports the current chapter’s source + translations.
6. **Translation model:** Use **翻译模型** on the shelf to pick provider/model (plugin-local only; prefers a usable DSH default, else the first usable third-party route). API keys stay on the DSH Models page.

## Risks

- Weread has no official public API; endpoints may change.
- Cookie equals login state — never commit it; store only in your DSH profile.
- Reading-time parity with the official app is best-effort.
- Translation uses your DSH model quota.

## Development

```sh
npm test
npm run build
npm run pack:dist
```

Design notes live under `docs/superpowers/specs/`.

## Publish notes

See [PUBLISH.md](./PUBLISH.md) for npm publish checklist.

## License

MIT. See `LICENSE` and `NOTICE` (protocol conventions reimplemented from Folio / touchFish community clients).

# dsh-weread-bilingual

WeChat Reading (**微信读书**) bilingual reader for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

Read Chinese books in the **right sidebar**, see English sentence-by-sentence with your **current DSH model**, and keep Weread reading time in sync. Built for **learning English in a context you actually care about**.

> **Install name (copy this into the DSH plugin marketplace / installer):**
>
> ```text
> dsh-weread-bilingual
> ```

## Features

- Weread shelf + chapter reader in the DSH right sidebar
- Side-by-side Chinese / English rows
- Display modes: **Hover** (translate on hover), Bilingual, Source, Translation
- Translation themes (plain / dashed / highlight / quote / weak / mask)
- Space to pause auto-translate (in bilingual modes)
- Export the current chapter as a bilingual Markdown table (**Save MD**)
- Reading-time heartbeats via Weread `/web/book/read`

## Requirements

- DeepSeek Harness `0.2.x` (`>=0.2.1-rc.5 <0.3.0`)
- Node.js 24.9+
- A WeChat Reading account (Cookie login)
- A configured DSH model route

## Install (plugin marketplace / Desktop)

1. Open DSH **plugin marketplace / plugin installer**.
2. Search or paste: `dsh-weread-bilingual`
3. Install, then **fully restart** DeepSeek Harness Desktop (or restart `dsh web` and hard-refresh).

### CLI

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual
```

```sh
dsh plugin --profile web add -w dsh-weread-bilingual
```

### From GitHub (before / without npm)

```sh
dsh plugin --profile desktop add -w github:zoeyzhang233666/dsh-weread-bilingual
```

### Local development

```sh
npm install
npm run build
dsh plugin --profile desktop add -w "d:/weread-bilingual-dsh"
```

## Use

1. Open the right sidebar guide and choose **Weread Bilingual** / **微信读书双语**.
2. Paste your `weread.qq.com` request Cookie and save (stored only in this DSH profile).
3. Open a book from the shelf.
4. Default **Hover** mode: hover a sentence to translate (saves tokens). Switch **Mode** / **Theme** in the toolbar as needed.
5. **Save MD** exports the current chapter’s source + translations.

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

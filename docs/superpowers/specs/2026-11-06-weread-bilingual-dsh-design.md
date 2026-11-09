# Weread bilingual DSH — design

Date: 2026-11-06

## Problem

Agentero’s DSH PDF reader translates well but requires a strict vault and fails on many real reading sources. Folio (weread-vscode) opens WeChat Reading in Cursor with copyable text and reading progress, but has no bilingual translation via the DSH model.

## Product

Standalone DeepSeek Harness plugin (not ChemClaw):

- Right sidebar: WeChat Reading shelf + chapter reader
- Layout: left Chinese / right English, sentence-aligned, synced scroll
- Auto translation: viewport-driven, one sentence at a time (concurrency 1)
- Model: current DSH selection via `dsh-llm` one-shot calls (no chat pollution)
- Reading time: `POST /web/book/read` with real accumulated `rt` while focused

## Architecture

Folio-style unofficial Weread web API + custom reader (not an iframe of weread.qq.com).

- **host**: Cookie, Weread HTTP, decrypt, heartbeat, translate proxy
- **client**: shelf + bilingual reader + settings
- **bundle**: `cordis.patch.yml` installs both

Right sidebar mounts:

- `ctx.sidebarRightTabs.register(...)`
- `ctx.slots.inject('sidebar.right.pane.tab', ...)`

Translation:

- `ctx.get('llm').prepareCall(...)` with `ctx.get('agentDefaultModel').currentSelection()`

## Out of scope (v1)

Local txt/epub/PDF outside Weread, OCR, notes/highlights, Agent book tools.

## Risks

Unofficial Weread APIs may change; Cookie is a login credential; read-time parity is best-effort; per-sentence calls consume quota.

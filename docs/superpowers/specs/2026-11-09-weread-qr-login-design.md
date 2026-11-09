# Weread QR login + cookie refresh

## Goal

Users sign in from the right sidebar with WeChat scan, without copying Cookie from DevTools. Cookies stay in the DSH profile and are refreshed while valid.

## Flow

1. `POST /auth/qr/start` → host calls Weread `web/login/getuid`, returns `uid` + QR payload for `https://weread.qq.com/web/confirm?uid=…`.
2. Client shows the QR; host `POST /auth/qr/wait` long-polls `web/login/getinfo` (~25s). Client retries until success, expire, or cancel.
3. On success, host builds `wr_vid` / `wr_skey` / `wr_pf` (and merges `Set-Cookie` from session init when available), validates via `/web/user`, persists Cookie.
4. Manual Cookie paste remains as fallback.
5. While logged in, status/shelf paths refresh Cookie via homepage HEAD when older than ~45 minutes, then persist.

## Non-goals

- Embedding weread.qq.com in an iframe
- Electron BrowserWindow cookie interception
- Weread Skill / Agent Gateway API keys

export const CSS_VERSION = '2026-11-09-qr-login'

/** ChemClaw Paper light palette as fallbacks; prefer live --bt-* when ChemClaw is loaded. */
export const CSS = `
.wrb-root {
  --wrb-bg: var(--bt-main, #faf9f5);
  --wrb-sidebar: var(--bt-sidebar, #f3f0e8);
  --wrb-panel: var(--bt-card, #f6f3eb);
  --wrb-bubble: var(--bt-bubble, #ebe7dc);
  --wrb-ink: var(--bt-ink, #1f1e1b);
  --wrb-muted: var(--bt-ink-2, rgba(31, 30, 27, 0.6));
  --wrb-faint: var(--bt-ink-3, rgba(31, 30, 27, 0.36));
  --wrb-line: var(--bt-line, rgba(31, 30, 27, 0.08));
  --wrb-line-2: var(--bt-line-2, rgba(31, 30, 27, 0.15));
  --wrb-hover: var(--bt-hover, rgba(119, 119, 119, 0.09));
  --wrb-active: var(--bt-active, rgba(119, 119, 119, 0.17));
  --wrb-accent: var(--bt-accent, #d97757);
  --wrb-accent-ink: var(--bt-accent-ink, #ffffff);
  --wrb-trans: color-mix(in srgb, var(--wrb-ink) 72%, var(--wrb-accent));
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--wrb-bg);
  color: var(--wrb-ink);
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans SC", sans-serif !important;
}
.wrb-top {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--wrb-line);
  background: var(--wrb-sidebar);
  flex: none;
}
.wrb-tab, .wrb-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--wrb-ink);
  border-radius: 8px;
  padding: 6px 11px;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
  font-size: 13px;
  cursor: pointer;
  transition: background-color .12s ease, color .12s ease;
}
.wrb-tab:hover, .wrb-btn:hover:not(:disabled) {
  background: var(--wrb-hover);
}
.wrb-tab[data-active="1"] {
  background: var(--wrb-bubble);
  color: var(--wrb-ink);
  font-weight: 600;
}
.wrb-btn.primary {
  background: var(--wrb-accent);
  color: var(--wrb-accent-ink);
  border-color: transparent;
}
.wrb-btn.primary:hover:not(:disabled) {
  filter: brightness(0.97);
  background: var(--wrb-accent);
}
.wrb-btn[data-active="1"]:not(.primary) {
  background: color-mix(in srgb, var(--wrb-accent) 14%, transparent);
  color: var(--wrb-ink);
  border-color: color-mix(in srgb, var(--wrb-accent) 35%, transparent);
}
.wrb-btn.warn {
  background: color-mix(in srgb, var(--wrb-accent) 18%, var(--wrb-panel));
  border-color: color-mix(in srgb, var(--wrb-accent) 40%, transparent);
  color: var(--wrb-ink);
  font-weight: 600;
}
.wrb-btn:disabled { opacity: 0.4; cursor: default; }
.wrb-btn-toggle {
  border-color: var(--wrb-line-2);
  background: var(--wrb-panel);
  pointer-events: auto;
  position: relative;
  z-index: 2;
}
.wrb-btn-toggle:hover {
  background: var(--wrb-bubble);
}
.wrb-spacer { flex: 1; }
.wrb-meta {
  font-size: 12px;
  color: var(--wrb-muted);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.wrb-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 20px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--wrb-line-2) transparent;
}
.wrb-body::-webkit-scrollbar { width: 10px; }
.wrb-body::-webkit-scrollbar-thumb {
  background: var(--wrb-line-2);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.wrb-body::-webkit-scrollbar-track { background: transparent; }
.wrb-shelf { display: grid; gap: 8px; }
.wrb-book {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--wrb-line);
  border-radius: 12px;
  background: var(--wrb-panel);
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
  transition: background-color .12s ease, border-color .12s ease;
}
.wrb-book:hover {
  background: var(--wrb-bubble);
  border-color: var(--wrb-line-2);
}
.wrb-book img {
  width: 48px; height: 64px; object-fit: cover; border-radius: 6px; background: var(--wrb-bubble);
}
.wrb-book strong { display: block; font-size: 14px; font-weight: 600; }
.wrb-book span { color: var(--wrb-muted); font-size: 12px; font-family: ui-sans-serif, system-ui, sans-serif; }
.wrb-login, .wrb-empty, .wrb-error {
  padding: 20px;
  border: 1px solid var(--wrb-line);
  border-radius: 14px;
  line-height: 1.6;
  background: var(--wrb-panel);
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
}
.wrb-error {
  border-color: color-mix(in srgb, var(--wrb-accent) 45%, var(--wrb-line));
  background: color-mix(in srgb, var(--wrb-accent) 10%, var(--wrb-panel));
  margin-bottom: 12px;
}
.wrb-login h3 { margin: 0 0 8px; font-size: 18px; }
.wrb-login > p { margin: 0 0 14px; color: var(--wrb-muted); font-size: 13px; }
.wrb-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 8px 0 14px;
}
.wrb-qr img {
  width: 240px;
  height: 240px;
  border-radius: 12px;
  border: 1px solid var(--wrb-line);
  background: #fff;
}
.wrb-qr-status, .wrb-qr-placeholder {
  color: var(--wrb-muted);
  font-size: 13px;
  text-align: center;
}
.wrb-qr-placeholder {
  padding: 48px 16px;
  border: 1px dashed var(--wrb-line-2);
  border-radius: 12px;
  margin: 8px 0 14px;
}
.wrb-login-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.wrb-otp {
  display: flex;
  gap: 8px;
  margin: 0 0 12px;
}
.wrb-otp input {
  flex: 1;
  min-width: 0;
  border-radius: 10px;
  border: 1px solid var(--wrb-line-2);
  background: var(--wrb-bg);
  color: inherit;
  padding: 10px 12px;
  font-size: 14px;
}
.wrb-linkish {
  border: 0;
  background: transparent;
  color: var(--wrb-accent);
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.wrb-manual-cookie { margin-top: 12px; }
.wrb-manual-cookie p { margin: 0 0 8px; color: var(--wrb-muted); font-size: 12px; }
.wrb-login textarea {
  width: 100%;
  min-height: 110px;
  margin: 10px 0;
  border-radius: 10px;
  border: 1px solid var(--wrb-line-2);
  background: var(--wrb-bg);
  color: inherit;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.wrb-reader-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
  position: relative;
  z-index: 2;
  pointer-events: auto;
}
.wrb-reader-head h2 {
  margin: 0 8px 0 0;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.01em;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
}
.wrb-chapter-label {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--wrb-muted);
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
}
.wrb-cols {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--wrb-line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--wrb-panel);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--wrb-ink) 4%, transparent);
}
.wrb-cols[data-mode="source"] .wrb-cell-tr { display: none; }
.wrb-cols[data-mode="source"] .wrb-row { grid-template-columns: 1fr; }
.wrb-cols[data-mode="translation"] .wrb-cell-src { display: none; }
.wrb-cols[data-mode="translation"] .wrb-row { grid-template-columns: 1fr; }
.wrb-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
}
.wrb-row:nth-child(even) {
  background: color-mix(in srgb, var(--wrb-bubble) 55%, transparent);
}
.wrb-row[data-active="1"] {
  background: color-mix(in srgb, var(--wrb-accent) 8%, var(--wrb-panel));
}
.wrb-cell {
  padding: 14px 16px;
  border-bottom: 1px solid var(--wrb-line);
  line-height: 1.75;
  font-size: 15px;
}
.wrb-row:last-child .wrb-cell { border-bottom: none; }
.wrb-cell-src {
  border-right: 1px solid var(--wrb-line);
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans SC", sans-serif !important;
  color: var(--wrb-ink);
}
.wrb-cell-tr {
  color: var(--wrb-trans);
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
  position: relative;
  min-height: 3em;
}
.wrb-cell-tr[data-theme="dashed"] .wrb-tr-text {
  text-decoration: underline dashed color-mix(in srgb, var(--wrb-accent) 70%, transparent);
  text-underline-offset: 4px;
}
.wrb-cell-tr[data-theme="highlight"] .wrb-tr-text {
  background: color-mix(in srgb, var(--wrb-accent) 18%, transparent);
  border-radius: 4px;
  padding: 0 4px;
  box-decoration-break: clone;
}
.wrb-cell-tr[data-theme="blockquote"] {
  border-left: 3px solid color-mix(in srgb, var(--wrb-accent) 65%, transparent);
  padding-left: 14px;
}
.wrb-cell-tr[data-theme="weakening"] .wrb-tr-text {
  color: var(--wrb-muted);
  font-size: 14px;
}
.wrb-cell-tr[data-theme="mask"] .wrb-tr-text {
  filter: blur(5px);
  transition: filter .15s ease;
  user-select: none;
}
.wrb-row[data-active="1"] .wrb-cell-tr[data-theme="mask"] .wrb-tr-text,
.wrb-cell-tr[data-theme="mask"]:hover .wrb-tr-text {
  filter: none;
  user-select: text;
}
.wrb-cols[data-mode="hover"] .wrb-row:not([data-revealed="1"]) .wrb-tr-body {
  display: none;
}
.wrb-cols[data-mode="hover"] .wrb-row:not([data-revealed="1"]) .wrb-cell-tr::after {
  content: "悬停翻译";
  color: var(--wrb-faint);
  font-size: 12px;
  font-style: italic;
  font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
}
.wrb-cols[data-mode="hover"] .wrb-row[data-revealed="1"] .wrb-cell-tr::after {
  content: none;
}
.wrb-pending {
  color: var(--wrb-faint);
  font-style: italic;
  font-size: 13px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.wrb-actions {
  display: inline-flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.wrb-action {
  border: none;
  background: none;
  color: var(--wrb-accent);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 0;
}
.wrb-toc {
  max-height: 240px;
  overflow: auto;
  margin-bottom: 12px;
  border: 1px solid var(--wrb-line);
  border-radius: 12px;
  background: var(--wrb-panel);
  scrollbar-width: thin;
}
.wrb-toc button {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  border-bottom: 1px solid var(--wrb-line);
  background: transparent;
  color: inherit;
  padding: 9px 12px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
}
.wrb-toc button:hover { background: var(--wrb-hover); }
.wrb-toc button[data-active="1"] {
  background: color-mix(in srgb, var(--wrb-accent) 14%, transparent);
  font-weight: 600;
}
.wrb-bottom-nav {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--wrb-line);
  background: var(--wrb-sidebar);
}
.wrb-page-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--wrb-line);
  background: var(--wrb-panel);
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  flex: none;
}
.wrb-page-btn:hover:not(:disabled) {
  border-color: var(--wrb-line-2);
  background: var(--wrb-bubble);
}
.wrb-page-btn:disabled { opacity: 0.35; cursor: default; }
.wrb-page-info {
  flex: 1;
  min-width: 0;
  text-align: center;
  display: grid;
  gap: 2px;
}
.wrb-page-info strong {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
}
.wrb-page-info span {
  font-size: 11px;
  color: var(--wrb-muted);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.wrb-pause-btn {
  flex: none;
  min-width: 88px;
}
.wrb-toast {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 68px;
  z-index: 5;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--wrb-line-2);
  background: var(--wrb-panel);
  color: var(--wrb-ink);
  font-size: 12px;
  font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif !important;
  box-shadow: 0 8px 24px rgba(31, 30, 27, 0.08);
  pointer-events: none;
}
`

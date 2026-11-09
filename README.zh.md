# dsh-weread-bilingual

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**微信读书双语阅读**插件。

在 DSH **右侧栏**打开书架与章节，用当前默认模型**逐句**译成英文，并尽量同步微信读书阅读时长。理念是：**在自己感兴趣的文本语境里学英语**。

> **插件市场 / 安装器请搜索或粘贴完整包名：**
>
> ```text
> dsh-weread-bilingual
> ```

## 功能

- 右侧栏：书架 + 章节阅读
- 中英左右对照
- 显示模式：**Hover（悬停才译）** / 双语常显 / 仅原文 / 仅译文
- 译文样式：Plain / Dashed / Highlight / Quote / Weak / Mask
- 双语模式下空格可暂停自动翻译
- **Save MD**：导出当前章双语 Markdown 表格
- 阅读时长心跳（Weread `/web/book/read`）

## 环境

- DeepSeek Harness `0.2.x`（`>=0.2.1-rc.5 <0.3.0`）
- Node.js 24.9+
- 微信读书账号（Cookie 登录）
- 已配置的 DSH 模型

## 安装（插件市场 / Desktop）

1. 打开 DSH **插件市场 / 插件安装**。
2. 搜索或粘贴：`dsh-weread-bilingual`
3. 安装后**完全退出并重启** Desktop（或重启 `dsh web` 后强刷页面）。

### 命令行

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual
```

```sh
dsh plugin --profile web add -w dsh-weread-bilingual
```

### 直接从 GitHub 安装（尚未发 npm 或临时使用）

```sh
dsh plugin --profile desktop add -w github:zoeyzhang233666/dsh-weread-bilingual
```

## 使用

1. 右侧栏 guide 打开 **微信读书双语**。
2. 粘贴 weread.qq.com 的请求 Cookie 并保存（只存在当前 DSH profile）。
3. 从书架打开书籍。
4. 默认 **Hover**：悬停句子才翻译；工具栏可切换 Mode / Theme。
5. **Save MD** 导出当前章原文与译文。

## 风险说明

- 微信读书无公开官方 API，接口可能变更。
- Cookie 等同登录态，勿提交到仓库。
- 阅读时长与官方 App 对齐为尽力而为。
- 翻译会消耗 DSH 模型额度。

## 开发

```sh
npm test
npm run build
npm run pack:dist
```

## 许可

MIT。详见 `LICENSE` 与 `NOTICE`。

# dsh-weread-bilingual

[中文](./README.md) | [English](./README.en.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**微信读书双语阅读**插件。

在 DSH **右侧栏**打开书架与章节，用当前默认模型**逐句**译成英文，并尽量同步微信读书阅读时长。理念是：**在自己感兴趣的文本语境里学英语**。

> **插件市场 / 安装器请搜索或粘贴完整包名：**
>
> ```text
> dsh-weread-bilingual
> ```

## 功能

- 右侧栏：书架 + 章节阅读
- **微信扫码登录**（无需 F12 复制 Cookie；支持自动续期）
- 中英左右对照
- 显示模式：**Hover（悬停才译）** / 双语常显 / 仅原文 / 仅译文
- 译文样式：Plain / Dashed / Highlight / Quote / Weak / Mask
- 双语模式下空格可暂停自动翻译
- **Save MD**：导出当前章双语 Markdown 表格
- **翻译模型**：书架页可切换供应商/模型（插件本地偏好；自动避开无 Key 的官方路由）
- 阅读时长心跳（Weread `/web/book/read`）

## 环境

- DeepSeek Harness `0.2.x`（`>=0.2.1-rc.5 <0.3.0`）
- Node.js 24.9+
- 微信读书账号（扫码登录，或手动 Cookie）
- 已配置的 DSH 模型

## 安装

包已发布到 npm：[`dsh-weread-bilingual`](https://www.npmjs.com/package/dsh-weread-bilingual)。

> 这是 **DSH 插件**，不要用普通的 `npm install -g` 当全局工具装。  
> 正确方式是让 DSH 的插件安装器去拉这个包名（底层会从 npm 下载）。

### 插件市场 / Desktop

1. 打开 DSH **插件市场 / 插件安装**。
2. 搜索或粘贴：`dsh-weread-bilingual`
3. 安装后**完全退出并重启** Desktop（或重启 `dsh web` 后强刷页面）。

### 命令行（推荐，从 npm 安装）

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual
```

```sh
dsh plugin --profile web add -w dsh-weread-bilingual
```

指定版本：

```sh
dsh plugin --profile desktop add -w dsh-weread-bilingual@0.1.10
```

升级到最新：再执行一次上面的 `add`（或在市场里更新），然后重启 DSH。

### 从 GitHub 安装（跟 npm 最新版、或临时试分支）

```sh
dsh plugin --profile desktop add -w github:zoeyzhang233666/dsh-weread-bilingual
```

### 本地开发安装

```sh
git clone https://github.com/zoeyzhang233666/dsh-weread-bilingual.git
cd dsh-weread-bilingual
npm install
npm run build
dsh plugin --profile desktop add -w "d:/weread-bilingual-dsh"
```

把最后一行路径换成你本机仓库的绝对路径。

## 使用

1. 右侧栏 guide 打开 **微信读书双语**。
2. 点 **生成二维码**，微信扫码确认登录（Cookie 只存在当前 DSH profile；也可折叠区手动粘贴 Cookie）。
3. 从书架打开书籍。
4. 默认 **Hover**：悬停句子才翻译；工具栏可切换 Mode / Theme。
5. **Save MD** 导出当前章原文与译文。
6. **翻译模型**：书架页「翻译模型」可切换供应商与模型（仅影响本插件；默认优先用可用的 DSH 全局模型，否则自动选第一个可用第三方路由）。API Key 仍在 DSH Models 页配置。

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

设计说明见 `docs/superpowers/specs/`。

## 发布说明

见 [PUBLISH.md](./PUBLISH.md)。

## 许可

MIT。详见 `LICENSE` 与 `NOTICE`（协议约定参考 Folio / touchFish 社区客户端，自行实现）。

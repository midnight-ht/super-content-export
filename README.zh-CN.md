# SuperContentExport 网页内容导出

**[English](README.md)** | **中文文档**

SuperContentExport 是一个独立的 Chrome Manifest V3 插件，用于可视化拾取网页元素，并将选中内容复制或导出为 Markdown，也可以导出为 PNG 图片。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 元素拾取 | 通过蓝色悬停高亮，在网页中可视化选择元素 |
| Markdown 转换 | 支持标题、段落、强调、链接、图片、列表、表格、引用和代码块 |
| 复制 Markdown | 将选中元素的 Markdown 复制到剪贴板 |
| 下载 Markdown | 将选中内容保存为 `.md` 文件 |
| PNG 导出 | 按选中元素当前样式生成 PNG 图片 |
| 长内容截图 | 按视口分块截图并拼接较大的选中区域 |
| 浮层处理 | 原生截图期间临时隐藏重复出现的 `fixed`/`sticky` 页面浮层 |
| 中英文界面 | 通过 Chrome i18n 在简体中文和英文之间切换 |

## 安装方法

### 方式一：CRX 文件

1. 构建或下载 `super-content-export-vX.X.X.crx`。
2. 打开 `chrome://extensions/`，开启**开发者模式**。
3. 将 `.crx` 文件拖入扩展程序页面，并确认安装。

Chrome 可能提示扩展不是来自应用商店；如果当前环境允许直接安装 CRX，请按 Chrome 当前界面的确认流程操作。

### 方式二：ZIP / 加载未解压扩展

1. 构建或下载 `super-content-export-vX.X.X.zip` 并解压。
2. 打开 `chrome://extensions/`，开启**开发者模式**。
3. 点击**加载已解压的扩展程序**，选择解压后的文件夹。

本地开发时，执行构建后直接选择仓库中的 `dist/` 目录即可。

### 从源码安装

```powershell
npm install
npm run build:plain
```

命令会在项目根目录生成 `dist/`、带版本号的 ZIP 和签名 CRX。随后在 Chrome → 扩展程序 → **加载已解压的扩展程序** 中选择 `dist/`。

## 使用方法

1. 点击 Chrome 工具栏中的 **SuperContentExport** 图标。
2. 点击**选择元素**，将鼠标移动到网页内容上。
3. 点击目标元素，页面顶部会出现导出工具条。
4. 选择**复制 Markdown**、**下载 Markdown** 或**导出 PNG**。
5. 拾取过程中可按 `Esc` 取消，也可以点击工具条中的**取消**。

弹窗会通过本地存储保留最近一次选择的文本和 CSS 选择器，之后可以重复导出，无需再次拾取。

### PNG 导出说明

PNG 导出首先使用克隆 DOM/SVG 的渲染路径。如果跨域资源导致 Canvas 无法导出，插件会移除外部资源后重试，并可回退到浏览器原生的可见标签页截图。较大的选中区域会按视口分块处理，分块之间会留出短暂间隔，以遵守 Chrome 的截图频率限制。

原生截图期间，插件会隐藏自身的工具条和加载层，并临时隐藏计算样式为 `fixed` 或 `sticky` 的页面元素。无论成功还是失败，都会恢复页面原来的滚动位置和浮层样式。

跨域图片、视频、Canvas 内容、浏览器保护页面和其他特殊渲染内容可能无法完整截图。无法进行视觉导出时，建议优先使用 Markdown 导出。

## 项目结构

```text
SuperContentExport/
├── manifest.json            Chrome Manifest V3 配置
├── _locales/
│   ├── en/messages.json     英文字符串
│   └── zh_CN/messages.json  简体中文字符串
├── src/
│   ├── popup/               插件弹窗
│   ├── content/             拾取、Markdown 和 PNG 导出逻辑
│   └── background/          负责可见标签页截图的 Service Worker
├── test/                    Node.js 单元测试
├── icons/                   插件图标（16 / 48 / 128 px）
├── build.js                 构建与打包脚本
└── LICENSE                  非商业 MIT 风格许可证
```

## 构建与测试

```powershell
npm install              # 仅首次需要
npm test                 # 单元测试
npm run build:plain      # 便于本地检查的未混淆构建
npm run build            # 默认的混淆发布构建
```

| 产物 | 用途 |
| --- | --- |
| `dist/` | 可在 Chrome 中加载的扩展目录 |
| `super-content-export-vX.X.X.zip` | ZIP 分发包 |
| `super-content-export-vX.X.X.crx` | 用于直接分发的签名包 |
| `key.pem` | RSA 签名私钥；请备份，替换后会改变扩展 ID |

默认构建会混淆 JavaScript 并压缩 locale JSON。`npm run build:plain` 会设置 `NO_OBFUSCATE=1`，便于本地检查生成文件。

## 权限与兼容性

插件使用 `storage`、`activeTab` 和 `scripting` 权限，并使用拾取功能及可见标签页截图回退所需的 `<all_urls>` 主机访问权限。插件不包含云同步、远程上传、OCR 或外部服务依赖。

浏览器内部页面及其他受保护页面可能拒绝脚本注入或可见标签页截图。这属于浏览器访问限制，不能视为一次成功的导出。

## 开源许可

[MIT License — Non-Commercial](LICENSE)

个人及非商业用途免费使用。商业使用需获得版权所有者的书面授权。联系方式：<ht@zyweb.vip>

![支持开发者](./public/zh%20-%20appreciate.png)

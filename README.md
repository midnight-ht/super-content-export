# SuperContentExport

**English** | **[中文文档](README.zh-CN.md)**

SuperContentExport is a standalone Chrome Manifest V3 extension for picking a webpage element and exporting its content as Markdown or PNG.

## Features

| Feature | Description |
| --- | --- |
| Element picker | Visually select a webpage element with a blue hover highlight |
| Markdown conversion | Convert headings, paragraphs, emphasis, links, images, lists, tables, quotes, and code blocks |
| Copy Markdown | Copy the selected element's Markdown to the clipboard |
| Download Markdown | Save the selected content as a `.md` file |
| PNG export | Render the selected element with its current styles as a PNG |
| Long-page capture | Capture large selections in viewport tiles and stitch them together |
| Overlay handling | Temporarily hide repeated `fixed`/`sticky` page overlays during native capture |
| Bilingual UI | Switches between Simplified Chinese and English through Chrome i18n |

## Installation

### Method 1 — CRX

1. Build or download `super-content-export-vX.X.X.crx`.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Drag the `.crx` file onto the extensions page and confirm the installation.

Chrome may warn that the extension is not from the Web Store. Follow Chrome's current confirmation flow if direct CRX installation is allowed in your environment.

### Method 2 — ZIP / unpacked extension

1. Build or download `super-content-export-vX.X.X.zip` and extract it.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder.

For local development, select the repository's `dist/` directory after running the build.

### From source

```powershell
npm install
npm run build:plain
```

The command creates `dist/`, a versioned ZIP, and a signed CRX in the project root. Load `dist/` through Chrome → Extensions → **Load unpacked**.

## Usage

1. Click the **SuperContentExport** icon in the Chrome toolbar.
2. Click **Select element** and move the pointer over the page.
3. Click the target element. The page toolbar then provides the export actions.
4. Choose **Copy Markdown**, **Download Markdown**, or **Export PNG**.
5. Press `Esc` while picking, or click **Cancel** in the toolbar, to leave selection mode.

The popup also keeps the latest selection's text and selector locally so that the export buttons can be used again without picking the element a second time.

### PNG export behavior

PNG export first uses a cloned DOM/SVG rendering path. If cross-origin resources taint the canvas, the extension retries without external resources and can fall back to native visible-tab screenshots. Large selections are captured in viewport tiles, with a short delay between captures to stay within Chrome's screenshot limits.

During native capture, the extension hides its own toolbar/loading layer and temporarily hides page elements whose computed position is `fixed` or `sticky`. The original page scroll position and page overlay styles are restored after success or failure.

Cross-origin images, video, canvas content, browser-protected pages, and other special page-rendered content may not be captured completely. Markdown export is the safer fallback when visual capture is unavailable.

## Project structure

```text
SuperContentExport/
├── manifest.json            Chrome Manifest V3 configuration
├── _locales/
│   ├── en/messages.json     English strings
│   └── zh_CN/messages.json  Simplified Chinese strings
├── src/
│   ├── popup/               Extension popup
│   ├── content/             Picker, Markdown, and PNG export logic
│   └── background/          Service worker for visible-tab capture
├── test/                    Node.js unit tests
├── icons/                   Extension icons (16 / 48 / 128 px)
├── build.js                 Build and packaging script
└── LICENSE                  Non-commercial MIT-style license
```

## Build and test

```powershell
npm install              # first time only
npm test                 # unit tests
npm run build:plain      # readable build for local verification
npm run build            # obfuscated distribution build
```

| Output | Purpose |
| --- | --- |
| `dist/` | Loadable extension directory |
| `super-content-export-vX.X.X.zip` | ZIP distribution package |
| `super-content-export-vX.X.X.crx` | Signed package for direct distribution |
| `key.pem` | RSA signing key; back it up because replacing it changes the extension ID |

The build obfuscates JavaScript by default and minifies locale JSON. `npm run build:plain` sets `NO_OBFUSCATE=1` for easier local inspection.

## Permissions and compatibility

The extension uses `storage`, `activeTab`, and `scripting`, together with `<all_urls>` host access required by the page-side picker and visible-tab capture fallback. It has no cloud sync, remote upload, OCR, or external service dependency.

Browser-internal pages and other protected pages may reject script injection or visible-tab capture. This is a browser access limitation, not a successful export case.

## License

[MIT License — Non-Commercial](LICENSE)

Free for personal and non-commercial use. Commercial use requires written authorization from the copyright holder. Contact: <ht@zyweb.vip>

![Support the developer](./public/en%20-%20appreciate.png)

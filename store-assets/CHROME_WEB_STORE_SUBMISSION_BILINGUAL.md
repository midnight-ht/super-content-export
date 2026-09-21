# Chrome Web Store 提交文案（中英文对照）

用途：把中文和英文放在同一份文档中，直接复制到 Chrome Web Store Developer Dashboard。

> 说明：本文档按当前 `manifest.json` 和实际代码整理。插件不支持 XML 导出，因此所有文案只宣传复制 Markdown、导出 Markdown、导出 PNG 和长图处理。

## 一、商品详情 / Product details

### 1. 名称 / Name

中文：

```text
SuperContentExport 网页内容导出
```

English:

```text
SuperContentExport
```

### 2. 简短描述 / Short description

中文：

```text
可视化选择网页内容，复制或导出 Markdown，也可以保存为 PNG 图片。
```

English:

```text
Select webpage content to copy or download Markdown, or export it as PNG.
```

### 3. 产品详情 / Detailed description

中文：

```text
SuperContentExport 可以让你在网页中直接选择目标元素，并快速转换为便于保存和继续编辑的内容。

功能特点：

• 通过蓝色悬停高亮，在网页中可视化选择元素。
• 将选中内容复制为 Markdown，或下载为 .md 文件。
• 按选中元素当前样式导出 PNG 图片。
• 对较长内容按视口分块截图并拼接成长图。
• 原生截图期间临时隐藏重复出现的固定或吸顶浮层。
• 在英文和简体中文界面之间切换。

Markdown 转换支持标题、段落、强调、链接、图片、列表、表格、引用和代码块，导出后可以直接继续编辑和整理。

插件在浏览器本地处理内容，不包含云同步、OCR、数据分析、远程上传或外部服务依赖。浏览器内部页面及其他受保护页面可能因浏览器访问限制而无法注入脚本或执行可见标签页截图。
```

English:

```text
SuperContentExport lets you select a webpage element and turn it into portable content in a few clicks.

What it does:

• Visually pick a webpage element with a blue hover highlight.
• Copy the selection as Markdown or download it as a .md file.
• Export the selection as a PNG while preserving its current page styling.
• Capture long selections in viewport tiles and stitch them into one image.
• Temporarily hide repeated fixed or sticky overlays during native capture.
• Switch between English and Simplified Chinese in the extension UI.

Markdown conversion covers headings, paragraphs, emphasis, links, images, lists, tables, quotes, and code blocks, so the exported content is ready to continue editing in a Markdown workflow.

The extension processes content locally in the browser. It does not include cloud sync, OCR, analytics, remote upload, or an external service dependency. Browser-internal and other protected pages may reject script injection or visible-tab capture because of browser access restrictions.
```

### 4. 类别 / Category

中文：

```text
生产力工具
```

English:

```text
Productivity
```

### 5. 商店图标 / Store icon

- 统一图标：[icon-128.png](E:/project/plug-in/SuperContentExport/store-assets/icon-128.png)
- 尺寸：128×128

### 6. 以当地语言显示的屏幕截图 / Localized screenshots

| 语言 / Locale | 商城截图 / Screenshot | 尺寸 / Size |
| --- | --- | --- |
| English (en-US) | [en-US-01.png](E:/project/plug-in/SuperContentExport/store-assets/screenshots/en-US-01.png) | 1280×800 |
| 简体中文 (zh-CN) | [zh-CN-01.png](E:/project/plug-in/SuperContentExport/store-assets/screenshots/zh-CN-01.png) | 1280×800 |

### 7. 其他商品图 / Other promotional images

| 语言 / Locale | 小宣传图 / Small tile | 横幅图 / Marquee |
| --- | --- | --- |
| English (en-US) | [en-US-small-tile.png](E:/project/plug-in/SuperContentExport/store-assets/promotional/en-US-small-tile.png) | [en-US-marquee.png](E:/project/plug-in/SuperContentExport/store-assets/promotional/en-US-marquee.png) |
| 简体中文 (zh-CN) | [zh-CN-small-tile.png](E:/project/plug-in/SuperContentExport/store-assets/promotional/zh-CN-small-tile.png) | [zh-CN-marquee.png](E:/project/plug-in/SuperContentExport/store-assets/promotional/zh-CN-marquee.png) |

## 二、隐私权 / Privacy practices

### 1. 单一用途 / Single purpose

中文：

```text
可视化选择用户指定的网页元素，并在本地将其复制或导出为 Markdown 或 PNG。
```

English:

```text
Visually select a user-chosen webpage element and locally copy or export it as Markdown or PNG.
```

### 2. 权限理由 / Permission justifications

#### Storage

中文：

```text
用于在 Chrome 本地扩展存储中保存最近一次选择的 CSS 选择器、少量预览文本和来源页面 URL，以便用户在同一页面继续定位和导出；同时保存用户选择的界面语言。数据不会上传到远程服务器。
```

English:

```text
Used to store the latest selection's CSS selector, a short preview, and the source page URL in Chrome local extension storage so the user can locate and export the selection again on the same page. It also stores the user's interface language. The data is not uploaded to a remote server.
```

#### activeTab

中文：

```text
用户点击插件并主动开始操作后，用于访问当前标签页，以便选择网页元素、读取选中内容并执行复制或导出。插件不会在用户未发起操作时读取标签页内容。
```

English:

```text
Used to access the current tab after the user starts an action from the extension, so the extension can select webpage elements, read the selected content, and perform the requested copy or export. The extension does not read tab content without a user-initiated action.
```

#### scripting

中文：

```text
用于在用户主动选择或导出时，将元素拾取、Markdown 转换和 PNG 导出逻辑注入当前网页，并显示页面内的导出工具条。
```

English:

```text
Used to inject the element picker, Markdown conversion, and PNG export logic into the current webpage when the user starts a selection or export action, and to display the page export toolbar.
```

#### Host permissions: <all_urls>

中文：

```text
元素拾取和导出功能需要在用户选择使用插件的网页上运行。该权限用于读取用户主动选中的网页元素、转换其内容并执行 PNG 截图回退；浏览器内部页面和受保护页面仍受 Chrome 限制，插件不会绕过这些限制。
```

English:

```text
The element picker and export features need to run on webpages where the user chooses to use the extension. This access is used to read the webpage element selected by the user, convert its content, and provide the PNG screenshot fallback. Browser-internal and protected pages remain restricted by Chrome; the extension does not bypass those restrictions.
```

### 3. 远程代码 / Remote code

后台选项：选择 **否 / No**。

中文说明：

```text
插件不加载或执行远程托管的 JavaScript、Wasm 或其他远程代码。所有扩展逻辑都打包在提交的扩展程序中；插件内的 fetch 仅用于读取扩展包自身的本地语言资源。
```

English:

```text
The extension does not load or execute remotely hosted JavaScript, Wasm, or other remote code. All extension logic is bundled in the submitted package. The fetch calls used by the extension only read local language resources bundled inside the extension.
```

### 4. 数据使用 / Data usage

#### 建议勾选的数据类型 / Recommended data types

| 后台选项 / Dashboard option | 中文理由 / Chinese rationale | English rationale |
| --- | --- | --- |
| 网站内容 / Website content | 插件只在用户主动选择元素后读取和转换网页内容，用于复制 Markdown、下载 Markdown 或生成 PNG；内容只在本地处理，不上传或出售。 | The extension reads and converts webpage content only after the user selects an element, to copy Markdown, download Markdown, or generate a PNG. The content is processed locally and is not uploaded or sold. |
| 网络记录 / Web browsing activity | 插件读取并短暂保存来源页面 URL，用于判断最近一次选择是否属于当前页面，避免在错误页面重新使用选择结果；不建立浏览历史、不做分析或跟踪。 | The extension reads and stores the source page URL with the local selection so it can verify that the selection belongs to the current page. It does not build browsing history, perform analytics, or track browsing activity. |

建议不要勾选：个人身份信息、健康信息、财务和付款信息、身份验证信息、个人通讯、位置、用户活动，除非后续代码或产品行为发生变化。

Do not select the following unless the product behavior changes: personal information, health information, financial and payment information, authentication information, personal communications, location, or user activity.

#### 三项数据使用声明 / Three data-use certifications

后台三项声明均应勾选。中英文含义如下：

1. 中文：我不会将用户数据出售或转让给第三方，但 Chrome Web Store Limited Use 要求允许的情况除外。  
   English: I will not sell or transfer user data to third parties, other than as permitted by the Limited Use requirements.
2. 中文：我不会将用户数据用于或转让给与本产品单一用途无关的目的。  
   English: I will not use or transfer user data for purposes that are unrelated to my item's single purpose.
3. 中文：我不会使用或转让用户数据来确定信用度或用于贷款。  
   English: I will not use or transfer user data to determine creditworthiness or for lending purposes.

### 5. 隐私政策 URL / Privacy policy URL

当前仓库只有隐私政策草稿，尚未提供公开可访问 URL。发布前需要把对应内容发布到产品主页或独立隐私政策页面，再将公开 HTTPS 地址填入后台：

- [英文隐私披露草稿](E:/project/plug-in/SuperContentExport/store-assets/PRIVACY.en-US.md)
- [中文隐私披露草稿](E:/project/plug-in/SuperContentExport/store-assets/PRIVACY.zh-CN.md)
- 后台待填：`[公开可访问的隐私政策 HTTPS URL]`

## 三、主页与支持 / Homepage and support

```text
https://github.com/midnight-ht/super-content-export
```

## 四、提交前核对 / Pre-submit checklist

- [ ] 英文语言区域使用英文名称、英文描述、英文截图。
- [ ] 简体中文语言区域使用中文名称、中文描述、中文截图。
- [ ] 图标使用 `icon-128.png`。
- [ ] 数据类型至少核对“网站内容”和“网络记录/网络活动”是否与当前后台字段对应。
- [ ] 四项权限理由与当前 `manifest.json` 一致：`storage`、`activeTab`、`scripting`、`<all_urls>`。
- [ ] 远程代码选择“否”。
- [ ] 三项 Limited Use 声明全部勾选。
- [ ] 隐私政策 URL 已替换为公开可访问的 HTTPS 地址。
- [ ] 未宣传 XML 或其他尚未实现的导出格式。

## 官方参考 / Official references

- [Privacy practices fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data Policy](https://developer.chrome.com/docs/webstore/user_data)
- [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

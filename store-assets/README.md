# Chrome Web Store 物料

这套物料对应当前 `manifest.json` 的 SuperContentExport v0.1.0，已按英文和简体中文分开整理。

快速复制中英文商品详情、权限理由和隐私字段：请打开 [Chrome Web Store 提交文案（中英文对照）](./CHROME_WEB_STORE_SUBMISSION_BILINGUAL.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| `icon-128.png` | 商城图标，128×128 |
| `source/` | 用户提供的原始中英文弹窗截图，保留原始尺寸 |
| `screenshots/` | 商城截图，1280×800，每种语言 1 张 |
| `promotional/` | 中英文 440×280 小宣传图和 1400×560 横幅宣传图 |
| `listing.en-US.md` | 英文标题、描述、权限与隐私文案 |
| `listing.zh-CN.md` | 中文标题、描述、权限与隐私文案 |
| `PRIVACY.en-US.md` | 英文隐私披露，可用于隐私字段或隐私政策页面草稿 |
| `PRIVACY.zh-CN.md` | 中文隐私披露，可用于隐私字段或隐私政策页面草稿 |
| `../scripts/build-store-assets.ps1` | 重新生成截图和宣传图的脚本 |

## 上传顺序

1. 上传 `icon-128.png` 作为商城图标。
2. 英文语言区域上传 `screenshots/en-US-01.png` 和 `promotional/en-US-small-tile.png`；如需要再上传 `promotional/en-US-marquee.png`。
3. 简体中文语言区域上传 `screenshots/zh-CN-01.png` 和 `promotional/zh-CN-small-tile.png`；如需要再上传 `promotional/zh-CN-marquee.png`。
4. 将对应语言的 `listing.*.md` 内容填入名称、简短描述、详细描述、分类和支持链接。
5. 按商城隐私字段要求核对 `PRIVACY.*.md`，并以实际发布账号的隐私政策地址为准；本仓库没有代替正式隐私政策页面的外部 URL。

## 物料边界

`source/` 下的截图来自用户提供的 `E:\项目\插件\浏览器\内容导出\英文截图.png` 和 `中文截图.png`。`promotional/` 中的视觉物料只使用 SuperContentExport 当前图标、界面截图和已核对的功能文案；没有复用同目录中属于 TextSwap 的旧海报。

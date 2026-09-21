# Chrome Web Store listing — English

## Product details

- **Name:** SuperContentExport
- **Short description:** Select webpage content to copy or download Markdown, or export it as PNG.
- **Category suggestion:** Productivity
- **Language:** English
- **Homepage / support:** https://github.com/midnight-ht/super-content-export

## Full description

SuperContentExport lets you select a webpage element and turn it into portable content in a few clicks.

### What it does

- Visually pick a webpage element with a blue hover highlight.
- Copy the selection as Markdown or download it as a `.md` file.
- Export the selection as a PNG while preserving its current page styling.
- Capture long selections in viewport tiles and stitch them into one image.
- Temporarily hide repeated fixed or sticky overlays during native capture.
- Switch between English and Simplified Chinese in the extension UI.

Markdown conversion covers headings, paragraphs, emphasis, links, images, lists, tables, quotes, and code blocks, so the exported content is ready to continue editing in a Markdown workflow.

The extension works locally in the browser. It does not include cloud sync, OCR, analytics, remote upload, or an external service dependency. Browser-internal and other protected pages may reject script injection or visible-tab capture because of browser access restrictions.

## Permission explanation

- **Storage:** Keeps the latest selection and interface language in Chrome local extension storage.
- **Active tab:** Lets the user invoke selection and export actions on the current tab.
- **Scripting:** Injects the picker and export logic into the current webpage after the user starts an action.
- **Website access:** The picker and screenshot fallback need access to webpages where the user chooses to use the extension. Protected browser pages remain unavailable.

## Privacy statement

SuperContentExport stores the latest selected text, selector, and interface language locally in Chrome extension storage. It does not send webpage content or settings to a remote server, use analytics, or sell user data. Exported Markdown and PNG files are written to the user's local download flow.

## License note

Free for personal and non-commercial use under the repository's MIT License — Non-Commercial terms. Commercial use requires written authorization from the copyright holder.

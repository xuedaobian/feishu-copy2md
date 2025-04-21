# Feishu Doc to Markdown Exporter

A simple Chrome extension to extract content from a Feishu (Lark) document page and convert it into Markdown format.

## Features

*   Extracts text blocks, headings (H1-H6), code blocks (including language and caption), and bookmarks (links).
*   Attempts to preserve basic inline formatting like bold and italics within text blocks.
*   Handles scrolling for long documents to ensure most content is captured.
*   Copies the extracted Markdown to the clipboard automatically.
*   Provides basic status updates and error handling in the popup.

## How to Use

1.  **Load the Extension:**
    *   Clone or download this repository.
    *   Open Chrome and navigate to `chrome://extensions/`.
    *   Enable "Developer mode" in the top right corner.
    *   Click "Load unpacked" and select the directory containing the extension files (the one with `manifest.json`).
2.  **Extract Content:**
    *   Navigate to the Feishu document page you want to export (URL should contain `feishu.cn/`).
    *   Click the extension icon (usually near the address bar).
    *   Click the "Extract Content" button in the popup.
    *   The extension will scroll through the page, extract the content, and display the resulting Markdown in the text area.
    *   The Markdown will also be automatically copied to your clipboard.

## Limitations

*   **Image Handling:** Currently, images are not extracted. A placeholder `![Image Placeholder - 图片占位符]` is inserted instead.
*   **Complex Formatting:** Does not handle all Feishu formatting types (e.g., tables, lists might not be perfect, inline code, strikethrough). Inline style detection (bold/italic) relies on specific CSS classes or styles used by Feishu, which might change.
*   **Dynamic Content:** May have issues with highly dynamic or complex block types not explicitly handled.
*   **Performance:** Extraction on very long documents might take a few seconds due to the scrolling mechanism.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

一个将飞书文档转化markdown格式等chrome插件！

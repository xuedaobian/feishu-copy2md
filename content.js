console.log("飞书文档提取器内容脚本已加载。");

/**
 * 从标准文本块元素中提取文本内容。
 * 处理包含实际文本和换行标记的 span。
 */
function extractTextBlockContent(element) {
    let content = '';
    const lines = element.querySelectorAll('.ace-line');
    lines.forEach(line => {
        let lineText = '';
        const spans = line.querySelectorAll('span[data-string="true"]');
        spans.forEach(span => {
            // 忽略通常用于换行的零宽度空格字符
            if (!span.hasAttribute('data-enter')) {
                 lineText += span.textContent.replace(/\u200B/g, ''); // 移除零宽度空格
            }
        });
        content += lineText.trim() + '\n'; // 每个 ace-line 添加换行符
    });
    return content.trim(); // 修剪尾随换行符
}

/**
 * 从代码块元素中提取代码内容。
 * 保留行结构。
 */
function extractCodeBlockContent(element) {
    let codeContent = '';
    const languageSpan = element.querySelector('.code-block-header-btn span');
    const language = languageSpan ? languageSpan.textContent.trim().toLowerCase() : '';

    const captionDiv = element.querySelector('.code-block-caption-editor .ace-line');
    const caption = captionDiv ? captionDiv.textContent.replace(/\u200B/g, '').trim() : ''; // 移除零宽度空格

    const lines = element.querySelectorAll('.code-block-content .ace-line');
    lines.forEach(line => {
        // 获取行包装器的原始文本内容，应该保持间距
        const lineWrapper = line.querySelector('.code-line-wrapper');
        // 如果未找到包装器或为空，则回退到行的 textContent
        const lineText = lineWrapper ? lineWrapper.textContent : line.textContent;
        // 如果存在，移除尾随零宽度空格
        codeContent += lineText.replace(/\u200B$/, '') + '\n';
    });

    let markdown = '';
    if (caption) {
        markdown += `*${caption}*\n`; // 斜体化标题
    }
    markdown += '```' + language + '\n';
    markdown += codeContent.trimEnd(); // 从循环中移除潜在的尾随换行符
    markdown += '\n```\n';
    return markdown;
}

/**
 * Extracts content from currently visible blocks within the container
 * and stores it if not already processed.
 * @param {HTMLElement} scrollContainer - The scrolling container element.
 * @param {Set<string>} processedBlockIds - Set of already processed block IDs.
 * @param {string[]} extractedChunks - Array to store the extracted markdown chunks.
 */
function extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks) {
    // Find render wrappers within the currently scrolled container
    const wrappers = scrollContainer.querySelectorAll('.render-unit-wrapper');
    wrappers.forEach(wrapper => {
        const blocks = wrapper.children;
        for (const block of blocks) {
            if (block.matches && block.matches('div[data-block-id]')) {
                const blockId = block.dataset.blockId; // Or block.getAttribute('data-block-id');
                if (blockId && !processedBlockIds.has(blockId)) {
                    let markdownChunk = '';
                    // Check block type and extract
                    if (block.classList.contains('docx-text-block')) {
                        markdownChunk = extractTextBlockContent(block);
                        if (markdownChunk) {
                            markdownChunk += '\n\n'; // Add spacing after text blocks
                        }
                    } else if (block.classList.contains('docx-code-block')) {
                        const codeContainer = block.querySelector('.docx-code-block-container');
                        if (codeContainer) {
                            markdownChunk = extractCodeBlockContent(codeContainer);
                            markdownChunk += '\n'; // Add spacing after code blocks
                        }
                    }
                    // Add other block types here

                    if (markdownChunk) {
                        extractedChunks.push(markdownChunk);
                        processedBlockIds.add(blockId);
                        // console.log(`提取并存储块 ID: ${blockId}`);
                    }
                }
            }
        }
    });
}

/**
 * Incrementally scrolls the container, extracting content as it appears.
 * @param {function} sendResponse - Callback to send results to the popup.
 */
async function scrollAndExtractIncrementally(sendResponse) {
    console.log("查找滚动容器 '.bear-web-x-container'...");
    const scrollContainer = document.querySelector('.bear-web-x-container');

    if (!scrollContainer) {
        console.error("未找到滚动容器 '.bear-web-x-container'。提取将基于当前可见内容。");
        // Fallback or error handling - here we just extract what's visible now
        try {
            const processedBlockIds = new Set();
            const extractedChunks = [];
            extractAndStoreVisibleBlocks(document.body, processedBlockIds, extractedChunks); // Try body as fallback
            sendResponse({ markdown: extractedChunks.join(''), warning: "未找到滚动容器，提取可能不完整。" });
        } catch (error) {
            sendResponse({ error: `提取失败（未找到滚动容器）: ${error.message}` });
        }
        return;
    }

    console.log("开始增量滚动和提取...");
    const processedBlockIds = new Set();
    const extractedChunks = [];
    const scrollDownBy = scrollContainer.clientHeight * 0.8; // Scroll ~80% of viewport height
    let attempts = 0;
    const maxAttempts = 100; // Increased max attempts for potentially very long docs
    let lastScrollTop = -1;

    // Scroll to top first
    scrollContainer.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for potential initial render

    console.log("从顶部开始提取初始可见内容...");
    extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);

    // Loop scrolling down
    while (attempts < maxAttempts) {
        lastScrollTop = scrollContainer.scrollTop;
        scrollContainer.scrollBy(0, scrollDownBy);
        await new Promise(resolve => setTimeout(resolve, 250)); // Wait for content load/render
        let currentScrollTop = scrollContainer.scrollTop;

        // Extract newly visible content
        extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);

        // Check if we've reached the bottom (or stopped scrolling)
        const scrollHeight = scrollContainer.scrollHeight;
        const clientHeight = scrollContainer.clientHeight;
        if (currentScrollTop >= scrollHeight - clientHeight - 10 || currentScrollTop === lastScrollTop) { // Allow small tolerance, check if scroll stopped
             console.log("滚动到达底部或停止。");
             // One final check after reaching the bottom
             await new Promise(resolve => setTimeout(resolve, 300));
             extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);
             break; // Exit loop
        }

        attempts++;
        // console.log(`滚动尝试 #${attempts}, 当前 scrollTop: ${currentScrollTop}`);
    }

    if (attempts >= maxAttempts) {
         console.warn("滚动尝试达到最大次数。提取可能不完整。");
    }

    console.log(`内容提取完成。共处理 ${processedBlockIds.size} 个唯一块。`);
    try {
        const finalMarkdown = extractedChunks.join(''); // Join chunks in the order they were added
        sendResponse({ markdown: finalMarkdown.trim() });
    } catch (error) {
        console.error("组合 Markdown 时出错:", error);
        sendResponse({ error: `组合 Markdown 失败: ${error.message}` });
    }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("收到来自 popup 的消息:", request);
    if (request.action === "scrollToBottomAndExtract") { // Keep action name for now, or update popup.js too
        // 调用增量滚动和提取函数
        scrollAndExtractIncrementally(sendResponse);
        return true; // 表示响应是异步发送的（重要！）
    }
});

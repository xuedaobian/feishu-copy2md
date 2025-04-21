console.log("飞书文档提取器内容脚本已加载。");

/**
 * 处理 .ace-line 元素内的 span，转换内联样式为 Markdown。
 * 注意：需要根据飞书实际使用的 class 或 style 调整加粗/斜体检测逻辑。
 * @param {HTMLElement} lineElement - .ace-line DOM 元素。
 * @returns {string} - 包含内联 Markdown 格式的行文本。
 */
function processAceLine(lineElement) {
  let lineMd = '';
  const spans = lineElement.querySelectorAll('span[data-string="true"]');
  spans.forEach(span => {
    if (span.hasAttribute('data-enter')) {
      // 通常代表换行符或特殊空格，这里选择忽略或根据需要处理
      return;
    }

    let content = span.textContent.replace(/\u200B/g, ''); // 移除零宽度空格
    let prefix = '';
    let suffix = '';

    // --- 样式检测逻辑 (需要根据实际情况调整) ---
    // 示例：检查 class (假设飞书使用类似 'lark-text-bold' 的 class)
    const isBoldClass = span.classList.contains('lark-text-bold'); // 示例 class
    const isItalicClass = span.classList.contains('lark-text-italic'); // 示例 class

    // 示例：检查 style 属性
    const style = span.style;
    const isBoldStyle = style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 700;
    const isItalicStyle = style.fontStyle === 'italic';
    // 可以添加对 inline-code, strikethrough 等的检查

    // 优先处理加粗
    if (isBoldClass || isBoldStyle) {
      prefix += '**';
      suffix = '**' + suffix;
    }
    // 处理斜体 (可以与加粗并存)
    if (isItalicClass || isItalicStyle) {
      prefix += '*';
      suffix = '*' + suffix;
    }
    // --- 结束样式检测逻辑 ---

    lineMd += prefix + content + suffix;
  });
  return lineMd;
}

/**
 * 从标准文本块元素中提取文本内容，并处理内联样式。
 */
function extractTextBlockContent(element) {
  let content = '';
  const lines = element.querySelectorAll('.ace-line');
  lines.forEach(line => {
    content += processAceLine(line) + '\n'; // 使用 processAceLine 处理每一行
  });
  // 移除由连续空行产生的多余换行符，但保留段落间的单个空行
  return content.replace(/\n{3,}/g, '\n\n').trim();
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
 * 从书签块元素中提取链接和标题。
 * @param {HTMLElement} element - 书签块的容器元素 (.docx-bookmark-block).
 * @returns {string} - Markdown 格式的链接，如果找到的话。
 */
function extractBookmarkContent(element) {
  const urlElement = element.querySelector('.docx-bookmark-url');
  const titleElement = element.querySelector('.docx-bookmark-title');

  const url = urlElement ? urlElement.textContent.trim() : '';
  const title = titleElement ? titleElement.textContent.trim() : url; // 如果没有标题，使用 URL 作为标题

  if (url) {
    // 清理标题中的换行符
    const cleanedTitle = title.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim();
    return `[${cleanedTitle}](${url})\n`; // 返回 Markdown 链接格式
  }
  return ''; // 如果没有 URL，返回空字符串
}

/**
 * 从标题块元素中提取内容和级别。
 * @param {HTMLElement} element - 标题块元素 (e.g., .docx-heading1-block).
 * @param {number} level - 标题级别 (1-6).
 * @returns {string} - Markdown 格式的标题。
 */
function extractHeadingContent(element, level) {
  let content = '';
  const lines = element.querySelectorAll('.ace-line');
  lines.forEach(line => {
    content += processAceLine(line); // 处理标题中的内联样式
  });
  const prefix = '#'.repeat(level);
  return `${prefix} ${content.trim()}\n`; // 添加 # 前缀和空格
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
          let processed = false; // 标记是否已处理

          // 检查标题块 (H1-H6)
          for (let level = 1; level <= 6; level++) {
            if (block.classList.contains(`docx-heading${level}-block`)) {
              markdownChunk = extractHeadingContent(block, level);
              if (markdownChunk) {
                markdownChunk += '\n'; // 标题后加一个空行
              }
              processed = true;
              break; // 找到标题级别后退出循环
            }
          }

          // 如果不是标题块，检查其他类型
          if (!processed) {
            if (block.classList.contains('docx-text-block')) {
              markdownChunk = extractTextBlockContent(block);
              if (markdownChunk) {
                markdownChunk += '\n\n'; // 文本块后加两个换行符（保持段落间距）
              }
            } else if (block.classList.contains('docx-code-block')) {
              const codeContainer = block.querySelector('.docx-code-block-container');
              if (codeContainer) {
                markdownChunk = extractCodeBlockContent(codeContainer);
                markdownChunk += '\n'; // 代码块后加一个换行符
              }
            } else if (block.classList.contains('docx-bookmark-block')) {
              markdownChunk = extractBookmarkContent(block);
              if (markdownChunk) {
                markdownChunk += '\n'; // 书签后加一个换行符
              }
            } else if (block.classList.contains('docx-image-block')) { // <-- Add check for image block
              markdownChunk = '![Image Placeholder - 图片占位符]\n\n'; // Add a placeholder for images
            }
            // Add other block types here
          }

          if (markdownChunk) {
            // 避免添加完全是空行的块 (例如空的文本块)
            if (markdownChunk.trim().length > 0) {
              extractedChunks.push(markdownChunk);
              processedBlockIds.add(blockId);
              // console.log(`提取并存储块 ID: ${blockId}`);
            }
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
    // 合并块，并进行最终清理，去除多余的空行
    const finalMarkdown = extractedChunks.join('').replace(/\n{3,}/g, '\n\n').trim();
    sendResponse({ markdown: finalMarkdown });
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

console.log("飞书文档提取器内容脚本已加载。");

/**
 * 处理单个 span 元素，提取文本和样式
 * @param {HTMLElement} span - span 元素
 * @returns {string} - 处理后的 Markdown 文本
 */
function processSpan(span) {
  // 跳过换行标记
  if (span.hasAttribute('data-enter')) {
    return '';
  }

  // 检查是否是链接容器
  const linkContainer = span.closest('.docx-outer-link-container');
  if (linkContainer) {
    const linkElement = linkContainer.querySelector('a[data-link-node="true"]');
    if (linkElement) {
      const href = linkElement.getAttribute('href') || '';
      const text = linkElement.textContent.replace(/\u200B/g, '').trim();
      if (href && text) {
        return `[${text}](${href})`;
      }
      return text;
    }
  }

  let content = span.textContent.replace(/\u200B/g, ''); // 移除零宽度空格

  if (!content) return '';

  let prefix = '';
  let suffix = '';

  // 检查删除线
  const hasStrikeThrough = span.classList.contains('strike-through') ||
    span.style.textDecoration === 'line-through' ||
    span.style.textDecorationLine === 'line-through';

  // 检查下划线
  const hasUnderline = span.classList.contains('underline') ||
    span.style.textDecoration === 'underline' ||
    span.style.textDecorationLine === 'underline' ||
    (span.style.textDecoration && span.style.textDecoration.includes('underline'));

  // 检查背景高亮色
  let highlightColor = null;
  const classList = Array.from(span.classList);
  const bgClass = classList.find(cls => cls.includes('-bg') && cls.includes('text-highlight-background-'));
  if (bgClass) {
    // 从类名提取颜色，如 text-highlight-background-yellow-light-bg -> yellow
    const match = bgClass.match(/text-highlight-background-(\w+)/);
    if (match) {
      highlightColor = match[1].replace(/-light$/, '').replace(/-dark$/, '');
    }
  }
  // 也检查 style 属性中的 background-color
  if (!highlightColor && span.style.backgroundColor) {
    highlightColor = span.style.backgroundColor;
  }

  // 检查加粗
  const style = span.style;
  const isBold = span.classList.contains('lark-text-bold') ||
    style.fontWeight === 'bold' ||
    parseInt(style.fontWeight, 10) >= 700;

  // 检查斜体
  const isItalic = span.classList.contains('lark-text-italic') ||
    style.fontStyle === 'italic';

  // 检查行内代码
  const isCode = span.classList.contains('lark-text-code') ||
    span.closest('.inline-code');

  // 应用样式
  if (isCode) {
    prefix = '`';
    suffix = '`';
  } else {
    if (isBold) {
      prefix += '**';
      suffix = '**' + suffix;
    }
    if (isItalic) {
      prefix += '*';
      suffix = '*' + suffix;
    }
    if (hasStrikeThrough) {
      prefix += '~~';
      suffix = '~~' + suffix;
    }
    if (hasUnderline) {
      // Markdown 没有原生下划线，使用 HTML 标签
      prefix += '<u>';
      suffix = '</u>' + suffix;
    }
    if (highlightColor) {
      // 使用 mark 标签表示背景高亮
      prefix += `<mark style="background: ${highlightColor}">`;
      suffix = '</mark>' + suffix;
    }
  }

  return prefix + content + suffix;
}

/**
 * 处理 .ace-line 元素内的内容，转换内联样式为 Markdown。
 * @param {HTMLElement} lineElement - .ace-line DOM 元素。
 * @returns {string} - 包含内联 Markdown 格式的行文本。
 */
function processAceLine(lineElement) {
  let lineMd = '';
  const processedLinks = new Set();

  // 遍历所有子节点
  const walker = document.createTreeWalker(
    lineElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function (node) {
        if (node.matches && node.matches('span[data-string="true"]')) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  let node;
  while (node = walker.nextNode()) {
    // 检查是否在链接容器内
    const linkContainer = node.closest('.docx-outer-link-container');
    if (linkContainer) {
      const containerId = linkContainer.getAttribute('data-inline-wrapper') || linkContainer.outerHTML.substring(0, 50);
      if (processedLinks.has(containerId)) {
        continue; // 跳过已处理的链接
      }
      processedLinks.add(containerId);

      const linkElement = linkContainer.querySelector('a[data-link-node="true"]');
      if (linkElement) {
        const href = linkElement.getAttribute('href') || '';
        const text = linkElement.textContent.replace(/\u200B/g, '').trim();
        if (href && text) {
          lineMd += `[${text}](${href})`;
        } else {
          lineMd += text;
        }
        continue;
      }
    }

    lineMd += processSpan(node);
  }

  return lineMd;
}

/**
 * 从标准文本块元素中提取文本内容，并处理内联样式。
 */
function extractTextBlockContent(element) {
  let content = '';
  const lines = element.querySelectorAll('.ace-line');
  lines.forEach(line => {
    content += processAceLine(line) + '\n';
  });
  return content.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 从代码块元素中提取代码内容。
 */
function extractCodeBlockContent(element) {
  let codeContent = '';
  const languageSpan = element.querySelector('.code-block-header-btn span');
  let language = languageSpan ? languageSpan.textContent.trim().toLowerCase() : '';

  // Plain Text 不需要标注语言
  if (language === 'plain text') {
    language = '';
  }

  const captionDiv = element.querySelector('.code-block-caption-editor .ace-line');
  const caption = captionDiv ? captionDiv.textContent.replace(/\u200B/g, '').trim() : '';

  const lines = element.querySelectorAll('.code-block-content .ace-line');
  lines.forEach(line => {
    const lineWrapper = line.querySelector('.code-line-wrapper');
    const lineText = lineWrapper ? lineWrapper.textContent : line.textContent;
    codeContent += lineText.replace(/\u200B$/, '') + '\n';
  });

  let markdown = '';
  if (caption) {
    markdown += `*${caption}*\n`;
  }
  markdown += '```' + language + '\n';
  markdown += codeContent.trimEnd();
  markdown += '\n```\n';
  return markdown;
}

/**
 * 从书签块元素中提取链接和标题。
 */
function extractBookmarkContent(element) {
  const urlElement = element.querySelector('.docx-bookmark-url');
  const titleElement = element.querySelector('.docx-bookmark-title');

  const url = urlElement ? urlElement.textContent.trim() : '';
  const title = titleElement ? titleElement.textContent.trim() : url;

  if (url) {
    const cleanedTitle = title.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim();
    return `[${cleanedTitle}](${url})\n`;
  }
  return '';
}

/**
 * 从标题块元素中提取内容和级别。
 */
function extractHeadingContent(element, level) {
  let content = '';
  const lines = element.querySelectorAll('.ace-line');
  lines.forEach(line => {
    content += processAceLine(line);
  });
  const prefix = '#'.repeat(level);
  return `${prefix} ${content.trim()}\n`;
}

/**
 * 从有序列表块中提取内容
 * @param {HTMLElement} element - docx-ordered-block 元素
 * @returns {string} - Markdown 格式的有序列表项
 */
function extractOrderedListContent(element) {
  // 获取列表序号
  const orderButton = element.querySelector('.order.button');
  let number = '1';
  if (orderButton) {
    const buttonText = orderButton.textContent.trim();
    const match = buttonText.match(/^(\d+)/);
    if (match) {
      number = match[1];
    }
  }

  let content = '';
  const lines = element.querySelectorAll('.list-content .ace-line');
  lines.forEach(line => {
    content += processAceLine(line);
  });

  return `${number}. ${content.trim()}\n`;
}

/**
 * 从无序列表块中提取内容
 * @param {HTMLElement} element - docx-bullet-block 元素
 * @returns {string} - Markdown 格式的无序列表项
 */
function extractBulletListContent(element) {
  let content = '';
  const lines = element.querySelectorAll('.list-content .ace-line');
  lines.forEach(line => {
    content += processAceLine(line);
  });

  return `- ${content.trim()}\n`;
}

/**
 * 从任务列表块中提取内容
 * @param {HTMLElement} element - docx-todo-block 元素
 * @returns {string} - Markdown 格式的任务列表项
 */
function extractTodoContent(element) {
  // 检查是否已完成（通过 checkbox 状态或样式判断）
  const isChecked = element.classList.contains('todo-block_checked') ||
    element.querySelector('.todo-block_checked') !== null ||
    element.querySelector('input[type="checkbox"]:checked') !== null;

  let content = '';
  const lines = element.querySelectorAll('.todo-block_content .ace-line');
  lines.forEach(line => {
    content += processAceLine(line);
  });

  const checkbox = isChecked ? '[x]' : '[ ]';
  return `- ${checkbox} ${content.trim()}\n`;
}

/**
 * 从引用块中提取内容
 * @param {HTMLElement} element - docx-quote_container-block 元素
 * @returns {string} - Markdown 格式的引用
 */
function extractQuoteContent(element) {
  let content = '';
  const textBlocks = element.querySelectorAll('.quote-container-block-children .ace-line');
  textBlocks.forEach(line => {
    const lineContent = processAceLine(line);
    if (lineContent) {
      content += `> ${lineContent}\n`;
    }
  });

  return content || '> \n';
}

/**
 * 从高亮块（callout）中提取内容
 * @param {HTMLElement} element - docx-callout-block 元素
 * @returns {string} - Markdown 格式的引用（带 emoji）
 */
function extractCalloutContent(element) {
  // 获取 emoji
  let emoji = '';
  const emojiElement = element.querySelector('.callout-block-emoji .emoji-mart-emoji-native span');
  if (emojiElement) {
    emoji = emojiElement.textContent.trim();
  }

  let content = '';
  const textBlocks = element.querySelectorAll('.callout-block-children .ace-line');
  textBlocks.forEach(line => {
    const lineContent = processAceLine(line);
    if (lineContent) {
      content += lineContent + '\n';
    }
  });

  // 使用引用格式，带 emoji
  let markdown = '';
  const lines = content.trim().split('\n');
  lines.forEach((line, index) => {
    if (index === 0 && emoji) {
      markdown += `> ${emoji} ${line}\n`;
    } else {
      markdown += `> ${line}\n`;
    }
  });

  return markdown || '> \n';
}

/**
 * 提取分割线
 * @returns {string} - Markdown 分割线
 */
function extractDividerContent() {
  return '---\n';
}

/**
 * 跟踪列表上下文，用于处理连续列表项
 */
const listContext = {
  lastOrderedNumber: 0,
  reset() {
    this.lastOrderedNumber = 0;
  }
};

/**
 * Extracts content from currently visible blocks within the container
 * and stores it if not already processed.
 */
function extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks) {
  // 排除预渲染容器和嵌套容器（callout, quote）内的 render-unit-wrapper
  const wrappers = scrollContainer.querySelectorAll('.render-unit-wrapper');
  wrappers.forEach(wrapper => {
    // 跳过在预渲染容器内的 wrapper
    if (wrapper.closest('.bear-virtual-pre-renderer')) {
      return;
    }
    // 跳过嵌套在 callout 或 quote 内部的 wrapper
    if (wrapper.classList.contains('callout-render-unit') ||
        wrapper.classList.contains('quote-container-render-unit') ||
        wrapper.closest('.callout-block-children') ||
        wrapper.closest('.quote-container-block-children')) {
      return;
    }
    const blocks = wrapper.children;
    for (const block of blocks) {
      if (block.matches && block.matches('div[data-block-id]')) {
        const blockId = block.dataset.blockId;
        if (blockId && !processedBlockIds.has(blockId)) {
          // 检查是否是嵌套在容器块内部的子块，如果是则跳过
          const parentContainer = block.closest('.quote-container-block-children, .callout-block-children');
          if (parentContainer) {
            // 这个块在引用或高亮块内部，跳过单独处理
            continue;
          }

          let markdownChunk = '';
          let processed = false;

          // 检查标题块 (H1-H6)
          for (let level = 1; level <= 6; level++) {
            if (block.classList.contains(`docx-heading${level}-block`)) {
              markdownChunk = extractHeadingContent(block, level);
              if (markdownChunk) {
                markdownChunk += '\n';
              }
              processed = true;
              listContext.reset();
              break;
            }
          }

          if (!processed) {
            // 有序列表
            if (block.classList.contains('docx-ordered-block')) {
              markdownChunk = extractOrderedListContent(block);
              processed = true;
            }
            // 无序列表
            else if (block.classList.contains('docx-bullet-block')) {
              markdownChunk = extractBulletListContent(block);
              processed = true;
              listContext.reset();
            }
            // 任务列表
            else if (block.classList.contains('docx-todo-block')) {
              markdownChunk = extractTodoContent(block);
              processed = true;
              listContext.reset();
            }
            // 引用块
            else if (block.classList.contains('docx-quote_container-block')) {
              markdownChunk = extractQuoteContent(block);
              if (markdownChunk) {
                markdownChunk += '\n';
              }
              // 标记内部子块为已处理
              block.querySelectorAll('[data-block-id]').forEach(child => {
                processedBlockIds.add(child.dataset.blockId);
              });
              processed = true;
              listContext.reset();
            }
            // 高亮块（callout）
            else if (block.classList.contains('docx-callout-block')) {
              markdownChunk = extractCalloutContent(block);
              if (markdownChunk) {
                markdownChunk += '\n';
              }
              // 标记内部子块为已处理
              block.querySelectorAll('[data-block-id]').forEach(child => {
                processedBlockIds.add(child.dataset.blockId);
              });
              processed = true;
              listContext.reset();
            }
            // 分割线
            else if (block.classList.contains('docx-divider-block')) {
              markdownChunk = extractDividerContent();
              markdownChunk += '\n';
              processed = true;
              listContext.reset();
            }
            // 文本块
            else if (block.classList.contains('docx-text-block')) {
              markdownChunk = extractTextBlockContent(block);
              if (markdownChunk) {
                markdownChunk += '\n\n';
              }
              processed = true;
              listContext.reset();
            }
            // 代码块
            else if (block.classList.contains('docx-code-block')) {
              const codeContainer = block.querySelector('.docx-code-block-container');
              if (codeContainer) {
                markdownChunk = extractCodeBlockContent(codeContainer);
                markdownChunk += '\n';
              }
              processed = true;
              listContext.reset();
            }
            // 书签块
            else if (block.classList.contains('docx-bookmark-block')) {
              markdownChunk = extractBookmarkContent(block);
              if (markdownChunk) {
                markdownChunk += '\n';
              }
              processed = true;
              listContext.reset();
            }
            // 图片块
            else if (block.classList.contains('docx-image-block')) {
              markdownChunk = '![Image Placeholder - 图片占位符]\n\n';
              processed = true;
              listContext.reset();
            }
          }

          if (markdownChunk) {
            if (markdownChunk.trim().length > 0) {
              extractedChunks.push(markdownChunk);
              processedBlockIds.add(blockId);
            }
          }
        }
      }
    }
  });
}

/**
 * Incrementally scrolls the container, extracting content as it appears.
 */
async function scrollAndExtractIncrementally(sendResponse) {
  console.log("查找滚动容器 '.bear-web-x-container'...");
  const scrollContainer = document.querySelector('.bear-web-x-container');

  if (!scrollContainer) {
    console.error("未找到滚动容器 '.bear-web-x-container'。提取将基于当前可见内容。");
    try {
      const processedBlockIds = new Set();
      const extractedChunks = [];
      listContext.reset();
      extractAndStoreVisibleBlocks(document.body, processedBlockIds, extractedChunks);
      sendResponse({ markdown: extractedChunks.join(''), warning: "未找到滚动容器，提取可能不完整。" });
    } catch (error) {
      sendResponse({ error: `提取失败（未找到滚动容器）: ${error.message}` });
    }
    return;
  }

  console.log("开始增量滚动和提取...");
  const processedBlockIds = new Set();
  const extractedChunks = [];
  listContext.reset();
  const scrollDownBy = scrollContainer.clientHeight * 0.8;
  let attempts = 0;
  const maxAttempts = 100;
  let lastScrollTop = -1;

  // Scroll to top first
  scrollContainer.scrollTop = 0;
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log("从顶部开始提取初始可见内容...");
  extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);

  // Loop scrolling down
  while (attempts < maxAttempts) {
    lastScrollTop = scrollContainer.scrollTop;
    scrollContainer.scrollBy(0, scrollDownBy);
    await new Promise(resolve => setTimeout(resolve, 250));
    let currentScrollTop = scrollContainer.scrollTop;

    extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);

    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    if (currentScrollTop >= scrollHeight - clientHeight - 10 || currentScrollTop === lastScrollTop) {
      console.log("滚动到达底部或停止。");
      await new Promise(resolve => setTimeout(resolve, 300));
      extractAndStoreVisibleBlocks(scrollContainer, processedBlockIds, extractedChunks);
      break;
    }

    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.warn("滚动尝试达到最大次数。提取可能不完整。");
  }

  console.log(`内容提取完成。共处理 ${processedBlockIds.size} 个唯一块。`);
  try {
    const finalMarkdown = extractedChunks.join('').replace(/\n{3,}/g, '\n\n').trim();
    sendResponse({ markdown: finalMarkdown });
  } catch (error) {
    console.error("组合 Markdown 时出错:", error);
    sendResponse({ error: `组合 Markdown 失败: ${error.message}` });
  }
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("收到来自 popup 的消息:", request);
  if (request.action === "scrollToBottomAndExtract") {
    scrollAndExtractIncrementally(sendResponse);
    return true;
  }
});

console.log("Content script executing..."); // Log script start

// --- IMPORTANT: Define the CSS selector for the target HTML area ---
const TARGET_SELECTOR = '.bear-virtual-container'; // Higher-level container for Feishu docs

// Add CSS styles for the floating copy buttons
function addStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .td-copy-button {
      position: absolute;
      top: -10px;
      right: -10px;
      background-color: rgba(0, 120, 212, 0.8);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .root-render-unit-container {
      position: relative;
    }
    .root-render-unit-container:hover .td-copy-button {
      opacity: 1;
    }
    .td-copy-button:hover {
      background-color: rgba(0, 120, 212, 1);
    }
    .td-copy-button:active {
      transform: scale(0.95);
    }
    .td-copy-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10000;
      animation: fadeIn 0.3s, fadeOut 0.3s 1.7s;
      animation-fill-mode: forwards;
    }
    .td-progress-toast {
      position: fixed;
      bottom: 70px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10000;
    }
    .td-capture-all-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 120, 212, 0.9);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(styleElement);
}

// Add a button to manually capture all document content
function addCaptureAllButton() {
  const captureButton = document.createElement('button');
  captureButton.className = 'td-capture-all-button';
  captureButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
    </svg>
    Capture Full Document
  `;

  captureButton.addEventListener('click', function() {
    captureEntireDocument();
  });

  document.body.appendChild(captureButton);
}

// Function to add copy buttons to visible containers
function addCopyButtonsToContainers() {
  const containers = document.querySelectorAll('.root-render-unit-container');
  console.log(`Found ${containers.length} visible container elements`);
  
  containers.forEach((container, index) => {
    // Skip if this container already has a copy button
    if (container.querySelector('.td-copy-button')) {
      return;
    }

    // Add position relative if not already set
    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    
    // Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'td-copy-button';
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle;">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
      </svg>
    `;
    copyButton.title = 'Copy this section';
    
    // Add click handler
    copyButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      copySpecificContainer(container);
    });
    
    container.appendChild(copyButton);
  });
}

// Utility function: Debounce to limit frequent calls
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Global document mapping to track all paragraphs across the document
const documentMap = {
  paragraphs: new Map(), // Maps paragraph identifier to content and metadata
  orderedIds: [],        // Maintains paragraph order
  isCapturing: false,
  lastKnownBlockCount: 0,
  mainScrollElement: null,
  progressToast: null,
  maxScrollPosition: 0,
  currentDocumentUrl: window.location.href // Record current document URL
};

// Monitor document changes
function monitorDocumentChanges() {
  let lastUrl = window.location.href;

  window.addEventListener('popstate', () => {
    checkForDocumentChange();
  });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(this, arguments);
    checkForDocumentChange();
  };

  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    checkForDocumentChange();
  };

  setInterval(checkForDocumentChange, 1000);

  function checkForDocumentChange() {
    const currentUrl = window.location.href;

    if (currentUrl !== lastUrl && getUrlWithoutHash(currentUrl) !== getUrlWithoutHash(lastUrl)) {
      console.log('Document change detected:', lastUrl, '->', currentUrl);

      lastUrl = currentUrl;
      documentMap.currentDocumentUrl = currentUrl;

      resetDocumentMapping();

      setTimeout(() => {
        initDocumentMapping();
        console.log('Document mapping reinitialized after document change');
      }, 1000);
    }
  }

  function getUrlWithoutHash(url) {
    return url.split('#')[0];
  }
}

// Reset document mapping
function resetDocumentMapping() {
  documentMap.paragraphs.clear();
  documentMap.orderedIds = [];
  documentMap.lastKnownBlockCount = 0;
  documentMap.isCapturing = false;

  if (documentMap.progressToast) {
    document.body.removeChild(documentMap.progressToast);
    documentMap.progressToast = null;
  }

  window.capturedMarkdown = null;

  console.log('Document mapping reset');
}

// Initialize document mapping and set up tracking
function initDocumentMapping() {
  documentMap.mainScrollElement = document.querySelector('.page-main') || document;

  const blockObserver = new MutationObserver(handleBlockMutations);
  blockObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  captureVisibleBlocks();

  documentMap.mainScrollElement.addEventListener('scroll', debounce(() => {
    if (!documentMap.isCapturing) {
      captureVisibleBlocks();
    }
  }, 300));

  console.log('Document mapping initialized with scroll element:', documentMap.mainScrollElement);
}

// Handle mutations to track block additions and changes
function handleBlockMutations(mutations) {
  if (documentMap.isCapturing) return;

  let blockChanges = false;

  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        if (node.classList && node.classList.contains('docx-text-block')) {
          blockChanges = true;
        } else if (node.querySelectorAll) {
          const blocks = node.querySelectorAll('.docx-text-block');
          if (blocks.length > 0) blockChanges = true;
        }
      });
    } else if (mutation.type === 'characterData') {
      const targetNode = mutation.target.parentNode;
      if (targetNode && targetNode.closest && targetNode.closest('.docx-text-block')) {
        blockChanges = true;
      }
    }
  });

  if (blockChanges) {
    captureVisibleBlocks();
  }
}

// 优化版的块捕获函数
function captureVisibleBlocks() {
  const textBlocks = document.querySelectorAll('.docx-text-block');
  const codeBlocks = document.querySelectorAll('.docx-code-block');

  const totalBlockCount = textBlocks.length + codeBlocks.length;
  if (totalBlockCount === documentMap.lastKnownBlockCount && 
      documentMap.paragraphs.size > 0) {
    return;
  }

  documentMap.lastKnownBlockCount = totalBlockCount;

  const allBlocks = [...textBlocks, ...codeBlocks];
  const blockBatches = splitIntoBatches(allBlocks, 20);
  const newOrderedIds = [];

  blockBatches.forEach(batch => {
    processBatch(batch, newOrderedIds);
  });

  if (newOrderedIds.length > 0) {
    documentMap.orderedIds = mergeOrderedArrays(documentMap.orderedIds, newOrderedIds);
  }

  documentMap.maxScrollPosition = Math.max(
    documentMap.mainScrollElement.scrollHeight, 
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
}

// 性能优化：批量处理块
function processBatch(blocks, newOrderedIds) {
  blocks.forEach(block => {
    const blockPosition = block.getBoundingClientRect().top + documentMap.mainScrollElement.scrollTop;
    const blockContent = block.textContent.trim().substring(0, 50);
    const blockHash = fastHash(blockContent + blockPosition.toString().substring(0, 8));

    if (documentMap.paragraphs.has(blockHash)) {
      newOrderedIds.push(blockHash);
      return;
    }

    try {
      if (!turndownService) return;

      let markdownContent;
      const isCodeBlock = block.classList.contains('docx-code-block');

      if (isCodeBlock) {
        markdownContent = processCodeBlock(block);
      } else {
        markdownContent = processTextBlock(block);
      }

      documentMap.paragraphs.set(blockHash, {
        content: markdownContent,
        position: blockPosition,
        isEmpty: block.classList.contains('isEmpty'),
        type: isCodeBlock ? 'code' : 'text'
      });

      newOrderedIds.push(blockHash);
    } catch (e) {
      console.error("处理块时出错:", e);
    }
  });
}

// Helper to process a text block
function processTextBlock(block) {
  if (block.classList.contains('isEmpty')) {
    return '\n';
  }

  let content = '';
  const textZone = block.querySelector('.zone-container');

  if (textZone) {
    const lines = textZone.querySelectorAll('.ace-line');
    const lineTexts = Array.from(lines).map(line => line.textContent || '');
    content = lineTexts.join(' ').trim();
  } else {
    content = block.textContent.trim();
  }

  return content ? content : '';
}

// Helper to process a code block
function processCodeBlock(block) {
  if (!turndownService) return '';

  const htmlContent = block.outerHTML;
  let markdown = turndownService.turndown(htmlContent);
  return markdown.replace(/\u200b/g, '');
}

// 性能优化：更快的哈希函数
function fastHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }

  return hash.toString(16);
}

// 性能优化：批量处理辅助函数
function splitIntoBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

// Merge two ordered arrays while maintaining proper document order
function mergeOrderedArrays(oldArray, newArray) {
  const oldPosMap = new Map();
  oldArray.forEach((id, index) => {
    if (documentMap.paragraphs.has(id)) {
      oldPosMap.set(id, documentMap.paragraphs.get(id).position);
    }
  });

  const newPosMap = new Map();
  newArray.forEach((id) => {
    if (documentMap.paragraphs.has(id)) {
      newPosMap.set(id, documentMap.paragraphs.get(id).position);
    }
  });

  const allIds = [...new Set([...oldArray, ...newArray])];
  return allIds.sort((a, b) => {
    const posA = oldPosMap.get(a) || newPosMap.get(a) || 0;
    const posB = oldPosMap.get(b) || newPosMap.get(b) || 0;
    return posA - posB;
  });
}

// 优化版的文档捕获函数
async function captureEntireDocument() {
  if (documentMap.isCapturing) {
    showToast("已在捕获中...");
    return;
  }

  documentMap.isCapturing = true;
  showProgressToast("正在捕获文档: 0%");

  const originalScrollPosition = documentMap.mainScrollElement.scrollTop;

  try {
    const scrollHeight = Math.max(
      documentMap.mainScrollElement.scrollHeight, 
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    const viewportHeight = window.innerHeight;

    const scrollStep = Math.floor(viewportHeight * 0.9);
    const totalSteps = Math.ceil(scrollHeight / scrollStep);

    const scrollPositions = [];
    for (let step = 0; step <= totalSteps; step++) {
      scrollPositions.push(step * scrollStep);
    }

    let waitTime = 400;
    let consecutiveNoNewBlocks = 0;

    let lastBlockCount = documentMap.paragraphs.size;

    for (let i = 0; i < scrollPositions.length; i++) {
      const targetY = scrollPositions[i];

      documentMap.mainScrollElement.scrollTo({
        top: targetY,
        behavior: 'auto'
      });

      const progress = Math.min(100, Math.round((i / scrollPositions.length) * 100));
      updateProgressToast(`正在捕获文档: ${progress}%`);

      await new Promise(resolve => setTimeout(resolve, waitTime));

      captureVisibleBlocks();

      const newBlockCount = documentMap.paragraphs.size;
      if (newBlockCount > lastBlockCount) {
        waitTime = Math.min(waitTime + 50, 600);
        consecutiveNoNewBlocks = 0;
      } else {
        consecutiveNoNewBlocks++;
        if (consecutiveNoNewBlocks > 2) {
          waitTime = Math.max(waitTime - 50, 200);
        }
      }

      lastBlockCount = newBlockCount;
    }

    documentMap.mainScrollElement.scrollTo({top: scrollHeight, behavior: 'auto'});
    await new Promise(resolve => setTimeout(resolve, waitTime));
    captureVisibleBlocks();

    const paragraphsArray = [];
    let previousWasEmpty = false;

    documentMap.orderedIds.forEach(id => {
      if (!documentMap.paragraphs.has(id)) return;

      const paragraph = documentMap.paragraphs.get(id);

      if (paragraph.isEmpty) {
        if (!previousWasEmpty) {
          paragraphsArray.push('\n\n');
          previousWasEmpty = true;
        }
        return;
      }

      if (paragraph.type === 'code') {
        paragraphsArray.push(paragraph.content);
        previousWasEmpty = false;
      } else {
        if (paragraph.content.trim()) {
          if (!previousWasEmpty && paragraphsArray.length > 0) {
            paragraphsArray.push('\n\n');
          }
          paragraphsArray.push(paragraph.content);
          previousWasEmpty = false;
        } else if (!previousWasEmpty) {
          paragraphsArray.push('\n\n');
          previousWasEmpty = true;
        }
      }
    });

    const fullMarkdown = paragraphsArray.join('');

    try {
      await copyToClipboard(fullMarkdown);
      showToast("文档已完整捕获并复制！");
    } catch (clipboardError) {
      console.error("剪贴板错误:", clipboardError);

      const popupUrl = chrome.runtime.getURL('popup.html') + '?hasCapture=true';
      window.capturedMarkdown = fullMarkdown;

      showToast("文档已捕获，点击扩展图标复制内容");
    }

    documentMap.mainScrollElement.scrollTo({
      top: originalScrollPosition,
      behavior: 'auto'
    });

  } catch (error) {
    console.error("Error capturing document:", error);
    showToast("Error capturing document");

    documentMap.mainScrollElement.scrollTo({
      top: originalScrollPosition, 
      behavior: 'auto'
    });
  } finally {
    documentMap.isCapturing = false;
    if (documentMap.progressToast) {
      document.body.removeChild(documentMap.progressToast);
      documentMap.progressToast = null;
    }
  }
}

// Show progress toast that stays on screen until updated or removed
function showProgressToast(message) {
  if (documentMap.progressToast) {
    documentMap.progressToast.textContent = message;
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'td-progress-toast';
  toast.textContent = message;

  document.body.appendChild(toast);
  documentMap.progressToast = toast;
}

function updateProgressToast(message) {
  if (documentMap.progressToast) {
    documentMap.progressToast.textContent = message;
  } else {
    showProgressToast(message);
  }
}

// Simple string hash function - generates ID based on content
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Function to show a toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'td-copy-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    document.body.removeChild(toast);
  }, 2000);
}

// Function to copy a specific container
function copySpecificContainer(container) {
  if (!turndownService) {
    console.error("TurndownService not initialized when attempting to copy container.");
    showToast("Error: Markdown conversion service not available");
    return;
  }

  try {
    const htmlContent = container.outerHTML;
    let markdown = turndownService.turndown(htmlContent);
    markdown = markdown.replace(/\u200b/g, '');

    copyToClipboard(markdown)
      .then(() => {
        showToast("Copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy:", err);
        showToast("Failed to copy. See console for details.");
      });
      
  } catch (e) {
    console.error("Error converting container to markdown:", e);
    showToast("Error during conversion");
  }
}

// Function to copy text to clipboard with fallback method
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(text)
          .then(() => resolve(true))
          .catch(err => {
            console.warn("Clipboard API failed, using fallback method:", err);
            fallbackCopyToClipboard(text, resolve, reject);
          });
      } catch (e) {
        console.warn("Clipboard API error, using fallback method:", e);
        fallbackCopyToClipboard(text, resolve, reject);
      }
    } else {
      fallbackCopyToClipboard(text, resolve, reject);
    }
  });
}

// Fallback method using textarea element
function fallbackCopyToClipboard(text, resolve, reject) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const successful = document.execCommand('copy');

    document.body.removeChild(textarea);

    if (successful) {
      resolve(true);
    } else {
      reject(new Error("execCommand('copy') failed"));
    }
  } catch (err) {
    reject(err);
  }
}

// We need to ensure codeFormatter.js is loaded before turndown.js
if (typeof codeFormatter === 'undefined') {
  console.error("CodeFormatter module not loaded. Check manifest.json script loading order.");
}

let turndownService;
try {
  if (typeof TurndownService !== 'undefined') {
      turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          preformattedCode: true
      });
      
      turndownService.remove(function (node, options) {
          return (node.nodeName === 'DIV' && node.classList.contains('code-block-header')) ||
                 (node.nodeName === 'DIV' && node.classList.contains('ignore-dom') && node.querySelector('.code-block-header'));
      });
      
      turndownService.addRule('preserveFeishuIndentation', {
          filter: function(node) {
              return node.nodeName === 'DIV' && 
                     node.classList.contains('code-line-wrapper');
          },
          replacement: function(content, node) {
              return content;
          }
      });
      
      console.log("TurndownService initialized in content script with custom rules.");
  } else {
      console.error("TurndownService is not defined in content script. Check manifest.json and turndown.js loading.");
  }
} catch (e) {
    console.error("Error initializing TurndownService in content script:", e);
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script received message:", request);

      if (request.action === "getHtmlContent") {
        if (!turndownService) {
            console.error("TurndownService not initialized when processing getHtmlContent.");
            sendResponse({ success: false, error: "Turndown service not available in content script." });
            return false;
        }

        showToast("Capturing full document content...");
        
        (async () => {
          try {
            await captureEntireDocument();
            sendResponse({ success: true });
          } catch (e) {
            console.error("Content Script: Error during document capture:", e);
            sendResponse({ success: false, error: `Capture error: ${e.message}` });
          }
        })();
        
        return true;
      } else if (request.action === "retrieveCapturedMarkdown") {
        if (window.capturedMarkdown) {
          sendResponse({ 
            success: true, 
            markdown: window.capturedMarkdown 
          });
          
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
              action: "copyMarkdown", 
              markdown: window.capturedMarkdown 
            });
          }
          
          return true;
        } else {
          sendResponse({ success: false, error: "No captured markdown available" });
          return false;
        }
      }
    });
    console.log("Content script message listener attached.");
} else {
    console.error("Content script: chrome.runtime.onMessage is not available.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializePage();
  });
} else {
  initializePage();
}

function initializePage() {
  addStyles();
  addCaptureAllButton();
  addCopyButtonsToContainers();
  
  initDocumentMapping();
  
  monitorDocumentChanges();
  
  console.log('Page enhancement features initialized, monitoring document changes');
}

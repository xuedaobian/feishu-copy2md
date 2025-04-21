document.getElementById('extractBtn').addEventListener('click', () => {
  const outputArea = document.getElementById('output');
  const extractButton = document.getElementById('extractBtn'); // Get button reference
  outputArea.value = '正在提取...'; // Update status message
  extractButton.disabled = true; // Disable button during extraction
  extractButton.textContent = '提取中...'; // Change button text

  // Query the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      outputArea.value = '错误: 未找到活动标签页。';
      extractButton.disabled = false; // Re-enable button
      extractButton.textContent = '提取内容'; // Restore button text
      return;
    }
    const activeTab = tabs[0];

    // Check if the tab URL matches the Feishu Docs pattern
    if (!activeTab.url || !activeTab.url.includes('feishu.cn/')) {
      outputArea.value = '错误: 当前页面不是飞书文档页面。\n请导航到 feishu.cn/... URL。';
      extractButton.disabled = false; // Re-enable button
      extractButton.textContent = '提取内容'; // Restore button text
      return;
    }

    // Send a message to the content script to start the scroll and extract process
    chrome.tabs.sendMessage(activeTab.id, { action: "scrollToBottomAndExtract" }, (response) => {
      extractButton.disabled = false; // Re-enable button
      extractButton.textContent = '提取内容'; // Restore button text

      if (chrome.runtime.lastError) {
        // Handle errors, e.g., content script not injected or page not ready
        outputArea.value = `错误: ${chrome.runtime.lastError.message}\n请尝试重新加载飞书页面后重试。`; // Update error message
        console.error(chrome.runtime.lastError.message);
      } else if (response && response.markdown) {
        const markdownContent = response.markdown;
        outputArea.value = markdownContent;

        // Copy to clipboard using modern API
        navigator.clipboard.writeText(markdownContent).then(() => {
          console.log('Markdown 已复制到剪贴板');
          // Optionally provide user feedback (e.g., change button text briefly)
          extractButton.textContent = '已复制!';
          setTimeout(() => {
            extractButton.textContent = '提取内容';
          }, 1500); // Reset button text after 1.5 seconds
        }).catch(err => {
          console.error('无法复制到剪贴板:', err);
          outputArea.value += '\n\n(自动复制到剪贴板失败)'; // Append error to textarea
        });

      } else if (response && response.warning) { // Handle warnings from content script
        outputArea.value = `${response.markdown}\n\n警告: ${response.warning}`;
        // Still try to copy if markdown exists despite warning
        if (response.markdown) {
          navigator.clipboard.writeText(response.markdown).then(() => {
            console.log('Markdown (带警告) 已复制到剪贴板');
            extractButton.textContent = '已复制 (有警告)!';
            setTimeout(() => {
              extractButton.textContent = '提取内容';
            }, 2000);
          }).catch(err => {
            console.error('无法复制到剪贴板:', err);
            outputArea.value += '\n\n(自动复制到剪贴板失败)';
          });
        }
      } else if (response && response.error) {
        outputArea.value = `错误: ${response.error}`;
      } else {
        outputArea.value = '错误：内容脚本无响应或响应格式意外。';
      }
    });
  });
});

// Optional: Clear placeholder on focus
const outputArea = document.getElementById('output');
outputArea.addEventListener('focus', () => {
  if (outputArea.value === 'Extracted Markdown will appear here...' || outputArea.value === 'Extracting...') {
    // Optionally clear or select text
  }
});

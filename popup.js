document.getElementById('extractBtn').addEventListener('click', () => {
    const outputArea = document.getElementById('output');
    outputArea.value = 'Extracting...';

    // Query the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            outputArea.value = 'Error: No active tab found.';
            return;
        }
        const activeTab = tabs[0];

        // Check if the tab URL matches the Feishu Docs pattern
        if (!activeTab.url || !activeTab.url.includes('feishu.cn/')) {
             outputArea.value = 'Error: Not a Feishu Docs page.\nPlease navigate to a feishu.cn/... URL.';
             return;
        }

        // Send a message to the content script to start the scroll and extract process
        chrome.tabs.sendMessage(activeTab.id, { action: "scrollToBottomAndExtract" }, (response) => {
            if (chrome.runtime.lastError) {
                // Handle errors, e.g., content script not injected or page not ready
                outputArea.value = `Error: ${chrome.runtime.lastError.message}\nTry reloading the Feishu page and clicking Extract again.`;
                console.error(chrome.runtime.lastError.message);
            } else if (response && response.markdown) {
                outputArea.value = response.markdown;
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

document.getElementById('convertButton').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Processing...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
        statusDiv.textContent = 'Error: No active tab found.';
        return;
    }
    const activeTab = tabs[0];
    if (!activeTab.id) {
        statusDiv.textContent = 'Error: Active tab has no ID.';
        return;
    }

    // Send message to content script in the active tab
    chrome.tabs.sendMessage(activeTab.id, { action: "getHtmlContent" }, (response) => {
      if (chrome.runtime.lastError) {
        // Handle errors, e.g., content script not injected or communication failed
        statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
        console.error(chrome.runtime.lastError.message);
      } else if (response && response.success) {
        statusDiv.textContent = 'Copied to clipboard!';
        // Optionally close the popup after a short delay
        setTimeout(() => window.close(), 1500);
      } else if (response) {
        statusDiv.textContent = `Failed: ${response.error || 'Unknown error'}`;
      } else {
         statusDiv.textContent = 'No response received.'; // Or handle as needed
      }
    });
  });
});

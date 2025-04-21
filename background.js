chrome.runtime.onInstalled.addListener(() => {
  console.log('Feishu Doc Exporter extension installed.');
});

// Listen for messages if needed for more complex background tasks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Example: Handle messages from content scripts or popup if necessary
  // if (message.action === "someBackgroundAction") {
  //   // Perform action
  //   sendResponse({ status: "done" });
  // }
  return true; // Keep message channel open for asynchronous response if needed
});

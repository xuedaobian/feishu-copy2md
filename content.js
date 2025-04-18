console.log("Content script executing..."); // Log script start

// --- IMPORTANT: Define the CSS selector for the target HTML area ---
const TARGET_SELECTOR = '.root-render-unit-container'; // Updated selector for Feishu Docs

let turndownService;
try {
  if (typeof TurndownService !== 'undefined') {
      turndownService = new TurndownService();
      console.log("TurndownService initialized in content script.");
  } else {
      console.error("TurndownService is not defined in content script. Check manifest.json and turndown.js loading.");
  }
} catch (e) {
    console.error("Error initializing TurndownService in content script:", e);
}

// Ensure the listener is attached only once and after potential initialization errors
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script received message:", request); // Log received message

      if (request.action === "getHtmlContent") {
        if (!turndownService) {
            console.error("TurndownService not initialized when processing getHtmlContent.");
            sendResponse({ success: false, error: "Turndown service not available in content script." });
            return false; // Synchronous response
        }

        const element = document.querySelector(TARGET_SELECTOR);
        if (element) {
          try {
            const htmlContent = element.outerHTML;
            const markdown = turndownService.turndown(htmlContent);
            console.log("Content Script: Conversion successful. Sending 'copyMarkdown' to background script."); // Log before sending

            // Send the MARKDOWN content to the background script for copying
            chrome.runtime.sendMessage({ action: "copyMarkdown", markdown: markdown }, (response) => {
              // This callback executes when the background script calls sendResponse
              console.log("Content Script: Received response callback from background."); // Log callback entry

              // Check chrome.runtime.lastError FIRST - this is critical for port closed errors
              if (chrome.runtime.lastError) {
                console.error("Content Script: Error receiving response from background:", chrome.runtime.lastError.message);
                // Send the specific error back to the popup
                sendResponse({ success: false, error: `Background connection error: ${chrome.runtime.lastError.message}` });
              } else if (response && response.success) {
                 console.log("Content Script: Background reported success:", response);
                 // Forward success to popup
                 sendResponse({ success: true });
              } else if (response) {
                 // Background reported failure
                 console.error("Content Script: Background reported failure:", response);
                 sendResponse({ success: false, error: response.error || "Background script failed to copy." });
              } else {
                 // No response object received, and lastError wasn't set. Should not happen with return true.
                 console.error("Content Script: No response object received from background script, and no lastError.");
                 sendResponse({ success: false, error: "Unknown error: No response or error from background." });
              }
            });
            console.log("Content Script: sendMessage called, returning true to wait for async response.");
            // Return true IMMEDIATELY after calling sendMessage
            return true;

          } catch (e) {
              console.error("Content Script: Error during HTML processing or conversion:", e);
              sendResponse({ success: false, error: `Conversion error: ${e.message}` });
              return false; // Synchronous response for conversion error
          }
        } else {
          console.error(`Element with selector "${TARGET_SELECTOR}" not found.`);
          sendResponse({ success: false, error: `Element "${TARGET_SELECTOR}" not found.` });
          return false; // Synchronous response for element not found
        }
      }
      // If the action wasn't 'getHtmlContent', indicate we are not handling it asynchronously
      // return false; // Or let it be undefined implicitly
    });
    console.log("Content script message listener attached."); // Confirm listener setup
} else {
    console.error("Content script: chrome.runtime.onMessage is not available.");
}

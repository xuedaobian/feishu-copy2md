console.log("Background service worker starting...");

// Path to the offscreen document
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Function to check if an offscreen document is currently open
async function hasOffscreenDocument(path) {
  // Check all existing contexts for a match.
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(path)]
  });
  return existingContexts.length > 0;
}

// Function to create and manage the offscreen document
async function setupOffscreenDocument(path) {
  console.log("Background: Checking for existing offscreen document...");
  if (await hasOffscreenDocument(path)) {
    console.log("Background: Offscreen document already exists.");
    return; // Already exists, do nothing.
  }
  console.log("Background: Creating offscreen document...");
  try {
      await chrome.offscreen.createDocument({
        url: path,
        reasons: [chrome.offscreen.Reason.CLIPBOARD],
        justification: 'Needed for clipboard operations',
      });
      console.log("Background: Offscreen document created successfully.");
  } catch (error) {
      console.error("Background: Error creating offscreen document:", error);
      throw error; // Re-throw the error to be caught by the caller
  }
}

// Main message listener
try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          // Log immediately upon receiving any message BEFORE async logic starts
          console.log("Background: Listener invoked for message:", request);

          // --- Handle copyMarkdown action ---
          if (request.action === "copyMarkdown" && typeof request.markdown === 'string') {
            console.log("Background: Processing 'copyMarkdown' action...");

            // Use an immediately-invoked async function expression (IIAFE)
            // to handle the async logic and ensure sendResponse is called.
            (async () => {
              try {
                console.log("Background: Calling setupOffscreenDocument...");
                await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);
                console.log("Background: setupOffscreenDocument completed.");

                console.log("Background: Sending 'copyDataToClipboard' message to offscreen document...");
                const response = await chrome.runtime.sendMessage({
                  action: 'copyDataToClipboard',
                  data: request.markdown
                });

                console.log("Background: Received response from offscreen document:", response);
                console.log("Background: Relaying response back to content script.");
                sendResponse(response); // Call sendResponse on success

              } catch (err) {
                // Catch errors from setup, sending to offscreen, or receiving from offscreen
                console.error('Background: Error during offscreen handling for copyMarkdown:', err);
                // Ensure sendResponse is called even on error
                sendResponse({ success: false, error: `Background error during offscreen handling: ${err.message || err}` });
              }
            })(); // Immediately invoke the async function

            // Return true because the IIAFE is async and will call sendResponse later.
            return true;

          // --- Handle invalid copyMarkdown data ---
          } else if (request.action === "copyMarkdown") {
              console.error("Background: Received copyMarkdown action but markdown data is invalid:", request.markdown);
              sendResponse({ success: false, error: "Invalid markdown data received." });
              return false; // Synchronous response

          // --- Handle messages intended for offscreen (shouldn't happen often) ---
          } else if (request.action === "copyDataToClipboard") {
              console.warn("Background: Received 'copyDataToClipboard' message intended for offscreen script.");
              // Decide how to handle this - perhaps ignore or send an error?
              // sendResponse({ success: false, error: "Message intended for offscreen received by background." });
              return false; // Indicate not handled asynchronously

          // --- Handle other messages ---
          } else {
              console.log("Background: Received unhandled message action:", request.action);
              return false; // Indicate not handled asynchronously
          }
        });
        console.log("Background script message listener attached.");
    } else {
        console.error("Background: chrome.runtime.onMessage is not available.");
    }
} catch (e) {
    console.error("Background: Error setting up main listener:", e);
}

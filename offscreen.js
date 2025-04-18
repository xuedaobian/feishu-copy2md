console.log("Offscreen script starting...");

// Function to copy text using document.execCommand
function copyUsingExecCommand(text) {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px'; // Move it off-screen
    textArea.value = text;
    document.body.appendChild(textArea);

    let success = false;
    try {
        textArea.select(); // Select the text
        success = document.execCommand('copy'); // Execute the copy command
        if (success) {
            console.log("Offscreen: execCommand('copy') successful.");
        } else {
            console.error("Offscreen: execCommand('copy') failed.");
        }
    } catch (err) {
        console.error('Offscreen: Error during execCommand copy:', err);
        success = false;
    } finally {
        // Clean up the temporary element
        document.body.removeChild(textArea);
    }
    return success;
}

// Offscreen script listens for messages from the background script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Offscreen: Received message:", request); // Log received message
    if (request.action === 'copyDataToClipboard' && typeof request.data === 'string') {
        console.log("Offscreen: Processing 'copyDataToClipboard' action using execCommand...");

        // Use the execCommand approach
        const success = copyUsingExecCommand(request.data);

        if (success) {
            console.log("Offscreen: Sending success response back to background.");
            sendResponse({ success: true });
        } else {
            console.log("Offscreen: Sending failure response back to background.");
            sendResponse({ success: false, error: "Offscreen clipboard write failed using execCommand." });
        }
        // Indicate that the response is sent synchronously in this case
        return false;
    } else {
        console.warn("Offscreen: Received unhandled message action:", request.action);
    }
    // If not handled, return false or undefined implicitly
    return false;
});

console.log("Offscreen: Message listener attached.");

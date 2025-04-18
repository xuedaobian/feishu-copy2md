/**
 * Code formatting utilities for Turndown HTML to Markdown conversion
 */

/**
 * Applies language-specific indentation to code
 * 
 * @param {string} code - The code to format
 * @param {string} language - The programming language
 * @returns {string} Properly indented code
 */
function applyLanguageIndentation(code, language) {
  if (!code || !language) return code;
  
  // Normalize language name
  language = language.toLowerCase().trim();
  
  // Split code into lines
  var lines = code.split('\n');
  var indentedLines = [];
  var indentLevel = 0;
  var indentSize = 4; // Default indent size (4 spaces)
  
  // Language-specific indentation rules
  switch (language) {
    case 'javascript':
    case 'java':
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'c#':
    case 'php':
    case 'typescript':
      // Brace-based languages
      lines.forEach(function (line) {
        var trimmedLine = line.trim();

        // Decrease indent level for lines that only contain a closing brace
        if (/^[}\])]/.test(trimmedLine)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        // Apply current indentation
        if (trimmedLine.length > 0) {
          var indent = Array(indentLevel + 1).join(' '.repeat(indentSize));
          indentedLines.push(indent + trimmedLine);
        } else {
          indentedLines.push('');
        }

        // Increase indent level for lines that end with an opening brace
        if (/[{[(]$/.test(trimmedLine)) {
          indentLevel++;
        }
      });
      break;

    case 'python':
    case 'yaml':
    case 'ruby':
      // Indentation-sensitive languages - preserve existing indentation
      // but ensure it's consistent
      var indentPattern = null;

      lines.forEach(function (line) {
        var leadingWhitespace = line.match(/^(\s*)/)[1];

        // Try to detect the indentation pattern if not already set
        if (!indentPattern && leadingWhitespace.length > 0) {
          indentPattern = leadingWhitespace;
        }

        indentedLines.push(line);
      });
      break;

    case 'html':
    case 'xml':
      // Tag-based languages
      var inTag = false;

      lines.forEach(function (line) {
        var trimmedLine = line.trim();

        // Decrease indent for closing tags
        if (/^<\//.test(trimmedLine)) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        // Apply current indentation
        if (trimmedLine.length > 0) {
          var indent = Array(indentLevel + 1).join(' '.repeat(indentSize));
          indentedLines.push(indent + trimmedLine);
        } else {
          indentedLines.push('');
        }

        // Increase indent for opening tags (but not self-closing)
        if (/<[^>]*>/.test(trimmedLine) && !/>$/.test(trimmedLine) && !/<\//.test(trimmedLine)) {
          indentLevel++;
        }
      });
      break;

    default:
      // For other languages or unknown languages, preserve the code as is
      return code;
  }

  return indentedLines.join('\n');
}

/**
 * Extracts and formats code from Feishu code block elements
 * 
 * @param {Element} codeLinesContainer - The container element with code lines
 * @param {string} language - The programming language 
 * @returns {string} Formatted code
 */
function extractCodeFromFeishu(codeLinesContainer, language) {
  if (!codeLinesContainer) return '';
  
  var lineElements = codeLinesContainer.querySelectorAll('.ace-line');
  var lines = [];
  
  lineElements.forEach(function(lineElement) {
    // Check if this is a virtual list placeholder - skip if it is
    if (lineElement.hasAttribute('data-virtual-list-placeholder')) {
      return;
    }
    
    // Check if there's any structured indentation data
    var codeLineWrapper = lineElement.querySelector('.code-line-wrapper');
    if (codeLineWrapper) {
      var lineText = codeLineWrapper.textContent || '';
      
      // First try to extract any explicit indent information
      var lineNum = codeLineWrapper.getAttribute('data-line-num');
      var indentElements = codeLineWrapper.querySelectorAll('.indent');
      var indentCount = indentElements.length;
      
      // If we found explicit indent elements, use them
      if (indentCount > 0) {
        var indentation = '    '.repeat(indentCount);
        lineText = indentation + lineText.trimLeft();
      }
      // Otherwise, try to infer indentation from the content structure
      else {
        // Examine span structure to deduce indentation
        var spans = codeLineWrapper.querySelectorAll('span');
        var potentialIndentLevel = 0;
        
        // Look for spacing in the HTML structure
        for (var i = 0; i < spans.length; i++) {
          var span = spans[i];
          if (span.textContent.trim() === '') {
            potentialIndentLevel++;
          } else {
            break;
          }
        }
        
        // If we detect potential indentation
        if (potentialIndentLevel > 0) {
          var inferredIndent = '    '.repeat(potentialIndentLevel);
          lineText = inferredIndent + lineText.trimLeft();
        }
      }
      
      lines.push(lineText);
    } else {
      // Fallback for non-structured content
      lines.push(lineElement.textContent || '');
    }
  });
  
  var code = lines.join('\n');
  
  // Apply language-specific indentation if the raw extraction didn't work well
  // This can be detected by checking if code has proper indentation already
  var hasProperIndentation = /\n\s+/.test(code);
  if (!hasProperIndentation && language) {
    code = applyLanguageIndentation(code, language);
  }
  
  return code;
}

/**
 * Extracts and formats code from standard HTML code blocks
 * 
 * @param {Element} codeNode - The code element
 * @param {string} language - The programming language
 * @returns {string} Formatted code
 */
function extractCodeFromStandard(codeNode, language) {
  if (!codeNode) return '';
  
  // For standard code blocks, preserve whitespace as-is
  var code = codeNode.innerHTML
    .replace(/<br\s*\/?>/gi, '\n') // Replace <br> with newlines
    .replace(/<[^>]*>/g, '')       // Remove remaining HTML tags
    .replace(/&lt;/g, '<')         // Restore special characters
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
    
  // Apply language-specific indentation
  if (language) {
    code = applyLanguageIndentation(code, language);
  }
  
  return code;
}

// Export functions for use in turndown.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyLanguageIndentation: applyLanguageIndentation,
    extractCodeFromFeishu: extractCodeFromFeishu,
    extractCodeFromStandard: extractCodeFromStandard
  };
} else {
  // For browser environment
  window.codeFormatter = {
    applyLanguageIndentation: applyLanguageIndentation,
    extractCodeFromFeishu: extractCodeFromFeishu,
    extractCodeFromStandard: extractCodeFromStandard
  };
}

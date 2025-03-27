
// Content script for WhatsApp Web page manipulation

// Default target language
let targetLanguage = 'NL';
const translatedMessages = new Map();

// Initialize when page is loaded
window.addEventListener('load', () => {
  console.log('WhatsApp Translator initialized on page load');
  initializeExtension();
});

// Re-initialize on navigation changes within WhatsApp Web
const observer = new MutationObserver((mutations) => {
  // Check if we're on a chat page by looking for WhatsApp message containers
  if (document.querySelector('[data-testid="conversation-panel-messages"]')) {
    console.log('Chat panel detected, attaching translation listeners');
    attachTranslationListeners();
  }
});

// Start observing the document body for DOM changes
observer.observe(document.body, { childList: true, subtree: true });

function initializeExtension() {
  console.log('WhatsApp Translator extension initialized');
  
  // Get saved target language from storage
  chrome.storage.sync.get(['targetLanguage'], (result) => {
    if (result.targetLanguage) {
      targetLanguage = result.targetLanguage;
      console.log('Target language set to:', targetLanguage);
    }
  });
  
  // Add listeners to message bubbles
  attachTranslationListeners();
}

function attachTranslationListeners() {
  console.log('Attaching translation listeners to messages');
  
  // Use a more aggressive approach to find and process message bubbles
  setInterval(() => {
    // Find all message containers that haven't been processed yet
    const messageBubbles = document.querySelectorAll('.copyable-text:not([wt-processed])');
    
    if (messageBubbles.length > 0) {
      console.log('Found new WhatsApp messages:', messageBubbles.length);
      
      messageBubbles.forEach(bubble => {
        // Mark as processed
        bubble.setAttribute('wt-processed', 'true');
        
        // Get the message container
        const messageContainer = bubble.closest('[data-testid="msg-container"]') || 
                                bubble.closest('.message-in, .message-out') ||
                                bubble.parentElement;
        
        if (!messageContainer) {
          console.log('No valid message container found for this bubble');
          return;
        }
        
        // Add double-click event listener
        bubble.addEventListener('dblclick', (event) => {
          event.stopPropagation();
          console.log('Message double-clicked, initiating translation');
          handleMessageDoubleClick(event, bubble);
        });
        
        // Add visual indicator that this message can be translated
        const indicator = document.createElement('div');
        indicator.className = 'wt-indicator';
        
        // Use translated text for indicators based on current language
        let translatedIndicatorText = 'Double-click to translate';
        chrome.storage.sync.get(['translationData'], (result) => {
          if (result.translationData && result.translationData['Double-click to translate']) {
            const translations = result.translationData['Double-click to translate'];
            translatedIndicatorText = translations[targetLanguage] || 'Double-click to translate';
          }
          indicator.textContent = translatedIndicatorText;
        });
        
        indicator.style.cssText = `
          position: absolute;
          top: -20px;
          right: 10px;
          background: rgba(0,128,105,0.8);
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
          z-index: 1000;
        `;
        
        // Ensure the message container has position relative for proper indicator positioning
        if (window.getComputedStyle(messageContainer).position !== 'relative') {
          messageContainer.style.position = 'relative';
        }
        
        messageContainer.appendChild(indicator);
        
        // Show indicator on hover
        messageContainer.addEventListener('mouseenter', () => {
          indicator.style.opacity = '1';
        });
        
        messageContainer.addEventListener('mouseleave', () => {
          indicator.style.opacity = '0';
        });
        
        console.log('Translation listener and indicator added to message');
      });
    }
  }, 2000); // Check every 2 seconds for new messages
}

function handleMessageDoubleClick(event, element) {
  console.log('Handling message double click');
  
  const messageContainer = element.closest('[data-testid="msg-container"]') || 
                          element.closest('.message-in, .message-out') ||
                          element.parentElement;
  
  if (!messageContainer) {
    console.error('No message container found');
    return;
  }
  
  // Generate a unique ID for this message
  const messageId = messageContainer.getAttribute('data-id') || 
                  `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Set a consistent ID for the message container if it doesn't have one
  if (!messageContainer.getAttribute('data-id')) {
    messageContainer.setAttribute('data-id', messageId);
  }
  
  // Get translated UI text based on current language
  let translatedText = {
    translating: 'Translating...',
    translatedTo: `Translated to ${targetLanguage}`,
    doubleClickToTranslate: 'Double-click to translate',
    doubleClickToRevert: 'Double-click to revert',
    translationFailed: 'Translation failed. Check API key.'
  };
  
  // Try to get translations from storage
  chrome.storage.sync.get(['translationData'], (result) => {
    if (result.translationData) {
      const data = result.translationData;
      if (data['Translating...'] && data['Translating...'][targetLanguage]) {
        translatedText.translating = data['Translating...'][targetLanguage];
      }
      if (data['Translated to'] && data['Translated to'][targetLanguage]) {
        translatedText.translatedTo = `${data['Translated to'][targetLanguage]} ${targetLanguage}`;
      }
      if (data['Double-click to translate'] && data['Double-click to translate'][targetLanguage]) {
        translatedText.doubleClickToTranslate = data['Double-click to translate'][targetLanguage];
      }
      if (data['Double-click to revert'] && data['Double-click to revert'][targetLanguage]) {
        translatedText.doubleClickToRevert = data['Double-click to revert'][targetLanguage];
      }
      if (data['Translation failed'] && data['Translation failed'][targetLanguage]) {
        translatedText.translationFailed = data['Translation failed'][targetLanguage];
      }
    }
    
    // Check if message is already translated
    if (messageContainer.hasAttribute('wt-translated')) {
      // Message is already translated, revert to original
      console.log('Reverting translated message to original');
      const originalHtml = translatedMessages.get(messageId);
      if (originalHtml) {
        console.log('Retrieved original HTML:', originalHtml);
        
        // Get the text element
        const textElement = element.querySelector('[data-testid="message-text"]') || element;
        
        // Restore original HTML
        textElement.innerHTML = originalHtml;
        
        // Remove translated indicator
        const indicator = messageContainer.querySelector('.wt-translated-badge');
        if (indicator) indicator.remove();
        
        messageContainer.removeAttribute('wt-translated');
        
        // Update the hover tooltip to show "translate" option again
        const hoverIndicator = messageContainer.querySelector('.wt-indicator');
        if (hoverIndicator) {
          hoverIndicator.textContent = translatedText.doubleClickToTranslate;
        }
      } else {
        console.warn('Original HTML not found for message ID:', messageId);
      }
    } else {
      // Message is not translated yet, translate it
      console.log('Translating message:', messageId);
      
      // Find the text container
      const textElement = element.querySelector('[data-testid="message-text"]') || element;
      
      // Store original HTML
      const originalHtml = textElement.innerHTML;
      translatedMessages.set(messageId, originalHtml);
      console.log('Stored original HTML for ID:', messageId, originalHtml);
      
      // Extract text content while preserving HTML structure
      const textContent = extractTextContent(textElement);
      console.log('Extracted text content:', textContent);
      
      // Add translating visual indicator
      messageContainer.classList.add('wt-translating');
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'wt-loading';
      loadingIndicator.textContent = translatedText.translating;
      loadingIndicator.style.cssText = `
        font-size: 11px;
        color: #128C7E;
        font-style: italic;
        margin-top: 4px;
        padding: 2px 4px;
      `;
      messageContainer.appendChild(loadingIndicator);
      
      // Send translation request to background script
      console.log('Sending translation request to background script');
      chrome.runtime.sendMessage(
        { 
          action: 'translate', 
          text: textContent, 
          targetLang: targetLanguage 
        },
        (response) => {
          console.log('Received translation response:', response);
          
          // Remove loading indicator
          if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
          }
          messageContainer.classList.remove('wt-translating');
          
          if (response && response.success) {
            // Apply the translation while preserving HTML structure
            applyTranslation(textElement, response.translation, originalHtml);
            messageContainer.setAttribute('wt-translated', 'true');
            
            // Add translated indicator
            const indicator = document.createElement('div');
            indicator.className = 'wt-translated-badge';
            indicator.textContent = translatedText.translatedTo;
            indicator.style.cssText = `
              font-size: 11px;
              color: #128C7E;
              background: rgba(18,140,126,0.1);
              padding: 2px 6px;
              border-radius: 4px;
              margin-top: 4px;
              display: inline-block;
            `;
            
            messageContainer.appendChild(indicator);
            console.log('Message translated successfully');
            
            // Update the hover tooltip to show "revert" option
            const hoverIndicator = messageContainer.querySelector('.wt-indicator');
            if (hoverIndicator) {
              hoverIndicator.textContent = translatedText.doubleClickToRevert;
            }
          } else {
            // Show error
            console.error('Translation failed:', response?.error);
            const errorIndicator = document.createElement('div');
            errorIndicator.className = 'wt-error';
            errorIndicator.textContent = translatedText.translationFailed;
            errorIndicator.style.cssText = `
              font-size: 11px;
              color: #e74c3c;
              background: rgba(231,76,60,0.1);
              padding: 2px 6px;
              border-radius: 4px;
              margin-top: 4px;
              display: inline-block;
            `;
            messageContainer.appendChild(errorIndicator);
            setTimeout(() => {
              if (errorIndicator && errorIndicator.parentNode) {
                errorIndicator.parentNode.removeChild(errorIndicator);
              }
            }, 3000);
          }
        }
      );
    }
  });
}

// Extract text content while preserving line breaks and formatting
function extractTextContent(element) {
  // For complex WhatsApp messages with multiple spans and formatting
  if (element.querySelectorAll('span.x1lliihq, span.b38, span.b85').length > 0) {
    // Handle the message with special WhatsApp formatting
    let text = '';
    const spans = element.querySelectorAll('span.x1lliihq, span.b38, span.b85, img.emoji');
    
    spans.forEach(span => {
      if (span.tagName === 'IMG' && span.classList.contains('emoji')) {
        // For emojis, use their alt text
        text += span.alt || '';
      } else if (span.textContent === '\n' || span.textContent === '') {
        // For newline spans
        text += '\n';
      } else {
        // For regular text spans
        text += span.textContent;
      }
    });
    
    return text;
  }
  
  // Fallback to simpler text extraction
  let text = '';
  
  // Get all text nodes while preserving line breaks
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === 'BR' || 
              (node.nodeName === 'SPAN' && node.textContent.trim() === '')) {
      text += '\n';
    } else if (node.nodeName === 'IMG' && node.alt) {
      // For emojis, use their alt text
      text += node.alt;
    }
  }
  
  return text;
}

// Apply translation while preserving the original HTML structure
function applyTranslation(element, translatedText, originalHtml) {
  if (!element || !translatedText) return;
  
  // Check if the element contains spans with special WhatsApp formatting classes
  if (element.querySelectorAll('span.x1lliihq, span.b38, span.b85').length > 0) {
    // Complex message with multiple spans and formatting
    const spans = Array.from(element.querySelectorAll('span.x1lliihq'));
    
    // Skip if there are no appropriate spans
    if (spans.length === 0) {
      element.textContent = translatedText;
      return;
    }
    
    // Split translated text by newlines to match with spans
    const translatedLines = translatedText.split('\n');
    let lineIndex = 0;
    
    // Go through each span and replace text content
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      
      // Skip special elements like emoji spans
      if (span.querySelector('img.emoji') || 
          span.classList.contains('b38') || 
          span.classList.contains('b85')) {
        continue;
      }
      
      // Skip empty spans or spans that only contain whitespace/newlines
      if (!span.textContent.trim()) {
        continue;
      }
      
      // Replace the span's text with corresponding translated line
      if (lineIndex < translatedLines.length) {
        span.textContent = translatedLines[lineIndex++];
      }
    }
    
    // If there are any remaining lines that weren't applied, add them as new spans
    if (lineIndex < translatedLines.length) {
      for (let i = lineIndex; i < translatedLines.length; i++) {
        if (translatedLines[i].trim()) {
          const newSpan = document.createElement('span');
          newSpan.className = 'x1lliihq';
          newSpan.textContent = translatedLines[i];
          element.appendChild(newSpan);
        }
      }
    }
  } else {
    // Simple message, just replace the text
    element.textContent = translatedText;
  }
}

// Ensure we're connected to the background script
function connectToBackgroundScript() {
  console.log('Connecting to background script');
  chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
    if (response && response.connected) {
      console.log('Connected to background script successfully');
    } else {
      console.error('Failed to connect to background script');
    }
  });
}

// Connect when loaded
connectToBackgroundScript();

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setTargetLanguage') {
    targetLanguage = request.targetLang;
    console.log('Target language updated to:', targetLanguage);
    
    // Update all indicators with translated text
    updateAllIndicators();
    
    sendResponse({ success: true });
  }
  return true;
});

// Function to update all translation indicators with correct language
function updateAllIndicators() {
  chrome.storage.sync.get(['translationData'], (result) => {
    if (result.translationData) {
      const data = result.translationData;
      
      // Update untranslated message indicators
      const untranslatedIndicators = document.querySelectorAll('.wt-indicator');
      untranslatedIndicators.forEach(indicator => {
        if (indicator.closest('[wt-translated]')) {
          // This is for messages that are already translated - show revert text
          if (data['Double-click to revert'] && data['Double-click to revert'][targetLanguage]) {
            indicator.textContent = data['Double-click to revert'][targetLanguage];
          } else {
            indicator.textContent = 'Double-click to revert';
          }
        } else {
          // This is for untranslated messages - show translate text
          if (data['Double-click to translate'] && data['Double-click to translate'][targetLanguage]) {
            indicator.textContent = data['Double-click to translate'][targetLanguage];
          } else {
            indicator.textContent = 'Double-click to translate';
          }
        }
      });
      
      // Update translated message badges
      const translatedBadges = document.querySelectorAll('.wt-translated-badge');
      translatedBadges.forEach(badge => {
        if (data['Translated to'] && data['Translated to'][targetLanguage]) {
          badge.textContent = `${data['Translated to'][targetLanguage]} ${targetLanguage}`;
        } else {
          badge.textContent = `Translated to ${targetLanguage}`;
        }
      });
    }
  });
}

// Add some basic CSS for the translation UI
function addStylesheet() {
  const style = document.createElement('style');
  style.textContent = `
    .wt-translating {
      opacity: 0.7;
      transition: opacity 0.3s;
    }
    .wt-translated-badge, .wt-error, .wt-loading {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Dark mode support for WhatsApp Web */
    html[dir] .dark .wt-indicator {
      background: rgba(0, 128, 105, 0.6);
      color: #e9edef;
    }
    
    html[dir] .dark .wt-translated-badge {
      color: #aebac1;
      background: rgba(18, 140, 126, 0.2);
    }
    
    html[dir] .dark .wt-error {
      color: #f15c6d;
      background: rgba(231, 76, 60, 0.2);
    }
    
    html[dir] .dark .wt-loading {
      color: #aebac1;
    }
  `;
  document.head.appendChild(style);
}

// Add stylesheet when the page loads
addStylesheet();

// Save translations in Chrome storage for use by content script
function saveTranslationsToStorage() {
  const translationKeys = [
    'Translating...',
    'Translated to',
    'Double-click to translate',
    'Double-click to revert',
    'Translation failed'
  ];
  
  const translations = {};
  
  // Create a simple nested translation object
  translationKeys.forEach(key => {
    translations[key] = {
      'EN': key,
      'NL': key === 'Translating...' ? 'Vertalen...' :
            key === 'Translated to' ? 'Vertaald naar' :
            key === 'Double-click to translate' ? 'Dubbelklik om te vertalen' :
            key === 'Double-click to revert' ? 'Dubbelklik om terug te zetten' :
            key === 'Translation failed' ? 'Vertaling mislukt. Controleer API-sleutel.' : key,
      'DE': key === 'Translating...' ? 'Übersetzen...' :
            key === 'Translated to' ? 'Übersetzt in' :
            key === 'Double-click to translate' ? 'Doppelklicken zum Übersetzen' :
            key === 'Double-click to revert' ? 'Doppelklicken zum Zurücksetzen' :
            key === 'Translation failed' ? 'Übersetzung fehlgeschlagen. API-Schlüssel prüfen.' : key,
      'FR': key === 'Translating...' ? 'Traduction en cours...' :
            key === 'Translated to' ? 'Traduit en' :
            key === 'Double-click to translate' ? 'Double-cliquez pour traduire' :
            key === 'Double-click to revert' ? 'Double-cliquez pour rétablir' :
            key === 'Translation failed' ? 'Échec de la traduction. Vérifiez la clé API.' : key,
      'ES': key === 'Translating...' ? 'Traduciendo...' :
            key === 'Translated to' ? 'Traducido al' :
            key === 'Double-click to translate' ? 'Haga doble clic para traducir' :
            key === 'Double-click to revert' ? 'Haga doble clic para revertir' :
            key === 'Translation failed' ? 'Traducción fallida. Comprueba la clave API.' : key,
      // Add more languages as needed
    };
  });
  
  // Store translations in Chrome storage
  chrome.storage.sync.set({ translationData: translations }, () => {
    console.log('Translation data saved to storage');
  });
}

// Initialize translations in storage
saveTranslationsToStorage();

// Periodically refresh translation listeners to catch any new UI changes
setInterval(attachTranslationListeners, 10000);

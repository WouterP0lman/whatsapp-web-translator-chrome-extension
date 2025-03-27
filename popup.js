
// Save settings when button is clicked
document.getElementById('saveButton').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const targetLang = document.getElementById('targetLang').value;
  
  // Validate inputs
  if (!apiKey) {
    showStatusMessage('Please enter a DeepL API key', 'error');
    return;
  }
  
  // Save to Chrome storage
  chrome.storage.sync.set({ 
    apiKey: apiKey,
    targetLanguage: targetLang
  }, () => {
    // Also send API key to background script
    chrome.runtime.sendMessage({
      action: 'saveApiKey',
      apiKey: apiKey
    }, (response) => {
      if (response && response.success) {
        showStatusMessage('Settings saved successfully!', 'success');
        
        // Notify active tabs that settings have been updated
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setTargetLanguage',
              targetLang: targetLang
            });
          }
        });
        
        // Test the translation API to ensure everything is working
        testApiConnection(apiKey, targetLang);
      } else {
        showStatusMessage('Error saving settings', 'error');
      }
    });
  });
});

// Test the API connection
function testApiConnection(apiKey, targetLang) {
  if (!apiKey) return;
  
  const testText = "This is a test message to verify the translation service is working.";
  
  chrome.runtime.sendMessage({
    action: 'translate',
    text: testText,
    targetLang: targetLang
  }, (response) => {
    if (response && response.success) {
      console.log('Test translation successful:', response.translation);
    } else {
      console.error('Test translation failed:', response?.error);
      showStatusMessage('Warning: Test translation failed. API key may be invalid.', 'error');
    }
  });
}

// Helper to show status messages
function showStatusMessage(message, type = 'success') {
  const statusElement = document.getElementById('statusMessage');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  // Ensure popup elements exist
  if (!document.getElementById('apiKey') || !document.getElementById('targetLang')) {
    console.error('Popup elements not found');
    return;
  }
  
  chrome.storage.sync.get([
    'apiKey', 
    'targetLanguage'
  ], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
    
    if (result.targetLanguage) {
      document.getElementById('targetLang').value = result.targetLanguage;
    } else {
      // Set default language to English if not set
      document.getElementById('targetLang').value = 'EN';
    }
  });
  
  // Check connection with background script
  chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
    if (response && response.connected) {
      console.log('Popup connected to background script');
    } else {
      console.error('Popup failed to connect to background script');
      showStatusMessage('Failed to connect to extension. Try reloading.', 'error');
    }
  });
});

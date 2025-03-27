
// Save settings when button is clicked
document.getElementById('saveButton').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  const targetLang = document.getElementById('targetLang').value;
  
  // Validate inputs
  if (!apiKey) {
    showStatusMessage(getTranslation('Please enter a DeepL API key', targetLang), 'error');
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
        showStatusMessage(getTranslation('Settings saved successfully!', targetLang), 'success');
        
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
        showStatusMessage(getTranslation('Error saving settings', targetLang), 'error');
      }
    });
  });
});

// Get a translated message
function getTranslation(text, language) {
  const translations = {
    'Please enter a DeepL API key': {
      'EN': 'Please enter a DeepL API key',
      'DE': 'Bitte geben Sie einen DeepL API-Schlüssel ein',
      'FR': 'Veuillez entrer une clé API DeepL',
      'ES': 'Por favor, introduce una clave API de DeepL',
      'IT': 'Si prega di inserire una chiave API DeepL',
      'NL': 'Voer een DeepL API-sleutel in',
      // Add more languages as needed
    },
    'Settings saved successfully!': {
      'EN': 'Settings saved successfully!',
      'DE': 'Einstellungen erfolgreich gespeichert!',
      'FR': 'Paramètres enregistrés avec succès !',
      'ES': '¡Configuración guardada con éxito!',
      'IT': 'Impostazioni salvate con successo!',
      'NL': 'Instellingen succesvol opgeslagen!',
      // Add more languages as needed
    },
    'Error saving settings': {
      'EN': 'Error saving settings',
      'DE': 'Fehler beim Speichern der Einstellungen',
      'FR': 'Erreur lors de l\'enregistrement des paramètres',
      'ES': 'Error al guardar la configuración',
      'IT': 'Errore durante il salvataggio delle impostazioni',
      'NL': 'Fout bij het opslaan van instellingen',
      // Add more languages as needed
    },
    'Warning: Test translation failed. API key may be invalid.': {
      'EN': 'Warning: Test translation failed. API key may be invalid.',
      'DE': 'Warnung: Testübersetzung fehlgeschlagen. API-Schlüssel könnte ungültig sein.',
      'FR': 'Avertissement : échec de la traduction de test. La clé API peut être invalide.',
      'ES': 'Advertencia: La traducción de prueba falló. La clave API puede no ser válida.',
      'IT': 'Avviso: traduzione di prova non riuscita. La chiave API potrebbe non essere valida.',
      'NL': 'Waarschuwing: Testvertaling mislukt. API-sleutel is mogelijk ongeldig.',
      // Add more languages as needed
    },
    'Failed to connect to extension. Try reloading.': {
      'EN': 'Failed to connect to extension. Try reloading.',
      'DE': 'Verbindung zur Erweiterung fehlgeschlagen. Versuchen Sie, neu zu laden.',
      'FR': 'Échec de la connexion à l\'extension. Essayez de recharger.',
      'ES': 'No se pudo conectar con la extensión. Intenta recargar.',
      'IT': 'Impossibile connettersi all\'estensione. Prova a ricaricare.',
      'NL': 'Kon geen verbinding maken met extensie. Probeer te herladen.',
      // Add more languages as needed
    }
  };
  
  return translations[text]?.[language] || text;
}

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
      showStatusMessage(getTranslation('Warning: Test translation failed. API key may be invalid.', targetLang), 'error');
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
    
    // Update UI labels with translations based on selected language
    updateUITranslations(result.targetLanguage || 'EN');
  });
  
  // Check connection with background script
  chrome.runtime.sendMessage({ action: 'checkConnection' }, (response) => {
    if (response && response.connected) {
      console.log('Popup connected to background script');
    } else {
      console.error('Popup failed to connect to background script');
      showStatusMessage(getTranslation('Failed to connect to extension. Try reloading.', 'EN'), 'error');
    }
  });
});

// Update all UI text with translations
function updateUITranslations(language) {
  const translatedElements = {
    'extensionSettingsTitle': {
      'element': document.getElementById('extensionSettingsTitle'),
      'text': 'Extension Settings'
    },
    'apiKeyLabel': {
      'element': document.getElementById('apiKeyLabel'),
      'text': 'DeepL API Key'
    },
    'targetLangLabel': {
      'element': document.getElementById('targetLangLabel'),
      'text': 'Target Language'
    },
    'saveButton': {
      'element': document.getElementById('saveButton'),
      'text': 'Save Settings'
    },
    'apiKeyPlaceholder': {
      'element': document.getElementById('apiKey'),
      'attribute': 'placeholder',
      'text': 'Enter your DeepL API key'
    }
  };
  
  const translations = {
    'Extension Settings': {
      'EN': 'Extension Settings',
      'DE': 'Erweiterungseinstellungen',
      'FR': 'Paramètres de l\'extension',
      'ES': 'Configuración de la extensión',
      'IT': 'Impostazioni dell\'estensione',
      'NL': 'Extensie-instellingen',
      // Add more languages as needed
    },
    'DeepL API Key': {
      'EN': 'DeepL API Key',
      'DE': 'DeepL API-Schlüssel',
      'FR': 'Clé API DeepL',
      'ES': 'Clave API de DeepL',
      'IT': 'Chiave API DeepL',
      'NL': 'DeepL API-sleutel',
      // Add more languages as needed
    },
    'Target Language': {
      'EN': 'Target Language',
      'DE': 'Zielsprache',
      'FR': 'Langue cible',
      'ES': 'Idioma de destino',
      'IT': 'Lingua di destinazione',
      'NL': 'Doeltaal',
      // Add more languages as needed
    },
    'Save Settings': {
      'EN': 'Save Settings',
      'DE': 'Einstellungen speichern',
      'FR': 'Enregistrer les paramètres',
      'ES': 'Guardar configuración',
      'IT': 'Salva impostazioni',
      'NL': 'Instellingen opslaan',
      // Add more languages as needed
    },
    'Enter your DeepL API key': {
      'EN': 'Enter your DeepL API key',
      'DE': 'Geben Sie Ihren DeepL API-Schlüssel ein',
      'FR': 'Entrez votre clé API DeepL',
      'ES': 'Introduzca su clave API de DeepL',
      'IT': 'Inserisci la tua chiave API DeepL',
      'NL': 'Voer uw DeepL API-sleutel in',
      // Add more languages as needed
    }
  };
  
  // Update each element with its translation
  for (const [id, config] of Object.entries(translatedElements)) {
    if (config.element) {
      const translation = translations[config.text]?.[language] || config.text;
      
      if (config.attribute) {
        config.element.setAttribute(config.attribute, translation);
      } else {
        config.element.textContent = translation;
      }
    }
  }
}

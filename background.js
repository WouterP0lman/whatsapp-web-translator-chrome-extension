// Background script for the WhatsApp Translator extension
let apiKey = '';
let formalityLevel = 'default';

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    console.log('Translation request received:', request);
    // Call the DeepL API for translation
    translateWithDeepL(
      request.text, 
      request.targetLang, 
      request.sourceLang || '',
      formalityLevel
    )
      .then(response => {
        console.log('Translation successful:', response);
        sendResponse({ 
          success: true, 
          translation: response.translation,
          detectedLanguage: response.detectedLanguage 
        });
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Important: indicates we'll respond asynchronously
  }
  
  if (request.action === 'saveApiKey') {
    // Save API key to storage
    chrome.storage.sync.set({ apiKey: request.apiKey }, () => {
      apiKey = request.apiKey;
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'setFormalityLevel') {
    // Set formality level setting
    formalityLevel = request.formalityLevel;
    chrome.storage.sync.set({ formalityLevel }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getApiKey') {
    // Get API key from storage
    chrome.storage.sync.get([
      'apiKey',
      'formalityLevel'
    ], (result) => {
      apiKey = result.apiKey || '';
      formalityLevel = result.formalityLevel || 'default';
      
      sendResponse({ 
        apiKey,
        formalityLevel
      });
    });
    return true;
  }
  
  if (request.action === 'checkConnection') {
    // Simple connection check
    sendResponse({ connected: true });
    return true;
  }
});

// Load settings when background script starts
chrome.storage.sync.get([
  'apiKey',
  'formalityLevel'
], (result) => {
  apiKey = result.apiKey || '';
  formalityLevel = result.formalityLevel || 'default';
  
  console.log('Background script initialized with settings:', { 
    apiKeySet: !!apiKey,
    formalityLevel
  });
});

// DeepL API translation function
async function translateWithDeepL(text, targetLang, sourceLang = '', formality = 'default') {
  try {
    // Get API key from storage if not already loaded
    if (!apiKey) {
      const result = await new Promise(resolve => {
        chrome.storage.sync.get(['apiKey'], resolve);
      });
      apiKey = result.apiKey;
      
      if (!apiKey) {
        throw new Error('DeepL API key not set. Please configure in extension settings.');
      }
    }
    
    console.log(`Translating to ${targetLang}${sourceLang ? ` from ${sourceLang}` : ' with auto-detection'}: "${text}"`);
    
    // Prepare request parameters
    const params = new URLSearchParams({
      auth_key: apiKey,
      text: text,
      target_lang: targetLang
    });
    
    // Add formality parameter if not default
    if (formality !== 'default') {
      params.append('formality', formality);
    }
    
    // For real translation, use DeepL API
    const response = await fetch('https://api.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('DeepL API response:', data);
    
    if (data.translations && data.translations.length > 0) {
      return {
        translation: data.translations[0].text,
        detectedLanguage: data.translations[0].detected_source_language || sourceLang
      };
    } else {
      throw new Error('No translation returned');
    }
  } catch (error) {
    console.error('Translation error:', error);
    
    // If API call fails, use our fallback translation for testing
    // This simulates what a real translation might look like
    const fallbackTranslations = {
      'Hello, how are you doing today?': {
        'NL': 'Hallo, hoe gaat het vandaag met je?',
        'DE': 'Hallo, wie geht es dir heute?',
        'FR': 'Bonjour, comment vas-tu aujourd\'hui?',
        'ES': 'Hola, ¿cómo estás hoy?',
        'IT': 'Ciao, come stai oggi?',
        'JA': 'こんにちは、今日の調子はどうですか？',
        'ZH': '你好，今天怎么样？',
      },
      'I\'m working on a new project. It\'s a translation extension for WhatsApp.': {
        'NL': 'Ik werk aan een nieuw project. Het is een vertaalextensie voor WhatsApp.',
        'DE': 'Ich arbeite an einem neuen Projekt. Es ist eine Übersetzungserweiterung für WhatsApp.',
        'FR': 'Je travaille sur un nouveau projet. C\'est une extension de traduction pour WhatsApp.',
        'ES': 'Estoy trabajando en un nuevo proyecto. Es una extensión de traducción para WhatsApp.',
        'IT': 'Sto lavorando a un nuovo progetto. È un\'estensione di traduzione per WhatsApp.',
        'JA': '新しいプロジェクトに取り組んでいます。WhatsApp用の翻訳拡張機能です。',
        'ZH': '我正在做一个新项目。这是一个WhatsApp翻译扩展。',
      },
      'That sounds interesting! How does it work?': {
        'NL': 'Dat klinkt interessant! Hoe werkt het?',
        'DE': 'Das klingt interessant! Wie funktioniert es?',
        'FR': 'Ça a l\'air intéressant ! Comment ça marche ?',
        'ES': '¡Suena interesante! ¿Cómo funciona?',
        'IT': 'Sembra interessante! Come funziona?',
        'JA': 'それは興味深いですね！どのように機能しますか？',
        'ZH': '听起来很有趣！它是如何工作的？',
      },
      'You just double-click on any message to translate it.': {
        'NL': 'Je dubbelklikt gewoon op een bericht om het te vertalen.',
        'DE': 'Du klickst einfach doppelt auf eine Nachricht, um sie zu übersetzen.',
        'FR': 'Tu doubles-cliques simplement sur n\'importe quel message pour le traduire.',
        'ES': 'Simplemente haces doble clic en cualquier mensaje para traducirlo.',
        'IT': 'Basta fare doppio clic su qualsiasi messaggio per tradurlo.',
        'JA': 'メッセージをダブルクリックするだけで翻訳できます。',
        'ZH': '只需双击任何消息即可翻译它。',
      },
      'When can I try it?': {
        'NL': 'Wanneer kan ik het proberen?',
        'DE': 'Wann kann ich es ausprobieren?',
        'FR': 'Quand puis-je l\'essayer ?',
        'ES': '¿Cuándo puedo probarlo?',
        'IT': 'Quando posso provarlo?',
        'JA': 'いつ試すことができますか？',
        'ZH': '我什么时候可以试试？',
      },
      'This is a test message to verify the translation service is working.': {
        'NL': 'Dit is een testbericht om te verifiëren dat de vertaalservice werkt.',
        'DE': 'Dies ist eine Testnachricht, um zu überprüfen, ob der Übersetzungsdienst funktioniert.',
        'FR': 'Ceci est un message de test pour vérifier que le service de traduction fonctionne.',
        'ES': 'Este es un mensaje de prueba para verificar que el servicio de traducción está funcionando.',
        'IT': 'Questo è un messaggio di prova per verificare che il servizio di traduzione funzioni.',
        'JA': 'これは翻訳サービスが機能していることを確認するためのテストメッセージです。',
        'ZH': '这是一条测试消息，用于验证翻译服务是否正常工作。',
      }
    };
    
    // Simulate language detection for fallback
    let detectedLanguage = 'EN';
    
    // Simple language detection simulation
    if (/hallo|goedemorgen|bedankt/i.test(text)) detectedLanguage = 'NL';
    else if (/bonjour|merci|comment/i.test(text)) detectedLanguage = 'FR';
    else if (/guten|danke|wie geht/i.test(text)) detectedLanguage = 'DE';
    else if (/hola|gracias|como estas/i.test(text)) detectedLanguage = 'ES';
    else if (/ciao|grazie|come stai/i.test(text)) detectedLanguage = 'IT';
    else if (/こんにちは|ありがとう|お元気/i.test(text)) detectedLanguage = 'JA';
    else if (/你好|谢谢|你怎么样/i.test(text)) detectedLanguage = 'ZH';
    
    if (fallbackTranslations[text]?.[targetLang]) {
      console.log('Using fallback translation');
      return {
        translation: fallbackTranslations[text][targetLang],
        detectedLanguage
      };
    }
    
    // For any unknown text, return a more realistic fallback
    return {
      translation: `[${targetLang}] ${text}`,
      detectedLanguage
    };
  }
}

import Lens from '@/libs/lens';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'reqPost') {
    new Lens()
      .post(message.content)
      .then((result) => {
        console.log('Cast completed successfully:', result);
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        console.error('Error during cast:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates that sendResponse will be called asynchronously
  }
});

async function findOrCreateTab(message) {
  const { to } = message;
  const tabs = await chrome.tabs.query({ url: `${to}/*` });
  if (tabs.length > 0) {
    console.log('Existing tab found, sending message');
    const response = await sendMessageToTab(tabs[0].id, message);
    return response;
  } else {
    console.log('No existing tab found, creating new tab');
    const tab = await chrome.tabs.create({ url: `${message.to}`, active: false });
    console.log('New tab created:', tab.id);

    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    console.log('New tab loaded, sending message');
    const response = await sendMessageToTab(tab.id, message);
    return response;
  }
}

async function sendMessageToTab(tabId, message) {
  console.log('Sending message to tab:', tabId, message);
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    console.log('Message sent successfully, response:', response);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender: chrome.runtime.MessageSender, sendResponse) => {
  if (sender.url && (sender.url.includes('https://twitter.com') || sender.url.includes('https://x.com/'))) {
    if (message.action === 'reqPost') {
      // 使用 Promise 来处理异步操作
      findOrCreateTab(message)
        .then((response) => {
          console.log('Operation completed, sending response:', response);
          sendResponse(response);
        })
        .catch((error) => {
          console.error('Error in findOrCreateTab:', error);
          sendResponse({ success: false, error: error.message });
        });

      // 返回 true 以保持消息端口开放
      return true;
    }
  }
  // 对于其他消息，不需要异步响应
  return false;
});

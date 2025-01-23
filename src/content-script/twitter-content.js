const store = {
  tweetContent: {
    text: '',
    images: [],
    videos: [],
    videoCovers: []
  },
  warpcast: {
    video: 0,
    url: 'https://warpcast.com'
  },
  lens: {
    video: 0,
    url: 'https://hey.xyz'
  }
};

const convertBlobToBase64 = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
    };
  });

// 通过 fetch 获取图片
async function getDataFromImg(imgSrc) {
  const response = await fetch(imgSrc);
  const blob = await response.blob();
  const base64data = await convertBlobToBase64(blob);
  return { data: base64data, mimeType: blob.type };
}

function closeMenu() {
  const menu = document.getElementById('cast-menu');
  menu.style.display = 'none';

  // 移除所有事件监听器
  window.removeEventListener('scroll', closeMenuOnScroll);
  document.removeEventListener('click', closeMenuOnClickOutside);
}

function closeMenuOnScroll() {
  closeMenu();
}

function closeMenuOnClickOutside(event) {
  if (!event.target.closest('.cast-menu') && !event.target.closest('.cast-button')) {
    closeMenu();
  }
}

// 创建菜单元素并添加到 body
function createMenu() {
  const menu = document.createElement('div');
  menu.id = 'cast-menu';
  menu.className = 'cast-menu';
  menu.style.display = 'none';
  menu.innerHTML = `
    <div class="cast-menu-inner">
      <button class="cast-option" data-platform="warpcast">Warpcast</button>
      <button class="cast-option" data-platform="lens">Lens</button>
    </div>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', handlePlatformSelect);
}

function injectButton() {
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  tweets.forEach((tweet) => {
    if (!tweet.querySelector('.cast-button')) {
      const button = document.createElement('button');
      button.className = 'cast-button';
      button.innerHTML = `
        <svg aria-hidden="true" focusable="false" role="img" class="octicon octicon-apps" viewBox="0 0 16 16" width="18" height="18" fill="currentColor" style="display: inline-block; user-select: none; vertical-align: text-bottom; overflow: visible;"><path d="M1.5 3.25c0-.966.784-1.75 1.75-1.75h2.5c.966 0 1.75.784 1.75 1.75v2.5A1.75 1.75 0 0 1 5.75 7.5h-2.5A1.75 1.75 0 0 1 1.5 5.75Zm7 0c0-.966.784-1.75 1.75-1.75h2.5c.966 0 1.75.784 1.75 1.75v2.5a1.75 1.75 0 0 1-1.75 1.75h-2.5A1.75 1.75 0 0 1 8.5 5.75Zm-7 7c0-.966.784-1.75 1.75-1.75h2.5c.966 0 1.75.784 1.75 1.75v2.5a1.75 1.75 0 0 1-1.75 1.75h-2.5a1.75 1.75 0 0 1-1.75-1.75Zm7 0c0-.966.784-1.75 1.75-1.75h2.5c.966 0 1.75.784 1.75 1.75v2.5a1.75 1.75 0 0 1-1.75 1.75h-2.5a1.75 1.75 0 0 1-1.75-1.75ZM3.25 3a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h2.5A.25.25 0 0 0 6 5.75v-2.5A.25.25 0 0 0 5.75 3Zm7 0a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h2.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Zm-7 7a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h2.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Zm7 0a.25.25 0 0 0-.25.25v2.5c0 .138.112.25.25.25h2.5a.25.25 0 0 0 .25-.25v-2.5a.25.25 0 0 0-.25-.25Z"></path></svg>
      `;
      button.addEventListener('click', handleCastClick);
      tweet.querySelector('[role="group"]').appendChild(button);
    }
  });
}

async function handleCastClick(event) {

  event.preventDefault();
  const button = event.currentTarget;
  const menu = document.getElementById('cast-menu');

  // 如果菜单已经显示，则隐藏它
  if (menu.style.display === 'block') {
    closeMenu();
    store.tweetContent = {};
    return;
  }

  // 获取推文
  const tweet = button.closest('[data-testid="tweet"]');
  store.tweetContent = await getTweetContent(tweet);

  // 计算菜单位置
  const buttonRect = button.getBoundingClientRect();
  console.log(buttonRect);
  menu.style.top = `${buttonRect.bottom}px`;
  menu.style.left = `${buttonRect.left}px`;
  menu.style.display = 'block';

  // 添加滚动事件监听器
  window.addEventListener('scroll', closeMenuOnScroll);

  // 点击其他地方时关闭菜单
  document.addEventListener('click', closeMenuOnClickOutside);
}

async function handlePlatformSelect(event) {
  if (!event.target.classList.contains('cast-option') || event.target.disabled) {
    return;
  }

  // Disable all platform buttons
  const buttons = document.querySelectorAll('.cast-option');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });

  const platform = event.target.dataset.platform;
  console.log('Selected platform:', platform);

  // 不支持视频的转换成图片
  if (!store[platform].video && store.tweetContent.videos[0]) {
    store.tweetContent.images[0] = store.tweetContent.videoCovers[0];
    console.log('Converted video to image cover');
  }

  // warpcast 最多支持 2 张
  if (store[platform] == 'warpcast' && store.tweetContent.images.length > 2) {
    store.tweetContent.images = store.tweetContent.images.slice(0, 2);
  }

  const { text, images, videos } = store.tweetContent;
  console.log('Tweet content:', { text, imageCount: images.length, videoCount: videos.length });

  // 转换成 Base64 数据传递
  const imagesOfBase64 = await Promise.all(images.map(getDataFromImg));
  console.log('Images converted to Base64');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'reqPost',
      to: store[platform].url,
      content: {
        text,
        images: imagesOfBase64
      }
    });

    console.log('Warpcast response:', response);
    if (response && response.success) {
      console.log('Successfully posted to', platform);
    } else {
      console.error('Failed to post to', platform, response.error);
    }
  } catch (error) {
    console.error('Error posting to', platform, error);
  } finally {
    // Re-enable buttons before closing menu
    buttons.forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    });
    closeMenu();
  }
}

async function getTweetContent(tweet) {
  const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.textContent || '';
  const tweetImages = Array.from(tweet.querySelectorAll('[data-testid="tweetPhoto"] img'))
    .filter((img) => img.src)
    .map((img) => img.src);

  const tweetVideos = Array.from(tweet.querySelectorAll('video source')).map((source) => source.src);

  const tweetVideoCovers = Array.from(tweet.querySelectorAll('video')).map((video) => video.poster);

  console.log({
    text: tweetText,
    images: tweetImages,
    videos: tweetVideos,
    videoCovers: tweetVideoCovers
  });
  return {
    text: tweetText,
    images: tweetImages,
    videos: tweetVideos,
    videoCovers: tweetVideoCovers
  };
}

// 初始化
createMenu();
injectButton();

// 监听DOM变化,对新加载的推文也注入按钮
const observer = new MutationObserver(injectButton);
observer.observe(document.body, { childList: true, subtree: true });

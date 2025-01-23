class Warpcast {
  private static instance: Warpcast;
  private dbName = 'localforage';
  private storeName = 'keyvaluepairs';
  private authTokenKey = 'auth-token';

  constructor() {
    if (Warpcast.instance) {
      return Warpcast.instance;
    }
    Warpcast.instance = this;
  }

  private async getAuthToken(): Promise<{ secret: string }> {
    return new Promise((resolve, reject) => {
      const request: IDBOpenDBRequest = indexedDB.open(this.dbName);

      request.onerror = (event: Event) => reject(`Error opening database: ${(event.target as IDBOpenDBRequest).error}`);

      request.onsuccess = (event: Event) => {
        const db: IDBDatabase = (event.target as IDBOpenDBRequest).result;
        const transaction: IDBTransaction = db.transaction([this.storeName], 'readonly');
        const objectStore: IDBObjectStore = transaction.objectStore(this.storeName);
        const getRequest: IDBRequest = objectStore.get(this.authTokenKey);

        getRequest.onerror = (event: Event) =>
          reject(`Error retrieving auth-token: ${(event.target as IDBRequest).error}`);

        getRequest.onsuccess = (event: Event) => {
          const result = (event.target as IDBRequest).result;
          if (result !== undefined) {
            resolve(result);
          } else {
            reject('auth-token not found in database');
          }
        };
      };
    });
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
    const { secret } = await this.getAuthToken();
    const headers = {
      Authorization: `Bearer ${secret}`,
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  private async uploadMedia(images: Array<{ data: string; mimeType: string }>): Promise<string[]> {
    console.log('Starting media upload');
    const urls: string[] = [];
    const maxImagesToUpload = 2;

    // 只处理前两张图片
    const imagesToProcess = images.slice(0, maxImagesToUpload);

    for (const { data, mimeType } of imagesToProcess) {
      console.log('Uploading image:', mimeType);

      const {
        result: { url }
      } = await this.fetchWithAuth('https://client.warpcast.com/v1/generate-image-upload-url', {
        method: 'POST'
      });
      console.log('Image upload URL generated');

      const response = await fetch(data);
      const blob = await response.blob();

      const form = new FormData();
      form.append('file', blob, mimeType);

      const uploadResponse = await fetch(url, {
        method: 'POST',
        body: form
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload image: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      const {
        result: { variants }
      } = await uploadResponse.json();
      const imageUrl = variants.find((i: string) => i.includes('original'));
      console.log('Image uploaded, URL:', imageUrl);
      urls.push(imageUrl);
    }

    return urls;
  }

  public async post(message: { text: string; images: Array<{ data: string; mimeType: string }> }): Promise<any> {
    console.log('Starting cast process');
    const { text, images } = message;

    const urls = await this.uploadMedia(images);
    console.log('Media uploaded, URLs:', urls);

    const result = await this.fetchWithAuth('https://client.warpcast.com/v2/casts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        castDistribution: 'default',
        text,
        embeds: urls
      })
    });

    console.log('Cast successful');
    return result;
  }
}

export default Warpcast;

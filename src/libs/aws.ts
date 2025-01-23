import { v4 as uuid } from 'uuid';

import { S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

class S3ClientManager {
  private static instance: S3ClientManager;
  private client: S3 | null = null;
  private tokenExpiryTime: number | null = null;

  constructor() {
    if (S3ClientManager.instance) return S3ClientManager.instance;
    S3ClientManager.instance = this;

    this.client = null;
    this.tokenExpiryTime = null;
  }

  async getClient() {
    if (this.isClientValid()) {
      return this.client;
    }
    await this.refreshClient();
    return this.client;
  }

  isClientValid() {
    return this.client && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime;
  }

  async refreshClient() {
    try {
      const credentials = await this.fetchCredentials();
      this.client = this.createS3Client(credentials);
      this.addNullBodyMiddleware();
      this.tokenExpiryTime = credentials.expirationTimeInMillis;
    } catch (error) {
      console.error('Error refreshing S3 client:', error);
      throw error;
    }
  }

  private async fetchCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expirationTimeInMillis: number;
  }> {
    const response = await fetch('https://api.hey.xyz/sts/token');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  private createS3Client(credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string }): S3 {
    return new S3({
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      },
      endpoint: 'https://endpoint.4everland.co',
      maxAttempts: 10,
      region: 'us-west-2'
    });
  }
  addNullBodyMiddleware() {
    this.client?.middlewareStack.addRelativeTo(
      (next) => async (args) => {
        const { response } = await next(args);
        if (response.body == null) {
          response.body = new Uint8Array();
        }
        return { response };
      },
      {
        name: 'nullFetchResponseBodyMiddleware',
        override: true,
        relation: 'after',
        toMiddleware: 'deserializerMiddleware'
      }
    );
  }
}

const s3ClientManager = new S3ClientManager();

async function uploadToIPFS(
  data: Uint8Array | Buffer,
  onProgress?: (progress: number) => void
): Promise<{ uri: string }> {
  if (!ArrayBuffer.isView(data)) {
    throw new Error('Invalid data type. Expected Uint8Array or Buffer.');
  }

  try {
    const client = await s3ClientManager.getClient();
    if (!client) {
      throw new Error('S3 client is not available');
    }
    const params = {
      Body: data,
      Bucket: 'hey-media',
      ContentType: 'image/jpeg',
      Key: uuid()
    };

    const task = new Upload({ client, params });
    task.on('httpUploadProgress', (e) => {
      const progress = ((e.loaded || 0) / (e.total || 1)) * 100;
      const roundedProgress = Math.round(progress);

      // 默认进度打印
      console.log(`Upload progress: ${roundedProgress}%`);

      // 如果提供了自定义的 onProgress 函数，则调用它
      if (typeof onProgress === 'function') {
        onProgress(roundedProgress);
      }
    });

    await task.done();
    const result = await client.headObject(params);
    const cid = result.Metadata?.['ipfs-hash'];
    if (!cid) {
      throw new Error('Failed to get IPFS hash from metadata');
    }

    return { uri: `ipfs://${cid}` };
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

export { uploadToIPFS };

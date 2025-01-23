import { jwtDecode } from 'jwt-decode';
import { v4 as uuid } from 'uuid';

import { uploadToIPFS } from './aws';

class Lens {
  private address: string | undefined;
  private static instance: Lens;

  constructor() {
    if (Lens.instance) {
      return Lens.instance;
    }
    Lens.instance = this;
  }

  private getAuthToken() {
    const authStore = localStorage.getItem('auth.store');
    if (!authStore) throw new Error('Auth store not found');
    const {
      state: { accessToken }
    } = JSON.parse(authStore);
    const decoded = jwtDecode<{ id: string; evmAddress: string }>(accessToken);
    const { evmAddress } = decoded;

    this.address = evmAddress;
    return accessToken;
  }

  private async fetchGraphQL(query, variables, operationName) {
    const token = this.getAuthToken();
    const response = await fetch('https://api-v2.lens.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': token
      },
      body: JSON.stringify({ query, variables, operationName })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private async getProfiles() {
    let profile = localStorage.getItem('profile');
    if (profile) {
      return JSON.parse(profile);
    }

    const query = `query Profiles($request: ProfilesRequest!) {
  result: profiles(request: $request) {
    items {
      id
      handle {
        localName
        fullHandle
      }
      ownedBy {
        address
      }
    }
  }
}`;

    const variables = { request: { limit: 'Fifty', where: { ownedBy: [this.address] } } };
    const { data } = await this.fetchGraphQL(query, variables, 'Profiles');

    profile = data.result.items[0];
    localStorage.setItem('profile', JSON.stringify(profile));
    return profile;
  }

  private async createMetadata(profile, description, images) {
    const {
      handle: { localName }
    } = profile;

    const lens = {
      id: uuid(),
      appId: 'Hey',
      locale: 'zh',
      content: `${description}!\n`,
      title: `Post by @${localName}`
    };

    let contentType = 'text-only';
    if (!images || !images.length) {
      Object.assign(lens, {
        mainContentFocus: 'TEXT_ONLY'
      });
    }

    if (images && images.length) {
      const image = images.shift();
      Object.assign(lens, { image, mainContentFocus: 'IMAGE' });

      if (images.length) {
        Object.assign(lens, { attachments: images });
      }
      contentType = 'image';
    }

    try {
      const response = await fetch('https://api.hey.xyz/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `${description}!\n`,
          external_url: `https://hey.xyz/u/${localName}`,
          name: `Post by @${localName}`,
          animation_url: 'ipfs://bafkreiaoua5s4iyg4gkfjzl6mzgenw4qw7mwgxj7zf7ev7gga72o5d3lf4',
          $schema: `https://json-schemas.lens.dev/publications/${contentType}/3.0.0.json`,
          lens
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('metadata', data);
      return data;
    } catch (error) {
      console.error('Error in createMetadata:', error);
      throw error;
    }
  }

  private async postOnMomoka(profile, text, images) {
    try {
      const { id } = await this.createMetadata(profile, text, images);

      const query =
        'mutation PostOnMomoka($request: MomokaPostRequest!) {\n  postOnMomoka(request: $request) {\n    ... on CreateMomokaPublicationResult {\n      id\n      __typename\n    }\n    ... on LensProfileManagerRelayError {\n      reason\n      __typename\n    }\n    __typename\n  }\n}';

      const variables = { request: { contentURI: `https://metadata.hey.xyz/${id}` } };
      const data = await this.fetchGraphQL(query, variables, 'PostOnMomoka');

      console.log('PostOnMomoka', data);
      return data;
    } catch (error) {
      console.error('Error in postOnMomoka:', error);
      throw error;
    }
  }

  private async uploadMedia(images: { data: string; mimeType: string }[]) {
    console.log('Starting media upload');
    const urls: { item: string; type: string }[] = [];

    for (const { data, mimeType } of images) {
      console.log('Uploading image:', mimeType);

      const response = await fetch(data);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const { uri } = await uploadToIPFS(uint8Array);
      urls.push({ item: uri, type: mimeType });
    }

    return urls;
  }

  public async post(message: { text: string; images: { data: string; mimeType: string }[] }) {
    const { text, images } = message;
    const profile = await this.getProfiles();
    const uploadedImages = await this.uploadMedia(images);
    const result = await this.postOnMomoka(profile, text, uploadedImages);
    return result;
  }
}

export default Lens;

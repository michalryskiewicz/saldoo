import Keyv from 'keyv';

class Cache {
  private static instance: Cache;
  private keyv: Keyv;

  private constructor() {
    this.keyv = new Keyv();
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  async set<T>(key: string, value: T) {
    return this.keyv.set(key, value);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.keyv.get(key);
  }

  async delete(key: string) {
    return this.keyv.delete(key);
  }

  async clear(): Promise<void> {
    await this.keyv.clear();
  }
}

const cache = Cache.getInstance();

export default cache;

import { type IDBPDatabase, openDB } from 'idb'
import createBeekeeperApp, { type IBeekeeperSession, type IBeekeeperInstance, type IBeekeeperWallet } from "@hive/beekeeper";
import { GenericError } from './errors';


// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

const BEEKEEPER_LOGS = true;

export interface AuthUser {
  username: string;
  authorized: boolean;
}

class AuthWorker {
  public readonly run: Promise<AuthWorker>;

  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly lockTimeout: number = 10 * 1000;
  private readonly storage = "/storage_root";
  private readonly aliasStorage = 'Aliases';
  private readonly wallet: string = "default";

  constructor() {
    // Use readiness here to wait until wasm module is loaded.
    this.run = new Promise<AuthWorker>((resolve, reject) => {
      createBeekeeperApp({ enableLogs: BEEKEEPER_LOGS, storageRoot: this.storage }).then(async (api) => {
        this.api = api;
        this.session = await api.createSession('banana')
        resolve(this)
      }).catch((err) => {
        reject(err)
      })
    });
  }

  // todo, alias -> username!
  // timeout handling no timers
  // request auth
  public async authorizeNewUser(password: string, wifKey: string, alias?: string): Promise<void> {
    try {
      const unlocked = await this.session.createWallet(this.wallet, password);
      const pubKey = await unlocked.wallet.importKey(wifKey);

      if (alias) {
        await this.addAlias(alias, pubKey);
      }
    } catch (error) {
      throw new GenericError('Authorization error')
    }
  }

  public async authorize(wallet: string, password: string): Promise<void> {
    const w = await this.getExistingWallet();

    if (w) {
      const unlocked = await w.unlock(password)
      console.log('this wallet is exist!', unlocked.name)
    } else {
      console.log('error!')
    }
  }

  public async getExistingWallet(): Promise<IBeekeeperWallet | null> {
    const [wallet] = await this.session.listWallets();

    return wallet || null;
  }

  public async unregister(): Promise<void> {
    await this.api.delete();
    self.indexedDB.deleteDatabase(this.storage)
    self.indexedDB.deleteDatabase(this.aliasStorage);
  }

  private async addAlias(alias: string, pubKey: string): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(['aliases'], 'readwrite');
    const store = tx.objectStore('aliases');
    await store.add({ pubKey, alias });
    await tx.done
    db.close()
  }

  private async removeAlias(alias: string): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(['aliases'], 'readwrite');
    const store = tx.objectStore('aliases');
    await store.delete(alias);
    await tx.done;
    db.close()
  }

  private async getAliasDb(): Promise<IDBPDatabase> {
    const db = await openDB(this.aliasStorage, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('aliases')) {
          const store = db.createObjectStore('aliases', { keyPath: 'alias' })
          store.createIndex('alias', 'alias', { unique: true })
        }

      }
    })
    return db;
  }

}

class Auth {
  private static worker: AuthWorker;
  constructor(private readonly chainId: string) { }

  public async initialize(): Promise<void> {
    if (!Auth.worker) {
      Auth.worker = await new AuthWorker().run;
      console.log("initialized and chain id is!", this.chainId);
    }
  }

  public async register(password: string, wifKey: string, alias?: string): Promise<void> {
    await this.initialize();
    await Auth.worker.authorizeNewUser(password, wifKey, alias);
  }

  public async authorize(username: string, password: string): Promise<void> {
    await this.initialize();
    await Auth.worker.authorize(username, password);
  }

  public async logout(): Promise<void> {
    await this.initialize();
    await Auth.worker.unregister();
  }

  public async sign(): Promise<void> {
    await this.initialize();
  }

  public async getCurrentAuth(): Promise<AuthUser | null> {
    await this.initialize();

    const wallet = await Auth.worker.getExistingWallet();
    
    if (!wallet) return null;

    return {
      authorized: !!wallet.unlocked,
      username: wallet.name
    }
  }
}

const exports = {
  Auth
}

declare const Comlink: any;
Comlink.expose(exports);

export type WorkerExpose = typeof exports;
export type { Auth }

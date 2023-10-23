import { type IDBPDatabase, openDB } from 'idb'
import createBeekeeperApp, { type IBeekeeperSession, type IBeekeeperInstance } from "@hive/beekeeper";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

const BEEKEEPER_LOGS = true;

class AuthWorker {
  public readonly run: Promise<AuthWorker>;

  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly lockTimeout: number = 10 * 1000;
  private readonly storage: string = "/storage_root";
  private readonly wallet: string = "default";

  constructor() {
    // Use readiness here to wait until wasm module is loaded.
    this.run = new Promise<AuthWorker>((resolve, reject) => {
      createBeekeeperApp({ enableLogs: BEEKEEPER_LOGS, storageRoot: this.storage }).then(async (api) => {
        this.api = api;
        this.session = await api.createSession('banana')
        await this.removeAlias('lehche:posting');
        resolve(this)
      }).catch((err) => {
        reject(err)
      })
    });
  }

  public async getList(): Promise<void> {
    const wallets = await this.session.listWallets()
    console.log(wallets);
  }

  public async authorizeNewUser(password: string, wifKey: string, alias?: string): Promise<void> {
    try {
      await this.getList()
      const unlocked = await this.session.createWallet(this.wallet, password);
      await unlocked.importKey(wifKey);

      await this.getList()
      const [pubKey] = await this.session.getPublicKeys()
      if (alias) {
        console.log(alias, pubKey);
        await this.addAlias(alias, pubKey);
      }
    } catch (error) {
      console.log('here??', error)
    }
  }

  private async addAlias(alias: string, pubKey: string): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(['aliases'], 'readwrite');
    const store = tx.objectStore('aliases');
    await store.add({ pubKey, alias });
    await tx.done
  }

  private async removeAlias(alias: string): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(['aliases'], 'readwrite');
    const store = tx.objectStore('aliases');
    await store.delete(alias);
    await tx.done;
  }

  private async getAliasDb(): Promise<IDBPDatabase> {
    const db = await openDB('Aliases', 1, {
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

    // const resp = Auth.worker.importKey(wifKey);
    // console.log("keys are imported ", resp);
    // console.log(Auth.worker.getPublicKeys());
  }

  // get key or keys here
  public async authorize(password: string): Promise<void> {
    await this.initialize();

    // if (Auth.worker.isWalletExist()) {
    //   Auth.worker.unlock(password); // handle unlock response
    //   // Authorise internally with registered key,
    //   // return auth response
    // } else {
    //   throw new GenericError("No user exist, please register first.");
    // }
  }

  public async logout(): Promise<void> {
    await this.initialize();
  }

  public async sign(): Promise<void> {
    await this.initialize();
  }
}

const exports = {
  Auth
}

declare const Comlink: any;
Comlink.expose(exports);

export type WorkerExpose = typeof exports;
export type { Auth }

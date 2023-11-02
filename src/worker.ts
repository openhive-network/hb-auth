import { type IDBPDatabase, openDB, deleteDB } from "idb";
import createBeekeeperApp, {
  type IBeekeeperSession,
  type IBeekeeperInstance,
  type IBeekeeperWallet,
} from "@hive/beekeeper";
import { GenericError } from "./errors";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

const BEEKEEPER_LOGS = true;
// const SESSION_HEALTH_CHECK = 2000;
const noop = async (): Promise<void> => { };

export interface AuthUser {
  username: string;
  authorized: boolean;
}

class AuthWorker {
  public readonly Ready: Promise<AuthWorker>;
  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly storage = "/storage_root";
  private readonly aliasStorage = "/aliases";
  private sessionEndCallback = noop;
  // private _interval!: ReturnType<typeof setInterval>;

  constructor() {
    this.Ready = new Promise((resolve, reject) => {
      this.initializeBeekeeperApp()
        .then(() => {
          resolve(this);
        })
        .catch(reject);
    });
  }

  private async initializeBeekeeperApp(): Promise<void> {
    this.api = await createBeekeeperApp({
      enableLogs: BEEKEEPER_LOGS,
      storageRoot: this.storage,
      unlockTimeout: 900 // TODO: handle timeout properly for opened wallets
    });
    this.session = await this.api.createSession(self.crypto.randomUUID());
  }

  public setSessionEndCallback(callback: () => Promise<void> = noop): void {
    this.sessionEndCallback = callback;
  }

  public async authorizeNewUser(
    password: string,
    wifKey: string,
    username: string,
    keyType: string,
  ): Promise<void> {
    try {
      const unlocked = await this.session.createWallet(username, password);
      const pubKey = await unlocked.wallet.importKey(wifKey);

      if (username) {
        await this.addAlias(username, pubKey, keyType);
      }
    } catch (error) {
      throw new GenericError("Authorization error");
    }
  }

  public async authenticate(username: string, password: string): Promise<void> {
    try {
      const w = await this.getExistingWallet();

      if (w && w.name === username) {
        await w.unlock(password);
      } else {
        throw new GenericError("Invalid Credentials");
      }
    } catch (error) {
      throw new GenericError("Invalid Credentials")
    }
  }

  public async getExistingWallet(): Promise<IBeekeeperWallet | undefined> {
    const [wallet] = await this.session.listWallets();
    return wallet;
  }

  public async sign(digest: string, keyType?: string): Promise<string> {
    try {
      const wallet = await this.getExistingWallet();
      if (!wallet?.unlocked) throw new GenericError("Not authorized");
      // refactor this to select from multiple type of keys owner/active
      const [pubKey] = await wallet.unlocked.getPublicKeys();

      const signed = await wallet.unlocked.signDigest(pubKey, digest)
      return signed;
    } catch (err: any) {
      throw new GenericError(err.message)
    }
  }

  public async lockAll(): Promise<void> {
    await this.session.lockAll();
  }

  public async unregister(): Promise<void> {
    await this.api.delete();
    const storage = openDB(this.storage);
    await (await storage).clear("FILE_DATA");
    await deleteDB(this.aliasStorage);
    // clearInterval(this._interval);
  }

  private async addAlias(
    alias: string,
    pubKey: string,
    keyType: string,
  ): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(["aliases"], "readwrite");
    const store = tx.objectStore("aliases");
    await store.add({ pubKey, alias: `${alias}@${keyType}` });
    await tx.done;
    db.close();
  }

  private async removeAlias(alias: string): Promise<void> {
    const db = await this.getAliasDb();
    const tx = db.transaction(["aliases"], "readwrite");
    const store = tx.objectStore("aliases");
    await store.delete(alias);
    await tx.done;
    db.close();
  }

  private async getAliasDb(): Promise<IDBPDatabase> {
    const db = await openDB(this.aliasStorage, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("aliases")) {
          const store = db.createObjectStore("aliases", { keyPath: "alias" });
          store.createIndex("alias", "alias", { unique: true });
        }
      },
    });
    return db;
  }
}

class Auth {
  #worker: AuthWorker | undefined;
  constructor(private readonly chainId: string) { }

  private async getWorker(): Promise<AuthWorker> {
    if (this.#worker !== undefined) return this.#worker;

    this.#worker = await new AuthWorker().Ready;
    return this.#worker;
  }

  public async register(
    password: string,
    wifKey: string,
    username: string,
    keyType: string,
  ): Promise<void> {
    await (
      await this.getWorker()
    ).authorizeNewUser(password, wifKey, username, keyType);
  }

  public async authenticate(username: string, password: string): Promise<void> {
    await (await this.getWorker()).authenticate(username, password);
  }

  public async lock(): Promise<void> {
    await (await this.getWorker()).lockAll();
  }

  public async logout(): Promise<void> {
    await (await this.getWorker()).unregister();
    this.#worker = undefined;
  }

  public async setSessionEndCallback(
    callback: () => Promise<void> = noop,
  ): Promise<void> {
    (await this.getWorker()).setSessionEndCallback(callback);
  }

  public async sign(digest: string, keyType?: string): Promise<string> {
    return await (await this.getWorker()).sign(digest, keyType);
  }

  public async getCurrentAuth(): Promise<AuthUser | null> {
    try {
      const wallet = await (await this.getWorker()).getExistingWallet();

      if (!wallet) return null;

      return {
        authorized: !!wallet.unlocked,
        username: wallet.name,
      };
    } catch (err) {
      return null;
    }
  }
}

const exports = {
  Auth,
};

declare const Comlink: any;
Comlink.expose(exports);

export type WorkerExpose = typeof exports;
export type { Auth };

import { type IDBPDatabase, openDB } from "idb";
import createBeekeeperApp, {
  type IBeekeeperSession,
  type IBeekeeperInstance,
  type IBeekeeperWallet,
} from "@hive/beekeeper";
import { AuthorizationError, GenericError, InternalError } from "./errors";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

const BEEKEEPER_LOGS = true;
const KEY_TYPES = ["active", "posting"] as const;
// const SESSION_HEALTH_CHECK = 2000;
const noop = async (): Promise<void> => {};

export type KeyAuthorityType = (typeof KEY_TYPES)[number];

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
      unlockTimeout: 900, // TODO: handle timeout properly for opened wallets
    });
    this.session = await this.api.createSession(self.crypto.randomUUID());
  }

  public setSessionEndCallback(callback: () => Promise<void> = noop): void {
    this.sessionEndCallback = callback;
  }

  public async authorizeNewUser(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    if (!username || !password || !wifKey || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    try {
      const unlocked = await this.session.createWallet(username, password);
      const pubKey = await unlocked.wallet.importKey(wifKey);

      await this.addAlias(username, pubKey, keyType);
    } catch (error) {
      if (String(error).includes("key")) {
        throw new AuthorizationError("Invalid key or key format");
      } else {
        throw new AuthorizationError("Invalid credentials");
      }
    }
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    if (!username || !password || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    try {
      const w = await this.getWallet(username);

      if (w && w.name === username) {
        await w.unlock(password);
      } else {
        throw new AuthorizationError("User not found");
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new AuthorizationError(error.message);
      } else {
        throw new InternalError(error);
      }
    }
  }

  public async getWallet(name: string): Promise<IBeekeeperWallet | undefined> {
    const wallets = await this.getWallets();
    return wallets.find((wallet) => wallet.name === name);
  }

  public async getWallets(): Promise<IBeekeeperWallet[]> {
    return await this.session.listWallets();
  }

  public async sign(
    username: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    try {
      const wallet = await this.getWallet(username);
      if (!wallet?.unlocked) throw new AuthorizationError("Not authorized");
      // TODO: refactor this to select from multiple type of keys owner/active
      const [pubKey] = await wallet.unlocked.getPublicKeys();
      // TODO: find pubkey here for given keytype and alias
      console.log(pubKey);
      const signed = await wallet.unlocked.signDigest(pubKey, digest);
      return signed;
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async lock(): Promise<void> {
    try {
      await this.api.delete();
      await this.sessionEndCallback();
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    try {
      await this.api.delete();
      await this.removeAlias(`${username}@${keyType}`);
      // clearInterval(this._interval);
    } catch (error) {
      throw new InternalError(error);
    }
  }

  private async addAlias(
    alias: string,
    pubKey: string,
    keyType: KeyAuthorityType,
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

  private checkKeyType(keyType: KeyAuthorityType): void {
    if (!KEY_TYPES.includes(keyType)) {
      throw new AuthorizationError(
        "Invalid key type. Only 'active' or 'posting' key supported",
      );
    }
  }
}

class Auth {
  #worker: AuthWorker | undefined;

  private async getWorker(): Promise<AuthWorker> {
    try {
      if (this.#worker !== undefined) return this.#worker;

      this.#worker = await new AuthWorker().Ready;
      return this.#worker;
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async register(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (
      await this.getWorker()
    ).authorizeNewUser(username, password, wifKey, keyType);
  }

  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (await this.getWorker()).unregister(username, keyType);
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (await this.getWorker()).authenticate(username, password, keyType);
  }

  public async logout(): Promise<void> {
    await (await this.getWorker()).lock();
    this.#worker = undefined;
  }

  public async setSessionEndCallback(
    callback: () => Promise<void> = noop,
  ): Promise<void> {
    (await this.getWorker()).setSessionEndCallback(callback);
  }

  public async sign(
    username: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await (await this.getWorker()).sign(username, digest, keyType);
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    try {
      const wallet = await (await this.getWorker()).getWallet(username);

      if (!wallet) return null;

      return {
        authorized: !!wallet.unlocked,
        username: wallet.name,
      };
    } catch (error) {
      throw new GenericError(`Internal error: \n${error as string}`);
    }
  }

  public async getAuths(): Promise<AuthUser[]> {
    try {
      const wallets = await (await this.getWorker()).getWallets();

      return wallets.map(({ unlocked, name }) => ({
        authorized: !!unlocked,
        username: name,
      }));
    } catch (error) {
      throw new GenericError(`Internal error: \n${error as string}`);
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

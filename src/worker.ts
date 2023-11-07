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
const noop = async (): Promise<void> => { };

export type KeyAuthorityType = (typeof KEY_TYPES)[number];

export interface AuthUser {
  username: string;
  authorized: boolean;
}

// This class is used to initiate new wasm application while registering a new user
// It deals with signing process during first authorization phase
class Registration {
  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly storage = "/registration";

  public async request(
    username: string,
    wifKey: string,
    digest: string,
  ): Promise<string> {
    this.api = await createBeekeeperApp({
      unlockTimeout: 10,
      storageRoot: this.storage,
    });
    this.session = await this.api.createSession(self.crypto.randomUUID());
    const wallet = await this.session.createWallet(username);
    await wallet.wallet.importKey(wifKey);
    const [pubKey] = await wallet.wallet.getPublicKeys();

    const signed = await wallet.wallet.signDigest(pubKey, digest);
    return signed;
  }

  public async clear(): Promise<void> {
    await this.api.delete();
    const db = await openDB(this.storage);
    await db.clear("FILE_DATA")
  }
}

class AuthWorker {
  public readonly Ready: Promise<AuthWorker>;
  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly storage = "/storage_root";
  private readonly aliasStorage = "/aliases";
  private sessionEndCallback = noop;
  private _generator!: AsyncGenerator<string, string>;
  private _registration: Registration | undefined;
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

  public async onAuthComplete(): Promise<void> {
    await this._registration?.clear();
    this._registration = undefined;
    await this._generator.next()
  }

  private async * processNewRegistration(username: string, password: string, wifKey: string, keyType: KeyAuthorityType, digest: string): AsyncGenerator<any> {
    try {
      this._registration = new Registration();
      const signed = await this._registration.request(username, wifKey, digest);
      // first yield signed transaction
      yield await Promise.resolve(signed);

      // later register new user
      yield await this.saveUser(username, password, wifKey, keyType);
    } catch (error) {
      throw new InternalError(`Registration failed: ${error as string}`)
    }
  }

  public async registerUser(username: string, password: string, wifKey: string, keyType: KeyAuthorityType, digest: string): Promise<string> {
    if (!username || !password || !wifKey || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    this._generator = this.processNewRegistration(username, password, wifKey, keyType, digest);

    return (await this._generator.next()).value
  }

  public async saveUser(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    try {
      const unlocked = await this.session.createWallet(username, password);
      const pubKey = await unlocked.wallet.importKey(wifKey);

      await this.addAlias(username, pubKey, keyType);

      return 'success';
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
    digest: string
  ): Promise<string> {
    if (!username || !password || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    try {
      const w = await this.getWallet(username);

      if (w && w.name === username) {
        await w.unlock(password);
        return await this.sign(username, digest, keyType);
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
    digest: string
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).registerUser(username, password, wifKey, keyType, digest);
  }

  public async onAuthComplete(): Promise<void> {
    await (await this.getWorker()).onAuthComplete();
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
    digest: string
  ): Promise<string> {
    return await (await this.getWorker()).authenticate(username, password, keyType, digest);
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

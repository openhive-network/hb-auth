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
const SESSION_HEALTH_CHECK = 2000;
const noop = async (): Promise<void> => { };

export type KeyAuthorityType = (typeof KEY_TYPES)[number];

export interface AuthUser {
  username: string;
  authorized: boolean;
  loggedInKeyType: KeyAuthorityType | undefined;
  registeredKeyTypes: KeyAuthorityType[];
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
    this.session = this.api.createSession(self.crypto.randomUUID());
    const wallet = await this.session.createWallet(username);
    await wallet.wallet.importKey(wifKey);
    const [pubKey] = wallet.wallet.getPublicKeys();

    const signed = wallet.wallet.signDigest(pubKey, digest);
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
  private _loggedInUser: Omit<AuthUser, 'authorized'> | undefined;
  private _generator!: AsyncGenerator<string, string>;
  private _registration: Registration | undefined;
  private _interval!: ReturnType<typeof setInterval>;

  public get loggedInUser(): Omit<AuthUser, 'authorized'> | undefined {
    return this._loggedInUser;
  }

  public set loggedInUser(user: Omit<AuthUser, 'authorized'> | undefined) {
    this._loggedInUser = user;
  }

  constructor(private readonly sessionTimeout: number) {
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
      unlockTimeout: this.sessionTimeout,
    });
    this.session = this.api.createSession(self.crypto.randomUUID());
  }

  public setSessionEndCallback(callback: () => Promise<void> = noop): void {
    this.sessionEndCallback = callback;
  }

  private isValidSession(): boolean {
    const { now, timeout_time } = this.session.getInfo();
    return new Date(now).getTime() < new Date(timeout_time).getTime();
  }

  private startSessionInterval(): void {
    this._interval = setInterval(async () => {
      if (!this.isValidSession()) {
        await this.lock();
      } else {
        // still valid auth session
      }
    }, SESSION_HEALTH_CHECK);
  }

  private clearSessionInterval(): void {
    clearInterval(this._interval);
  }

  public async onAuthComplete(failed?: boolean): Promise<void> {
    await this._registration?.clear();
    this._registration = undefined;

    if (failed) {
      await this._generator.throw(new AuthorizationError("Invalid credentials"));
    } else {
      this.startSessionInterval();
      await this._generator?.next()
    }
  }

  private async * processNewRegistration(username: string, password: string, wifKey: string, keyType: KeyAuthorityType, digest: string): AsyncGenerator<any> {
    try {
      this._registration = new Registration();
      const signed = await this._registration.request(username, wifKey, digest);

      // first yield signed transaction
      yield await Promise.resolve(signed);

      // later register new user
      yield await this.saveUser(username, password, wifKey, keyType);
    } catch (error: any) {
      // clear registration on error
      await this._registration?.clear();

      if (error instanceof AuthorizationError) {
        throw new AuthorizationError(error.message);
      } else {
        if (String(error).includes("key")) {
          throw new AuthorizationError("Invalid key or key format");
        } else {
          throw new AuthorizationError("Invalid credentials");
        }
      }
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
    const wallets = await this.getWallets();
    const exist = wallets.find((wallet) => wallet.name === username);

    if (exist) {
      const alias = await this.getAlias(`${username}@${keyType}`);
      if (alias?.alias) throw new AuthorizationError(`This user is already registered with '${keyType}' authority`);

      const unlocked = exist.unlock(password);
      const pubKey = await unlocked.importKey(wifKey);
      await this.addAlias(username, pubKey, keyType);
    } else {
      const unlocked = await this.session.createWallet(username, password);
      const pubKey = await unlocked.wallet.importKey(wifKey);
      await this.addAlias(username, pubKey, keyType);
    }

    if (!this.loggedInUser) {
      this.loggedInUser = {
        username,
        loggedInKeyType: keyType,
        registeredKeyTypes: await this.getRegisteredKeyTypes(username)
      }
    }

    return 'success';
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
        w.unlock(password);
        return await this.sign(username, digest, keyType);
      } else {
        throw new AuthorizationError("User not found");
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new AuthorizationError(error.message);
      } else {
        if (String(error).includes("already")) {
          throw new AuthorizationError("User is already logged in");
        } else {
          throw new InternalError(error);
        }
      }
    }
  }

  public async getWallet(name: string): Promise<IBeekeeperWallet | undefined> {
    const wallets = await this.getWallets();
    return wallets.find((wallet) => wallet.name === name);
  }

  public async getWallets(): Promise<IBeekeeperWallet[]> {
    return this.session.listWallets();
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    try {
      const wallet = await this.getWallet(username)

      if (!wallet) return null;

      return {
        authorized: !!wallet.unlocked,
        username: wallet.name,
        loggedInKeyType: this.loggedInUser?.username === username ? this.loggedInUser.loggedInKeyType : undefined,
        registeredKeyTypes: await this.getRegisteredKeyTypes(username)
      };
    } catch (error) {
      throw new GenericError(`Internal error: \n${error as string}`);
    }
  }

  public async getAuths(): Promise<AuthUser[]> {
    try {
      const authUsers = [];

      for await (const { name } of await this.getWallets()) {
        const user = await this.getAuthByUser(name);
        if (user) {
          authUsers.push(user);
        }
      }

      return authUsers;
    } catch (error) {
      throw new GenericError(`Internal error: \n${error as string}`);
    }
  }

  public async sign(
    username: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    try {
      const wallet = await this.getWallet(username);
      if (!wallet?.unlocked) throw new AuthorizationError("Not authorized");
      const keys = wallet.unlocked.getPublicKeys();
      const alias = await this.getAlias(`${username}@${keyType}`);
      const foundKey = keys.find((key) => key === alias?.pubKey);

      if (!foundKey) {
        wallet.unlocked?.lock();
        throw new AuthorizationError('Not authorized, missing authority');
      }

      const signed = wallet.unlocked.signDigest(foundKey, digest);

      if (!this.loggedInUser) {
        this.loggedInUser = {
          username,
          loggedInKeyType: keyType,
          registeredKeyTypes: await this.getRegisteredKeyTypes(username)
        }
      }

      return signed;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        throw new InternalError(error);
      }
    }
  }

  public async logout(): Promise<void> {
    try {
      await this.sessionEndCallback();
      this.clearSessionInterval();
      this.loggedInUser = undefined;
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async lock(): Promise<void> {
    try {
      if (!this.isValidSession() || !this.loggedInUser) {
        throw new AuthorizationError("There is no existing user session or session already expired");
      } else {
        const wallet = await this.getWallet(this.loggedInUser.username);
        wallet?.unlocked?.lock();
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        throw new InternalError(error);
      }
    }
  }

  public async unlock(username: string, password: string): Promise<void> {
    try {
      const wallet = await this.getWallet(username);

      if (!this.isValidSession()) {
        throw new InternalError("There is no existing user session or session already expired");
      }

      if (!wallet) {
        throw new AuthorizationError("User not found");
      } else {
        wallet?.unlock(password);
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        throw new InternalError(error);
      }
    }
  }

  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    try {
      await this.api.delete();
      await this.removeAlias(`${username}@${keyType}`);
      this.loggedInUser = undefined;
      this.clearSessionInterval();
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

  private async getAlias(alias: string): Promise<{ alias: string, pubKey: string }> {
    const db = await this.getAliasDb();
    return await db.get('aliases', alias);
  }

  private async getRegisteredKeyTypes(username: string): Promise<KeyAuthorityType[]> {
    const db = await this.getAliasDb();
    const keys = await db.getAllKeys('aliases') as string[];
    const types: KeyAuthorityType[] = [];

    keys.forEach((key) => {
      const [walletName, keyType] = key.split('@') as [string, KeyAuthorityType];
      if (walletName === username) {
        types.push(keyType);
      }
    });

    return types;
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
  static #worker: AuthWorker | undefined;

  constructor(private readonly sessionTimeout: number) { }

  private async getWorker(): Promise<AuthWorker> {
    try {
      if (Auth.#worker !== undefined) return Auth.#worker;

      Auth.#worker = await new AuthWorker(this.sessionTimeout).Ready;
      return Auth.#worker;
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

  public async onAuthComplete(failed: boolean): Promise<void> {
    await (await this.getWorker()).onAuthComplete(failed);
  }

  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (await this.getWorker()).unregister(username, keyType);
  }

  public async lock(): Promise<void> {
    await (await this.getWorker()).lock();
  }

  public async unlock(username: string, password: string): Promise<void> {
    await (await this.getWorker()).unlock(username, password);
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
    await (await this.getWorker()).logout();
    Auth.#worker = undefined;
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
    return await (await this.getWorker()).getAuthByUser(username);
  }

  public async getAuths(): Promise<AuthUser[]> {
    return await (await this.getWorker()).getAuths();
  }
}

const exports = {
  Auth,
};

declare const Comlink: any;
declare let onconnect: any;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
onconnect = (event: any) => {
  const port = event.ports[0];

  Comlink.expose(exports, port);
}

Comlink.expose(exports);

export type WorkerExpose = typeof exports;
export type { Auth };

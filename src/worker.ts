import { type IDBPDatabase, openDB } from "idb";
import * as Comlink from "comlink";
import createBeekeeperApp, {
  type IBeekeeperSession,
  type IBeekeeperInstance,
  type IBeekeeperWallet,
  type IBeekeeperUnlockedWallet,
} from "@hiveio/beekeeper";
import { AuthorizationError, GenericError, InternalError } from "./errors";

// adjust this when breaking changes are made
const IDB_VERSION = "v3";

const BEEKEEPER_LOGS = true;
const KEY_TYPES = ["active", "posting", "owner"] as const;
const SESSION_HEALTH_CHECK = 2000;
const noop = async (): Promise<void> => {};

export type KeyAuthorityType = (typeof KEY_TYPES)[number];

export interface UserSettings {
  strict: boolean;
  alias: string;
}

export interface AuthUser {
  username: string;
  unlocked: boolean;
  authorized: boolean;
  loggedInKeyType: KeyAuthorityType | undefined;
  registeredKeyTypes: KeyAuthorityType[];
}

class AuthWorker {
  public readonly Ready: Promise<AuthWorker>;
  private api!: IBeekeeperInstance;
  private session!: IBeekeeperSession;
  private readonly storage = `/storage_root_${IDB_VERSION}`;
  private readonly aliasStorage = `/aliases_${IDB_VERSION}`;
  private sessionEndCallback = noop;
  private _loggedInUser: AuthUser | undefined;
  private _generator!: AsyncGenerator<string, string>;
  private _interval!: ReturnType<typeof setInterval>;
  private readonly settingsStorage = `/settings_${IDB_VERSION}`;

  public get loggedInUser(): AuthUser | undefined {
    return this._loggedInUser;
  }

  public set loggedInUser(user: AuthUser | undefined) {
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
    if (failed) {
      await this._generator.throw(
        new AuthorizationError("Invalid credentials"),
      );
    } else {
      if (this.loggedInUser) {
        this.loggedInUser = {
          ...this.loggedInUser,
          authorized: true,
        };
      }

      this.startSessionInterval();
      await this._generator?.next();
    }
  }

  private async *processNewRegistration(
    username: string,
    password: string,
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean,
  ): AsyncGenerator<any> {
    try {
      const timestamp = Date.now();
      const tempWalletName = `${username}_temp_${timestamp}`;
      const registation = await this.session.createWallet(
        tempWalletName,
        password,
        true,
      );
      const pKey = await registation.wallet.importKey(wifKey);
      const signed = registation.wallet.signDigest(pKey, digest);
      await registation.wallet.removeKey(pKey);
      registation.wallet.close();

      // first yield signed transaction
      yield await Promise.resolve(signed);

      // later register new user
      yield await this.saveUser(username, password, wifKey, keyType, strict);
    } catch (error: any) {
      if (error instanceof AuthorizationError) {
        throw new AuthorizationError(error.message);
      } else {
        if (String(error).includes("key")) {
          throw new AuthorizationError("Invalid key or key format");
        } else {
          throw new AuthorizationError(error);
        }
      }
    }
  }

  public async registerUser(
    username: string,
    password: string,
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
  ): Promise<string> {
    if (!username || !password || !wifKey || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    this._generator = this.processNewRegistration(
      username,
      password,
      digest,
      wifKey,
      keyType,
      strict,
    );

    return (await this._generator.next()).value;
  }

  public async saveUser(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
  ): Promise<string> {
    const exist = await this.getWallet(username);

    if (exist) {
      if (exist?.unlocked) {
        await this.importKey(exist.unlocked, wifKey, keyType);
      } else {
        const unlocked = exist.unlock(password);
        await this.importKey(unlocked, wifKey, keyType);
      }
    } else {
      const { wallet } = await this.session.createWallet(username, password);
      await this.importKey(wallet, wifKey, keyType);
    }

    if (!this.loggedInUser) {
      this.loggedInUser = {
        username,
        authorized: true,
        unlocked: true,
        loggedInKeyType: keyType,
        registeredKeyTypes: await this.getRegisteredKeyTypes(username),
      };
    }

    await this.setUserSettings(username, { strict });
    return "success";
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
    digest: string,
  ): Promise<string> {
    if (!username || !password || !keyType) {
      throw new AuthorizationError("Empty field");
    }

    this.checkKeyType(keyType);

    try {
      const authUser = await this.getAuthByUser(username);

      // Check if user is already logged in and authorized
      if (authUser?.authorized && this.isValidSession()) {
        throw new AuthorizationError("User is already logged in");
      }

      const w = await this.getWallet(username);

      if (w && w.name === username) {
        await this.unlock(username, password);

        this._loggedInUser = {
          username,
          unlocked: true,
          authorized: false,
          loggedInKeyType: keyType,
          registeredKeyTypes: await this.getRegisteredKeyTypes(username),
        };

        return await this.sign(username, digest, keyType);
      } else {
        throw new AuthorizationError("User not found");
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        if (String(error).toLowerCase().includes("invalid password")) {
          throw new AuthorizationError("Invalid credentials xxx");
        } else {
          throw new InternalError(error);
        }
      }
    }
  }

  private async importKey(
    wallet: IBeekeeperUnlockedWallet,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    this.checkKeyType(keyType);

    try {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const alias = await this.getAlias(`${wallet.name}@${keyType}`);
      if (alias?.alias)
        throw new AuthorizationError(
          `This user is already registered with '${keyType}' authority`,
        );

      const pubKey = await wallet.importKey(wifKey);
      await this.addAlias(wallet.name, pubKey, keyType);
      return pubKey;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        throw new InternalError(error);
      }
    }
  }

  public async importKeyForUser(
    username: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    const wallet = await this.getWallet(username);
    if (wallet?.unlocked) {
      return await this.importKey(wallet?.unlocked, wifKey, keyType);
    } else {
      throw new AuthorizationError(
        "User is not logged in. Please login for importing key",
      );
    }
  }

  private async getWallet(name: string): Promise<IBeekeeperWallet | undefined> {
    const wallets = await this.getWallets();
    return wallets.find((wallet) => wallet.name === name);
  }

  private async getWallets(): Promise<IBeekeeperWallet[]> {
    return this.session.listWallets();
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    try {
      const wallet = await this.getWallet(username);

      if (!wallet) return null;

      const isCurrentUser = this.loggedInUser?.username === username;

      return {
        authorized:
          isCurrentUser &&
          !!this.loggedInUser?.authorized &&
          !!wallet?.unlocked,
        unlocked: !!wallet?.unlocked,
        username: wallet?.name ?? username,
        loggedInKeyType: isCurrentUser
          ? this.loggedInUser?.loggedInKeyType
          : undefined,
        registeredKeyTypes: await this.getRegisteredKeyTypes(username),
      };
    } catch (error) {
      throw new InternalError(error);
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

  public async singleSign(
    username: string,
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    this.checkKeyType(keyType);
    try {
      const timestamp = Date.now();
      const tempWalletName = `${username}_temp_${timestamp}`;
      const tempPassword = `${username}_${digest}_${timestamp}`;
      const tempWallet = await this.session.createWallet(
        tempWalletName,
        tempPassword,
        true,
      );
      const pKey = await tempWallet.wallet.importKey(wifKey);
      const signed = tempWallet.wallet.signDigest(pKey, digest);
      await tempWallet.wallet.removeKey(pKey);
      tempWallet.wallet.close();

      return signed;
    } catch (error) {
      throw new InternalError(error);
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
        throw new AuthorizationError("Not authorized, missing authority");
      }

      const signed = wallet.unlocked.signDigest(foundKey, digest);

      if (!this.loggedInUser) {
        this.loggedInUser = {
          username,
          unlocked: true,
          authorized: true,
          loggedInKeyType: keyType,
          registeredKeyTypes: await this.getRegisteredKeyTypes(username),
        };
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
    await this.sessionEndCallback();
    this.clearSessionInterval();
    // Clear the session
    if (this.loggedInUser) {
      const wallet = await this.getWallet(this.loggedInUser.username);
      wallet?.unlocked?.lock();
    }
    // Clear the logged in user state completely
    this._loggedInUser = undefined;
  }

  public async lock(): Promise<void> {
    try {
      if (!this.isValidSession() || !this.loggedInUser) {
        throw new AuthorizationError(
          "There is no existing user session or session already expired",
        );
      } else {
        const wallet = await this.getWallet(this.loggedInUser.username);
        wallet?.unlocked?.lock();
        if (this.loggedInUser) {
          this.loggedInUser.unlocked = false;
        }
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
        throw new InternalError(
          "There is no existing user session or session already expired",
        );
      }

      if (!wallet) {
        throw new AuthorizationError("User not found");
      }

      // Add check for already unlocked wallet
      if (!wallet.unlocked) {
        wallet.unlock(password);
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        if (String(error).toLowerCase().includes("invalid password")) {
          throw new AuthorizationError("Invalid credentials");
        } else {
          throw new InternalError(error);
        }
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

  private async getAlias(
    alias: string,
  ): Promise<{ alias: string; pubKey: string }> {
    const db = await this.getAliasDb();
    return await db.get("aliases", alias);
  }

  private async getRegisteredKeyTypes(
    username: string,
  ): Promise<KeyAuthorityType[]> {
    const db = await this.getAliasDb();
    const keys = (await db.getAllKeys("aliases")) as string[];
    const types: KeyAuthorityType[] = [];

    keys.forEach((key) => {
      const [walletName, keyType] = key.split("@") as [
        string,
        KeyAuthorityType,
      ];
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

  public async getUserSettings(
    username: string,
  ): Promise<UserSettings | undefined> {
    const db = await openDB(this.settingsStorage, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("settings")) {
          const store = db.createObjectStore("settings", { keyPath: "alias" });
          store.createIndex("alias", "alias", { unique: true });
        }
      },
    });

    return await db.get("settings", username);
  }

  public async setUserSettings(
    username: string,
    settings: Partial<UserSettings>,
  ): Promise<void> {
    const db = await openDB(this.settingsStorage, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("settings")) {
          const store = db.createObjectStore("settings", { keyPath: "alias" });
          store.createIndex("alias", "alias", { unique: true });
        }
      },
    });

    const tx = db.transaction(["settings"], "readwrite");
    const store = tx.objectStore("settings");

    const existing = await store.get(username);
    await store.put({
      ...existing,
      alias: username,
      ...settings,
    });

    await tx.done;
    db.close();
  }
}

class Auth {
  static #worker: AuthWorker | undefined;

  constructor(private readonly sessionTimeout: number) {}

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
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).registerUser(username, password, digest, wifKey, keyType, strict);
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

  public async importKey(
    username: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).importKeyForUser(username, wifKey, keyType);
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
    digest: string,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).authenticate(username, password, keyType, digest);
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

  public async singleSign(
    username: string,
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).singleSign(username, digest, wifKey, keyType);
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    return await (await this.getWorker()).getAuthByUser(username);
  }

  public async getAuths(): Promise<AuthUser[]> {
    return await (await this.getWorker()).getAuths();
  }

  public async getUserSettings(
    username: string,
  ): Promise<UserSettings | undefined> {
    return await (await this.getWorker()).getUserSettings(username);
  }

  public async setUserSettings(
    username: string,
    settings: Partial<UserSettings>,
  ): Promise<void> {
    await (await this.getWorker()).setUserSettings(username, settings);
  }
}

const exports = {
  Auth,
};

declare let onconnect: any;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
onconnect = (event: any) => {
  const port = event.ports[0];

  Comlink.expose(exports, port);
};

Comlink.expose(exports);

export type WorkerExpose = typeof exports;
export type { Auth };

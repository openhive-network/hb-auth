import { type IDBPDatabase, openDB } from "idb";
import * as Comlink from "comlink";
import createBeekeeperApp, {
  type IBeekeeperSession,
  type IBeekeeperInstance,
  type IBeekeeperWallet,
  type IBeekeeperUnlockedWallet,
} from "@hiveio/beekeeper";
import {
  AuthorizationError,
  CheckRequiredError,
  GenericError,
  InternalError,
} from "./errors";
import {
  MARKER_PUBLIC_KEY,
  deriveSettingKey,
  getMarkerWif,
  readStoredSetting,
  readVerifiedSetting,
  writeSetting,
} from "./protected-settings";

// adjust this when breaking changes are made
const IDB_VERSION = "v3";

const KEY_TYPES = ["active", "posting", "owner"] as const;
// Key types `sign` refuses while a user's wallet requires a check first.
const CHECKED_KEY_TYPES: readonly KeyAuthorityType[] = ["active", "owner"];
// Wrong passwords in a row, across every call that checks one, after which
// the user's wallet is locked.
const MAX_FAILED_PASSWORD_CHECKS = 5;
const noop = async (): Promise<void> => {};

const isInvalidPassword = (error: unknown): boolean =>
  String(error).toLowerCase().includes("invalid password");

interface Timings {
  sessionHealthCheck: number;
  beekeeperStartTimeout: number;
  beekeeperDeleteTimeout: number;
}

const DEFAULT_TIMINGS: Timings = {
  sessionHealthCheck: 2000,
  beekeeperStartTimeout: 30000,
  beekeeperDeleteTimeout: 30000,
};

// Tests override these by setting `hbAuthTimings` on the worker's global
// scope; it is read on every use, so it can change between calls.
const timing = (name: keyof Timings): number => {
  const value = (self as { hbAuthTimings?: Partial<Timings> }).hbAuthTimings?.[
    name
  ];
  return typeof value === "number" ? value : DEFAULT_TIMINGS[name];
};

export type KeyAuthorityType = (typeof KEY_TYPES)[number];

export interface UserSettings {
  strict: {
    [K in KeyAuthorityType]?: boolean;
  };
  alias: string;
  authorizedAccounts?: {
    [K in KeyAuthorityType]?: string;
  };
}

export interface AuthUser {
  username: string;
  unlocked: boolean;
  authorized: boolean;
  loggedInKeyType: KeyAuthorityType | undefined;
  registeredKeyTypes: KeyAuthorityType[];
}

export type LoggedInUsers = Record<string, AuthUser>;

export class AuthWorker {
  public readonly Ready: Promise<AuthWorker>;
  #api!: IBeekeeperInstance;
  #session!: IBeekeeperSession;
  private readonly storage = `/storage_root_${IDB_VERSION}`;
  private readonly aliasStorage = `/aliases_${IDB_VERSION}`;
  private sessionEndCallback = noop;
  private _generator!: AsyncGenerator<string, string>;
  private _intervals: Record<string, ReturnType<typeof setInterval>> = {};
  private readonly settingsStorage = `/settings_${IDB_VERSION}`;
  #loggedInUsers: LoggedInUsers = {};
  #deletion: Promise<void> | undefined;
  // Settles once every beekeeper call queued so far has settled.
  #beekeeperQueue: Promise<void> = Promise.resolve();
  // Per user, the key that verifies the protected-setting record, derived from
  // the password that last unlocked the user's wallet in the signing session.
  #settingKeys: Record<string, CryptoKey> = {};
  #failedPasswordChecks: Record<string, number> = {};

  private readonly sessionTimeout: number;

  constructor(sessionTimeout: number) {
    this.sessionTimeout = sessionTimeout;

    this.Ready = new Promise((resolve, reject) => {
      this.initializeBeekeeperApp()
        .then(() => {
          resolve(this);
        })
        .catch(reject);
    });
  }

  private async initializeBeekeeperApp(): Promise<void> {
    this.#api = await createBeekeeperApp({
      storageRoot: this.storage,
      unlockTimeout: this.sessionTimeout,
    });
    this.#session = await this.beekeeper(() =>
      this.#api.createSession(self.crypto.randomUUID()),
    );

    // Initialize intervals for any existing logged in users
    const wallets = await this.listWallets();
    for (const wallet of wallets) {
      if (wallet.unlocked) {
        this.startSessionInterval(wallet.name);
      }
    }
  }

  // Beekeeper refuses a call while an asynchronous one is running, and this
  // worker serves every tab, so every beekeeper call goes through here,
  // reading a wallet's `unlocked` included (it locks a timed-out wallet).
  // Calls run one at a time, in the order they were made; a failed call
  // rejects only its own caller. `call` must not queue another call itself:
  // that one would wait for `call` to finish, which waits for it.
  private async beekeeper<T>(call: () => T | Promise<T>): Promise<T> {
    const result = this.#beekeeperQueue.then(call);
    this.#beekeeperQueue = result.then(noop, noop);
    return await result;
  }

  public setSessionEndCallback(callback: () => Promise<void> = noop): void {
    this.sessionEndCallback = callback;
  }

  public async dispose(): Promise<void> {
    await this.beekeeper(async () => {
      await this.#api.delete();
    });
  }

  // Only from inside a queued beekeeper call.
  private isValidSession(): boolean {
    const { now, timeoutTime } = this.#session.getInfo();
    return new Date(now).getTime() < new Date(timeoutTime).getTime();
  }

  private startSessionInterval(username: string): void {
    // Clear any existing interval for this user
    if (this._intervals[username]) {
      this.clearSessionInterval(username);
    }

    this._intervals[username] = setInterval(async () => {
      const expired = await this.beekeeper(() => {
        if (this.isValidSession()) return false;
        this.findWallet(username)?.unlocked?.lock();
        return true;
      });
      if (expired) {
        // Update user state
        if (this.#loggedInUsers[username]) {
          this.#loggedInUsers[username].unlocked = false;
          this.#loggedInUsers[username].authorized = false;
        }

        // Clear interval after locking
        this.clearSessionInterval(username);
      }
    }, timing("sessionHealthCheck"));
  }

  // Locks every wallet once beekeeper's inactivity clock has run out, so that
  // refreshing the clock afterwards cannot revive an expired user's wallet
  // before its session interval gets to lock it. Every beekeeper unlock() has
  // to go through unlockWallet, since unlock() refreshes the clock shared by
  // all wallets.
  private async lockExpiredSession(): Promise<void> {
    if (await this.beekeeper(() => this.lockAllIfExpired())) {
      this.markAllLocked();
    }
  }

  // Only from inside a queued beekeeper call.
  private lockAllIfExpired(): boolean {
    if (this.isValidSession()) return false;
    this.#session.lockAll();
    return true;
  }

  private markAllLocked(): void {
    for (const user of Object.values(this.#loggedInUsers)) {
      user.unlocked = false;
      user.authorized = false;
    }
    this.clearAllSessionIntervals();
  }

  private async unlockWallet(
    wallet: IBeekeeperWallet,
    password: string,
  ): Promise<IBeekeeperUnlockedWallet> {
    await this.lockExpiredSession();
    return await this.beekeeper(async () => await wallet.unlock(password));
  }

  // unlockWallet in the signing session, counting a wrong password.
  private async unlockWithPassword(
    username: string,
    wallet: IBeekeeperWallet,
    password: string,
  ): Promise<IBeekeeperUnlockedWallet> {
    try {
      const unlocked = await this.unlockWallet(wallet, password);
      this.clearFailedPasswordChecks(username);
      return unlocked;
    } catch (error) {
      if (isInvalidPassword(error)) await this.countFailedPasswordCheck(username);
      throw error;
    }
  }

  // Unlocks the user's wallet with `password` in a beekeeper session of its
  // own, hands it to `use` and closes that session, after a failed unlock too.
  // The signing session keeps its state, apart from beekeeper's inactivity
  // clock, which every unlock restarts: an expired session is locked first,
  // in the same queued call, so that the restart cannot revive it. `use` runs
  // inside that call, so it must not queue a beekeeper call itself.
  private async withCheckSession<T>(
    username: string,
    password: string,
    use: (wallet: IBeekeeperUnlockedWallet) => Promise<T>,
  ): Promise<T> {
    let expired = false;
    try {
      const result = await this.beekeeper(async () => {
        expired = this.lockAllIfExpired();
        if (!this.#session.hasWallet(username)) {
          throw new AuthorizationError("User not found");
        }
        const session = this.#api.createSession(self.crypto.randomUUID());
        try {
          return await use(await session.openWallet(username).unlock(password));
        } finally {
          session.close();
        }
      });
      this.clearFailedPasswordChecks(username);
      return result;
    } catch (error) {
      if (isInvalidPassword(error)) {
        await this.countFailedPasswordCheck(username);
        throw new AuthorizationError("Invalid credentials");
      }
      throw error;
    } finally {
      if (expired) this.markAllLocked();
    }
  }

  private clearFailedPasswordChecks(username: string): void {
    this.#failedPasswordChecks = Object.fromEntries(
      Object.entries(this.#failedPasswordChecks).filter(
        ([key]) => key !== username,
      ),
    );
  }

  // While another session has a wallet unlocked, beekeeper compares a password
  // with the one it holds, without its KDF, so guesses would be cheap. After a
  // few wrong ones the wallet is locked, and every further guess costs a full
  // unlock.
  private async countFailedPasswordCheck(username: string): Promise<void> {
    const failed = (this.#failedPasswordChecks[username] ?? 0) + 1;
    this.#failedPasswordChecks[username] = failed;
    if (failed < MAX_FAILED_PASSWORD_CHECKS) return;

    await this.lockWallet(username);
    if (this.#loggedInUsers[username]) {
      this.#loggedInUsers[username].unlocked = false;
    }
  }

  // Puts the marker key into a wallet `password` has just unlocked and keeps
  // the key that verifies its setting record. Returns whether the wallet had no
  // marker yet, i.e. predates the setting.
  private async markProtectedSettingWallet(
    username: string,
    password: string,
    unlocked: IBeekeeperUnlockedWallet,
  ): Promise<{ key: CryptoKey; legacy: boolean }> {
    const key = await deriveSettingKey(username, password);
    this.#settingKeys[username] = key;
    const markerWif = await getMarkerWif();
    const legacy = await this.beekeeper(async () => {
      if (unlocked.getPublicKeys().includes(MARKER_PUBLIC_KEY)) return false;
      await this.importMarkerKey(unlocked, markerWif);
      return true;
    });
    return { key, legacy };
  }

  // Only from inside a queued beekeeper call.
  private async importMarkerKey(
    wallet: IBeekeeperUnlockedWallet,
    markerWif: string,
  ): Promise<void> {
    if ((await wallet.importKey(markerWif)) !== MARKER_PUBLIC_KEY) {
      throw new InternalError("Unexpected protected-setting marker key");
    }
  }

  // After a successful unlock: a wallet from before the setting existed gets
  // a record (off) unless it has a valid one already.
  private async adoptProtectedSetting(
    username: string,
    password: string,
    unlocked: IBeekeeperUnlockedWallet,
  ): Promise<void> {
    const { key, legacy } = await this.markProtectedSettingWallet(
      username,
      password,
      unlocked,
    );
    if (legacy && (await readVerifiedSetting(key, username)) === undefined) {
      await writeSetting(key, username, false);
    }
  }

  private async requiresActiveCheck(username: string): Promise<boolean> {
    const key = this.#settingKeys[username];
    if (!key) return true;
    return (await readVerifiedSetting(key, username)) ?? true;
  }

  private async createTemporaryWallet(
    name: string,
    password: string,
  ): Promise<IBeekeeperUnlockedWallet> {
    const locked = await this.beekeeper(async () => {
      const { wallet } = await this.#session.createWallet(name, password, true);
      return wallet.lock();
    });
    // createWallet does not refresh beekeeper's inactivity clock, so on an
    // instance idle for longer than the session timeout the first key
    // operation would fail; unlock() refreshes it.
    return await this.unlockWallet(locked, password);
  }

  // Signs with a key held only for this signature, then closes the wallet.
  private async signWithTemporaryKey(
    wallet: IBeekeeperUnlockedWallet,
    wifKey: string,
    digest: string,
  ): Promise<string> {
    return await this.beekeeper(async () => {
      const pKey = await wallet.importKey(wifKey);
      const signed = await wallet.signDigest(pKey, digest);
      await wallet.removeKey(pKey);
      wallet.close();
      return signed;
    });
  }

  private clearSessionInterval(username: string): void {
    if (this._intervals[username]) {
      clearInterval(this._intervals[username]);
      this._intervals = Object.fromEntries(
        Object.entries(this._intervals).filter(([key]) => key !== username),
      );
    }
  }

  // Add method to clear all intervals
  private clearAllSessionIntervals(): void {
    Object.keys(this._intervals).forEach((username) => {
      this.clearSessionInterval(username);
    });
  }

  public async onAuthComplete(
    username: string,
    failed?: boolean,
  ): Promise<void> {
    if (failed) {
      await this._generator.throw(
        new AuthorizationError("Invalid credentials"),
      );
    } else {
      if (this.#loggedInUsers[username]) {
        this.#loggedInUsers[username].authorized = true;
      }

      this.startSessionInterval(username);
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
    requireActiveCheck: boolean,
  ): AsyncGenerator<any> {
    try {
      const timestamp = Date.now();
      const tempWalletName = `${username}_temp_${timestamp}`;
      const tempWallet = await this.createTemporaryWallet(
        tempWalletName,
        password,
      );
      const signed = await this.signWithTemporaryKey(
        tempWallet,
        wifKey,
        digest,
      );

      // first yield signed transaction
      yield await Promise.resolve(signed);

      // later register new user
      yield await this.saveUser(
        username,
        password,
        wifKey,
        keyType,
        strict,
        requireActiveCheck,
      );
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
    requireActiveCheck: boolean = false,
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
      requireActiveCheck,
    );

    return (await this._generator.next()).value;
  }

  public async saveUser(
    username: string,
    password: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
    requireActiveCheck: boolean = false,
  ): Promise<string> {
    const exist = await this.getWallet(username);

    if (exist) {
      // The setting is chosen when the wallet is created; adding a key keeps it.
      const unlocked = await this.getUnlocked(exist);
      if (unlocked) {
        await this.importKey(unlocked, wifKey, keyType);
      } else {
        const unlocked = await this.unlockWithPassword(
          username,
          exist,
          password,
        );
        await this.adoptProtectedSetting(username, password, unlocked);
        await this.importKey(unlocked, wifKey, keyType);
      }
    } else {
      const { wallet } = await this.beekeeper(
        async () => await this.#session.createWallet(username, password),
      );
      const { key } = await this.markProtectedSettingWallet(
        username,
        password,
        wallet,
      );
      await writeSetting(key, username, requireActiveCheck);
      await this.importKey(wallet, wifKey, keyType);
    }

    // Initialize or update loggedInUsers state
    if (!this.#loggedInUsers[username]) {
      this.#loggedInUsers[username] = {
        username,
        authorized: true,
        unlocked: true,
        loggedInKeyType: keyType,
        registeredKeyTypes: await this.getRegisteredKeyTypes(username),
      };
    }

    await this.setUserSettings(username, { strict }, keyType);
    return "success";
  }

  public async authenticate(
    username: string,
    password: string,
    keyType: KeyAuthorityType,
    digest: string,
  ): Promise<string> {
    const wallet = await this.getWallet(username);
    if (!wallet) {
      throw new AuthorizationError("Invalid credentials");
    }

    const currentUserState = await this.getAuthByUser(username);
    if (currentUserState?.authorized) {
      // First ensure any existing session is cleaned up
      await this.logout(username);
    }

    try {
      const unlocked = await this.unlockWithPassword(
        username,
        wallet,
        password,
      );
      const keys = await this.beekeeper(() => unlocked.getPublicKeys());
      const alias = await this.getAlias(`${username}@${keyType}`);

      if (!alias) {
        await this.beekeeper(() => unlocked.lock());
        throw new AuthorizationError("Not authorized, missing authority");
      }

      const foundKey = keys.find((key) => key === alias.pubKey);
      if (!foundKey) {
        await this.beekeeper(() => unlocked.lock());
        throw new AuthorizationError("Not authorized, missing authority");
      }

      await this.adoptProtectedSetting(username, password, unlocked);

      // Get all registered key types for this user
      const registeredKeyTypes = await this.getRegisteredKeyTypes(username);

      // Update or create user session
      this.#loggedInUsers[username] = {
        username,
        authorized: true,
        unlocked: true,
        loggedInKeyType: keyType,
        registeredKeyTypes,
      };

      // Start session interval for this user
      this.startSessionInterval(username);

      // The password was just checked, so active keys sign too.
      return await this.signInSession(username, digest, keyType);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new AuthorizationError("Invalid credentials");
    }
  }

  public async invalidateExistingKey(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    try {
      const existingKeys = await this.getRegisteredKeyTypes(username);

      if (!existingKeys?.includes(keyType)) {
        // no need to invalidate
        return Promise.resolve();
      }

      const existingAlias = await this.getAlias(`${username}@${keyType}`);

      if (existingAlias?.alias) {
        const invalidatedAlias = `${username}@${keyType}-${Date.now()}`;
        await this.addAlias(invalidatedAlias, existingAlias.pubKey, keyType);
        await this.removeAlias(existingAlias.alias);
      }

      return Promise.resolve();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        throw new InternalError(error);
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

      const pubKey = await this.beekeeper(
        async () => await wallet.importKey(wifKey),
      );
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
    const unlocked = await this.getUnlocked(await this.getWallet(username));
    if (unlocked) {
      return await this.importKey(unlocked, wifKey, keyType);
    } else {
      throw new AuthorizationError(
        "User is not logged in. Please login for importing key",
      );
    }
  }

  private async getWallet(name: string): Promise<IBeekeeperWallet | undefined> {
    return await this.beekeeper(() => this.findWallet(name));
  }

  // Only from inside a queued beekeeper call.
  private findWallet(name: string): IBeekeeperWallet | undefined {
    const wallets = this.#session.listCreatedWallets();
    const found = wallets.find((wallet) => wallet.name === name);
    if (found) return found;

    // Wallet may exist in persistent storage but not in the current session
    // (e.g. after worker re-initialization). Try to open it.
    if (this.#session.hasWallet(name)) {
      return this.#session.openWallet(name);
    }

    return undefined;
  }

  private async getUnlocked(
    wallet: IBeekeeperWallet | undefined,
  ): Promise<IBeekeeperUnlockedWallet | undefined> {
    return await this.beekeeper(() => wallet?.unlocked);
  }

  private async lockWallet(name: string): Promise<void> {
    await this.beekeeper(() => {
      this.findWallet(name)?.unlocked?.lock();
    });
  }

  private async listWallets(): Promise<
    Array<{ name: string; unlocked: boolean }>
  > {
    return await this.beekeeper(() =>
      this.#session
        .listCreatedWallets()
        .map((wallet) => ({ name: wallet.name, unlocked: !!wallet.unlocked })),
    );
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    const user = this.#loggedInUsers[username];

    if (!user) {
      return null;
    }

    // Update registered key types for logged in user
    user.registeredKeyTypes = await this.getRegisteredKeyTypes(username);
    return user;
  }

  public async getAuths(): Promise<AuthUser[]> {
    try {
      const authUsers = [];

      for await (const { name } of await this.listWallets()) {
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

  public async getRegisteredUsers(): Promise<AuthUser[]> {
    const wallets = await this.listWallets();
    const registeredUsers: AuthUser[] = [];

    for (const wallet of wallets) {
      const registeredKeyTypes = await this.getRegisteredKeyTypes(wallet.name);
      registeredUsers.push({
        username: wallet.name,
        unlocked: wallet.unlocked,
        authorized: !!this.#loggedInUsers[wallet.name]?.authorized,
        loggedInKeyType: this.#loggedInUsers[wallet.name]?.loggedInKeyType,
        registeredKeyTypes,
      });
    }

    return registeredUsers;
  }

  public async getRegisteredUserByUsername(
    username: string,
  ): Promise<AuthUser | null> {
    const registeredUsers = await this.getRegisteredUsers();
    return registeredUsers.find((user) => user.username === username) ?? null;
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
      const tempWallet = await this.createTemporaryWallet(
        tempWalletName,
        tempPassword,
      );
      return await this.signWithTemporaryKey(tempWallet, wifKey, digest);
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async sign(
    username: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    const signing = await this.findSigningKey(username, keyType);
    if (
      CHECKED_KEY_TYPES.includes(keyType) &&
      (await this.requiresActiveCheck(username))
    ) {
      throw new CheckRequiredError(
        `Signing with the '${keyType}' key requires a password or passkey check`,
      );
    }
    return await this.beekeeper(
      async () => await signing.unlocked.signDigest(signing.key, digest),
    );
  }

  private async signInSession(
    username: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    const { unlocked, key } = await this.findSigningKey(username, keyType);
    return await this.beekeeper(
      async () => await unlocked.signDigest(key, digest),
    );
  }

  // The key of `keyType` in the user's wallet unlocked in the signing session,
  // if the session may sign with it.
  private async findSigningKey(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<{ unlocked: IBeekeeperUnlockedWallet; key: string }> {
    const wallet = await this.getWallet(username);
    const unlocked = await this.getUnlocked(wallet);
    if (!wallet || !unlocked) throw new AuthorizationError("Not authorized");

    const keys = await this.beekeeper(() => unlocked.getPublicKeys());
    const alias = await this.getAlias(`${username}@${keyType}`);
    const foundKey = keys.find((key) => key === alias?.pubKey);

    if (!foundKey) {
      await this.beekeeper(() => wallet.unlocked?.lock());
      throw new AuthorizationError("Not authorized, missing authority");
    }

    // Get key-specific strict mode setting
    const settings = await this.getUserSettings(username);
    const isStrictMode = settings?.strict[keyType] ?? true;

    // In strict mode, verify the user is authorized with the correct key type
    const userSession = this.#loggedInUsers[username];
    if (isStrictMode && !userSession?.authorized) {
      throw new AuthorizationError("Not authorized");
    }

    return { unlocked, key: foundKey };
  }

  /**
   * Checks `password` against the user's wallet without touching the signing
   * session's state. Throws AuthorizationError("Invalid credentials") for a
   * wrong password.
   */
  public async checkPassword(
    username: string,
    password: string,
  ): Promise<void> {
    await this.withCheckSession(username, password, noop);
  }

  /**
   * Checks `password` and signs `digest` with the user's key of `keyType`,
   * whether or not the wallet is unlocked in the signing session, which keeps
   * its state.
   */
  public async signWithPassword(
    username: string,
    password: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    this.checkKeyType(keyType);
    const alias = await this.getAlias(`${username}@${keyType}`);
    return await this.withCheckSession(username, password, async (wallet) => {
      if (!alias || !wallet.getPublicKeys().includes(alias.pubKey)) {
        throw new AuthorizationError("Not authorized, missing authority");
      }
      return await wallet.signDigest(alias.pubKey, digest);
    });
  }

  /**
   * Whether `sign` refuses active and owner keys for the user. Verified while
   * the user's wallet is unlocked in the signing session; otherwise the stored
   * value, unverified. A missing or invalid record reads as true.
   */
  public async getRequireActiveCheck(username: string): Promise<boolean> {
    const key = this.#settingKeys[username];
    if (key) return (await readVerifiedSetting(key, username)) ?? true;
    return (await readStoredSetting(username)) ?? true;
  }

  /**
   * Changes the setting after checking `password`; a failed check leaves it
   * unchanged.
   */
  public async setRequireActiveCheck(
    username: string,
    password: string,
    requireActiveCheck: boolean,
  ): Promise<void> {
    const markerWif = await getMarkerWif();
    await this.withCheckSession(username, password, async (wallet) => {
      if (!wallet.getPublicKeys().includes(MARKER_PUBLIC_KEY)) {
        await this.importMarkerKey(wallet, markerWif);
      }
    });
    const key = await deriveSettingKey(username, password);
    await writeSetting(key, username, requireActiveCheck);
  }

  public async logout(username: string): Promise<void> {
    // Logout specific user
    await this.lockWallet(username);

    // Remove from logged in users
    this.#loggedInUsers = Object.fromEntries(
      Object.entries(this.#loggedInUsers).filter(([key]) => key !== username),
    );
    this.#settingKeys = Object.fromEntries(
      Object.entries(this.#settingKeys).filter(([key]) => key !== username),
    );

    // Clear interval for this specific user
    this.clearSessionInterval(username);

    await this.sessionEndCallback();
  }

  public async logoutAll(): Promise<void> {
    // Lock all wallets
    await this.beekeeper(() => {
      for (const wallet of this.#session.listCreatedWallets()) {
        wallet.unlocked?.lock();
      }
    });

    // Clear all logged in users
    this.#loggedInUsers = {};
    this.#settingKeys = {};

    // Clear all session intervals
    this.clearAllSessionIntervals();

    await this.sessionEndCallback();
  }

  public async lock(): Promise<void> {
    try {
      // Get all unlocked users
      const unlockedUsers = Object.values(this.#loggedInUsers).filter(
        (user) => user.unlocked,
      );
      if (unlockedUsers.length === 0) {
        throw new AuthorizationError(
          "There is no existing user session or session already expired",
        );
      }

      // Lock all unlocked users
      for (const user of unlockedUsers) {
        await this.lockWallet(user.username);
        this.#loggedInUsers[user.username].unlocked = false;
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
      // An expired session has to authenticate again, even before its
      // session interval has marked it unauthorized.
      await this.lockExpiredSession();
      const wallet = await this.getWallet(username);

      if (!this.#loggedInUsers[username]?.authorized) {
        throw new AuthorizationError(
          "There is no existing user session or session already expired",
        );
      }

      if (!wallet) {
        throw new AuthorizationError("User not found");
      }

      // Add check for already unlocked wallet
      if (!(await this.getUnlocked(wallet))) {
        const unlocked = await this.unlockWithPassword(
          username,
          wallet,
          password,
        );
        await this.adoptProtectedSetting(username, password, unlocked);
        // Update user session state
        this.#loggedInUsers[username].unlocked = true;
      }
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      } else {
        if (isInvalidPassword(error)) {
          throw new AuthorizationError("Invalid credentials");
        } else {
          throw new InternalError(error);
        }
      }
    }
  }

  public hasLoggedInUsers(): boolean {
    return Object.keys(this.#loggedInUsers).length > 0;
  }

  // Deletes the beekeeper instance and removes the alias. Concurrent calls
  // share one deletion. Does not run the session-end callback; the caller
  // does, once the instance is gone.
  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    this.#deletion ??= this.deleteInstance();
    await this.#deletion;
    try {
      await this.removeAlias(`${username}@${keyType}`);
    } catch (error) {
      throw new InternalError(error);
    }
  }

  private async deleteInstance(): Promise<void> {
    // Deleting the instance locks and closes every user's wallet. Their
    // sessions are dropped first, so that a failed deletion cannot leave any
    // of them behind.
    this.clearAllSessionIntervals();
    this.#loggedInUsers = {};
    this.#settingKeys = {};
    try {
      await this.beekeeper(async () => {
        await this.#api.delete();
      });
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
    try {
      const tx = db.transaction(["aliases"], "readwrite");
      const store = tx.objectStore("aliases");
      await store.delete(alias);
      await tx.done;
    } finally {
      db.close();
    }
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
    keyType?: KeyAuthorityType,
  ): Promise<UserSettings | null> {
    try {
      const db = await openDB(this.settingsStorage, 1, {
        upgrade(db) {
          db.createObjectStore("settings");
        },
      });

      const settings = (await db.get("settings", username)) as UserSettings;

      if (keyType) {
        return settings
          ? {
              strict: { [keyType]: settings.strict[keyType] },
              alias: settings.alias,
            }
          : null;
      }

      return settings || null;
    } catch (error) {
      throw new InternalError(error);
    }
  }

  public async setUserSettings(
    username: string,
    settings: {
      strict: boolean;
      authorizedAccounts?: {
        [K in KeyAuthorityType]?: string;
      };
    },
    keyType: KeyAuthorityType,
  ): Promise<void> {
    try {
      const db = await openDB(this.settingsStorage, 1, {
        upgrade(db) {
          db.createObjectStore("settings");
        },
      });

      const existingSettings = ((await db.get(
        "settings",
        username,
      )) as UserSettings) || {
        strict: {},
        alias: username,
        authorizedAccounts: {},
      };

      const updatedSettings = {
        ...existingSettings,
        strict: {
          ...existingSettings.strict,
          [keyType]: settings.strict,
        },
        authorizedAccounts: {
          ...existingSettings.authorizedAccounts,
          ...settings.authorizedAccounts,
        },
      };

      await db.put("settings", updatedSettings, username);
    } catch (error) {
      throw new InternalError(error);
    }
  }

}

class Auth {
  // Holds the pending start too, so calls racing in before the first start
  // finishes share one beekeeper (one WASM instance) instead of each starting
  // their own.
  static #worker: Promise<AuthWorker> | undefined;
  // Reapplied to a worker started after unregister replaced the previous one.
  static #sessionEndCallback: (() => Promise<void>) | undefined;
  // Settles once the beekeeper being deleted by unregister is gone, or once
  // its deletion timeout gives up on it; a new start waits for it so that two
  // instances do not share the storage root.
  static #retiring: Promise<void> = Promise.resolve();
  // The instance unregister is deleting, until it is gone or given up on, and
  // the timeout that gives up on it.
  static #retirement:
    | { worker: AuthWorker; timedOut: Promise<never> }
    | undefined;

  private readonly sessionTimeout: number;

  constructor(sessionTimeout: number) {
    this.sessionTimeout = sessionTimeout;
  }

  private async getWorker(): Promise<AuthWorker> {
    if (Auth.#worker === undefined) {
      const starting: Promise<AuthWorker> = this.startWorker()
        .then((worker) => {
          worker.setSessionEndCallback(Auth.#sessionEndCallback);
          return worker;
        })
        .catch((error) => {
          this.dropWorker(starting);
          throw new InternalError(error);
        });
      Auth.#worker = starting;
    }

    return await Auth.#worker;
  }

  private async startWorker(): Promise<AuthWorker> {
    await Auth.#retiring;
    const authWorker = new AuthWorker(this.sessionTimeout);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Beekeeper start timed out"));
        // Nothing will use the abandoned instance; delete it if its start
        // ever finishes, so it cannot run beside the next start's instance on
        // the same storage root. A failed start was already reported as the
        // timeout.
        authWorker.Ready.then(async (worker) => {
          await worker.dispose();
        }, noop).catch((error) => {
          console.error("Failed to delete an abandoned beekeeper", error);
        });
      }, timing("beekeeperStartTimeout"));
    });
    const ready = authWorker.Ready;
    // Rejections after the timeout has won the race were already reported.
    ready.catch(noop);

    try {
      return await Promise.race([ready, timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  private dropWorker(worker: Promise<AuthWorker> | undefined): void {
    if (Auth.#worker === worker) Auth.#worker = undefined;
  }

  public async register(
    username: string,
    password: string,
    digest: string,
    wifKey: string,
    keyType: KeyAuthorityType,
    strict: boolean = true,
    requireActiveCheck: boolean = false,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).registerUser(
      username,
      password,
      digest,
      wifKey,
      keyType,
      strict,
      requireActiveCheck,
    );
  }

  public async onAuthComplete(
    username: string,
    failed: boolean,
  ): Promise<void> {
    await (await this.getWorker()).onAuthComplete(username, failed);
  }

  public async unregister(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    // A concurrent unregister is already deleting the instance; this one
    // shares that deletion and leaves ending the session to it.
    const pending = Auth.#retirement;
    if (pending !== undefined) {
      await Promise.race([
        pending.worker.unregister(username, keyType),
        pending.timedOut,
      ]);
      return;
    }

    const worker = this.getWorker();
    // getWorker caches the start synchronously, before its first await.
    const starting = Auth.#worker;
    const current = await worker;
    if (Auth.#worker !== starting) {
      // Another unregister waiting on the same start got to it first.
      await current.unregister(username, keyType);
      return;
    }

    // Dropped before the instance is deleted, so that calls arriving
    // meanwhile start a new beekeeper (once this one is gone) instead of
    // reaching the deleted one.
    this.dropWorker(starting);
    const loggedOut = current.hasLoggedInUsers();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Gives up on a deletion that never settles: the instance is abandoned,
    // as a timed-out start is, so that later starts can proceed.
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new InternalError("Beekeeper deletion timed out"));
      }, timing("beekeeperDeleteTimeout"));
    });
    // Joiners race the same timeout; the rejection is reported to each.
    timedOut.catch(noop);
    const retirement = { worker: current, timedOut };
    Auth.#retirement = retirement;
    const unregistering = Promise.race([
      current.unregister(username, keyType),
      timedOut,
    ]);
    Auth.#retiring = unregistering.then(noop, noop);
    try {
      await unregistering;
    } finally {
      clearTimeout(timer);
      if (Auth.#retirement === retirement) Auth.#retirement = undefined;
      // Outside #retiring: the callback may call back into Auth, or (from a
      // closed tab of a SharedWorker) never settle.
      if (loggedOut) await (Auth.#sessionEndCallback ?? noop)();
    }
  }

  public async lock(): Promise<void> {
    await (await this.getWorker()).lock();
  }

  public async unlock(username: string, password: string): Promise<void> {
    await (await this.getWorker()).unlock(username, password);
  }

  public async invalidateExistingKey(
    username: string,
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (await this.getWorker()).invalidateExistingKey(username, keyType);
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

  public async logout(username: string): Promise<void> {
    await (await this.getWorker()).logout(username);
  }

  public async logoutAll(): Promise<void> {
    await (await this.getWorker()).logoutAll();
  }

  public async setSessionEndCallback(
    callback: () => Promise<void> = noop,
  ): Promise<void> {
    Auth.#sessionEndCallback = callback;
    (await this.getWorker()).setSessionEndCallback(callback);
  }

  public async getRegisteredUsers(): Promise<AuthUser[]> {
    return await (await this.getWorker()).getRegisteredUsers();
  }

  public async getRegisteredUserByUsername(
    username: string,
  ): Promise<AuthUser | null> {
    return await (await this.getWorker()).getRegisteredUserByUsername(username);
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

  public async checkPassword(
    username: string,
    password: string,
  ): Promise<void> {
    await (await this.getWorker()).checkPassword(username, password);
  }

  public async signWithPassword(
    username: string,
    password: string,
    digest: string,
    keyType: KeyAuthorityType,
  ): Promise<string> {
    return await (
      await this.getWorker()
    ).signWithPassword(username, password, digest, keyType);
  }

  public async getRequireActiveCheck(username: string): Promise<boolean> {
    return await (await this.getWorker()).getRequireActiveCheck(username);
  }

  public async setRequireActiveCheck(
    username: string,
    password: string,
    requireActiveCheck: boolean,
  ): Promise<void> {
    await (
      await this.getWorker()
    ).setRequireActiveCheck(username, password, requireActiveCheck);
  }

  public async getAuthByUser(username: string): Promise<AuthUser | null> {
    return await (await this.getWorker()).getAuthByUser(username);
  }

  public async getAuths(): Promise<AuthUser[]> {
    return await (await this.getWorker()).getAuths();
  }

  public async getUserSettings(
    username: string,
    keyType?: KeyAuthorityType,
  ): Promise<UserSettings | null> {
    return await (await this.getWorker()).getUserSettings(username, keyType);
  }

  public async setUserSettings(
    username: string,
    settings: {
      strict: boolean;
      authorizedAccounts?: {
        [K in KeyAuthorityType]?: string;
      };
    },
    keyType: KeyAuthorityType,
  ): Promise<void> {
    await (await this.getWorker()).setUserSettings(username, settings, keyType);
  }
}

declare let SharedWorkerGlobalScope: any;
declare let onconnect: (event: MessageEvent) => void;

const exports = {
  Auth,
};

// Check if we're in a SharedWorker context
if (typeof SharedWorkerGlobalScope !== 'undefined' && self instanceof SharedWorkerGlobalScope) {
  // Handle SharedWorker connections
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, prefer-const
  onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    Comlink.expose(exports, port);
  };
} else {
  // Handle regular Worker
  Comlink.expose(exports);
}

export type WorkerExpose = typeof exports;
export type { Auth };

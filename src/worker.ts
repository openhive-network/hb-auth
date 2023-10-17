import WasmModule, {
  type FileSystemType,
  type beekeeper_api,
} from "@hive/beekeeper";
import { GenericError } from "./errors";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");

type Result = Parameters<beekeeper_api["create_session"]>[0];

interface Response {
  error?: string;
}

interface InitResponse extends Response {
  status: boolean;
  version: string;
}

interface TokenResponse extends Response {
  token: string;
}

interface CreateWalletResponse extends Response {
  password: string;
}

interface ListWalletsResponse extends Response {
  wallets: Array<{
    name: string;
    unlocked: boolean;
  }>;
}

interface OpenWalletResponse extends Response {}
interface LockWalletResponse extends Response {}
interface UnlockWalletResponse extends Response {}

interface GetPublicKeysResponse extends Response {
  keys: Array<{ public_key: string }>;
}

interface ImportKeyResponse extends Response {
  public_key: string;
}

// TODO: Move out basic logger later
const DEBUG = true;
const BEEKEEPER_LOGS = false;
const log = (
  message: any,
  type: "log" | "error" | "info" | "warn" = "log",
): void => {
  if (DEBUG) {
    console[type](message);
  }
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class AuthWorker {
  public readonly run: Promise<AuthWorker>;

  private wasm!: Awaited<ReturnType<typeof WasmModule>>;
  private api!: beekeeper_api;
  private readonly lockTimeout: number = 10 * 1000;
  private readonly storage: string = "/storage_root";
  private readonly wallet: string = "default";
  private token!: string;

  constructor() {
    // Use readiness here to wait until wasm module is loaded.
    this.run = new Promise<AuthWorker>((resolve, reject) => {
      WasmModule()
        .then(async (module) => {
          this.wasm = module;
          await this.setup();
          resolve(this);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  private async setup(): Promise<void> {
    // Setup storage and sync IDB to WASM MEM
    this.wasm.FS.mkdir(this.storage);
    this.wasm.FS.mount(
      this.wasm.FS.filesystems.IDBFS as FileSystemType,
      {},
      this.storage,
    );
    await this.sync();

    // Prepare params and create an API
    const params = new this.wasm.StringList();
    // Set wallet directory
    params.push_back("--wallet-dir");
    params.push_back(this.storage);
    // Enable/disable logging
    params.push_back("--enable-logs");
    params.push_back(Boolean(BEEKEEPER_LOGS).toString());

    this.api = new this.wasm.beekeeper_api(params);

    // Initialize
    const { status, version } = this.parse<InitResponse>(this.api.init());
    if (status)
      log(`Beekeeper API initialized with version: ${version}`, "info");
    else log("Something unexpected happenned while initializing beekeeper API");

    // Session creation
    this.token = this.parse<TokenResponse>(this.api.create_session("")).token;
    log(`Token: ${this.token}`);
    this.api.set_timeout(this.token, Infinity);
  }

  public async createWallet(password: string): Promise<void> {
    if (this.isWalletExist()) return; // TODO: what in this case?
    // First time, there is no wallet, so create
    log("Wallet doesn't exists, so create one.");
    const resp = this.parse<CreateWalletResponse>(
      this.api.create(this.token, this.wallet, password),
    );
    log(resp);
    await this.sync(false);
  }

  public isWalletExist(): boolean {
    const { error } = this.parse<OpenWalletResponse>(
      this.api.open(this.token, this.wallet),
    );

    if (error) return false;

    return true;
  }

  public unlock(password: string): void {
    if (!password) throw new GenericError("Password is required.");

    const result = this.api.unlock(this.token, this.wallet, password);
    console.log("unlock result", result);
    console.log(this.api.list_wallets(this.token));
  }

  public lock(): void {
    this.api.lock(this.token, this.wallet);
  }

  public importKey(wifKey: string): ImportKeyResponse {
    const { error, public_key } = this.parse<ImportKeyResponse>(
      this.api.import_key(this.token, this.wallet, wifKey),
    );

    if (error) throw new GenericError(error);

    return { public_key };
  }

  public getPublicKeys(): GetPublicKeysResponse {
    return this.parse<GetPublicKeysResponse>(
      this.api.get_public_keys(this.token),
    );
  }

  private parse<T>(obj: Result): T {
    const resp = JSON.parse(obj as string);

    if ("error" in resp) {
      return resp;
    } else {
      return JSON.parse(resp.result);
    }
  }

  // Sync storage after changes
  // toWasm = true means that we sync IDB to Wasm memory
  // toWasm = false means that we sync from Wasm memory to IDB
  private async sync(toWasm: boolean = true): Promise<any> {
    return await new Promise((resolve, reject) => {
      this.wasm.FS.syncfs(toWasm, (err) => {
        if (err) reject(err);
        else resolve(null);
      });
    });
  }
}

class Auth {
  private static worker: AuthWorker;
  constructor(private readonly chainId: string) {}

  public async initialize(): Promise<void> {
    if (!Auth.worker) {
      Auth.worker = await new AuthWorker().run;
      console.log("initialized and chain id is!", this.chainId);
    }
  }

  public async register(password: string, wifKey: string): Promise<void> {
    await this.initialize();
    await Auth.worker.createWallet(password);

    const resp = Auth.worker.importKey(wifKey);
    console.log("keys are imported ", resp);
    console.log(Auth.worker.getPublicKeys());
  }

  // get key or keys here
  public async authorize(password: string): Promise<void> {
    await this.initialize();

    if (Auth.worker.isWalletExist()) {
      Auth.worker.unlock(password); // handle unlock response
      // Authorise internally with registered key,
      // return auth response
    } else {
      throw new GenericError("No user exist, please register first.");
    }
  }

  public async logout(): Promise<void> {
    await this.initialize();
  }

  public async sign(): Promise<void> {
    await this.initialize();
  }
}

declare const Comlink: any;
Comlink.expose({ Auth });

export type { Auth };

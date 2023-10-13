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
interface UnlokcWalletResponse extends Response {}

interface ImportKeyResponse extends Response {
  public_key: string;
}
// type Callable = (...args: any[]) => any;

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

    // Wallet setup
    await this.setupWallet();
  }

  private async setupWallet(): Promise<void> {
    const { error } = this.parse<OpenWalletResponse>(
      this.api.open(this.token, this.wallet),
    );

    if (error) {
      // First time, there is no wallet, so create
      log("Wallet doesn't exists, so create one.");
      const { password } = this.parse<CreateWalletResponse>(
        this.api.create(this.token, this.wallet),
      );
      log(password);
      await this.sync(false);
    } else {
      // Use existing one if already there
      const { wallets } = this.parse<ListWalletsResponse>(
        this.api.list_wallets(this.token),
      );

      log(`Existing wallets: ${JSON.stringify(wallets)}`);
    }
  }

  public unlock(password: string): void {
    if (!password) throw new GenericError("Password is required.");

    this.api.unlock(this.token, this.wallet, password);
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

  private parse<T>(obj: Result): T {
    const resp = JSON.parse(obj as string);

    if ("error" in resp) {
      return resp;
    } else {
      return JSON.parse(resp.result);
    }
  }

  // private call<Call extends Callable>(
  //   f: Call,
  //   ...args: Parameters<Call>
  //   // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  // ): ReturnType<Call> | void {
  //   return this.parse(f(...args));
  // }

  // TODO: return to this in spare time
  // hint instead of Parameters type ArgsType<T> = T extends (...args: infer U) => any ? U : never;
  // private call<T, Name extends keyof beekeeper_api, P extends Array<Parameters<beekeeper_api[Name]>>>(func: Name, ...args: P): T {
  //   type ArgsType<T> = T extends (...args: infer U) => any ? U : never;
  //   type Params = ArgsType<keyof beekeeper_api>

  //   return this.parse<T>(this.api[func](...args));
  // }

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

let worker: AuthWorker;

// get chainID here
// make this implicit maybe,
const initialize = async (): Promise<void> => {
  if (!worker) {
    worker = await new AuthWorker().run;
  }
};

export interface AuthResult<T> {
  reuslt?: T;
  error?: GenericError;
}

// const login = async (): Promise<AuthResult> => {
//   // 1. make sure worker is initialized
//   // 2. make sure wallet is unlocked to interact with keys
//   // 3. if not unlock the wallet
//   // 4. import keys but show it like seamless
//   // 5. when all data saving is done, sign a sample transaction to verify if credentials are valid
// };

// const logout = async (): Promise<AuthResult> => {
//   // require wallet password,
//   // remove all keys from the wallet
//   // emit result
// };

// const authorize = async (): Promise<AuthResult> => {
//   // Check if user is auhtorized
//   // if wallet is locked, request for unlock
//   // return authorisation result from a result of credentials verification
// };

declare const Comlink: any;
Comlink.expose({ initialize });

import WasmModule, { type FileSystemType, type beekeeper_api } from "@hive/beekeeper";
import { GenericError } from "./errors";

interface InitResponse {
  status: boolean;
  version: string;
}

interface TokenResponse {
  token: string;
}

interface CreateWalletResponse {
  password: string;
}

// TODO: Move out basic logger later
const DEBUG = false;
const log = (message: string, type: 'log' | 'error' | 'info' = 'log'): void => {
  if (DEBUG) {
    console[type](message);
  }
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class AuthWorker {
  public readonly run: Promise<void>;

  private wasm!: Awaited<ReturnType<typeof WasmModule>>;
  private api!: beekeeper_api;
  private readonly lockTimeout: number = 10 * 1000;
  private readonly storage: string = "/storage_root";
  private readonly wallet: string = "default";
  private token!: string;

  constructor() {
    // Use readiness here to wait until wasm module is loaded.
    this.run = new Promise((resolve, reject) => {
      WasmModule()
        .then(async (module) => {
          this.wasm = module;
          await this.setup();
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  private async setup(): Promise<void> {
    // Setup storage and sync IDB to WASM MEM
    this.wasm.FS.mkdir(this.storage);
    this.wasm.FS.mount(this.wasm.FS.filesystems.IDBFS as FileSystemType, {}, this.storage);
    await this.sync();

    // Prepare params and create an API
    const params = new this.wasm.StringList();
    // Set wallet directory
    params.push_back('--wallet-dir');
    params.push_back(this.storage);
    // Enable/disable logging
    params.push_back('--enable-logs');
    params.push_back(Boolean(DEBUG).toString());

    this.api = new this.wasm.beekeeper_api(params);

    // Initialize
    const { status, version } = this.parse<InitResponse>(this.api.init() as string);
    if (status)
      log(`beekeeper API initialized with version: ${version}`, 'info');
    else
      log('Something unexpected happenned while initializing beekeeper API')

    // Session creation
    this.token = this.parse<TokenResponse>(this.api.create_session('') as string).token;
    log(`Token: ${this.token}`);
    this.api.set_timeout(this.token, Infinity);

    // Wallet setup
    await this.setupWallet();
  }

  private async setupWallet(): Promise<void> {
    const { password } = this.parse<CreateWalletResponse>(this.api.create(this.token, this.wallet) as string);
    log(password);
    await this.sync(false);
  }

  private parse<R>(obj: string): R {
    const resp = JSON.parse(obj);

    if ('error' in resp) {
      throw new GenericError(JSON.parse(resp.error))
    } else {
      return JSON.parse(resp.result)
    }
  }

  // Sync storage after changes
  // toWasm = true means that we sync IDB to Wasm memory
  // toWasm = false means that we sync from Wasm memory to IDB
  private async sync(toWasm: boolean = true): Promise<any> {
    return await new Promise((resolve, reject) => {
      this.wasm.FS.syncfs(toWasm, (err) => {
        if (err) reject(err)
        else resolve(null)
      })
    })
  }
}

new AuthWorker().run
  .then(() => {
    if (DEBUG) {
      log("module is ready for processing tasks.");
    }
  })
  .catch((err) => {
    // TODO: what to do in this case??
    log(`error occurred while loading auth module \n${err as string}`, 'error');
  });

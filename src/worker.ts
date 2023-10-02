import WasmModule, { type MainModule } from "@hive/beekeeper";

const STORAGE_ROOT = "/storage_root";

let module: MainModule;

async function initWasmModule(): Promise<MainModule> {
  module = await WasmModule();
  const FS = (module as any).FS;
  FS.mkdir(STORAGE_ROOT);
  FS.mount(FS.filesystems.IDBFS, {}, STORAGE_ROOT);
  return await new Promise((resolve, reject) => {
    FS.syncfs(true, (err: any) => {
      if (err) {
        reject(err);
      }

      resolve(module);
    });
  });
}

async function sync(): Promise<any> {
  return await new Promise((resolve, reject) => {
    (module as any).FS.syncfs((err: any) => {
      if (err) reject(err);

      resolve(null);
    });
  });
}

async function init(): Promise<void> {
  const mod = (await initWasmModule()) as any;
  console.log("ALL synced on initialization!");

  mod.FS.writeFile("/storage_root/my-file.txt", "hello");
  console.log(
    mod.FS.readFile("/storage_root/my-file.txt", { encoding: "utf8" }),
  );

  const params = new module.StringList();
  params.push_back("--wallet-dir");
  params.push_back(STORAGE_ROOT);
  const api = new module.beekeeper_api(params);
  const resp = api.init();
  console.log(resp);
  const result = api.create_session("abc") as string;
  const _result = JSON.parse(result);
  const token = JSON.parse(_result.result).token;
  console.log("session token", token);
  const wallet = api.create(token, "default");
  console.log("auto generated wallet password", wallet);
  console.log(api.list_wallets(token));
  console.log(
    mod.FS.readFile("/storage_root/default.wallet", { encoding: "utf8" }),
  );

  await sync();

  console.log("ALL synced after initialization!");
}

init().catch((err) => {
  console.log(err);
});

self.onmessage = (msg) => {
  console.log("got message", msg.data);

  switch (msg.data.type) {
    case "ping":
      self.postMessage({
        ...msg.data,
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        payload: `Your payload was: ${msg.data?.payload}`,
      });
      break;

    default:
      self.postMessage({ error: " This is error !! ", id: msg.data.id });
      break;
  }
};

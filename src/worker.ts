import MainModule from '@hive/beekeeper'

async function init(): Promise<void> {
  const module = await MainModule();
  const api = new module.beekeeper_api(new module.StringList());
  const resp = api.init();
  console.log(resp);
}

init().catch((err) => {
  console.log(err)
})

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

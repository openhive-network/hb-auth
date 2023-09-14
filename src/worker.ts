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

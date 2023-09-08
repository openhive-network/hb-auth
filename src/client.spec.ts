import { Client } from "./client";

jest.mock("./environment", () => ({ isSupportWebWorker: true }));

describe("Test Client", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("creates an instance only by getClient method", () => {
    const client = Client.getClient();
    expect(client).toBeInstanceOf(Client);
  });

  test("instance are the same", () => {
    const i1 = Client.getClient();
    const i2 = Client.getClient();
    expect(i1).toEqual(i2);
  });

  test.todo("handle if no web worker supported");
  // isSupportWebWorkerSpy = jest.spyOn(environment, 'isSupportWebWorker', 'get').mockReturnValue(false);
});


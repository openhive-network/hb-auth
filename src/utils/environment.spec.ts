import { getEnvironment, isBrowser, isSupportWebWorker } from "./environment";

describe("Test environment utils", () => {
  test("getEnvironment", () => {
    expect(getEnvironment).toBe("node");
    // TODO: make this work
    // Mock window object and test other cases
    // const windowSpy = jest.spyOn(global, 'window', 'get');
    // expect(getEnvironment).toBe("browser");
  });

  test("isBrowser", () => {
    expect(isBrowser).toBeFalsy();
  });

  test("isSupportWebWorker", () => {
    expect(isSupportWebWorker).toBeFalsy();
  });
});

import { isBrowser, isSupportWebWorker } from "./environment";

describe("Test environment utils", () => {

  test("isBrowser", () => {
    expect(isBrowser).toBeFalsy();
  });

  test("isSupportWebWorker", () => {
    expect(isSupportWebWorker).toBeFalsy();
  });
});

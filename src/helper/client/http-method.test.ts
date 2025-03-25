import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { httpMethod } from "./http-method";

// Type for capturing init (explicitly indicating presence of method and headers properties)
type CapturedInit = RequestInit & {
  method?: string;
  headers?: Record<string, string>;
};

describe("httpMethod (integration test without excessive mocks)", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Save the global fetch before test begins
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore the global fetch after test ends
    global.fetch = originalFetch;
  });

  it("should use $get method with url options (query and hash) and merge init correctly", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "users"];
    const params = { id: "123" };
    const dynamicKeys: string[] = [];

    // Variables to capture fetch arguments
    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    const customFetch: typeof fetch = (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => {
      // Assert init as CapturedInit type
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    };

    const defaultOptions = {
      fetch: customFetch,
      init: { headers: { "Content-Type": "application/json" } },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    // Specify query and hash as URL options
    const urlOptions = { query: { foo: "bar", baz: "qux" }, hash: "section1" };
    // Specify additional init on client side (e.g., add Authorization header)
    const clientOptions = {
      init: { headers: { Authorization: "Bearer token" } },
    };

    await requestFn(urlOptions, clientOptions);

    // Assume createUrl generates paths.join('/') + query + hash
    const expectedBase = paths.join("/");
    const searchParams = new URLSearchParams(urlOptions.query).toString();
    const expectedUrl =
      expectedBase +
      (searchParams ? "?" + searchParams : "") +
      (urlOptions.hash ? "#" + urlOptions.hash : "");
    expect(calledUrl).toBe(expectedUrl);

    // Verify method is uppercase and $ is removed
    expect(calledInit?.method).toBe("GET");
    // Verify headers are merged between defaultOptions.init and clientOptions.init
    expect(calledInit?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    });
  });

  it("should use $post method without url options and with only defaultOptions (global fetch override)", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "posts"];
    const params = { postId: "456" };
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    // Override global.fetch for testing to capture arguments
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 201 }));
    }) as typeof fetch;

    const defaultOptions = {
      // If defaultOptions.fetch is not set, global.fetch is used
      init: { headers: { "Content-Type": "application/json" } },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );
    await requestFn();

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("POST");
    expect(calledInit?.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("should prefer options.fetch over defaultOptions.fetch and global fetch", async () => {
    const key = "$put";
    const paths = ["http://example.com", "api", "update"];
    const params = { item: "789" };
    const dynamicKeys: string[] = [];

    // defaultOptions.fetch (should NOT be called)
    let defaultFetchCalled = false;
    const defaultFetch: typeof fetch = (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => {
      defaultFetchCalled = true;

      return Promise.resolve(new Response(null, { status: 200 }));
    };

    const defaultOptions = {
      fetch: defaultFetch,
      init: { headers: { "Content-Type": "application/json" } },
    };

    // Override options.fetch (this one should be used)
    let optionsFetchCalled = false;
    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    const optionsFetch: typeof fetch = (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => {
      optionsFetchCalled = true;
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 204 }));
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = {
      fetch: optionsFetch,
      init: { headers: { "X-Custom": "custom-value" } },
    };

    await requestFn(undefined, clientOptions);

    expect(optionsFetchCalled).toBe(true);
    expect(defaultFetchCalled).toBe(false);
    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("PUT");
    expect(calledInit?.headers).toEqual({
      "Content-Type": "application/json",
      "X-Custom": "custom-value",
    });
  });

  it("should allow empty clientOptions and URL options, using defaults", async () => {
    const key = "$delete";
    const paths = ["http://example.com", "api", "delete"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: { headers: { Accept: "application/json" } },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );
    // Omit URL options and clientOptions
    await requestFn();

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("DELETE");
    expect(calledInit?.headers).toEqual({ Accept: "application/json" });
  });

  it("should correctly replace dynamic keys in URL", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "users", "_id"];
    const params = { _id: "123" };
    const dynamicKeys = ["_id"];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: { headers: { Accept: "application/json" } },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );
    await requestFn();

    const expectedUrl = "http://example.com/api/users/123";
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("GET");
  });

  it("should work with method key without $ prefix", async () => {
    const key = "patch";
    const paths = ["http://example.com", "api", "patchTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: { headers: {} },
    };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );
    await requestFn();

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("PATCH");
  });

  it("should propagate errors from fetch", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "error"];
    const params = {};
    const dynamicKeys: string[] = [];
    const errorMessage = "Fetch failed";

    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      return Promise.reject(new Error(errorMessage));
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await expect(requestFn()).rejects.toThrow(errorMessage);
  });
});

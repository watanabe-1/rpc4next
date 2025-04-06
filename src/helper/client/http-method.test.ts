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

    await requestFn({ url: urlOptions }, clientOptions);

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
      "content-type": "application/json",
      authorization: "Bearer token",
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
    await requestFn({ body: { json: params } });

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("POST");
    expect(calledInit?.headers).toEqual({ "content-type": "application/json" });
    expect(calledInit?.body).toBe(JSON.stringify(params));
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

    await requestFn({ body: { json: params } }, clientOptions);

    expect(optionsFetchCalled).toBe(true);
    expect(defaultFetchCalled).toBe(false);
    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("PUT");
    expect(calledInit?.headers).toEqual({
      "content-type": "application/json",
      "x-custom": "custom-value",
    });
    expect(calledInit?.body).toBe(JSON.stringify(params));
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
    await requestFn({ body: { json: params } });

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("DELETE");
    expect(calledInit?.headers).toEqual({
      accept: "application/json",
      "content-type": "application/json",
    });
    expect(calledInit?.body).toBe(JSON.stringify(params));
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
    await requestFn({ body: { json: params } });

    const expectedUrl = paths.join("/");
    expect(calledUrl).toBe(expectedUrl);
    expect(calledInit?.method).toBe("PATCH");
    expect(calledInit?.body).toBe(JSON.stringify(params));
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

  it("should correctly merge Headers passed as a Headers instance and an array", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    // defaultOptions.headers: Headers instance
    const defaultHeaders = new Headers();
    defaultHeaders.append("X-Default", "defaultValue");
    // clientOptions.headers: array of [string, string]
    const clientHeaders: [string, string][] = [["X-Custom", "customValue"]];

    const defaultOptions = {
      init: { headers: defaultHeaders },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = {
      init: { headers: clientHeaders },
    };

    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({
      "x-default": "defaultValue",
      "x-custom": "customValue",
    });
  });

  it("should override default headers with client headers when keys overlap using different HeadersInit forms", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersOverride"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    // defaultOptions.headers: array form
    const defaultHeaders: [string, string][] = [["X-Test", "default"]];
    // clientOptions.headers: Headers instance overriding the same key
    const clientHeaders = new Headers();
    clientHeaders.append("X-Test", "client");

    const defaultOptions = {
      init: { headers: defaultHeaders },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = {
      init: { headers: clientHeaders },
    };

    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({ "x-test": "client" });
  });

  it("should prioritize body.json over clientOptions and defaultOptions body", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "priority"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: {
        headers: { "Content-Type": "default-type" },
        body: "default-body",
      },
    };

    const clientOptions = {
      init: {
        headers: { Authorization: "Bearer xyz" },
        body: "client-body",
      },
    };

    const jsonBody = { hello: "world" };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { json: jsonBody } }, clientOptions);

    expect(calledInit?.body).toBe(JSON.stringify(jsonBody));

    expect(calledInit?.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer xyz",
    });
  });
});

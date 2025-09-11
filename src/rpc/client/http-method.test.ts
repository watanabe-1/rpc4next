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
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("uses $get with url options (query/hash) and merges init correctly", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "users"];
    const params = { id: "123" };
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    const customFetch: typeof fetch = (_input, _init) => {
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

    const urlOptions = { query: { foo: "bar", baz: "qux" }, hash: "section1" };
    const clientOptions = {
      init: { headers: { Authorization: "Bearer token" } },
    };

    await requestFn({ url: urlOptions }, clientOptions);

    const expectedBase = paths.join("/");
    const searchParams = new URLSearchParams(urlOptions.query).toString();
    const expectedUrl =
      expectedBase +
      (searchParams ? "?" + searchParams : "") +
      (urlOptions.hash ? "#" + urlOptions.hash : "");
    expect(calledUrl).toBe(expectedUrl);

    expect(calledInit?.method).toBe("GET");
    expect(calledInit?.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer token",
    });
  });

  it("uses $post with body.json and sets inferred content-type when none provided", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "posts"];
    const params = { postId: "456" };
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 201 }));
    }) as typeof fetch;

    const defaultOptions = {
      // No default content-type here to test inference
      init: {},
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

  it("prefers options.fetch over defaultOptions.fetch and global fetch", async () => {
    const key = "$put";
    const paths = ["http://example.com", "api", "update"];
    const params = { item: "789" };
    const dynamicKeys: string[] = [];

    let defaultFetchCalled = false;
    const defaultFetch: typeof fetch = (_input, _init) => {
      defaultFetchCalled = true;

      return Promise.resolve(new Response(null, { status: 200 }));
    };

    const defaultOptions = {
      fetch: defaultFetch,
      init: { headers: { "Content-Type": "application/json" } },
    };

    let optionsFetchCalled = false;
    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    const optionsFetch: typeof fetch = (_input, _init) => {
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

  it("allows empty clientOptions and URL options, using defaults", async () => {
    const key = "$delete";
    const paths = ["http://example.com", "api", "delete"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
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

  it("replaces dynamic keys in URL", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "users", "_id"];
    const params = { _id: "123" };
    const dynamicKeys = ["_id"];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
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

  it("works with method key without $ prefix", async () => {
    const key = "patch";
    const paths = ["http://example.com", "api", "patchTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledUrl: RequestInfo | URL | null = null;
    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledUrl = _input;
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = { init: { headers: {} } };
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

  it("propagates errors from fetch (with helpful message)", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "error"];
    const params = {};
    const dynamicKeys: string[] = [];
    const errorMessage = "Fetch failed";

    global.fetch = ((_input, _init) => {
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

  it("merges default Headers instance with client headers object", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultHeaders = new Headers();
    defaultHeaders.append("X-Default", "defaultValue");
    const clientHeaders = { "x-custom": "customValue" };

    const defaultOptions = { init: { headersInit: defaultHeaders } };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = { init: { headers: clientHeaders } };
    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({
      "x-default": "defaultValue",
      "x-custom": "customValue",
    });
  });

  it("merges default headers object with client Headers instance", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const clientHeaders = new Headers();
    clientHeaders.append("X-Default", "defaultValue");
    const defaultHeaders = { "x-custom": "customValue" };

    const defaultOptions = { init: { headersInit: clientHeaders } };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = { init: { headers: defaultHeaders } };
    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({
      "x-default": "defaultValue",
      "x-custom": "customValue",
    });
  });

  it("merges Headers passed as a Headers instance and an array", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersTest"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultHeaders = new Headers();
    defaultHeaders.append("X-Default", "defaultValue");
    const clientHeaders: [string, string][] = [["X-Custom", "customValue"]];

    const defaultOptions = { init: { headersInit: defaultHeaders } };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = { init: { headersInit: clientHeaders } };
    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({
      "x-default": "defaultValue",
      "x-custom": "customValue",
    });
  });

  it("overrides default headers with client headers when keys overlap using different HeadersInit forms", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "headersOverride"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultHeaders: [string, string][] = [["X-Test", "default"]];
    const clientHeaders = new Headers();
    clientHeaders.append("X-Test", "client");

    const defaultOptions = { init: { headersInit: defaultHeaders } };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const clientOptions = { init: { headersInit: clientHeaders } };
    await requestFn(undefined, clientOptions);

    expect(calledInit?.headers).toEqual({ "x-test": "client" });
  });

  it("does NOT override user-provided content-type even when body.json is present (defaultOptions provided)", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "priority"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: {
        headers: { "Content-Type": "custom/type" },
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

    // Body should use JSON string
    expect(calledInit?.body).toBe(JSON.stringify(jsonBody));
    // content-type should remain user-provided ("custom/type"), not forced to application/json
    expect(calledInit?.headers).toEqual({
      "content-type": "custom/type",
      authorization: "Bearer xyz",
    });
  });

  it("sets inferred content-type when body.json is present and user has NOT provided content-type", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "priority"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: {
        // No content-type here
        headers: { Accept: "application/json" },
      },
    };

    const clientOptions = {
      init: {
        // Still no content-type
        headers: { Authorization: "Bearer xyz" },
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
      accept: "application/json",
      authorization: "Bearer xyz",
      "content-type": "application/json",
    });
  });

  it("merges existing Cookie header with requestHeaders.cookies", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "withCookies"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = {
      init: { headers: { Cookie: "a=1" } },
    };

    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const methodParam = {
      requestHeaders: {
        cookies: { b: "2" },
        headers: undefined,
      },
    } as const;

    await requestFn(methodParam);

    expect(calledInit?.headers).toEqual({
      cookie: "a=1; b=2",
    });
  });

  it("does not attach body for GET/HEAD even if body.json is provided", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "nobody"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { json: { should: "be-ignored" } } });

    expect(calledInit?.method).toBe("GET");
    expect(calledInit?.body).toBeUndefined();
  });

  it("does not set content-type for FormData (let the browser set multipart boundary)", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "upload"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const fd = new FormData();
    fd.append("file", new Blob(["abc"]), "a.txt");

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { formData: fd, json: undefined } });

    expect(calledInit?.method).toBe("POST");
    // No explicit content-type here
    expect(calledInit?.headers).toEqual(undefined);
    // Body is the FormData object (opaque to equality, but presence is enough)
    expect(calledInit?.body).toBeDefined();
  });

  it("includes cookies from requestHeaders.cookies into the Cookie header", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "withCookies"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    const methodParam = {
      requestHeaders: {
        cookies: {
          sessionId: "abc123",
          theme: "dark",
        },
        headers: undefined,
      },
    };

    await requestFn(methodParam);

    expect(calledInit?.headers).toEqual({
      cookie: "sessionId=abc123; theme=dark",
    });
  });

  it("sets inferred content-type for text body when user has NOT provided one", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "textBody"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { text: "hello", json: undefined } });

    expect(calledInit?.method).toBe("POST");
    expect(calledInit?.body).toBe("hello");
    expect(calledInit?.headers).toEqual({
      "content-type": "text/plain; charset=utf-8",
    });
  });

  it("sets inferred content-type for URLSearchParams body", async () => {
    const key = "$post";
    const paths = ["http://example.com", "api", "urlencoded"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const usp = new URLSearchParams();
    usp.set("a", "1");
    usp.set("b", "2");

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { urlencoded: usp, json: undefined } });

    expect(calledInit?.method).toBe("POST");
    // Body instance identity is kept
    expect(calledInit?.body).toBe(usp);
    expect(calledInit?.headers).toEqual({
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    });
  });

  it("does not set content-type for raw body", async () => {
    const key = "$put";
    const paths = ["http://example.com", "api", "raw"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 204 }));
    }) as typeof fetch;

    const payload = new Uint8Array([1, 2, 3]).buffer;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { raw: payload, json: undefined } });

    expect(calledInit?.method).toBe("PUT");
    expect(calledInit?.body).toBe(payload);
    expect(calledInit?.headers ?? {}).not.toHaveProperty("content-type");
  });

  it("does not attach body for HEAD even if body is provided", async () => {
    const key = "$head";
    const paths = ["http://example.com", "api", "head"];
    const params = {};
    const dynamicKeys: string[] = [];

    let calledInit: CapturedInit | undefined = {};
    global.fetch = ((_input, _init) => {
      calledInit = _init as CapturedInit | undefined;

      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await requestFn({ body: { json: { will: "be-ignored" } } });

    expect(calledInit?.method).toBe("HEAD");
    expect(calledInit?.body).toBeUndefined();
  });

  it("wraps non-Error rejections with helpful message", async () => {
    const key = "$get";
    const paths = ["http://example.com", "api", "boom"];
    const params = {};
    const dynamicKeys: string[] = [];

    global.fetch = ((_input, _init) => {
      return Promise.reject("string-failure"); // not an Error
    }) as typeof fetch;

    const defaultOptions = { init: {} };
    const requestFn = httpMethod(
      key,
      paths,
      params,
      dynamicKeys,
      defaultOptions
    );

    await expect(requestFn()).rejects.toThrow(
      "[httpMethod] GET http://example.com/api/boom failed: string-failure"
    );
  });
});

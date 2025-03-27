import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, test, expect } from "vitest";
import { createRpcClient } from "./rpc";
import { routeHandlerFactory } from "../server";
import { ParamsKey, Endpoint } from "./types";

const createRouteHandler = routeHandlerFactory();

const { POST: _post_0 } = createRouteHandler().post(async (rc) =>
  rc.text("post")
);

const { GET: _get_0 } = createRouteHandler().get(async (rc) =>
  rc.json({ method: "get" })
);

const { DELETE: _delete_0 } = createRouteHandler().delete(async (rc) =>
  rc.text("delete")
);

const { HEAD: _head_0 } = createRouteHandler().head(async (rc) =>
  rc.text("head")
);

const { PATCH: _patch_0 } = createRouteHandler().patch(async (rc) =>
  rc.text("patch")
);

const { PUT: _put_0 } = createRouteHandler().put(async (rc) => rc.text("put"));

export type PathStructure = Endpoint & {
  admin: Endpoint & {
    _qualification: Endpoint &
      Record<ParamsKey, { qualification: string }> & {
        _grade: Endpoint;
      };
  };
  api: {
    questions: {
      $post: typeof _post_0;
      $delete: typeof _delete_0;
      $head: typeof _head_0;
      $patch: typeof _patch_0;
      $put: typeof _put_0;
    } & Endpoint & {
        _qualification: { $get: typeof _get_0 } & Endpoint;
      };
  };
};

// MSW handler configuration
const server = setupServer(
  http.get("http://localhost:3000/api/questions/test", () => {
    return HttpResponse.json({ method: "get" });
  }),
  http.post("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("post");
  }),
  http.delete("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("delete");
  }),
  http.head("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("head");
  }),
  http.patch("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("patch");
  }),
  http.put("http://localhost:3000/api/questions", () => {
    return HttpResponse.text("put");
  })
);

// MSW lifecycle setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createRpcClient", () => {
  test("URL generation: client.admin._qualification('test').$url()", () => {
    const client = createRpcClient<PathStructure>("");
    const urlResult = client.admin._qualification("test").$url();
    expect(urlResult.path).toBe("/admin/test");
    expect(urlResult.pathname).toBe("/admin/[qualification]");
    expect(urlResult.params).toEqual({ qualification: "test" });
  });

  test("GET request: client.api.questions._qualification('test').$get()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions._qualification("test").$get();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ method: "get" });
  });

  test("POST request: client.api.questions.$post()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$post();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("post");
  });

  test("DELETE request: client.api.questions.$delete()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$delete();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("delete");
  });

  test("HEAD request: client.api.questions.$head()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$head();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("head");
  });

  test("PATCH request: client.api.questions.$patch()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$patch();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("patch");
  });

  test("PUT request: client.api.questions.$put()", async () => {
    const client = createRpcClient<PathStructure>("http://localhost:3000");
    const response = await client.api.questions.$put();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("put");
  });

  test("URL generation: add query/hash parameters", () => {
    const client = createRpcClient<PathStructure>("");
    const urlResult = client.admin._qualification("test").$url({
      query: { foo: "bar" },
      hash: "section",
    });
    expect(urlResult.path).toBe("/admin/test?foo=bar#section");
  });
});

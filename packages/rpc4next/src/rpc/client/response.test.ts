import { describe, expect, expectTypeOf, it } from "vitest";

import type { TypedNextResponse } from "../server";
import {
  createRpcResponsePromise,
  type ErrorResponseCode,
  type ErrorResponsePayload,
  type RpcFilePayload,
  RpcResponseError,
  type SuccessfulJsonPayload,
  type SuccessfulResponsePayload,
} from "./response";

const unwrapResponse = <TResponse extends Response>(response: TResponse | Promise<TResponse>) =>
  createRpcResponsePromise(Promise.resolve(response)).unwrap();

const unwrapFileResponse = <TResponse extends Response>(response: TResponse | Promise<TResponse>) =>
  createRpcResponsePromise(Promise.resolve(response)).unwrapFile();

describe("response promise unwrap", () => {
  it("parses successful JSON responses", async () => {
    const response = Response.json({ ok: true, value: "success" });

    await expect(unwrapResponse(response)).resolves.toEqual({
      ok: true,
      value: "success",
    });
  });

  it("accepts a response promise", async () => {
    const response = Promise.resolve(Response.json({ value: "promised" }));

    await expect(unwrapResponse(response)).resolves.toEqual({
      value: "promised",
    });
  });

  it("parses successful text responses by Content-Type", async () => {
    const response = new Response("plain text", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });

    await expect(unwrapResponse(response)).resolves.toBe("plain text");
  });

  it("parses successful XML and YAML application responses as text", async () => {
    await expect(
      unwrapResponse(
        new Response("<ok>true</ok>", {
          headers: {
            "content-type": "application/problem+xml; charset=utf-8",
          },
        }),
      ),
    ).resolves.toBe("<ok>true</ok>");

    await expect(
      unwrapResponse(
        new Response("ok: true", {
          headers: {
            "content-type": "application/x-yaml",
          },
        }),
      ),
    ).resolves.toBe("ok: true");
  });

  it("parses successful non-text responses as blobs", async () => {
    const response = new Response("binary", {
      headers: {
        "content-type": "application/octet-stream",
      },
    });

    const payload = await unwrapResponse(response);

    expect(payload).toBeInstanceOf(Blob);
    await expect((payload as Blob).text()).resolves.toBe("binary");
  });

  it("unwraps successful file responses with blob metadata", async () => {
    const response = new Response("id,name\n1,Ada", {
      headers: {
        "content-disposition": `attachment; filename="users.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });

    const file = await createRpcResponsePromise(Promise.resolve(response)).unwrapFile();

    expectTypeOf(file).toEqualTypeOf<RpcFilePayload<Response>>();
    expect(file.filename).toBe("users.csv");
    expect(file.contentType).toBe("text/csv; charset=utf-8");
    expect(file.response).toBe(response);
    await expect(file.blob.text()).resolves.toBe("id,name\n1,Ada");
  });

  it("unwraps RFC 5987 encoded file names", async () => {
    const file = await unwrapFileResponse(
      new Response("pdf", {
        headers: {
          "content-disposition": "attachment; filename*=UTF-8''report%202026.pdf",
          "content-type": "application/pdf",
        },
      }),
    );

    expect(file.filename).toBe("report 2026.pdf");
  });

  it("returns undefined for successful no-body statuses", async () => {
    const response = new Response(null, {
      status: 204,
      headers: {
        "content-type": "application/octet-stream",
      },
    });

    await expect(unwrapResponse(response)).resolves.toBeUndefined();
  });

  it("throws RpcResponseError with a parsed JSON payload for error responses", async () => {
    const response = Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "invalid",
        },
      },
      { status: 400, statusText: "Bad Request" },
    );

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      status: 400,
      statusText: "Bad Request",
      code: "BAD_REQUEST",
      payload: {
        error: {
          code: "BAD_REQUEST",
          message: "invalid",
        },
      },
      response,
    });

    await expect(
      unwrapResponse(Response.json({ error: true }, { status: 500 })),
    ).rejects.toBeInstanceOf(RpcResponseError);
  });

  it("falls back to text for non-JSON error responses", async () => {
    const response = new Response("not json", {
      status: 502,
      statusText: "Bad Gateway",
    });

    const error = await unwrapResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RpcResponseError);
    expect((error as RpcResponseError).status).toBe(502);
    expect((error as RpcResponseError).statusText).toBe("Bad Gateway");
    expect((error as RpcResponseError).payload).toBe("not json");
    expect((error as RpcResponseError).response).toBe(response);
  });

  it("throws RpcResponseError with undefined payload for no-body error statuses", async () => {
    const response = new Response(null, {
      status: 304,
      headers: {
        "content-type": "application/json",
      },
    });

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      status: 304,
      payload: undefined,
      response,
    });
  });

  it("handles empty or unreadable error bodies", async () => {
    await expect(unwrapResponse(new Response(null, { status: 404 }))).rejects.toMatchObject({
      status: 404,
      payload: undefined,
    });

    const unreadableResponse = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      headers: new Headers({
        "content-type": "text/plain",
      }),
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      json: async () => ({}),
      text: async () => {
        throw new Error("body unavailable");
      },
    };

    await expect(
      createRpcResponsePromise(Promise.resolve(unreadableResponse)).unwrap(),
    ).rejects.toMatchObject({
      status: 503,
      statusText: "Service Unavailable",
      payload: undefined,
      response: unreadableResponse,
    });
  });

  it("throws RpcResponseError with a parsed payload for file error responses", async () => {
    const response = Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "invalid export",
        },
      },
      { status: 400, statusText: "Bad Request" },
    );

    await expect(
      createRpcResponsePromise(Promise.resolve(response)).unwrapFile(),
    ).rejects.toMatchObject({
      status: 400,
      statusText: "Bad Request",
      code: "BAD_REQUEST",
      payload: {
        error: {
          code: "BAD_REQUEST",
          message: "invalid export",
        },
      },
      response,
    });
  });

  it("infers JSON payloads from successful response union members", async () => {
    type ResponseUnion =
      | TypedNextResponse<
          {
            ok: true;
            value: string;
          },
          200,
          "application/json"
        >
      | TypedNextResponse<
          {
            ok: false;
            reason: string;
          },
          400,
          "application/json"
        >
      | TypedNextResponse<"not found", 404, "text/plain">;

    type Payload = SuccessfulJsonPayload<ResponseUnion>;
    type ResponsePayload = SuccessfulResponsePayload<ResponseUnion>;

    expectTypeOf<Payload>().toEqualTypeOf<{
      ok: true;
      value: string;
    }>();
    expectTypeOf<ResponsePayload>().toEqualTypeOf<{
      ok: true;
      value: string;
    }>();

    const response = Promise.resolve(Response.json({ ok: true, value: "typed" }) as ResponseUnion);
    const payload = await createRpcResponsePromise(response).unwrap();

    expectTypeOf(payload).toEqualTypeOf<{
      ok: true;
      value: string;
    }>();
    expect(payload).toEqual({ ok: true, value: "typed" });
  });

  it("infers error payloads and codes from unsuccessful response union members", () => {
    type ResponseUnion =
      | TypedNextResponse<{ ok: true }, 200, "application/json">
      | TypedNextResponse<
          {
            error: {
              code: "NOT_FOUND";
              message: string;
              details: {
                entryId: string;
              };
            };
          },
          404,
          "application/json"
        >
      | TypedNextResponse<
          {
            error: {
              code: "CONFLICT";
              message: string;
            };
          },
          409,
          "application/json"
        >;

    type Payload = ErrorResponsePayload<ResponseUnion>;
    type Code = ErrorResponseCode<ResponseUnion>;
    type Error = RpcResponseError<Payload>;

    expectTypeOf<Code>().toEqualTypeOf<"NOT_FOUND" | "CONFLICT">();
    expectTypeOf<Error["code"]>().toEqualTypeOf<"NOT_FOUND" | "CONFLICT" | undefined>();
    expectTypeOf<Payload>().toEqualTypeOf<
      | {
          error: {
            code: "NOT_FOUND";
            message: string;
            details: {
              entryId: string;
            };
          };
        }
      | {
          error: {
            code: "CONFLICT";
            message: string;
          };
        }
    >();
  });

  it("infers text payloads from successful text response union members", async () => {
    type ResponseUnion =
      | TypedNextResponse<"accepted", 202, "text/plain">
      | TypedNextResponse<{ error: string }, 400, "application/json">;

    type Payload = SuccessfulResponsePayload<ResponseUnion>;

    expectTypeOf<Payload>().toEqualTypeOf<"accepted">();

    const response = Promise.resolve(
      new Response("accepted", {
        status: 202,
        headers: {
          "content-type": "text/plain",
        },
      }) as ResponseUnion,
    );
    const payload = await createRpcResponsePromise(response).unwrap();

    expectTypeOf(payload).toEqualTypeOf<"accepted">();
    expect(payload).toBe("accepted");
  });

  it("infers text payloads from XML and YAML application content types", async () => {
    type ResponseUnion =
      | TypedNextResponse<"<ok>true</ok>", 200, "application/xml">
      | TypedNextResponse<{ error: string }, 400, "application/json">;

    type Payload = SuccessfulResponsePayload<ResponseUnion>;

    expectTypeOf<Payload>().toEqualTypeOf<"<ok>true</ok>">();

    const response = Promise.resolve(
      new Response("<ok>true</ok>", {
        status: 200,
        headers: {
          "content-type": "application/xml",
        },
      }) as ResponseUnion,
    );
    const payload = await createRpcResponsePromise(response).unwrap();

    expectTypeOf(payload).toEqualTypeOf<"<ok>true</ok>">();
    expect(payload).toBe("<ok>true</ok>");

    expectTypeOf<
      SuccessfulResponsePayload<TypedNextResponse<{ ok: true }, 200, "application/custom+yaml">>
    >().toEqualTypeOf<string>();
  });

  it("infers undefined payloads from no-body response statuses", async () => {
    type ResponseUnion =
      | TypedNextResponse<{ ignored: true }, 204, "application/json">
      | TypedNextResponse<{ error: string }, 400, "application/json">;

    type Payload = SuccessfulResponsePayload<ResponseUnion>;

    expectTypeOf<Payload>().toEqualTypeOf<undefined>();

    const response = Promise.resolve(new Response(null, { status: 204 }) as ResponseUnion);
    const payload = await createRpcResponsePromise(response).unwrap();

    expectTypeOf(payload).toEqualTypeOf<undefined>();
    expect(payload).toBeUndefined();
  });
});

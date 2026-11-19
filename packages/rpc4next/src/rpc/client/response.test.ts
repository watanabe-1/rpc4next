import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { TypedNextResponse } from "../server";
import {
  createRpcResponsePromise,
  type ErrorResponseCode,
  type ErrorResponsePayload,
  matchRpcResponseError,
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

  it("parses media types with whitespace before their parameters", async () => {
    const json = new Response('{"ok":true}', {
      headers: { "content-type": "application/json ; charset=utf-8" },
    });
    const text = new Response("hello", {
      headers: { "content-type": "application/xml ; charset=utf-8" },
    });
    const form = new Response("name=Ada", {
      headers: { "content-type": "application/x-www-form-urlencoded ; charset=utf-8" },
    });

    await expect(unwrapResponse(json)).resolves.toEqual({ ok: true });
    await expect(unwrapResponse(text)).resolves.toBe("hello");
    const formData = await unwrapResponse(form);
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get("name")).toBe("Ada");
  });

  it.each([
    "text/plain; charset=utf-8",
    "application/xml",
    "application/problem+xml; charset=utf-8",
    "application/yaml",
    "application/x-yaml",
    "application/custom+yaml",
    "",
  ])("preserves successful empty text bodies for Content-Type %s", async (contentType) => {
    const response = new Response("", {
      status: 200,
      headers: { "content-type": contentType },
    });

    await expect(unwrapResponse(response)).resolves.toBe("");
  });

  it("keeps the string return type for successful empty text bodies", async () => {
    const response = new Response("", {
      headers: { "content-type": "text/plain" },
    }) as TypedNextResponse<string, 200, "text/plain">;
    const payload = await unwrapResponse(response);

    expectTypeOf(payload).toEqualTypeOf<string>();
    expect(payload.toUpperCase()).toBe("");
  });

  it.each(["", "not json"])("rejects invalid successful JSON %j", async (body) => {
    const response = new Response(body, {
      headers: { "content-type": "application/json" },
    });

    await expect(unwrapResponse(response)).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    ["application/json", "json"],
    ["text/plain", "text"],
    ["", "text"],
    ["multipart/form-data", "formData"],
    ["application/octet-stream", "blob"],
  ] as const)("propagates body read failures for Content-Type %s", async (contentType, method) => {
    const response = new Response("body", { headers: { "content-type": contentType } });
    const failure = new Error("body unavailable");
    vi.spyOn(response, method).mockRejectedValue(failure);

    await expect(unwrapResponse(response)).rejects.toBe(failure);
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

  it("returns an empty content type when a file response has no Content-Type", async () => {
    const response = new Response(null);
    const file = await unwrapFileResponse(response);

    expect(file.contentType).toBe("");
    expect(file.response).toBe(response);
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

  it.each([
    ['attachment;filename="report;2026.csv"', "report;2026.csv"],
    ["attachment;filename=report.csv", "report.csv"],
    ["attachment;filename=report.csv  ; size=3", "report.csv"],
    ["attachment;filename*=UTF-8''report%202026.pdf", "report 2026.pdf"],
  ])("reads filename from Content-Disposition %s", async (contentDisposition, filename) => {
    const file = await unwrapFileResponse(
      new Response("file", { headers: { "content-disposition": contentDisposition } }),
    );

    expect(file.filename).toBe(filename);
  });

  it("preserves a filename with invalid percent encoding", async () => {
    const file = await unwrapFileResponse(
      new Response("pdf", {
        headers: { "content-disposition": "attachment; filename*=UTF-8''report%ZZ.pdf" },
      }),
    );

    expect(file.filename).toBe("report%ZZ.pdf");
  });

  it("ignores whitespace after an encoded filename parameter", async () => {
    const file = await unwrapFileResponse(
      new Response("pdf", {
        headers: {
          "content-disposition": "attachment; filename*=UTF-8''report%202026.pdf  ; size=3",
        },
      }),
    );

    expect(file.filename).toBe("report 2026.pdf");
  });

  it.each([
    'attachment; xfilename="other.pdf"',
    "attachment; xfilename*=UTF-8''other.pdf",
    'attachment; filename-extra="other.pdf"',
    "attachment; filename*-extra=UTF-8''other.pdf",
  ])(
    "does not treat a different content disposition parameter as a filename: %s",
    async (value) => {
      const file = await unwrapFileResponse(
        new Response("pdf", { headers: { "content-disposition": value } }),
      );

      expect(file.filename).toBeUndefined();
    },
  );

  it.each([204, 205])("returns undefined for successful no-body status %i", async (status) => {
    const response = new Response(null, {
      status,
      headers: {
        "content-type": "text/plain",
      },
    });
    const readBody = vi.spyOn(response, "text");

    await expect(unwrapResponse(response)).resolves.toBeUndefined();
    expect(readBody).not.toHaveBeenCalled();
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

  it.each(["text/plain", "application/xml", "application/x-yaml", "application/json", ""])(
    "preserves errors with empty or unreadable bodies for Content-Type %s",
    async (contentType) => {
      for (const unreadable of [false, true]) {
        for (const unwrap of [unwrapResponse, unwrapFileResponse]) {
          const response = new Response("", {
            status: 502,
            statusText: "Bad Gateway",
            headers: { "content-type": contentType },
          });
          // Invalid JSON is read from a clone after JSON parsing fails.
          const fallbackResponse = response.clone();
          vi.spyOn(response, "clone").mockReturnValue(fallbackResponse);
          if (unreadable) {
            vi.spyOn(response, "text").mockRejectedValue(new Error("body unavailable"));
            vi.spyOn(fallbackResponse, "text").mockRejectedValue(new Error("body unavailable"));
          }

          const error = await unwrap(response).catch((caught: unknown) => caught);

          expect(error).toBeInstanceOf(RpcResponseError);
          expect(error).toMatchObject({
            status: 502,
            statusText: "Bad Gateway",
            payload: undefined,
            response,
          });
          expect((error as RpcResponseError).response).toBe(response);
        }
      }
    },
  );

  it("preserves the text fallback for invalid JSON error bodies", async () => {
    const response = new Response("not json", {
      status: 502,
      headers: { "content-type": "application/json" },
    });
    const error = await unwrapResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RpcResponseError);
    expect(error).toMatchObject({ status: 502, payload: "not json", response });
  });

  it("preserves form data from an error response", async () => {
    const response = new Response("reason=unavailable", {
      status: 502,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const error: unknown = await unwrapResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RpcResponseError);
    if (!(error instanceof RpcResponseError)) throw new Error("Expected RpcResponseError");
    expect(error.response).toBe(response);
    expect(error.payload).toBeInstanceOf(FormData);
    expect((error.payload as FormData).get("reason")).toBe("unavailable");
  });

  it("preserves the response when an error body is invalid form data", async () => {
    const response = new Response("upstream failure", {
      status: 502,
      headers: { "content-type": "multipart/form-data" },
    });

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      status: 502,
      payload: undefined,
      response,
    });
  });

  it("falls back to readable text when form data parsing fails", async () => {
    const response = new Response("upstream failure", {
      status: 502,
      headers: { "content-type": "multipart/form-data" },
    });
    vi.spyOn(response, "formData").mockRejectedValue(new TypeError("invalid form data"));

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      payload: "upstream failure",
      response,
    });
  });

  it("preserves binary error bodies as blobs", async () => {
    const response = new Response("binary failure", {
      status: 502,
      headers: { "content-type": "application/octet-stream" },
    });
    const error: unknown = await unwrapResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RpcResponseError);
    if (!(error instanceof RpcResponseError)) throw new Error("Expected RpcResponseError");
    expect(error.response).toBe(response);
    expect(error.payload).toBeInstanceOf(Blob);
    await expect((error.payload as Blob).text()).resolves.toBe("binary failure");
  });

  it("preserves the response when a binary error body cannot be read", async () => {
    const response = new Response("binary failure", {
      status: 502,
      statusText: "Bad Gateway",
      headers: { "content-type": "application/octet-stream" },
    });
    vi.spyOn(response, "blob").mockRejectedValue(new Error("body unavailable"));

    await expect(unwrapResponse(response)).rejects.toMatchObject({
      status: 502,
      statusText: "Bad Gateway",
      payload: undefined,
      response,
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

  it("matches RPC response errors with exhaustive typed handlers", () => {
    type Payload =
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
        };

    const response = Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Missing",
          details: {
            entryId: "entry-1",
          },
        },
      },
      { status: 404 },
    );
    const error = new RpcResponseError<Payload>(response, {
      error: {
        code: "NOT_FOUND",
        message: "Missing",
        details: {
          entryId: "entry-1",
        },
      },
    });

    const result = matchRpcResponseError<Payload, string>(error, {
      NOT_FOUND: (matched) => matched.payload.error.details.entryId,
      CONFLICT: (matched) => matched.payload.error.message,
    });

    expect(result).toBe("entry-1");
    expectTypeOf(result).toEqualTypeOf<string>();
  });

  it("rethrows the original error for unexpected external error codes", () => {
    type Payload = { error: { code: "NOT_FOUND"; message: string } };
    const payload = JSON.parse('{"error":{"code":"UNKNOWN","message":"Unexpected"}}') as Payload;
    const error = new RpcResponseError<Payload>(new Response(null, { status: 500 }), payload);

    expect(() => matchRpcResponseError(error, { NOT_FOUND: () => "handled" })).toThrow(error);
  });

  it.each([null, { error: null }, { error: { code: 42 } }])(
    "preserves an external JSON error without a string code: %j",
    async (payload) => {
      const response = Response.json(payload, { status: 502 });
      const error: unknown = await unwrapResponse(response).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(RpcResponseError);
      expect(error).toMatchObject({ code: undefined, payload, response });
    },
  );

  it.each([
    { body: "upstream unavailable", contentType: "text/plain" },
    { body: '{"error":{"message":"upstream unavailable"}}', contentType: "application/json" },
  ])(
    "rethrows the original error when an external response has no code: $contentType",
    async ({ body, contentType }) => {
      const response = new Response(body, {
        status: 502,
        headers: { "content-type": contentType },
      });
      const error: unknown = await unwrapResponse(response).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(RpcResponseError);
      if (!(error instanceof RpcResponseError)) throw new Error("Expected RpcResponseError");
      expect(error.code).toBeUndefined();

      let rethrown: unknown;
      try {
        matchRpcResponseError(error, {});
      } catch (caught) {
        rethrown = caught;
      }
      expect(rethrown).toBe(error);
    },
  );

  it("does not dispatch a code-less error to a handler named undefined", () => {
    const error = new RpcResponseError<unknown>(new Response(null, { status: 502 }), "upstream");
    const handler = vi.fn<() => string>(() => "handled");
    let rethrown: unknown;

    try {
      matchRpcResponseError(error, { undefined: handler });
    } catch (caught) {
      rethrown = caught;
    }

    expect(rethrown).toBe(error);
    expect(handler).not.toHaveBeenCalled();
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

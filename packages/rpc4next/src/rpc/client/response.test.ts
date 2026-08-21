import { describe, expect, expectTypeOf, it } from "vitest";

import type { TypedNextResponse } from "../server";
import {
  parseResponse,
  RpcResponseError,
  type SuccessfulJsonPayload,
  type SuccessfulResponsePayload,
} from "./response";

describe("parseResponse", () => {
  it("parses successful JSON responses", async () => {
    const response = Response.json({ ok: true, value: "success" });

    await expect(parseResponse(response)).resolves.toEqual({
      ok: true,
      value: "success",
    });
  });

  it("accepts a response promise", async () => {
    const response = Promise.resolve(Response.json({ value: "promised" }));

    await expect(parseResponse(response)).resolves.toEqual({
      value: "promised",
    });
  });

  it("parses successful text responses by Content-Type", async () => {
    const response = new Response("plain text", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });

    await expect(parseResponse(response)).resolves.toBe("plain text");
  });

  it("parses successful non-text responses as blobs", async () => {
    const response = new Response("binary", {
      headers: {
        "content-type": "application/octet-stream",
      },
    });

    const payload = await parseResponse(response);

    expect(payload).toBeInstanceOf(Blob);
    await expect((payload as Blob).text()).resolves.toBe("binary");
  });

  it("throws RpcResponseError with a parsed JSON payload for error responses", async () => {
    const response = Response.json(
      {
        error: {
          message: "invalid",
        },
      },
      { status: 400, statusText: "Bad Request" },
    );

    await expect(parseResponse(response)).rejects.toMatchObject({
      status: 400,
      statusText: "Bad Request",
      payload: {
        error: {
          message: "invalid",
        },
      },
      response,
    });

    await expect(
      parseResponse(Response.json({ error: true }, { status: 500 })),
    ).rejects.toBeInstanceOf(RpcResponseError);
  });

  it("falls back to text for non-JSON error responses", async () => {
    const response = new Response("not json", {
      status: 502,
      statusText: "Bad Gateway",
    });

    const error = await parseResponse(response).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RpcResponseError);
    expect((error as RpcResponseError).status).toBe(502);
    expect((error as RpcResponseError).statusText).toBe("Bad Gateway");
    expect((error as RpcResponseError).payload).toBe("not json");
    expect((error as RpcResponseError).response).toBe(response);
  });

  it("handles empty or unreadable error bodies", async () => {
    await expect(parseResponse(new Response(null, { status: 404 }))).rejects.toMatchObject({
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

    await expect(parseResponse(unreadableResponse)).rejects.toMatchObject({
      status: 503,
      statusText: "Service Unavailable",
      payload: undefined,
      response: unreadableResponse,
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
    const payload = await parseResponse(response);

    expectTypeOf(payload).toEqualTypeOf<{
      ok: true;
      value: string;
    }>();
    expect(payload).toEqual({ ok: true, value: "typed" });
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
    const payload = await parseResponse(response);

    expectTypeOf(payload).toEqualTypeOf<"accepted">();
    expect(payload).toBe("accepted");
  });
});

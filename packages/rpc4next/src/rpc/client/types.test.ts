import { NextResponse } from "next/server";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { ContentType } from "../lib/content-type-types";
import type { HttpStatusCode } from "../lib/http-status-code-types";
import { createNextRoute } from "../server/next-route";
import { defaultProcedureOnError } from "../server/on-error";
import { output, withOutput } from "../server/output";
import { procedure } from "../server/procedure";
import type { ProcedureRouteContract } from "../server/procedure-types";
import { createResponseHelpers } from "../server/route-context";
import type { TypedNextResponse } from "../server/types";
import { createRpcClient } from "./rpc-client";
import type { DynamicPathProxyAsFunction, RpcEndpoint, RpcGeneratedPathStructure } from "./types";

// Exercise the same endpoint types used by the generated client. These assertions
// are included in the package's tsc check, since Vitest alone does not check types.
type ClientResponse<THandler> = Awaited<
  ReturnType<
    DynamicPathProxyAsFunction<RpcGeneratedPathStructure<RpcEndpoint & { $get: THandler }>>["$get"]
  >
>;

const response = createResponseHelpers();

describe("route handler response inference", () => {
  it("infers synchronous NextResponse JSON through the client", async () => {
    function GET() {
      return NextResponse.json({ ok: true });
    }
    async function asyncGET() {
      return GET();
    }

    type PathStructure = RpcGeneratedPathStructure<{
      api: { example: RpcEndpoint & { $get: typeof GET } };
    }>;
    const client = createRpcClient<PathStructure>("http://localhost", {
      fetch: async () => GET(),
    });
    const result = await client.api.example.$get();
    const payload = await result.json();

    expectTypeOf(payload).toEqualTypeOf<{ ok: boolean }>();
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<ClientResponse<typeof asyncGET>>();
    expect(payload.ok).toBe(true);
  });

  it("preserves synchronous typed JSON and text response unions", () => {
    function GET(json: boolean) {
      return json ? response.json({ ok: true }, 201) : response.text("missing", 404);
    }
    async function asyncGET(json: boolean) {
      return GET(json);
    }

    type Expected =
      | TypedNextResponse<{ ok: boolean }, 201, "application/json">
      | TypedNextResponse<"missing", 404, "text/plain">;
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<Expected>();
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<ClientResponse<typeof asyncGET>>();
  });

  it("applies withOutput to synchronous native and raw responses", () => {
    const contract = output({ _output: { ok: true as const } });
    const GET = withOutput(contract, () => NextResponse.json({ ok: true }));
    const rawGET = withOutput(contract, () => new Response());
    const asyncGET = withOutput(contract, async () => NextResponse.json({ ok: true }));

    type Expected = TypedNextResponse<{ ok: true }, HttpStatusCode, ContentType>;
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<Expected>();
    expectTypeOf<ClientResponse<typeof rawGET>>().toEqualTypeOf<Expected>();
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<ClientResponse<typeof asyncGET>>();
  });

  it("replaces only success bodies with synchronous output contracts", () => {
    function handler(success: boolean) {
      return success ? response.json({ internal: true }, 201) : response.text("forbidden", 403);
    }
    const contract = output({ _output: { ok: true as const } });
    const GET = withOutput(contract, handler);
    const asyncGET = withOutput(contract, async (success: boolean) => handler(success));

    type Expected =
      | TypedNextResponse<{ ok: true }, 201, "application/json">
      | TypedNextResponse<"forbidden", 403, "text/plain">;
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<Expected>();
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<ClientResponse<typeof asyncGET>>();
  });

  it("does not infer a payload from an untyped Response", () => {
    function GET() {
      return Response.json({ ok: true });
    }
    async function asyncGET() {
      return GET();
    }

    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<
      TypedNextResponse<unknown, HttpStatusCode, ContentType>
    >();
    expectTypeOf<ClientResponse<typeof GET>>().toEqualTypeOf<ClientResponse<typeof asyncGET>>();
  });

  it("keeps procedure output, validation, and error response variants", () => {
    const { GET } = createNextRoute(
      procedure
        .forRoute({ pathname: "/api/example", params: {} } as ProcedureRouteContract<
          "/api/example",
          Record<never, never>
        >)
        .query(z.object({ id: z.string() }))
        .output(z.object({ id: z.string() }))
        .handle(({ query, response }) => response.json({ id: query.id }, 201)),
      { method: "GET", validateOutput: true, onError: defaultProcedureOnError },
    );

    type Result = ClientResponse<typeof GET>;
    expectTypeOf<Extract<Result, { status: 201 }>>().toEqualTypeOf<
      TypedNextResponse<{ id: string }, 201, "application/json">
    >();
    expectTypeOf<
      Extract<Result, { status: 400 }> extends never ? false : true
    >().toEqualTypeOf<true>();
    expectTypeOf<
      Extract<Result, { status: 500 }> extends never ? false : true
    >().toEqualTypeOf<true>();
    expectTypeOf<Result["status"]>().toEqualTypeOf<201 | 400 | 500>();
  });
});

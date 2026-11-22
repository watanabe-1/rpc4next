import { NextRequest, NextResponse } from "next/server";
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
import type { SuccessfulJsonPayload } from "./inference";
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
  it("infers toJSON methods with narrower or additional parameters", async () => {
    type OptionalSerializer = { value: string; toJSON?: (key: "optional") => 456 };
    const optional: OptionalSerializer = { value: "original", toJSON: () => 456 };
    const data = await response
      .json({
        item: { toJSON: (_key: "item") => 123 as const },
        extra: { toJSON: (_key: "extra", _second: number) => "serialized" as const },
        optional: optional as OptionalSerializer,
      })
      .json();
    expectTypeOf(data).toEqualTypeOf<{
      item: 123;
      extra: "serialized";
      optional: { value: string } | 456;
    }>();
    expect(data).toEqual({ item: 123, extra: "serialized", optional: 456 });
  });
  it("accounts for mutable fixed tuples changing length or order", async () => {
    const popped: [string] = ["a"];
    popped.pop();
    const shifted: [string, number] = ["a", 1];
    shifted.shift();
    const expanded: [string] = ["a"];
    expanded.push("b");
    const sparse: [string] = ["a"];
    Reflect.deleteProperty(sparse, 0);
    const data = await response.json({ popped, shifted, expanded, sparse }).json();
    expectTypeOf(data).toEqualTypeOf<{
      popped: (string | null)[];
      shifted: (string | number | null)[];
      expanded: (string | null)[];
      sparse: (string | null)[];
    }>();
    expect(data).toEqual({ popped: [], shifted: [1], expanded: ["a", "b"], sparse: [null] });
  });
  it("includes null for sparse arrays", async () => {
    const items: string[] = [];
    items.length = 1;
    const other = ["first", "second"];
    Reflect.deleteProperty(other, 0);
    const variadic: [string, ...string[]] = ["first"];
    variadic.length = 3;
    const data = await response.json({ items, other, variadic }).json();
    expectTypeOf(data).toEqualTypeOf<{
      items: (string | null)[];
      other: (string | null)[];
      variadic: (string | null)[];
    }>();
    expect(data).toEqual({
      items: [null],
      other: [null, "second"],
      variadic: ["first", null, null],
    });
  });
  it("reflects non-finite numbers and omitted unknown properties", async () => {
    const result = response.json({
      nan: NaN,
      infinity: Infinity,
      finite: 42 as const,
      unknown: undefined as unknown,
      unknownFunction: (() => 1) as unknown,
      unknownSymbol: Symbol("value") as unknown,
      array: [NaN, Infinity],
    });
    const data = await result.json();
    expectTypeOf(data).toEqualTypeOf<{
      nan: number | null;
      infinity: number | null;
      finite: 42;
      unknown?: unknown;
      unknownFunction?: unknown;
      unknownSymbol?: unknown;
      array: (number | null)[];
    }>();
    expect(data).toEqual({ nan: null, infinity: null, finite: 42, array: [null, null] });
  });
  it("omits built-in prototype properties from JSON response types", async () => {
    const map = Object.assign(new Map([["key", 1]]), { label: "map" });
    const GET = () =>
      response.json({
        map,
        set: new Set([1]),
        error: new Error("failure"),
        regexp: /test/,
        weakMap: new WeakMap(),
        weakSet: new WeakSet(),
      });
    const client = createRpcClient<
      RpcGeneratedPathStructure<{ api: RpcEndpoint & { $get: typeof GET } }>
    >("http://localhost", { fetch: async () => GET() });
    const data = await (await client.api.$get()).json();
    expectTypeOf(data).toEqualTypeOf<{
      map: { label: string };
      set: {};
      error: { name?: string; message?: string; stack?: string; cause?: unknown };
      regexp: {};
      weakMap: {};
      weakSet: {};
    }>();
    expect(data).toEqual({
      map: { label: "map" },
      set: {},
      error: {},
      regexp: {},
      weakMap: {},
      weakSet: {},
    });
  });
  it("preserves name and message on ordinary JSON objects", async () => {
    const result = response.json({ name: "Alice", message: "hello" });
    const data = await result.json();
    expectTypeOf(data).toEqualTypeOf<{ name: string; message: string }>();
    expect(data).toEqual({ name: "Alice", message: "hello" });
  });
  it("exposes boxed primitives as JSON primitives", async () => {
    const result = response.json({
      number: new Number(1),
      string: new String("x"),
      boolean: new Boolean(false),
      nested: { value: new Boolean(true) },
      mixed: [new Number(2), { value: new Boolean(true) }] as const,
    });
    const data = await result.json();
    expectTypeOf<
      readonly [number, { value: boolean }] extends typeof data.mixed ? true : false
    >().toEqualTypeOf<true>();
    expectTypeOf<Extract<typeof data.number, number>>().toEqualTypeOf<number>();
    expectTypeOf<Extract<typeof data.string, string>>().toEqualTypeOf<string>();
    expectTypeOf<Extract<typeof data.boolean, boolean>>().toEqualTypeOf<boolean>();
    expect(data).toEqual({
      number: 1,
      string: "x",
      boolean: false,
      nested: { value: true },
      mixed: [2, { value: true }],
    });
  });
  it("preserves object and primitive possibilities for structural wrapper matches", async () => {
    const mimic = Object.assign(
      Object.create(Number.prototype) as InstanceType<NumberConstructor>,
      {
        valueOf: () => 1,
        label: "x",
      },
    );
    const GET = () =>
      response.json({
        value: { valueOf: () => 1, label: "x" },
        mimic,
        customDate: Object.assign(new Date(), { toJSON: () => 123 as const }),
      });
    const data = await GET().json();
    expectTypeOf(data.value).toEqualTypeOf<{ label: string }>();
    expectTypeOf(data.mimic).toEqualTypeOf<number | null | { label: string }>();
    expectTypeOf(data.customDate).toEqualTypeOf<123>();
    expect(data).toEqual({ value: { label: "x" }, mimic: { label: "x" }, customDate: 123 });
  });
  it("reflects invalid dates and optional toJSON methods", async () => {
    type OptionalSerializer = { value: number; toJSON?: () => string };
    const withMethod: OptionalSerializer = { value: 1, toJSON: () => "serialized" };
    const withoutMethod: OptionalSerializer = { value: 2 };
    const GET = () =>
      response.json({
        date: new Date(NaN),
        values: [withMethod, withoutMethod] as OptionalSerializer[],
      });
    const result = GET();
    const data = await result.json();
    expectTypeOf(data).toEqualTypeOf<{
      date: string | null;
      values: (string | { value: number | null } | null)[];
    }>();
    expect(data).toEqual({ date: null, values: ["serialized", { value: 2 }] });
  });
  it("exposes the JSON representation of response values", async () => {
    const selfReturning = {
      value: 1,
      toJSON() {
        return this;
      },
    };
    const GET = () =>
      response.json({
        date: new Date("2024-01-01T00:00:00.000Z"),
        missing: undefined,
        maybe: undefined as string | undefined,
        items: [undefined, "value"] as [undefined, string],
        custom: { toJSON: () => ({ value: 1 }) },
        keyed: { toJSON: (key: string) => key },
        returnedDate: { toJSON: () => new Date("2024-01-01T00:00:00.000Z") },
        selfReturning,
        returnedDateItems: [{ toJSON: () => new Date("2024-01-01T00:00:00.000Z") }],
        omitted: { toJSON: () => undefined },
        maybeOmitted: { toJSON: (): string | undefined => undefined },
        replacedItems: [
          { toJSON: () => undefined },
          { toJSON: (): string | undefined => undefined },
        ] as const,
      });
    const client = createRpcClient<
      RpcGeneratedPathStructure<{ api: RpcEndpoint & { $get: typeof GET } }>
    >("http://localhost", { fetch: async () => GET() });
    const result = await client.api.$get();
    const data = await result.json();
    expectTypeOf(data).toEqualTypeOf<{
      date: string | null;
      maybe?: string;
      items: (null | string)[];
      custom: { value: number | null };
      keyed: string;
      returnedDate: {};
      selfReturning: { value: number | null };
      returnedDateItems: ({} | null)[];
      maybeOmitted?: string;
      replacedItems: readonly [null, string | null];
    }>();
    expectTypeOf<SuccessfulJsonPayload<typeof result>>().toEqualTypeOf<typeof data>();
    expect(data).toEqual({
      date: "2024-01-01T00:00:00.000Z",
      items: [null, "value"],
      custom: { value: 1 },
      keyed: "keyed",
      returnedDate: {},
      selfReturning: { value: 1 },
      returnedDateItems: [{}],
      replacedItems: [null, null],
    });
  });
  it("serializes procedure object responses from handlers and error handlers", async () => {
    const { GET } = createNextRoute(
      procedure
        .forRoute({ pathname: "/api/example", params: {} } as ProcedureRouteContract<
          "/api/example",
          Record<never, never>
        >)
        .handle(() => ({
          body: { date: new Date("2024-01-01T00:00:00.000Z") },
          status: 201 as const,
        })),
      {
        method: "GET",
        onError: () => ({
          body: { date: new Date("2024-01-02T00:00:00.000Z") },
          status: 500 as const,
        }),
      },
    );
    type Result = ClientResponse<typeof GET>;
    expectTypeOf<Awaited<ReturnType<Extract<Result, { status: 201 }>["json"]>>>().toEqualTypeOf<{
      date: string | null;
    }>();
    expectTypeOf<Awaited<ReturnType<Extract<Result, { status: 500 }>["json"]>>>().toEqualTypeOf<{
      date: string | null;
    }>();
    const result = await GET(new NextRequest("http://localhost/api/example"), {
      params: Promise.resolve({}),
    });
    expect(await result.json()).toEqual({ date: "2024-01-01T00:00:00.000Z" });
  });
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

  it("serializes native responses and output contract payload types", () => {
    const native = () => NextResponse.json({ date: new Date() });
    const contracted = withOutput(output({ _output: { date: new Date() } }), () =>
      response.json({ date: new Date() }),
    );
    expectTypeOf<Awaited<ReturnType<ClientResponse<typeof native>["json"]>>>().toEqualTypeOf<{
      date: string | null;
    }>();
    expectTypeOf<SuccessfulJsonPayload<ClientResponse<typeof contracted>>>().toEqualTypeOf<{
      date: string | null;
    }>();
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

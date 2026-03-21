import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { procedure } from "./procedure";
import type { StandardSchemaV1 } from "./standard-schema";

describe("procedure builder type definitions", () => {
  it("threads input, middleware context, and output contracts", () => {
    const userProcedure = procedure
      .meta({ tags: ["procedure"], auth: "optional" as const })
      .params(z.object({ userId: z.string() }))
      .query(
        z.object({
          includePosts: z.enum(["true", "false"]).optional(),
        }),
      )
      .json(z.object({ title: z.string() }))
      .headers(z.object({ "x-procedure-test": z.string() }))
      .cookies(z.object({ session: z.string() }))
      .output({
        _output: {
          ok: true as const,
          userId: "" as string,
          source: "procedure" as const,
        },
      })
      .use(async ({ headers }) => ({
        ctx: {
          requestId: headers["x-procedure-test"],
        },
      }))
      .handle(async ({ params, query, json, headers, cookies, ctx }) => {
        const _params: { userId: string } = params;
        const _query: {
          includePosts?: "true" | "false" | undefined;
        } = query;
        const _json: { title: string } = json;
        const _headers: { "x-procedure-test": string } = headers;
        const _cookies: { session: string } = cookies;
        const _ctx: { requestId: string } = ctx;

        void _params;
        void _query;
        void _json;
        void _headers;
        void _cookies;
        void _ctx;

        return {
          status: 200 as const,
          body: {
            ok: true as const,
            userId: params.userId,
            source: "procedure" as const,
          },
        };
      });

    expectTypeOf(userProcedure.definition).toMatchTypeOf<{
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
            query: {
              includePosts?: "true" | "false" | undefined;
            };
            json: { title: string };
            headers: { "x-procedure-test": string };
            cookies: { session: string };
          };
        };
      };
      meta?: {
        tags: string[];
        auth: "optional";
      };
      output?: {
        response?: {
          ok: true;
          userId: string;
          source: "procedure";
        };
      };
    }>();
  });

  it("supports custom procedure validators without zod coupling", () => {
    const parsePage: StandardSchemaV1<
      { page?: string | string[] },
      { page: number }
    > = {
      "~standard": {
        version: 1,
        vendor: "rpc4next-test",
        validate: (value) => {
          const input =
            typeof value === "object" && value !== null
              ? (value as { page?: string | string[] })
              : {};
          const page = "page" in input ? input.page : "";
          const first = Array.isArray(page) ? page[0] : page;
          const parsed = Number(first ?? "1");

          if (!Number.isInteger(parsed) || parsed < 1) {
            return {
              issues: [{ message: "page must be a positive integer" }],
            };
          }

          return {
            value: { page: parsed },
          };
        },
      },
    };

    const customValidatorProcedure = procedure
      .query(parsePage)
      .handle(({ query }) => {
        const _query: { page: number } = query;

        void _query;

        return {
          status: 200 as const,
        };
      });

    expectTypeOf(customValidatorProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          query: {
            page: number;
          };
        },
      ]
    >();
  });

  it("widens middleware context across multiple use calls", () => {
    const contextProcedure = procedure
      .headers(z.object({ "x-request-id": z.string() }))
      .use(({ headers }) => ({
        ctx: {
          requestId: headers["x-request-id"],
        },
      }))
      .use(({ ctx }) => ({
        ctx: {
          traceId: `${ctx.requestId}:trace`,
        },
      }))
      .handle(({ ctx }) => {
        const _ctx: {
          requestId: string;
          traceId: string;
        } = ctx;

        void _ctx;

        return {
          status: 204 as const,
        };
      });

    expectTypeOf(contextProcedure.handler).parameters.toMatchTypeOf<
      [
        {
          ctx: {
            requestId: string;
            traceId: string;
          };
        },
      ]
    >();
  });

  it("supports immutable shared baseProcedure presets", () => {
    const baseProcedure = procedure
      .headers(
        z.object({
          "x-demo-role": z.enum(["reader", "editor"]).optional(),
        }),
      )
      .meta({
        tags: ["shared-base-procedure"],
        auth: "optional" as const,
      })
      .use(({ headers }) => ({
        ctx: {
          viewer: {
            role: headers["x-demo-role"] ?? "reader",
          },
        },
      }));

    const listUsersProcedure = baseProcedure.handle(({ ctx }) => {
      const _ctx: {
        viewer: {
          role: "reader" | "editor";
        };
      } = ctx;

      void _ctx;

      return {
        status: 200 as const,
        body: {
          ok: true as const,
        },
      };
    });

    const getUserProcedure = baseProcedure
      .params(z.object({ userId: z.string() }))
      .query(
        z.object({
          includeDrafts: z.enum(["true", "false"]).optional(),
        }),
      )
      .handle(({ params, query, ctx }) => {
        const _params: { userId: string } = params;
        const _query: { includeDrafts?: "true" | "false" | undefined } = query;
        const _ctx: {
          viewer: {
            role: "reader" | "editor";
          };
        } = ctx;

        void _params;
        void _query;
        void _ctx;

        return {
          status: 200 as const,
          body: {
            ok: true as const,
            userId: params.userId,
          },
        };
      });

    expectTypeOf(listUsersProcedure.definition).toMatchTypeOf<{
      meta?: {
        tags: string[];
        auth: "optional";
      };
      input?: {
        validationSchema?: {
          output: {
            headers: {
              "x-demo-role"?: "reader" | "editor" | undefined;
            };
          };
        };
      };
    }>();

    expectTypeOf(getUserProcedure.definition).toMatchTypeOf<{
      input?: {
        validationSchema?: {
          output: {
            params: { userId: string };
            query: {
              includeDrafts?: "true" | "false" | undefined;
            };
            headers: {
              "x-demo-role"?: "reader" | "editor" | undefined;
            };
          };
        };
      };
    }>();
  });
});

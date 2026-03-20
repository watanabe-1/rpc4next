import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { procedure } from "./procedure";

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
});

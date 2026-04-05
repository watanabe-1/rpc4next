import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { onError } from "../../_shared/on-error";
import { routeContract } from "./route-contract";

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

const getProcedureUser = procedure
  .forRoute(routeContract)
  .meta({
    tags: ["procedure-contract"],
    auth: "optional",
  })
  .params(paramsSchema)
  .query(querySchema)
  .output({
    _output: {
      ok: true as const,
      userId: "" as string,
      includePosts: false as boolean,
      source: "procedure-contract" as const,
      requestId: "" as string,
    },
  })
  .use(async () => ({
    ctx: {
      requestId: "procedure-ctx",
    },
  }))
  .handle(async ({ params, query, ctx }) => ({
    status: 200,
    body: {
      ok: true,
      userId: params.userId,
      includePosts: query.includePosts === "true",
      source: "procedure-contract",
      requestId: ctx.requestId,
    },
  }));

export const GET = nextRoute(getProcedureUser, { method: "GET", onError });

export type Query = z.input<typeof querySchema>;

import { nextRoute, procedure } from "rpc4next/server";
import { z } from "zod";
import { routeContract } from "./route-contract";

export type Query = {
  includePosts?: "true" | "false";
};

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

const paramsSchema = z.object({
  userId: z.string().min(1),
});

const getUser = procedure
  .forRoute(routeContract)
  .params(paramsSchema)
  .query(querySchema)
  .output({
    _output: {
      ok: true as const,
      userId: "" as string,
      includePosts: false as boolean,
    },
  })
  .handle(async ({ params, query }) => ({
    body: {
      ok: true,
      userId: params.userId,
      includePosts: query.includePosts === "true",
    },
  }));

export const GET = nextRoute(getUser, { method: "GET" });

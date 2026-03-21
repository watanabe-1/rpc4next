import { routeHandlerFactory } from "rpc4next/server";
import { zValidator } from "rpc4next/server/validators/zod";
import { z } from "zod";
import type { Params } from "./route-contract";

export type Query = {
  includePosts?: "true" | "false";
};

const createRouteHandler = routeHandlerFactory();

const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const { GET } = createRouteHandler<{
  params: Params;
  query: z.infer<typeof querySchema>;
}>().get(zValidator("query", querySchema), async (rc) => {
  const { userId } = await rc.req.params();
  const query = rc.req.valid("query");

  return rc.json({
    ok: true,
    userId,
    includePosts: query.includePosts === "true",
  });
});

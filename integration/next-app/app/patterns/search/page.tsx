import { procedure } from "rpc4next/server";
import { z } from "zod";

import { routeContract } from "./route-contract";

export type Query = {
  q?: string;
};

const searchQuerySchema = z
  .object({
    q: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .transform(({ q }) => ({
    q: Array.isArray(q) ? q[0] : q,
  }));

const searchPageOutputSchema = z.object({
  q: z.string(),
});

export default procedure
  .forRoute(routeContract)
  .query(searchQuerySchema)
  .output(searchPageOutputSchema)
  .handle(({ query }) => ({
    body: {
      q: query.q ?? "none",
    },
  }))
  .nextPage(({ data }) => <div>search:{data.q}</div>, {
    validateOutput: true,
  });

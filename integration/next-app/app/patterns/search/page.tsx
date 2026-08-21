import { z } from "zod";

import { appPageProcedure } from "../../api/_shared/procedure-defaults";
import { routeContract } from "./route-contract";

const searchQuerySchema = z
  .object({
    q: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .transform(({ q }) => ({
    q: Array.isArray(q) ? q[0] : q,
  }));

export default appPageProcedure
  .forRoute(routeContract)
  .query(searchQuerySchema)
  .nextPage(({ query }) => <div>search:{query.q ?? "none"}</div>);

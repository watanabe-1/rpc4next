import { z } from "zod";

import { appPageProcedure } from "../../_rpc/page-procedure";
import { routeContract } from "./route-contract";

const pageHelperQuerySchema = z.object({
  mode: z.enum(["render", "redirect", "not-found", "error"]).optional(),
});

const pageHelperOutputSchema = z.object({
  mode: z.literal("render"),
});

export default appPageProcedure
  .forRoute(routeContract)
  .query(pageHelperQuerySchema)
  .output(pageHelperOutputSchema)
  .handle(({ page, query }) => {
    if (query.mode === "redirect") {
      return page.redirect("/feed");
    }

    if (query.mode === "not-found") {
      return page.notFound();
    }

    if (query.mode === "error") {
      throw new Error("page helper expected failure");
    }

    return {
      body: {
        mode: query.mode ?? "render",
      },
    };
  })
  .nextPage(({ data }) => <div>page-helper:{data.mode}</div>);

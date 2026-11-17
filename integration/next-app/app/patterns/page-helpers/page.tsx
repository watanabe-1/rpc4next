import { notFound, redirect } from "next/navigation";
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
  .query(pageHelperQuerySchema, {
    onValidationError: ({ searchParams }) => {
      if (searchParams.mode === "validation-redirect") redirect("/feed");
      if (searchParams.mode === "validation-not-found") notFound();
      if (searchParams.mode === "validation-error") throw new Error("page input hook failed");
      if (searchParams.mode === "validation-undefined") return undefined;

      return <div>page-input-validation</div>;
    },
  })
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
  .page(({ data }) => <div>page-helper:{data.mode}</div>, {
    onValidationError: () => <div>page-shared-validation</div>,
  });

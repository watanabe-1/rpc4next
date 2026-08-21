import { z } from "zod";

import { appPageProcedure } from "../../api/_shared/procedure-defaults";
import { ClientPageView } from "./client-view";
import { routeContract } from "./route-contract";

const clientPageQuerySchema = z.object({
  label: z.string().optional(),
});

const clientPageOutputSchema = z.object({
  count: z.number(),
  label: z.string(),
});

export default appPageProcedure
  .forRoute(routeContract)
  .query(clientPageQuerySchema)
  .output(clientPageOutputSchema)
  .handle(({ query }) => ({
    body: {
      count: 1,
      label: query.label ?? "server-data",
    },
  }))
  .nextPage(({ data }) => <ClientPageView initialCount={data.count} label={data.label} />);

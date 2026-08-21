import { z } from "zod";

import { appPageProcedure } from "../../api/_shared/procedure-defaults";
import { routeContract } from "./route-contract";

const photoParamsSchema = z.object({
  id: z.string(),
});

const photoPageOutputSchema = z.object({
  id: z.string(),
});

export default appPageProcedure
  .forRoute(routeContract)
  .params(photoParamsSchema)
  .output(photoPageOutputSchema)
  .handle(({ params }) => ({
    body: {
      id: params.id,
    },
  }))
  .nextPage(({ data }) => <div>photo:{data.id}</div>, {
    validateOutput: true,
  });

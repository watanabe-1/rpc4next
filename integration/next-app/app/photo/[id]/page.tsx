import { procedure } from "rpc4next/server";
import { z } from "zod";

import { routeContract } from "./route-contract";

const photoParamsSchema = z.object({
  id: z.string(),
});

const photoPageOutputSchema = z.object({
  id: z.string(),
});

export default procedure
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

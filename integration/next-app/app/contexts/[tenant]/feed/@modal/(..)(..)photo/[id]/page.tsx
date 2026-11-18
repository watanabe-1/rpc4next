import { procedure } from "rpc4next/server";
import { z } from "zod";

import { routeContract } from "./route-contract";

export default procedure
  .forRoute(routeContract)
  .params(z.object({ tenant: z.string(), id: z.string() }))
  .handle(({ request, params }) => ({ body: { pathname: request.nextUrl.pathname, params } }))
  .page(({ data }) => <div data-testid="intercept-result">{JSON.stringify(data)}</div>);

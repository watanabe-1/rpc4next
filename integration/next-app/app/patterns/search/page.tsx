import { appPageProcedure } from "../../_rpc/page-procedure";
import { routeContract } from "./route-contract";
import { searchQuerySchema } from "./schemas";

export default appPageProcedure
  .forRoute(routeContract)
  .query(searchQuerySchema)
  .page(({ query }) => <div>search:{query.q ?? "none"}</div>);

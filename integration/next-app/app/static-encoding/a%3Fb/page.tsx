import { appPageProcedure } from "../../_rpc/page-procedure";
import { routeContract } from "./route-contract";

export default appPageProcedure
  .forRoute(routeContract)
  .handle(({ request }) => ({
    body: {
      pathname: request.nextUrl.pathname,
      searchParams: [...request.nextUrl.searchParams],
      hash: request.nextUrl.hash,
    },
  }))
  .page(({ data }) => (
    <>
      <div>static-encoding:question</div>
      <pre data-testid="page-request">{JSON.stringify(data)}</pre>
    </>
  ));

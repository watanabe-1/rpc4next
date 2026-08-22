import { appRouteProcedure } from "../_shared/procedure-defaults";
import { routeContract } from "./route-contract";

const csv = ["id,name", "1,Ada"].join("\n");

export const { GET } = appRouteProcedure
  .forRoute(routeContract)
  .handle(async ({ response }) =>
    response.body(csv, {
      headers: {
        "Content-Disposition": `attachment; filename="users.csv"`,
        "Content-Type": "text/csv",
      },
    }),
  )
  .nextRoute({
    method: "GET",
  });

import { createPageProcedure } from "rpc4next/server";

import { pageOnError } from "./errors";

export const appPageProcedure = createPageProcedure({
  onError: pageOnError,
});

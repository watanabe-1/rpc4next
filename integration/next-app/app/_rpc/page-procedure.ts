import { procedure } from "rpc4next/server";

import { pageOnError } from "./errors";

export const appPageProcedure = procedure.defaults({
  page: {
    onError: pageOnError,
  },
});

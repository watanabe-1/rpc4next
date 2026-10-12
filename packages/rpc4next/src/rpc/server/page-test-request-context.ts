import type { NextRequest } from "next/server";
import { AsyncLocalStorage } from "node:async_hooks";

const pageTestRequestStorage = new AsyncLocalStorage<NextRequest>();

export const getRpcPageTestRequest = () => pageTestRequestStorage.getStore();

export const runWithRpcPageTestRequest = <TResult>(request: NextRequest, callback: () => TResult) =>
  pageTestRequestStorage.run(request, callback);

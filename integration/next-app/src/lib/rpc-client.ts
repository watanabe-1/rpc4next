import { createRpcClient } from "rpc4next/client";
import type { PathStructure } from "../generated/rpc";

export const rpcClient = createRpcClient<PathStructure>("http://127.0.0.1:3000");

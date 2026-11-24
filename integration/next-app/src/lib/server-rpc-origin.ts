// The fixture runs on port 3000 by default; other deployments can configure it.
export const serverRpcOrigin = () => process.env.RPC_ORIGIN ?? "http://127.0.0.1:3000";

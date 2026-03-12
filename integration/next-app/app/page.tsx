import { rpcClient } from "@/lib/rpc-client";

export default function HomePage() {
  const userUrl = rpcClient.api.users
    ._userId("demo-user")
    .$url({ query: { includePosts: "true" } });

  return (
    <main>
      <h1>rpc4next integration app</h1>
      <p>This app verifies the rpc4next CLI output against a live Next.js app.</p>
      <code>{userUrl.relativePath}</code>
    </main>
  );
}

import Link from "next/link";

import { rpcClient } from "@/lib/rpc-client";

export default function HomePage() {
  const userUrl = rpcClient.api.users
    ._userId("demo-user")
    .$url({ query: { includePosts: "true" } });
  const procedureExamplesUrl = "/procedure-examples";
  const responseHandlingUrl = "/response-handling";

  return (
    <main>
      <h1>rpc4next integration app</h1>
      <p>This app verifies the rpc4next CLI output against a live Next.js app.</p>
      <code>{userUrl.relativePath}</code>
      <Link href={rpcClient.users._id("demo-user").$url().relativePath}>Open generated user</Link>
      <p>
        The procedure-first walkthrough lives at <code>{procedureExamplesUrl}</code>.
      </p>
      <p>
        The response handling examples live at <code>{responseHandlingUrl}</code>.
      </p>
    </main>
  );
}

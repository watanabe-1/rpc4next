import { headers } from "next/headers";
import { createRpcClient } from "rpc4next/client";

import { appPageProcedure } from "../_rpc/page-procedure";
import { routeContract } from "./route-contract";
import type { PathStructure } from "@/generated/rpc";

export const dynamic = "force-dynamic";

export default appPageProcedure.forRoute(routeContract).page(async () => {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Expected host header for response page.");
  const rpc = createRpcClient<PathStructure>(`${protocol}://${host}`);

  const response = await rpc.api["procedure-contract"]._userId("demo-user").$get({
    url: { query: { includePosts: "true" } },
  });
  const result = await response.json();
  const errorResponse = await rpc.api["procedure-defaults-error"].$get({
    url: { query: { mode: "deny" } },
  });
  const error = await errorResponse.json();
  const textResponse = await rpc.api["procedure-response-text"].$get({
    url: { query: { name: "demo-user" } },
  });
  const text = await textResponse.text();
  const fileResponse = await rpc.api["procedure-file-download"].$get();
  if (!fileResponse.ok) throw new Error(`File request failed: ${fileResponse.status}`);
  const blob = await fileResponse.blob();
  const file = {
    contentDisposition: fileResponse.headers.get("content-disposition"),
    contentType: fileResponse.headers.get("content-type"),
    text: await blob.text(),
  };

  return (
    <main>
      <h1>Typed Response handling examples</h1>
      <p>Use response status and body methods to handle each result.</p>
      <section>
        <h2>JSON response</h2>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </section>
      <section>
        <h2>Expected error response</h2>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </section>
      <section>
        <h2>Text response</h2>
        <pre>{text}</pre>
      </section>
      <section>
        <h2>File download response</h2>
        <pre>{JSON.stringify(file, null, 2)}</pre>
      </section>
    </main>
  );
});

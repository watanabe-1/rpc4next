import { headers } from "next/headers";
import { createRpcClient, RpcResponseError } from "rpc4next/client";

import { appPageProcedure } from "../_rpc/page-procedure";
import { routeContract } from "./route-contract";
import type { PathStructure } from "@/generated/rpc";

export const dynamic = "force-dynamic";

type ExampleResult = {
  title: string;
  route: string;
  code: string;
  result: string;
};

const createServerRpcClient = async () => {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Expected host header for response-unwrap page.");
  }

  return createRpcClient<PathStructure>(`${protocol}://${host}`);
};

const formatPayload = (payload: unknown) => JSON.stringify(payload, null, 2);

export default appPageProcedure.forRoute(routeContract).nextPage(async () => {
  const serverRpcClient = await createServerRpcClient();

  const manualResponse = await serverRpcClient.api["procedure-contract"]._userId("demo-user").$get({
    url: { query: { includePosts: "true" } },
  });
  const manualPayload = await manualResponse.json();

  const expectedErrorResponse = await serverRpcClient.api["procedure-defaults-error"].$get({
    url: { query: { mode: "deny" } },
  });
  const expectedErrorPayload = expectedErrorResponse.ok
    ? await expectedErrorResponse.json()
    : {
        status: expectedErrorResponse.status,
        payload: await expectedErrorResponse.json(),
      };

  const unwrappedPayload = await serverRpcClient.api["procedure-contract"]
    ._userId("demo-user")
    .$get({
      url: { query: { includePosts: "true" } },
    })
    .unwrap();

  const textPayload = await serverRpcClient.api["procedure-response-text"]
    .$get({
      url: { query: { name: "demo-user" } },
    })
    .unwrap();

  const filePayload = await serverRpcClient.api["procedure-file-download"].$get().unwrapFile();

  let errorPayload: unknown;
  try {
    await serverRpcClient.api["procedure-defaults-error"]
      .$get({
        url: { query: { mode: "deny" } },
      })
      .unwrap();
  } catch (error) {
    if (!(error instanceof RpcResponseError)) {
      throw error;
    }

    errorPayload = {
      status: error.status,
      statusText: error.statusText,
      code: error.code,
      payload: error.payload,
    };
  }

  const examples: ExampleResult[] = [
    {
      title: "Typed Response success handling",
      route: "/api/procedure-contract/[userId]",
      code: `const response = await rpc.api["procedure-contract"]
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });

if (!response.ok) {
  const error = await response.json();
  // Branch on expected application errors here.
  return;
}

const body = await response.json();`,
      result: formatPayload(manualPayload),
    },
    {
      title: "Typed Response expected error handling",
      route: "/api/procedure-defaults-error",
      code: `const response = await rpc.api["procedure-defaults-error"]
  .$get({
    url: { query: { mode: "deny" } },
  });

if (!response.ok) {
  const error = await response.json();

  switch (error.error.code) {
    case "BAD_REQUEST":
    case "FORBIDDEN":
    case "INTERNAL_SERVER_ERROR":
      console.log(response.status);
      console.log(error.error.message);
      return;
  }
}`,
      result: formatPayload(expectedErrorPayload),
    },
    {
      title: "Response promise unwrap",
      route: "/api/procedure-contract/[userId]",
      code: `const body = await rpc.api["procedure-contract"]
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } })
  .unwrap();`,
      result: formatPayload(unwrappedPayload),
    },
    {
      title: "Content-Type based text parsing",
      route: "/api/procedure-response-text",
      code: `const body = await rpc.api["procedure-response-text"]
  .$get({
    url: { query: { name: "demo-user" } },
  })
  .unwrap();`,
      result: formatPayload(textPayload),
    },
    {
      title: "File download unwrap",
      route: "/api/procedure-file-download",
      code: `const file = await rpc.api["procedure-file-download"]
  .$get()
  .unwrapFile();

console.log(file.blob);
console.log(file.filename);
console.log(file.contentType);`,
      result: formatPayload({
        filename: filePayload.filename,
        contentType: filePayload.contentType,
        text: await filePayload.blob.text(),
      }),
    },
    {
      title: "Unwrap error fallback",
      route: "/api/procedure-defaults-error",
      code: `try {
  await rpc.api["procedure-defaults-error"]
    .$get({
      url: { query: { mode: "deny" } },
    })
    .unwrap();
} catch (error) {
  if (error instanceof RpcResponseError) {
    console.log(error.status);
    console.log(error.code);
    console.log(error.payload);
  }
}`,
      result: formatPayload(errorPayload),
    },
  ];

  return (
    <main>
      <h1>Response unwrap examples</h1>
      <p>
        This page compares typed Response handling for expected application errors with{" "}
        <code>unwrap()</code> for code that only needs the parsed success payload.
      </p>
      {examples.map((example) => (
        <section key={example.title}>
          <h2>{example.title}</h2>
          <p>
            Route: <code>{example.route}</code>
          </p>
          <h3>Code</h3>
          <pre>{example.code}</pre>
          <h3>Runtime result</h3>
          <pre>{example.result}</pre>
        </section>
      ))}
    </main>
  );
});

import { rpcClient } from "@/lib/rpc-client";

const examples = [
  {
    phase: "Phase 1",
    title: "metadata + error envelope",
    route: "/api/procedure-guarded/[userId]",
    notes: [
      "meta() annotates the route with summary, tags, auth, and idempotency.",
      'error("FORBIDDEN") + rpcError(...) exposes a typed error envelope to the client.',
    ],
    snippet: `await rpcClient.api["procedure-guarded"]._userId("demo-user").$get({
  url: { query: { includeDrafts: "true" } },
  requestHeaders: { headers: { "x-demo-role": "editor" } },
});`,
  },
  {
    phase: "Phase 2",
    title: "output contracts",
    route: "/api/contract-route",
    notes: [
      "routeHandlerFactory() can still publish explicit output() contracts.",
      "generated client response types pick up the declared output shape.",
    ],
    snippet: `const response = await rpcClient.api["contract-route"].$get();`,
  },
  {
    phase: "Phase 3",
    title: "procedure + nextRoute",
    route: "/api/procedure-contract/[userId]",
    notes: [
      "procedure() collects params/query/input contracts and middleware in one place.",
      'nextRoute(procedure, { method: "GET" }) adapts it to a real App Router file.',
    ],
    snippet: `const response = await rpcClient.api["procedure-contract"]
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });`,
  },
  {
    phase: "Phase 4",
    title: "shared internals with routeHandlerFactory()",
    route: "/api/users/[userId]",
    notes: [
      "Existing routeHandlerFactory() fixtures still work beside the new procedure API.",
      "The integration package keeps both styles visible while runtime internals stay shared.",
    ],
    snippet: `const response = await rpcClient.api.users
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });`,
  },
  {
    phase: "Phase 5",
    title: "shared baseProcedure presets",
    route: "/api/procedure-guarded/[userId]",
    notes: [
      "A shared baseProcedure centralizes headers validation, metadata, and auth/context setup.",
      "The route file stays the source of truth and only adds params(), query(), output(), error(), and handle().",
    ],
    snippet: `const response = await rpcClient.api["procedure-guarded"]
  ._userId("demo-user")
  .$get({
    url: { query: { includeDrafts: "true" } },
    requestHeaders: { headers: { "x-demo-role": "editor" } },
  });`,
  },
];

export default function ProcedureExamplesPage() {
  const guardedPublicUrl = rpcClient.api["procedure-guarded"]
    ._userId("demo-user")
    .$url();
  const guardedDraftUrl = rpcClient.api["procedure-guarded"]
    ._userId("demo-user")
    .$url({
      query: { includeDrafts: "true" },
    });
  const contractUrl = rpcClient.api["procedure-contract"]
    ._userId("demo-user")
    .$url({
      query: { includePosts: "true" },
    });

  return (
    <main>
      <h1>Procedure examples</h1>
      <p>
        This page groups the integration fixtures that correspond to
        `procedure-design.md` phases 1 through 5.
      </p>
      <ul>
        <li>
          guarded success URL: <code>{guardedPublicUrl.relativePath}</code>
        </li>
        <li>
          guarded draft URL: <code>{guardedDraftUrl.relativePath}</code>
        </li>
        <li>
          contract URL: <code>{contractUrl.relativePath}</code>
        </li>
      </ul>
      {examples.map((example) => (
        <section key={example.phase}>
          <h2>
            {example.phase}: {example.title}
          </h2>
          <p>
            Route: <code>{example.route}</code>
          </p>
          <ul>
            {example.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <pre>{example.snippet}</pre>
        </section>
      ))}
    </main>
  );
}

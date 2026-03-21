import { rpcClient } from "@/lib/rpc-client";

const examples = [
  {
    phase: "Recommended start",
    title: "route-bound procedure + nextRoute",
    route: "/api/procedure-contract/[userId]",
    notes: [
      "Bind the generated routeContract first, then declare params/query/output on one builder.",
      "nextRoute(procedure, { method: 'GET' }) keeps the App Router file export explicit while preserving typed input and output contracts.",
    ],
    snippet: `await rpcClient.api["procedure-contract"]
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });`,
  },
  {
    phase: "Shared policy",
    title: "baseProcedure + typed error contracts",
    route: "/api/procedure-guarded/[userId]",
    notes: [
      "A shared baseProcedure centralizes headers validation, metadata, auth/context setup, and shared error envelopes.",
      'Route-local .error("FORBIDDEN") variants still compose on top of shared UNAUTHORIZED / FORBIDDEN contracts.',
    ],
    snippet: `await rpcClient.api["procedure-guarded"]
  ._userId("demo-user")
  .$get({
    url: { query: { includeDrafts: "true" } },
    requestHeaders: {
      headers: { "x-demo-user": "demo-user", "x-demo-role": "editor" },
    },
  });`,
  },
  {
    phase: "Extended input",
    title: "json, headers, cookies, and formData",
    route: "/api/procedure-submit + /api/procedure-form-data",
    notes: [
      "procedure handles json/header/cookie contracts directly without validator wrappers.",
      "formData contracts follow the same builder model for uploads and browser-native form posts.",
    ],
    snippet: `await rpcClient.api["procedure-submit"].$post({
  body: { json: { title: "hello" } },
  requestHeaders: {
    headers: { "x-procedure-test": "demo" },
    cookies: { session: "abc123" },
  },
});`,
  },
  {
    phase: "Customization",
    title: "output validation + formatter + validation branching",
    route:
      "/api/procedure-invalid-output + /api/procedure-kit-error + /api/procedure-validation-branch + /api/procedure-response-text + /api/procedure-response-redirect",
    notes: [
      "The recommended path covers runtime output validation, project-level error formatting, validator-stage failure branching, and narrow response helpers inside procedure.handle(...).",
      "response.json(...), response.text(...), and response.redirect(...) keep the procedure-first model while improving authoring ergonomics.",
    ],
    snippet: `const response = await rpcClient.api["procedure-invalid-output"].$get();
// response.status === 500
// response.error.code === "INTERNAL_SERVER_ERROR"`,
  },
  {
    phase: "Compatibility path",
    title: "routeHandlerFactory() remains supported",
    route: "/api/users/[userId] + /api/posts + /api/request-meta",
    notes: [
      "The integration fixture still keeps middleware-first routes for compatibility coverage and migration reference.",
      "Use this path when preserving existing routeHandlerFactory() / zValidator(...) code is more practical than rewriting the route.",
    ],
    snippet: `await rpcClient.api.users
  ._userId("demo-user")
  .$get({ url: { query: { includePosts: "true" } } });`,
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
  const invalidOutputUrl = rpcClient.api["procedure-invalid-output"].$url();

  return (
    <main>
      <h1>Procedure examples</h1>
      <p>
        This page groups the integration fixtures around the recommended
        `procedure` / `nextRoute()` authoring path and its supported
        compatibility surface.
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
        <li>
          invalid output URL: <code>{invalidOutputUrl.relativePath}</code>
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

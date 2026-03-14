import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PatternStatus = "covered" | "fixture-only" | "missing";

type PatternReport = {
  docsUrl: string;
  fixturePath: string;
  id: string;
  note: string;
  status: PatternStatus;
};

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedRpcPath = path.join(workspaceRoot, "src/generated/rpc.ts");
const generatedRpc = fs.readFileSync(generatedRpcPath, "utf8");

const patternReports: PatternReport[] = [
  {
    id: "dynamic-segments",
    fixturePath: "app/patterns/dynamic/[slug]/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes",
    note: "Single dynamic segment fixture is present and asserted in TypeScript.",
    status: "covered",
  },
  {
    id: "catch-all-segments",
    fixturePath: "app/patterns/catch-all/[...parts]/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes",
    note: "Catch-all fixture is present and asserted in TypeScript.",
    status: "covered",
  },
  {
    id: "optional-catch-all-segments",
    fixturePath: "app/patterns/optional-catch-all/[[...parts]]/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes",
    note: "Optional catch-all fixture is present and asserted in TypeScript.",
    status: "covered",
  },
  {
    id: "route-groups",
    fixturePath: "app/patterns/(grouped)/reports/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/route-groups",
    note: "Route group fixture is present and asserted in TypeScript.",
    status: "covered",
  },
  {
    id: "parallel-routes",
    fixturePath: "app/patterns/parallel/@analytics/views/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/14/app/building-your-application/routing/parallel-routes",
    note: "Parallel route slot fixtures are present and asserted in TypeScript.",
    status: "covered",
  },
  {
    id: "private-folders",
    fixturePath: "app/patterns/_private/ignored/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/colocation",
    note: generatedRpc.includes('"_private"')
      ? "Generator still exposes `_private` in PathStructure."
      : "Private folder is excluded from PathStructure.",
    status: generatedRpc.includes('"_private"') ? "missing" : "covered",
  },
  {
    id: "escaped-underscore-segments",
    fixturePath: "app/patterns/%5Fescaped/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/colocation",
    note: generatedRpc.includes('"%5Fescaped"')
      ? "Escaped underscore segment preserves its encoded DSL key while routing to `/_escaped`."
      : "Generator does not preserve the encoded folder name for the escaped underscore segment.",
    status: generatedRpc.includes('"%5Fescaped"') ? "covered" : "missing",
  },
  {
    id: "intercepting-routes",
    fixturePath: "app/feed/@modal/(..)photo/[id]/page.tsx",
    docsUrl:
      "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes",
    note: "Fixture is present, but there is no dedicated assertion yet because rpc4next currently models URL paths rather than intercepted UI branches.",
    status: "fixture-only",
  },
];

const fixtureErrors = patternReports
  .filter((patternReport) => {
    const absoluteFixturePath = path.join(workspaceRoot, patternReport.fixturePath);

    return !fs.existsSync(absoluteFixturePath);
  })
  .map(
    (patternReport) =>
      `- ${patternReport.id}: missing fixture ${patternReport.fixturePath}`,
  );

const missingReports = patternReports.filter(
  (patternReport) => patternReport.status === "missing",
);
const fixtureOnlyReports = patternReports.filter(
  (patternReport) => patternReport.status === "fixture-only",
);

if (fixtureErrors.length > 0) {
  console.error("Folder pattern fixtures are incomplete:");
  console.error(fixtureErrors.join("\n"));
  process.exit(1);
}

if (missingReports.length > 0 || fixtureOnlyReports.length > 0) {
  console.error("Folder pattern coverage gaps detected:");

  for (const patternReport of [...missingReports, ...fixtureOnlyReports]) {
    console.error(
      `- ${patternReport.id}: ${patternReport.note} (${patternReport.fixturePath})`,
    );
    console.error(`  docs: ${patternReport.docsUrl}`);
  }

  process.exit(1);
}

console.log("All tracked Next.js app folder patterns are covered.");

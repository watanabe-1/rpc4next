import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedRpcPath = path.join(workspaceRoot, "src/generated/rpc.ts");
const generatedRpc = fs.readFileSync(generatedRpcPath, "utf8");

const fixturePaths = [
  "app/patterns/dynamic/[category]/page.tsx",
  "app/patterns/catch-all/[...parts]/page.tsx",
  "app/patterns/optional-catch-all/[[...parts]]/page.tsx",
  "app/patterns/(grouped)/reports/page.tsx",
  "app/patterns/parallel/@analytics/views/page.tsx",
  "app/patterns/parallel/@team/members/page.tsx",
  "app/patterns/_private/ignored/page.tsx",
  "app/patterns/%5Fescaped/page.tsx",
  "app/patterns/%E3%81%ZZ/page.tsx",
  "app/feed/@modal/(..)photo/[id]/page.tsx",
  "app/feed/@drilldown/(..)photo/[id]/comments/[commentId]/page.tsx",
];

describe("integration next-app folder pattern coverage", () => {
  for (const fixturePath of fixturePaths) {
    it(`keeps fixture ${fixturePath}`, () => {
      expect(fs.existsSync(path.join(workspaceRoot, fixturePath))).toBe(true);
    });
  }

  it("excludes Next.js private folders from PathStructure", () => {
    expect(generatedRpc.includes('"_private"')).toBe(false);
  });

  it("preserves escaped underscore folder keys in PathStructure", () => {
    expect(generatedRpc.includes('"%5Fescaped"')).toBe(true);
  });

  it("preserves malformed encoded folder keys in PathStructure", () => {
    expect(generatedRpc.includes('"%E3%81%ZZ"')).toBe(true);
  });

  it("excludes intercepting route variants from PathStructure", () => {
    expect(generatedRpc.includes('"@drilldown"')).toBe(false);
    expect(generatedRpc.includes('"@modal"')).toBe(false);
    expect(generatedRpc.includes('"(..)photo"')).toBe(false);
  });

  it("excludes parallel route slot names from PathStructure", () => {
    expect(generatedRpc.includes('"@analytics"')).toBe(false);
    expect(generatedRpc.includes('"@team"')).toBe(false);
    expect(generatedRpc.includes('"views"')).toBe(false);
    expect(generatedRpc.includes('"members"')).toBe(false);
  });
});

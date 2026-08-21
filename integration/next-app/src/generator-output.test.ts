import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ROUTE_CONTRACT_GENERATED_MARKER } from "../../../packages/rpc4next-cli/src/cli/core/generate-path-structure.js";
import { generate } from "../../../packages/rpc4next-cli/src/cli/generator.js";

const logger = {
  info: () => {},
  success: () => {},
  error: () => {},
};

let tmpDir: string | undefined;

const makeTempDir = () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-integration-"));

  return tmpDir;
};

const cleanupTempDir = () => {
  if (!tmpDir) {
    return;
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
};

describe("integration next-app generator output", () => {
  afterEach(() => {
    cleanupTempDir();
  });

  it("generates route contract files and removes stale generated contracts", () => {
    const rootDir = makeTempDir();
    const baseDir = path.join(rootDir, "app");
    const outputPath = path.join(rootDir, "src", "generated", "rpc.ts");
    const routeDir = path.join(baseDir, "cleanup-probe", "[id]");
    const routePath = path.join(routeDir, "route.ts");
    const contractPath = path.join(routeDir, "route-contract.ts");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(
      routePath,
      "export function GET() { return Response.json({ ok: true }); }\n",
      "utf8",
    );

    generate({
      baseDir,
      outputPath,
      paramsFileName: "route-contract.ts",
      logger,
    });

    expect(fs.existsSync(contractPath)).toBe(true);
    expect(fs.readFileSync(contractPath, "utf8")).toContain(ROUTE_CONTRACT_GENERATED_MARKER);
    expect(fs.readFileSync(contractPath, "utf8")).toContain(
      'ProcedureRouteContract<"/cleanup-probe/[id]", Params>',
    );

    fs.rmSync(routePath);

    generate({
      baseDir,
      outputPath,
      paramsFileName: "route-contract.ts",
      logger,
    });

    expect(fs.existsSync(contractPath)).toBe(false);
    expect(fs.readFileSync(outputPath, "utf8")).not.toContain("cleanup-probe");
  });
});

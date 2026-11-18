import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanupTempDir,
  makeTempDir,
  writeTree,
} from "../packages/rpc4next-cli/src/test-helpers/tmp-dir";

// Node.js tests cover CLI behavior in detail. These tests exercise representative
// CLI workflows and runtime-specific filesystem and process behavior on Bun.
// Add regression cases here when a Bun-specific compatibility issue is found.
const cli = fileURLToPath(new URL("../packages/rpc4next-cli/dist/index.js", import.meta.url));
let tempDir: string | undefined;
afterEach(() => cleanupTempDir(tempDir));

test("built CLI runs under Bun and generates, checks, and protects files", () => {
  expect(process.versions.bun).toBeTruthy();
  const dir = makeTempDir();
  tempDir = dir;
  const run = (...args: string[]) => {
    return spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: "utf8" });
  };
  const runSuccessfully = (...args: string[]) => {
    const result = run(...args);
    expect(`${result.status}\n${result.stdout}\n${result.stderr}`).toStartWith("0\n");
  };
  runSuccessfully("init", "--dry-run");
  expect(fs.readdirSync(dir)).toEqual([]);
  runSuccessfully("init");
  expect(fs.existsSync(path.join(dir, "rpc4next.config.json"))).toBe(true);
  expect(fs.existsSync(path.join(dir, "src/lib/rpc-client.ts"))).toBe(true);
  writeTree(dir, {
    app: {
      api: {
        users: {
          "[id]": {
            "route.ts":
              "export async function GET() { return Response.json({ ok: true }); }\n" +
              "export async function POST() { return Response.json({ ok: true }); }\n",
          },
        },
      },
    },
  });
  runSuccessfully();
  const generatedPath = path.join(dir, "src/generated/rpc.ts");
  const generated = fs.readFileSync(generatedPath, "utf8");
  expect(generated).toMatch(
    /export type PathStructure = RpcGeneratedPathStructure<\{\s*"api": \{\s*"users": \{\s*"_id": \{ "\$get": typeof GET_\w+ \} & \{ "\$post": typeof POST_\w+ \} & RpcEndpoint & Record<ParamsKey, \{ "id": string \}>/,
  );
  const contractPath = path.join(dir, "app/api/users/[id]/route-contract.ts");
  const contract = fs.readFileSync(contractPath, "utf8");
  expect(contract).toContain('export type Params = { "id": string };');
  expect(contract).toContain('ProcedureRouteContract<"/api/users/[id]", Params>');
  runSuccessfully("--check");
  fs.appendFileSync(path.join(dir, "app/api/users/[id]/route.ts"), "export function DELETE() {}\n");
  const stale = run("--check");
  expect(stale.status).toBe(1);
  expect(fs.readFileSync(generatedPath, "utf8")).toBe(generated);
  expect(fs.readFileSync(contractPath, "utf8")).toBe(contract);
  const clientPath = path.join(dir, "src/lib/rpc-client.ts");
  fs.writeFileSync(clientPath, "existing content\n");
  runSuccessfully("init");
  expect(fs.readFileSync(clientPath, "utf8")).toBe("existing content\n");
  runSuccessfully("init", "--force");
  expect(fs.readFileSync(clientPath, "utf8")).toContain("createRpcClient");
  fs.writeFileSync(path.join(dir, "rpc4next.config.json"), "{ invalid json");
  expect(run().status).toBe(1);
});

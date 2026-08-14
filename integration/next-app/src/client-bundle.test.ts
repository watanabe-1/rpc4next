import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const clientStaticDir = path.join(workspaceRoot, ".next", "static");
const routeSourceLeakSentinel = "rpc4next-client-bundle-route-source-leak-sentinel";
const shouldRunClientBundleTest = process.env.RPC4NEXT_RUN_CLIENT_BUNDLE_TEST === "1";

const collectJavaScriptFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectJavaScriptFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );

  return files.flat();
};

describe.skipIf(!shouldRunClientBundleTest)("client production bundle", () => {
  it("does not include route module source imported through generated type imports", async () => {
    await execFileAsync("bun", ["run", "build"], {
      cwd: workspaceRoot,
      env: process.env,
      maxBuffer: 1024 * 1024 * 20,
    });

    const clientFiles = await collectJavaScriptFiles(clientStaticDir);
    expect(clientFiles.length).toBeGreaterThan(0);

    const leakedFiles: string[] = [];

    await Promise.all(
      clientFiles.map(async (file) => {
        const source = await fs.readFile(file, "utf8");

        if (source.includes(routeSourceLeakSentinel)) {
          leakedFiles.push(path.relative(workspaceRoot, file));
        }
      }),
    );

    expect(leakedFiles).toStrictEqual([]);
  }, 180_000);
});

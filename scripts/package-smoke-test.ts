import type { BuildOptions } from "esbuild";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { replaceWorkspaceDepsFromManifest } from "./replace-workspace-deps.js";

type PackedPackage = {
  filename: string;
  name: string;
};

const repoRoot = process.cwd();
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/^(NODE_PATH|NODE_OPTIONS|npm_config_.*|npm_execpath|npm_node_execpath)$/i.test(key),
  ),
);

const run = (command: string, args: string[], cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let stopped = "";
    const stop = (reason: string) => {
      stopped = reason;
      if (!child.pid) return;
      if (process.platform === "win32") {
        // Kill npm lifecycle scripts and esbuild's native child as well.
        spawnSync(
          path.join(process.env.SystemRoot ?? "C:\\Windows", "System32/taskkill.exe"),
          ["/pid", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        );
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
        }
      }
    };
    const interrupt = () => stop("interrupted");
    const timer = setTimeout(() => stop("timed out after 180s"), 180_000);
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    child.stdout.setEncoding("utf8").on("data", (data: string) => {
      stdout += data;
    });
    child.stderr.setEncoding("utf8").on("data", (data: string) => {
      stderr += data;
    });
    let spawnError: Error | undefined;
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      if (code === 0 && !stopped && !spawnError) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `Command failed in ${cwd}: ${JSON.stringify([command, ...args])}\n${stopped || signal || code}\n${stdout}\n${stderr}`,
            { cause: spawnError },
          ),
        );
      }
    });
  });

// Resolve a tool-manager's Node shim once, then use the real executable for npm
// and CLI execution. Never execute npm.cmd or npm.exe (which may itself be a shim).
const nodeCommand = (
  await run(process.env.RPC4NEXT_SMOKE_NODE ?? "node", ["-p", "process.execPath"], repoRoot)
).trim();
const nodeDir = path.dirname(nodeCommand);
const npmCliCandidates = [
  process.env.RPC4NEXT_SMOKE_NPM_CLI,
  path.join(nodeDir, "node_modules/npm/bin/npm-cli.js"),
  path.resolve(nodeDir, "../lib/node_modules/npm/bin/npm-cli.js"),
  ...(process.env.PATH ?? "").split(path.delimiter).map((dir) => {
    const candidate = path.join(dir, "npm");

    return fs.existsSync(candidate) ? fs.realpathSync(candidate) : "";
  }),
];
const npmCli = npmCliCandidates.find(
  (candidate) => candidate && path.basename(candidate) === "npm-cli.js" && fs.existsSync(candidate),
);
if (!npmCli)
  throw new Error("Cannot locate npm-cli.js; set RPC4NEXT_SMOKE_NPM_CLI to its absolute path");
// Lifecycle scripts must also find the real Node before tool-manager shims.
childEnv.PATH = [nodeDir, childEnv.PATH].filter(Boolean).join(path.delimiter);
const npm = (args: string[], cwd: string) =>
  run(nodeCommand, ["--no-global-search-paths", npmCli, ...args], cwd);

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8"));

const assertExists = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
};

const packPackage = async (packageDir: string, destination: string): Promise<PackedPackage> => {
  const output = await npm(["pack", "--json", "--pack-destination", destination], packageDir);
  const [packed] = JSON.parse(output) as PackedPackage[];

  if (!packed) {
    throw new Error(`npm pack did not report a package for ${packageDir}`);
  }

  assertExists(path.join(destination, packed.filename));

  return packed;
};

const extractPackage = async (tarballPath: string, destination: string) => {
  fs.mkdirSync(destination, { recursive: true });
  await run("tar", ["-xzf", tarballPath, "-C", destination], repoRoot);

  return path.join(destination, "package");
};

const writeJson = (file: string, value: unknown) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const installFixture = async (cwd: string, packs: PackedPackage[], packDir: string) => {
  fs.mkdirSync(cwd, { recursive: true });
  const dependencies = Object.fromEntries(
    packs.map((pack) => [
      pack.name,
      `file:${path.join(packDir, pack.filename).replaceAll("\\", "/")}`,
    ]),
  );
  writeJson(path.join(cwd, "package.json"), {
    private: true,
    type: "module",
    dependencies,
    // Even nested workspace dependencies must use this build, never the registry.
    overrides: Object.fromEntries(packs.map((pack) => [pack.name, `$${pack.name}`])),
  });
  await npm(
    ["install", "--include=optional", "--include=peer", "--no-audit", "--no-fund", "--no-progress"],
    cwd,
  );
  const lock = readJson<{
    packages: Record<string, { resolved?: string; integrity?: string; link?: boolean }>;
  }>(path.join(cwd, "package-lock.json"));
  for (const pack of packs) {
    if (!lock.packages[`node_modules/${pack.name}`]) {
      throw new Error(`Missing lockfile entry for ${pack.name}`);
    }
    const expectedIntegrity = `sha512-${createHash("sha512")
      .update(fs.readFileSync(path.join(packDir, pack.filename)))
      .digest("base64")}`;
    for (const [location, entry] of Object.entries(lock.packages)) {
      if (!location.endsWith(`node_modules/${pack.name}`)) continue;
      if (entry.link || entry.integrity !== expectedIntegrity) {
        throw new Error(
          `${location} did not resolve to the local tarball: ${JSON.stringify(entry)}`,
        );
      }
    }
    assertExists(path.join(cwd, "node_modules", pack.name, "dist"));
  }
};

const runEsbuild = (cwd: string, options: BuildOptions) =>
  run(
    nodeCommand,
    [
      "--no-global-search-paths",
      "--input-type=module",
      "--eval",
      [
        "const { build, stop } = await import(process.argv[1]);",
        "try { await build(JSON.parse(process.argv[2])); } finally { stop(); }",
      ].join("\n"),
      import.meta.resolve("esbuild"),
      JSON.stringify({ ...options, absWorkingDir: cwd }),
    ],
    cwd,
  );

const runBundlerSmoke = async (cwd: string) => {
  const entryPath = path.join(cwd, "bundle-entry.ts");
  const outputPath = path.join(cwd, "bundle-output.js");

  fs.writeFileSync(
    entryPath,
    [
      'import { createRpcClient } from "rpc4next/client";',
      'import { createRpcHelper } from "rpc4next/client/helper";',
      'import { createRpcTestClient } from "rpc4next/client/test";',
      'import { procedure } from "rpc4next/server";',
      'import { HTTP_METHODS } from "rpc4next-shared";',
      "",
      'if (typeof createRpcClient !== "function") throw new Error("missing client export");',
      'if (typeof createRpcHelper !== "function") throw new Error("missing client helper export");',
      'if (typeof createRpcTestClient !== "function") throw new Error("missing client test export");',
      'if (typeof procedure !== "object") throw new Error("missing procedure export");',
      'if (!Array.isArray(HTTP_METHODS)) throw new Error("missing shared export");',
      "",
    ].join("\n"),
    "utf8",
  );

  await runEsbuild(cwd, {
    entryPoints: [entryPath],
    bundle: true,
    external: ["next/headers", "next/navigation", "next/server", "node:async_hooks"],
    format: "esm",
    outfile: outputPath,
    platform: "browser",
  });

  assertExists(outputPath);

  // Runtime packages target Next's bundler (their internal imports are
  // extensionless). Execute a consumer bundle to exercise the public APIs.
  const runtimeEntry = path.join(cwd, "client-api-smoke.ts");
  const runtimeOutput = path.join(cwd, "client-api-smoke.mjs");
  fs.writeFileSync(
    runtimeEntry,
    [
      'import assert from "node:assert/strict";',
      'import { createRpcClient } from "rpc4next/client";',
      'import { createRpcHelper } from "rpc4next/client/helper";',
      'import { HTTP_METHODS } from "rpc4next-shared";',
      'assert.equal(createRpcClient("").api.hello.$url().relativePath, "/api/hello");',
      'assert.equal(createRpcHelper().photo._id.$match("/photo/42").params.id, "42");',
      'assert.ok(HTTP_METHODS.includes("GET"));',
    ].join("\n"),
  );
  await runEsbuild(cwd, {
    entryPoints: [runtimeEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: runtimeOutput,
  });
  await run(nodeCommand, ["--no-global-search-paths", runtimeOutput], cwd);
};

const runCliSmoke = async (cwd: string, cliPackageDir: string) => {
  const appDir = path.join(cwd, "app", "api", "hello");
  const outputDir = path.join(cwd, "src", "generated");
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(appDir, "route.ts"),
    ["export async function GET() {", "  return Response.json({ ok: true });", "}", ""].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(cwd, "rpc4next.config.json"),
    `${JSON.stringify(
      {
        baseDir: "app",
        outputPath: "src/generated/rpc.ts",
        paramsFile: "route-contract.ts",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const packageJson = readJson<{ bin: { rpc4next: string } }>(
    path.join(cliPackageDir, "package.json"),
  );
  await run(
    nodeCommand,
    ["--no-global-search-paths", path.join(cliPackageDir, packageJson.bin.rpc4next)],
    cwd,
  );

  const generatedPath = path.join(outputDir, "rpc.ts");
  const generatedTestManifestPath = path.join(outputDir, "rpc-test-manifest.ts");
  const routeContractPath = path.join(appDir, "route-contract.ts");
  const generated = fs.readFileSync(generatedPath, "utf8");
  const generatedTestManifest = fs.readFileSync(generatedTestManifestPath, "utf8");
  const routeContract = fs.readFileSync(routeContractPath, "utf8");

  if (!generated.includes('"$get"') || !generated.includes("export type PathStructure")) {
    throw new Error("Generated PathStructure did not include the GET route");
  }
  if (!routeContract.includes("Generated by rpc4next-cli")) {
    throw new Error("CLI did not generate the route contract marker");
  }
  if (!generatedTestManifest.includes("testRoutes") || !generatedTestManifest.includes("GET")) {
    throw new Error("CLI did not generate the test manifest");
  }
};

const main = async () => {
  // Spaces exercise argument handling on Windows as well as POSIX systems.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next package smoke-"));

  try {
    // Keep npm's cache and config out of the checkout and the user's home.
    childEnv.npm_config_cache = path.join(tmpDir, "npm cache");
    childEnv.npm_config_userconfig = path.join(tmpDir, "user.npmrc");
    childEnv.npm_config_globalconfig = path.join(tmpDir, "global.npmrc");
    fs.writeFileSync(childEnv.npm_config_userconfig, "");
    fs.writeFileSync(childEnv.npm_config_globalconfig, "");
    const relative = path.relative(fs.realpathSync(repoRoot), fs.realpathSync(tmpDir));
    if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
      throw new Error("The smoke project must be outside the repository (check TMPDIR/TEMP)");
    }
    for (let dir = path.dirname(tmpDir); ; dir = path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, "node_modules"))) {
        throw new Error(`The smoke project must not inherit node_modules from ${dir}`);
      }
      if (dir === path.dirname(dir)) break;
    }
    const packDir = path.join(tmpDir, "packs");
    const extractDir = path.join(tmpDir, "extract");
    const fixtureDir = path.join(tmpDir, "fixture");
    fs.mkdirSync(packDir, { recursive: true });
    const stageDir = path.join(tmpDir, "release");
    const manifestFile = ".github/release-please/.release-please-manifest.json";
    const manifest = readJson<Record<string, string>>(path.join(repoRoot, manifestFile));
    fs.mkdirSync(path.dirname(path.join(stageDir, manifestFile)), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, manifestFile), path.join(stageDir, manifestFile));
    for (const packageDir of Object.keys(manifest)) {
      const source = path.join(repoRoot, packageDir);
      const destination = path.join(stageDir, packageDir);
      fs.cpSync(source, destination, {
        recursive: true,
        filter: (file) => path.basename(file) !== "node_modules",
      });
    }
    // npm pack does not rewrite workspace: URLs. Match publish.yml without
    // modifying the checkout, including when CI has already replaced them.
    replaceWorkspaceDepsFromManifest({ repoRoot: stageDir, manifestFile });
    const packedPackages: PackedPackage[] = [];
    for (const dir of Object.keys(manifest)) {
      packedPackages.push(await packPackage(path.join(stageDir, dir), packDir));
    }
    const extracted = new Map<string, string>();

    for (const packedPackage of packedPackages) {
      const extractedPackageDir = await extractPackage(
        path.join(packDir, packedPackage.filename),
        path.join(extractDir, packedPackage.name),
      );
      const packageJson = readJson<{
        bin?: Record<string, string>;
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      }>(path.join(extractedPackageDir, "package.json"));

      assertExists(path.join(extractedPackageDir, "dist"));
      if (packedPackage.name === "rpc4next-cli") {
        if (!packageJson.bin?.rpc4next) throw new Error("CLI tarball is missing its rpc4next bin");
        assertExists(path.join(extractedPackageDir, packageJson.bin.rpc4next));
      }

      for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
        for (const spec of Object.values(packageJson[field] ?? {})) {
          if (/^(workspace:|file:|link:)/.test(spec)) {
            throw new Error(`Unpublishable ${field} in ${packedPackage.name}: ${spec}`);
          }
        }
      }
      extracted.set(packedPackage.name, extractedPackageDir);
    }

    console.log("[package-smoke-test] installing release tarballs");
    await installFixture(fixtureDir, packedPackages, packDir);
    await runBundlerSmoke(fixtureDir);
    await runCliSmoke(fixtureDir, path.join(fixtureDir, "node_modules/rpc4next-cli"));

    // Regression for #724: remove the declaration, not the installed files.
    // A fresh npm install must succeed, then Node must reject the undeclared import.
    const cliSource = extracted.get("rpc4next-cli");
    if (!cliSource) throw new Error("Missing CLI tarball");
    const cliManifest = path.join(cliSource, "package.json");
    const cliPackage = readJson<{ dependencies: Record<string, string> }>(cliManifest);
    if (!cliPackage.dependencies["oxc-parser"]) throw new Error("CLI must declare oxc-parser");
    delete cliPackage.dependencies["oxc-parser"];
    writeJson(cliManifest, cliPackage);
    const negativePackDir = path.join(tmpDir, "negative packs");
    fs.mkdirSync(negativePackDir);
    const brokenCli = await packPackage(cliSource, negativePackDir);
    const negativePacks = packedPackages.map((pack) =>
      pack.name === brokenCli.name ? brokenCli : pack,
    );
    for (const pack of packedPackages) {
      if (pack.name !== brokenCli.name) {
        fs.copyFileSync(
          path.join(packDir, pack.filename),
          path.join(negativePackDir, pack.filename),
        );
      }
    }
    const negativeFixture = path.join(tmpDir, "negative fixture");
    await installFixture(negativeFixture, negativePacks, negativePackDir);
    let rejected = false;
    try {
      await runCliSmoke(negativeFixture, path.join(negativeFixture, "node_modules/rpc4next-cli"));
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/ERR_MODULE_NOT_FOUND[\s\S]*oxc-parser/.test(error.message)
      ) {
        throw error;
      }
      rejected = true;
    }
    if (!rejected) throw new Error("CLI unexpectedly worked without its oxc-parser dependency");

    console.log(
      "[package-smoke-test] bundling, CLI generation and missing-dependency control passed",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
};

await main();

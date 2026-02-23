import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { replaceWorkspaceDepsFromManifest } from "./replace-workspace-deps.js";

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8"));

const writeJson = (file: string, obj: unknown) =>
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");

const mkdirp = (p: string) => fs.mkdirSync(p, { recursive: true });

describe("replaceWorkspaceDepsFromManifest", () => {
  let tmpDir: string | null = null;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  });

  it("replaces workspace:* / workspace:^ / workspace:~ using dependency package version from manifest", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    // Fake monorepo structure
    const pShared = path.join(tmpDir, "packages/rpc4next-shared");
    const pCore = path.join(tmpDir, "packages/rpc4next");
    mkdirp(pShared);
    mkdirp(pCore);

    // manifest: path -> version
    writeJson(path.join(tmpDir, ".release-please-manifest.json"), {
      "packages/rpc4next": "2.0.0",
      "packages/rpc4next-shared": "1.7.3",
    });

    // package.jsons
    writeJson(path.join(pShared, "package.json"), {
      name: "rpc4next-shared",
      version: "0.0.0-ignored",
    });

    writeJson(path.join(pCore, "package.json"), {
      name: "rpc4next",
      version: "0.0.0-ignored",
      dependencies: {
        "rpc4next-shared": "workspace:*",
      },
      peerDependencies: {
        "rpc4next-shared": "workspace:^",
      },
      optionalDependencies: {
        "rpc4next-shared": "workspace:~",
      },
    });

    const res = replaceWorkspaceDepsFromManifest({ repoRoot: tmpDir });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = readJson<any>(path.join(pCore, "package.json"));
    expect(core.dependencies["rpc4next-shared"]).toBe("^1.7.3");
    expect(core.peerDependencies["rpc4next-shared"]).toBe("^1.7.3");
    expect(core.optionalDependencies["rpc4next-shared"]).toBe("~1.7.3");

    // result shape
    expect(res.updatedFiles.length).toBe(1);
    expect(res.changes.map((c) => `${c.depName}:${c.from}->${c.to}`)).toEqual([
      "rpc4next-shared:workspace:*->^1.7.3",
      "rpc4next-shared:workspace:^->^1.7.3",
      "rpc4next-shared:workspace:~->~1.7.3",
    ]);
  });

  it("does not touch workspace deps that are not in the manifest (external workspace refs)", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));

    const pCore = path.join(tmpDir, "packages/rpc4next");
    mkdirp(pCore);

    writeJson(path.join(tmpDir, ".release-please-manifest.json"), {
      "packages/rpc4next": "1.0.0",
    });

    writeJson(path.join(pCore, "package.json"), {
      name: "rpc4next",
      version: "1.0.0",
      dependencies: {
        "some-other-pkg": "workspace:*",
      },
    });

    const res = replaceWorkspaceDepsFromManifest({ repoRoot: tmpDir });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = readJson<any>(path.join(pCore, "package.json"));
    expect(core.dependencies["some-other-pkg"]).toBe("workspace:*");
    expect(res.updatedFiles.length).toBe(0);
    expect(res.changes.length).toBe(0);
  });

  it("throws if manifest is missing", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-test-"));
    expect(() =>
      replaceWorkspaceDepsFromManifest({ repoRoot: tmpDir ?? "" }),
    ).toThrow(/manifest not found/i);
  });
});

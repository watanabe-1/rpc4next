import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishReleasedPackages } from "./publish-released-packages.js";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn<() => void>() }));

type Lookup = NonNullable<Parameters<typeof publishReleasedPackages>[0]["fetch"]>;
type Publish = (cwd: string) => void;

describe("publishReleasedPackages", () => {
  let repoRoot: string;
  const paths = ["packages/a", "packages/b"];
  const pathsReleased = JSON.stringify(paths);
  const writeJson = (file: string, value: unknown) => {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(value));
  };

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-publish-"));
    writeJson(".github/release-please/release-please-config.json", {
      packages: {
        "packages/a": { "package-name": "a" },
        "packages/b": { "package-name": "b" },
      },
    });
    writeJson(".github/release-please/.release-please-manifest.json", {
      "packages/a": "1.0.0",
      "packages/b": "2.0.0",
    });
    writeJson("packages/a/package.json", { name: "a", version: "1.0.0" });
    writeJson("packages/b/package.json", { name: "b", version: "2.0.0" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("resumes a partial publication by skipping the version already published", async () => {
    const published = new Set<string>();
    const fetch = vi.fn<Lookup>(async (url: string) => {
      const name = new URL(url).pathname.split("/")[1];

      return published.has(name)
        ? Response.json({ name, version: name === "a" ? "1.0.0" : "2.0.0" })
        : new Response(null, { status: 404 });
    });
    let failB = true;
    const publish = vi.fn<Publish>((cwd: string) => {
      const name = path.basename(cwd);
      if (name === "b" && failB) throw new Error("transient publish failure");
      if (published.has(name)) throw new Error("duplicate publication");
      published.add(name);
    });
    const options = { repoRoot, pathsReleased, fetch, publish };

    await expect(publishReleasedPackages(options)).rejects.toThrow("transient publish failure");
    expect(published).toEqual(new Set(["a"]));
    failB = false;
    publish.mockClear();
    await expect(publishReleasedPackages(options)).resolves.toEqual({
      published: ["b@2.0.0"],
      skipped: ["a@1.0.0"],
    });
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      fs.realpathSync(path.join(repoRoot, "packages/b")),
    );
    publish.mockClear();
    await expect(publishReleasedPackages(options)).resolves.toEqual({
      published: [],
      skipped: ["a@1.0.0", "b@2.0.0"],
    });
    expect(publish).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://registry.npmjs.org/a/1.0.0", {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
  });

  it("recovers when npm accepted a version but the publish command reported failure", async () => {
    let accepted = false;
    const fetch = vi.fn<Lookup>(async () =>
      accepted
        ? Response.json({ name: "a", version: "1.0.0" })
        : new Response(null, { status: 404 }),
    );
    const publish = vi.fn<Publish>(() => {
      accepted = true;
      throw new Error("connection lost after acceptance");
    });
    const options = { repoRoot, pathsReleased: '["packages/a"]', fetch, publish };
    await expect(publishReleasedPackages(options)).rejects.toThrow("connection lost");
    await expect(publishReleasedPackages(options)).resolves.toEqual({
      published: [],
      skipped: ["a@1.0.0"],
    });
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 429, 500, 503, 302, 204])(
    "does not publish or skip on HTTP %s",
    async (status) => {
      const fetch = vi.fn<Lookup>(async () => new Response(null, { status }));
      const publish = vi.fn<Publish>();
      await expect(
        publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(publish).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([new Error("network unavailable"), new DOMException("timed out", "TimeoutError")])(
    "propagates lookup failures: %s",
    async (error) => {
      const fetch = vi.fn<Lookup>().mockRejectedValue(error);
      const publish = vi.fn<Publish>();
      await expect(
        publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
      ).rejects.toThrow(error);
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it.each([{ name: "other", version: "1.0.0" }, { name: "a", version: "9.0.0" }, {}, null])(
    "rejects unexpected registry metadata: %j",
    async (metadata) => {
      const fetch = vi.fn<Lookup>(async () => Response.json(metadata));
      const publish = vi.fn<Publish>();
      await expect(
        publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
      ).rejects.toThrow("Unexpected registry metadata");
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed registry JSON", async () => {
    const fetch = vi.fn<Lookup>(async () => new Response("not json", { status: 200 }));
    const publish = vi.fn<Publish>();
    await expect(
      publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
    ).rejects.toThrow(SyntaxError);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    "not json",
    "null",
    "{}",
    '["packages/a", 1]',
    '["packages/a", "packages/a"]',
    '["packages/a", "packages/unknown"]',
    '["packages/a", "../outside"]',
    '["packages/a", "packages/b/../../outside"]',
  ])("validates the entire release path list before side effects: %s", async (input) => {
    const fetch = vi.fn<Lookup>();
    const publish = vi.fn<Publish>();
    await expect(
      publishReleasedPackages({ repoRoot, pathsReleased: input, fetch, publish }),
    ).rejects.toThrow(/JSON|PATHS_RELEASED|Unconfigured release path/);
    expect(fetch).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    { name: "unexpected", version: "2.0.0" },
    { name: "b", version: "3.0.0" },
    { name: "b", version: "2.0.0", private: true },
    { name: "b", version: "2.0.0", publishConfig: { registry: "https://example.com/" } },
    { name: "b" },
  ])("rejects mismatched package metadata before any publication: %j", async (pkg) => {
    writeJson("packages/b/package.json", pkg);
    const fetch = vi.fn<Lookup>();
    const publish = vi.fn<Publish>();
    await expect(
      publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
    ).rejects.toThrow("Invalid release package metadata");
    expect(fetch).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects a configured package directory redirected by a symlink", async () => {
    fs.renameSync(path.join(repoRoot, "packages/b"), path.join(repoRoot, "redirected"));
    fs.symlinkSync(
      path.join(repoRoot, "redirected"),
      path.join(repoRoot, "packages/b"),
      "junction",
    );
    const fetch = vi.fn<Lookup>();
    const publish = vi.fn<Publish>();
    await expect(
      publishReleasedPackages({ repoRoot, pathsReleased, fetch, publish }),
    ).rejects.toThrow("Release path resolves outside its configured location");
    expect(fetch).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("accepts an empty release list without registry access", async () => {
    const fetch = vi.fn<Lookup>();
    const publish = vi.fn<Publish>();
    await expect(
      publishReleasedPackages({ repoRoot, pathsReleased: "[]", fetch, publish }),
    ).resolves.toEqual({ published: [], skipped: [] });
    expect(fetch).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes with the fixed registry and an argument array without a shell", async () => {
    const fetch = vi.fn<Lookup>(async () => new Response(null, { status: 404 }));
    await publishReleasedPackages({ repoRoot, pathsReleased: '["packages/a"]', fetch });
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "npm",
      ["publish", "--registry", "https://registry.npmjs.org/"],
      {
        cwd: fs.realpathSync(path.join(repoRoot, "packages/a")),
        stdio: "inherit",
        timeout: 180_000,
      },
    );
  });
});

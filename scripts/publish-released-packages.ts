import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const registry = "https://registry.npmjs.org/";

type Options = {
  repoRoot: string;
  pathsReleased: string;
  fetch?: (url: string, options: RequestInit) => Promise<Response>;
  publish?: (cwd: string) => void;
  logger?: (message: string) => void;
};

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export async function publishReleasedPackages(options: Options) {
  const paths: unknown = JSON.parse(options.pathsReleased);
  if (!Array.isArray(paths) || paths.some((p) => typeof p !== "string")) {
    throw new Error("PATHS_RELEASED must be an array of package paths");
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error("PATHS_RELEASED contains duplicate paths");
  }

  const config = readJson(
    path.join(options.repoRoot, ".github/release-please/release-please-config.json"),
  );
  const manifest = readJson(
    path.join(options.repoRoot, ".github/release-please/.release-please-manifest.json"),
  );
  const root = fs.realpathSync(options.repoRoot);
  // Validate the entire plan before making any registry requests or publishing.
  const packages = paths.map((p: string) => {
    if (!/^packages\/[a-z0-9-]+$/.test(p) || !Object.hasOwn(config.packages, p)) {
      throw new Error(`Unconfigured release path: ${p}`);
    }
    const cwd = fs.realpathSync(path.join(root, p));
    if (path.relative(root, cwd).split(path.sep).join("/") !== p) {
      throw new Error(`Release path resolves outside its configured location: ${p}`);
    }
    const pkg = readJson(path.join(cwd, "package.json"));
    if (
      typeof pkg.name !== "string" ||
      !/^[a-z0-9][a-z0-9._-]*$/.test(pkg.name) ||
      pkg.name !== config.packages[p]["package-name"] ||
      typeof pkg.version !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(pkg.version) ||
      !Object.hasOwn(manifest, p) ||
      pkg.version !== manifest[p] ||
      (pkg.publishConfig?.registry !== undefined && pkg.publishConfig.registry !== registry) ||
      pkg.private === true
    ) {
      throw new Error(`Invalid release package metadata: ${p}`);
    }

    return { cwd, name: pkg.name as string, version: pkg.version as string };
  });

  const fetchMetadata = options.fetch ?? globalThis.fetch;
  const publish =
    options.publish ??
    ((cwd: string) => {
      // This entry point runs in the Linux publish job. Never interpolate metadata into a shell.
      execFileSync("npm", ["publish", "--registry", registry], {
        cwd,
        stdio: "inherit",
        timeout: 180_000,
      });
    });
  const result: { published: string[]; skipped: string[] } = { published: [], skipped: [] };
  for (const pkg of packages) {
    const spec = `${pkg.name}@${pkg.version}`;
    const response = await fetchMetadata(
      `${registry}${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`,
      {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.status === 200) {
      const metadata = await response.json();
      if (metadata?.name !== pkg.name || metadata?.version !== pkg.version) {
        throw new Error(`Unexpected registry metadata for ${spec}`);
      }
      options.logger?.(`[publish] skip ${spec}: already published`);
      result.skipped.push(spec);
    } else if (response.status === 404) {
      options.logger?.(`[publish] publishing ${spec}`);
      publish(pkg.cwd);
      result.published.push(spec);
    } else {
      throw new Error(`Registry lookup failed for ${spec}: HTTP ${response.status}`);
    }
  }

  return result;
}

/* c8 ignore start */
if (import.meta.main) {
  const pathsReleased = process.env.PATHS_RELEASED;
  if (!pathsReleased) throw new Error("PATHS_RELEASED is required");
  await publishReleasedPackages({ repoRoot: process.cwd(), pathsReleased, logger: console.log });
}
/* c8 ignore end */

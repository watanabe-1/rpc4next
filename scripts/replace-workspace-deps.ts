import fs from "node:fs";
import path from "node:path";

export type Manifest = Record<string, string>;

export type ReplaceOptions = {
  repoRoot: string;
  manifestFile?: string; // Default: ".release-please-manifest.json"
  depFields?: readonly (
    | "dependencies"
    | "peerDependencies"
    | "optionalDependencies"
  )[];
  defaultRange?: "^" | "~"; // Which range to use for "workspace:*" (usually "^")
};

export type ReplaceResult = {
  updatedFiles: string[];
  changes: Array<{
    packageName: string;
    depName: string;
    from: string;
    to: string;
  }>;
};

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8"));

const writeJson = (file: string, obj: unknown) =>
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");

export function replaceWorkspaceDepsFromManifest(
  options: ReplaceOptions,
): ReplaceResult {
  const repoRoot = options.repoRoot;
  const manifestFile = options.manifestFile ?? ".release-please-manifest.json";
  const manifestPath = path.join(repoRoot, manifestFile);

  const depFields =
    options.depFields ??
    (["dependencies", "peerDependencies", "optionalDependencies"] as const);

  const defaultRange = options.defaultRange ?? "^";

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`release-please manifest not found: ${manifestPath}`);
  }

  const manifest = readJson<Manifest>(manifestPath);
  const packageDirs = Object.keys(manifest);

  // Map: package name -> version (from the manifest)
  const nameToVersion = new Map<string, string>();
  for (const dir of packageDirs) {
    const pkgPath = path.join(repoRoot, dir, "package.json");
    const pkg = readJson<{ name: string }>(pkgPath);
    nameToVersion.set(pkg.name, manifest[dir]);
  }

  const result: ReplaceResult = { updatedFiles: [], changes: [] };

  for (const dir of packageDirs) {
    const pkgPath = path.join(repoRoot, dir, "package.json");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkg = readJson<any>(pkgPath);

    let changed = false;

    for (const field of depFields) {
      const deps: Record<string, string> | undefined = pkg[field];
      if (!deps) continue;

      for (const [depName, spec] of Object.entries(deps)) {
        if (typeof spec !== "string") continue;
        if (!spec.startsWith("workspace:")) continue;

        const version = nameToVersion.get(depName);
        if (!version) continue; // Do not touch workspace deps that are not in the manifest

        const suffix = spec.slice("workspace:".length).trim();

        let prefix: "^" | "~";
        if (suffix === "~") prefix = "~";
        else if (suffix === "^") prefix = "^";
        else if (suffix === "*" || suffix === "") prefix = defaultRange;
        else prefix = defaultRange; // Normalize unexpected values to the default

        const next = `${prefix}${version}`;

        if (deps[depName] !== next) {
          console.log(
            `[replace] ${pkg.name}: ${field}.${depName} ${deps[depName]} -> ${next}`,
          );

          result.changes.push({
            packageName: pkg.name,
            depName,
            from: deps[depName],
            to: next,
          });
          deps[depName] = next;
          changed = true;
        }
      }
    }

    if (changed) {
      writeJson(pkgPath, pkg);
      result.updatedFiles.push(pkgPath);
    }
  }

  return result;
}

// CLI entry point (used by CI)
if (import.meta.main) {
  replaceWorkspaceDepsFromManifest({ repoRoot: process.cwd() });
}

import fs from "node:fs";
import path from "node:path";

type CopyRootFilesOptions = {
  /**
   * Package directories location relative to rootDir.
   * Default: "packages"
   */
  packagesDirName?: string;

  /**
   * Filenames to copy from rootDir into each package dir
   * only when the target file does not exist.
   *
   * e.g. ["README.md", "LICENSE"]
   */
  fileNames: string[];
};

export type CopyRootFilesResult = {
  /**
   * Map of filename -> list of package names where the file was copied.
   */
  copied: Record<string, string[]>;
};

/**
 * Copy root files (e.g. README.md, LICENSE) into each package directory
 * only if the target file does not already exist.
 */
export function copyRootFiles(
  rootDir: string,
  options: CopyRootFilesOptions,
): CopyRootFilesResult {
  const packagesDir = path.join(rootDir, options.packagesDirName ?? "packages");
  console.log(
    `[copy-root-files] start rootDir=${rootDir} packagesDir=${packagesDir} files=${options.fileNames.join(",")}`,
  );

  // Read all root files once
  const rootContents: Record<string, string> = {};
  for (const fileName of options.fileNames) {
    const srcPath = path.join(rootDir, fileName);
    rootContents[fileName] = fs.readFileSync(srcPath, "utf8");
  }

  const copied: Record<string, string[]> = Object.fromEntries(
    options.fileNames.map((f) => [f, []]),
  );

  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;

    const pkgName = ent.name;
    const pkgDir = path.join(packagesDir, pkgName);

    for (const fileName of options.fileNames) {
      const destPath = path.join(pkgDir, fileName);

      if (!fs.existsSync(destPath)) {
        fs.writeFileSync(destPath, rootContents[fileName]);
        console.log(`[copy-root-files] copied ${fileName} -> ${destPath}`);
        copied[fileName].push(pkgName);
      } else {
        console.log(
          `[copy-root-files] skipped (already exists) ${fileName} -> ${destPath}`,
        );
      }
    }
  }

  const copiedCount = Object.values(copied).reduce(
    (total, names) => total + names.length,
    0,
  );
  console.log(`[copy-root-files] done copied=${copiedCount}`);

  return { copied };
}

export function runCli(cwd = process.cwd()) {
  return copyRootFiles(cwd, { fileNames: ["README.md", "LICENSE"] });
}

// CLI entry point (used by CI)
/* c8 ignore start */
if (import.meta.main) runCli();
/* c8 ignore end */

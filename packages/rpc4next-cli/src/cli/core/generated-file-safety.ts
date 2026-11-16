import fs from "node:fs";
import path from "node:path";

import { ROUTE_CONTRACT_GENERATED_MARKER } from "./generate-path-structure.js";

export const assertNotNextReservedFile = (filePath: string): void => {
  const fileName = path.basename(filePath).toLowerCase();
  const reservedCodeFile =
    /^(page|route|layout|template|loading|error|global-error|not-found|global-not-found|default|forbidden|unauthorized)\.(js|jsx|ts|tsx|mdx)$/;
  const reservedMetadataFile =
    /^(robots\.(txt|js|ts)|sitemap\.(xml|js|ts)|manifest\.(json|webmanifest|js|ts)|favicon\.ico|(icon|apple-icon|opengraph-image|twitter-image)\d*\.(ico|jpg|jpeg|png|svg|gif|js|ts|tsx))$/;

  if (reservedCodeFile.test(fileName) || reservedMetadataFile.test(fileName)) {
    throw new Error(`Generation target collision at ${filePath}: Next.js reserved filename.`);
  }
};

export const validateGeneratedTargets = (filePaths: string[]): void => {
  const targets = new Set<string>();

  for (const filePath of filePaths) {
    assertNotNextReservedFile(filePath);

    const resolvedPath = path.resolve(filePath);
    const key = process.platform === "win32" ? resolvedPath.toLowerCase() : resolvedPath;

    if (targets.has(key)) {
      throw new Error(`Generation target collision at ${filePath}: duplicate output path.`);
    }
    targets.add(key);

    if (
      fs.existsSync(filePath) &&
      !fs.readFileSync(filePath, "utf8").includes(ROUTE_CONTRACT_GENERATED_MARKER)
    ) {
      throw new Error(
        `Generation target collision at ${filePath}: existing file has no rpc4next generated marker.`,
      );
    }
  }
};

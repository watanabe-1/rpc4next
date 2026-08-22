import fs from "node:fs";
import path from "node:path";

import { SUCCESS_INDENT_LEVEL, SUCCESS_PAD_LENGTH, SUCCESS_SEPARATOR } from "./constants.js";
import {
  clearScanCaches,
  createGeneratedParamsFilesCacheKey,
  generatedParamsFilesCache,
} from "./core/cache.js";
import {
  generatePathStructure,
  ROUTE_CONTRACT_GENERATED_MARKER,
} from "./core/generate-path-structure.js";
import { relativeFromRoot } from "./core/path-utils.js";
import { padMessage } from "./logger.js";
import type { Logger } from "./types.js";

const writeFileIfChanged = (filePath: string, nextContent: string): boolean => {
  if (fs.existsSync(filePath)) {
    const currentContent = fs.readFileSync(filePath, "utf8");

    if (currentContent === nextContent) {
      return false;
    }
  }

  fs.writeFileSync(filePath, nextContent);

  return true;
};

const isFileContentCurrent = (filePath: string, expectedContent: string): boolean => {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === expectedContent;
};

const isWithinBaseDir = (targetPath: string, baseDir: string): boolean => {
  const resolvedBaseDir = path.resolve(baseDir);
  const resolvedTargetPath = path.resolve(targetPath);
  const relativePath = path.relative(resolvedBaseDir, resolvedTargetPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const listGeneratedCandidateFiles = (baseDir: string, paramsFileName: string): string[] => {
  const files: string[] = [];

  const visit = (dirPath: string) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === paramsFileName) {
        files.push(entryPath);
      }
    }
  };

  if (!fs.existsSync(baseDir)) {
    return files;
  }

  visit(baseDir);

  return files;
};

const cleanupStaleGeneratedParamsFiles = ({
  baseDir,
  paramsFileName,
  expectedFilePaths,
  candidateFilePaths,
}: {
  baseDir: string;
  paramsFileName: string;
  expectedFilePaths: Set<string>;
  candidateFilePaths?: Iterable<string>;
}) => {
  const candidates = candidateFilePaths ?? listGeneratedCandidateFiles(baseDir, paramsFileName);

  for (const filePath of candidates) {
    const resolvedFilePath = path.resolve(filePath);

    if (expectedFilePaths.has(resolvedFilePath)) {
      continue;
    }

    if (!isWithinBaseDir(resolvedFilePath, baseDir)) {
      continue;
    }

    if (!fs.existsSync(resolvedFilePath)) {
      continue;
    }

    const currentContent = fs.readFileSync(resolvedFilePath, "utf8");

    if (!currentContent.includes(ROUTE_CONTRACT_GENERATED_MARKER)) {
      continue;
    }

    fs.rmSync(resolvedFilePath, { force: true });
  }
};

const findStaleGeneratedParamsFiles = ({
  baseDir,
  paramsFileName,
  expectedFilePaths,
}: {
  baseDir: string;
  paramsFileName: string;
  expectedFilePaths: Set<string>;
}): string[] => {
  return listGeneratedCandidateFiles(baseDir, paramsFileName).filter((filePath) => {
    const resolvedFilePath = path.resolve(filePath);

    if (expectedFilePaths.has(resolvedFilePath) || !isWithinBaseDir(resolvedFilePath, baseDir)) {
      return false;
    }

    return fs.readFileSync(resolvedFilePath, "utf8").includes(ROUTE_CONTRACT_GENERATED_MARKER);
  });
};

export const checkGenerated = ({
  baseDir,
  outputPath,
  paramsFileName,
  logger,
}: {
  baseDir: string;
  outputPath: string;
  paramsFileName: string | null;
  logger: Logger;
}): boolean => {
  try {
    logger.info("Checking generated types...", { event: "check" });

    const { pathStructure, paramsTypes } = generatePathStructure(outputPath, baseDir);
    let isCurrent = true;

    if (!isFileContentCurrent(outputPath, pathStructure)) {
      logger.error(`Generated path structure is stale: ${relativeFromRoot(outputPath)}`);
      isCurrent = false;
    }

    if (paramsFileName) {
      const expectedFilePaths = new Set(
        paramsTypes.map(({ dirPath }) => path.resolve(path.join(dirPath, paramsFileName))),
      );

      for (const { paramsType, dirPath } of paramsTypes) {
        const filePath = path.join(dirPath, paramsFileName);

        if (!isFileContentCurrent(filePath, paramsType)) {
          logger.error(`Generated params file is stale: ${relativeFromRoot(filePath)}`);
          isCurrent = false;
        }
      }

      for (const filePath of findStaleGeneratedParamsFiles({
        baseDir,
        paramsFileName,
        expectedFilePaths,
      })) {
        logger.error(`Generated params file should be removed: ${relativeFromRoot(filePath)}`);
        isCurrent = false;
      }
    }

    if (isCurrent) {
      logger.success("Generated files are up to date.");
    }

    return isCurrent;
  } finally {
    clearScanCaches();
  }
};

export const generate = ({
  baseDir,
  outputPath,
  paramsFileName,
  logger,
  preserveCache = false,
}: {
  baseDir: string;
  outputPath: string;
  paramsFileName: string | null;
  logger: Logger;
  preserveCache?: boolean;
}) => {
  try {
    logger.info("Generating types...", { event: "generate" });

    const { pathStructure, paramsTypes } = generatePathStructure(outputPath, baseDir);

    if (writeFileIfChanged(outputPath, pathStructure)) {
      logger.success(
        padMessage(
          "Path structure type",
          relativeFromRoot(outputPath),
          SUCCESS_SEPARATOR,
          SUCCESS_PAD_LENGTH,
        ),
        { indentLevel: SUCCESS_INDENT_LEVEL },
      );
    } else {
      logger.info(
        padMessage(
          "Unchanged path type",
          relativeFromRoot(outputPath),
          SUCCESS_SEPARATOR,
          SUCCESS_PAD_LENGTH,
        ),
        { indentLevel: SUCCESS_INDENT_LEVEL },
      );
    }

    if (paramsFileName) {
      let wroteParamsFile = false;
      const expectedFilePaths = new Set(
        paramsTypes.map(({ dirPath }) => path.resolve(path.join(dirPath, paramsFileName))),
      );
      const cacheKey = createGeneratedParamsFilesCacheKey({ baseDir, paramsFileName });
      const previousFilePaths = preserveCache ? generatedParamsFilesCache.get(cacheKey) : undefined;

      paramsTypes.forEach(({ paramsType, dirPath }) => {
        const filePath = path.join(dirPath, paramsFileName);
        const didWrite = writeFileIfChanged(filePath, paramsType);

        wroteParamsFile = wroteParamsFile || didWrite;
      });

      cleanupStaleGeneratedParamsFiles({
        baseDir,
        paramsFileName,
        expectedFilePaths,
        candidateFilePaths: previousFilePaths,
      });

      generatedParamsFilesCache.set(cacheKey, expectedFilePaths);

      if (wroteParamsFile) {
        logger.success(
          padMessage("Params types", paramsFileName, SUCCESS_SEPARATOR, SUCCESS_PAD_LENGTH),
          {
            indentLevel: SUCCESS_INDENT_LEVEL,
          },
        );
      } else {
        logger.info(
          padMessage("Unchanged params", paramsFileName, SUCCESS_SEPARATOR, SUCCESS_PAD_LENGTH),
          {
            indentLevel: SUCCESS_INDENT_LEVEL,
          },
        );
      }
    }
  } finally {
    if (!preserveCache) {
      // Normal generation should not retain scan results between embedded calls.
      clearScanCaches();
    }
  }
};

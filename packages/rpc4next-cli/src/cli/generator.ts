import fs from "node:fs";
import path from "node:path";

import { SUCCESS_INDENT_LEVEL, SUCCESS_PAD_LENGTH, SUCCESS_SEPARATOR } from "./constants.js";
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
}: {
  baseDir: string;
  paramsFileName: string;
  expectedFilePaths: Set<string>;
}) => {
  for (const filePath of listGeneratedCandidateFiles(baseDir, paramsFileName)) {
    const resolvedFilePath = path.resolve(filePath);

    if (expectedFilePaths.has(resolvedFilePath)) {
      continue;
    }

    if (!isWithinBaseDir(resolvedFilePath, baseDir)) {
      continue;
    }

    const currentContent = fs.readFileSync(resolvedFilePath, "utf8");

    if (!currentContent.includes(ROUTE_CONTRACT_GENERATED_MARKER)) {
      continue;
    }

    fs.rmSync(resolvedFilePath, { force: true });
  }
};

export const generate = ({
  baseDir,
  outputPath,
  paramsFileName,
  logger,
}: {
  baseDir: string;
  outputPath: string;
  paramsFileName: string | null;
  logger: Logger;
}) => {
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

    paramsTypes.forEach(({ paramsType, dirPath }) => {
      const filePath = path.join(dirPath, paramsFileName);
      const didWrite = writeFileIfChanged(filePath, paramsType);

      wroteParamsFile = wroteParamsFile || didWrite;
    });

    cleanupStaleGeneratedParamsFiles({
      baseDir,
      paramsFileName,
      expectedFilePaths,
    });

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
};

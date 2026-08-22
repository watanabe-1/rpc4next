import fs from "node:fs";
import path from "node:path";

import { EXIT_FAILURE, EXIT_SUCCESS } from "./constants.js";
import { toPosixPath } from "./core/path-utils.js";
import { checkGenerated, generate } from "./generator.js";
import type { CliOptions, ExitCode, Logger } from "./types.js";
import { setupWatcher } from "./watcher.js";

const handleGenerateSafely = (
  baseDir: string,
  outputPath: string,
  paramsFileName: string | null,
  logger: Logger,
  preserveCache = false,
): ExitCode => {
  try {
    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
      preserveCache,
    });

    return EXIT_SUCCESS;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to generate: ${error.message}`);
    } else {
      logger.error(`Unknown error occurred during generate: ${String(error)}`);
    }

    return EXIT_FAILURE;
  }
};

const handleCheckSafely = (
  baseDir: string,
  outputPath: string,
  paramsFileName: string | null,
  logger: Logger,
): ExitCode => {
  try {
    return checkGenerated({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
    })
      ? EXIT_SUCCESS
      : EXIT_FAILURE;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to check generated files: ${error.message}`);
    } else {
      logger.error(`Unknown error occurred during check: ${String(error)}`);
    }

    return EXIT_FAILURE;
  }
};

const isValidParamsFileName = (paramsFileName: string): boolean => {
  return (
    paramsFileName !== "." &&
    paramsFileName !== ".." &&
    !paramsFileName.includes("/") &&
    !paramsFileName.includes("\\") &&
    !path.isAbsolute(paramsFileName) &&
    path.basename(paramsFileName) === paramsFileName
  );
};

const isWithinCwd = (resolvedPath: string): boolean => {
  const cwd = getRealPathForContainment(path.resolve(process.cwd()));
  const targetPath = getRealPathForContainment(resolvedPath);
  const relativePath = path.relative(cwd, targetPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

const getRealPathForContainment = (resolvedPath: string): string => {
  if (fs.existsSync(resolvedPath)) {
    return fs.realpathSync.native(resolvedPath);
  }

  const segments: string[] = [];
  let currentPath = resolvedPath;

  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return resolvedPath;
    }

    segments.unshift(path.basename(currentPath));
    currentPath = parentPath;
  }

  return path.resolve(fs.realpathSync.native(currentPath), ...segments);
};

export const handleCli = (
  baseDir: string,
  outputPath: string,
  options: CliOptions,
  logger: Logger,
): ExitCode => {
  const resolvedBaseDirNative = path.resolve(baseDir);
  const resolvedOutputPathNative = path.resolve(outputPath);
  const resolvedBaseDir = toPosixPath(resolvedBaseDirNative);
  const resolvedOutputPath = toPosixPath(resolvedOutputPathNative);

  const paramsFileName = typeof options.paramsFile === "string" ? options.paramsFile : null;

  if (!isWithinCwd(resolvedBaseDirNative)) {
    logger.error("Error: baseDir must be inside the current working directory.");

    return EXIT_FAILURE;
  }

  if (!isWithinCwd(resolvedOutputPathNative)) {
    logger.error("Error: outputPath must be inside the current working directory.");

    return EXIT_FAILURE;
  }

  if (options.paramsFile !== undefined && !paramsFileName) {
    logger.error("Error: --params-file requires a filename.");

    return EXIT_FAILURE;
  }

  if (paramsFileName && !isValidParamsFileName(paramsFileName)) {
    logger.error("Error: --params-file must be a filename, not a path.");

    return EXIT_FAILURE;
  }

  if (options.watch && options.check) {
    logger.error("Error: --check cannot be used with --watch.");

    return EXIT_FAILURE;
  }

  if (options.check) {
    return handleCheckSafely(resolvedBaseDir, resolvedOutputPath, paramsFileName, logger);
  }

  if (options.watch) {
    setupWatcher(
      resolvedBaseDir,
      () => {
        // Watch mode keeps scan caches warm and invalidates changed paths in the watcher.
        handleGenerateSafely(resolvedBaseDir, resolvedOutputPath, paramsFileName, logger, true);
      },
      logger,
    );

    return EXIT_SUCCESS;
  }

  return handleGenerateSafely(resolvedBaseDir, resolvedOutputPath, paramsFileName, logger);
};

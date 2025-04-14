import path from "path";
import { EXIT_FAILURE, EXIT_SUCCESS } from "./constants";
import { generate } from "./generator";
import { setupWatcher } from "./watcher";
import type { CliOptions, ExitCode, Logger } from "./types";

const handleGenerateSafely = (
  baseDir: string,
  outputPath: string,
  paramsFileName: string | null,
  logger: Logger
): ExitCode => {
  try {
    generate({
      baseDir,
      outputPath,
      paramsFileName,
      logger,
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

export const handleCli = (
  baseDir: string,
  outputPath: string,
  options: CliOptions,
  logger: Logger
): ExitCode => {
  const resolvedBaseDir = path.resolve(baseDir).replace(/\\/g, "/");
  const resolvedOutputPath = path.resolve(outputPath).replace(/\\/g, "/");

  const paramsFileName =
    typeof options.paramsFile === "string" ? options.paramsFile : null;

  if (options.paramsFile !== undefined && !paramsFileName) {
    logger.error("Error: --params-file requires a filename.");

    return EXIT_FAILURE;
  }

  if (options.watch) {
    setupWatcher(
      resolvedBaseDir,
      () => {
        handleGenerateSafely(
          resolvedBaseDir,
          resolvedOutputPath,
          paramsFileName,
          logger
        );
      },
      logger
    );

    return EXIT_SUCCESS;
  }

  return handleGenerateSafely(
    resolvedBaseDir,
    resolvedOutputPath,
    paramsFileName,
    logger
  );
};

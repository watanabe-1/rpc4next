import path from "path";
import { EXIT_FAILURE, EXIT_SUCCESS } from "./constants";
import { generate } from "./generator";
import { setupWatcher } from "./watcher";
import type { CliOptions, ExitCode, Logger } from "./types";

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
        generate({
          baseDir: resolvedBaseDir,
          outputPath: resolvedOutputPath,
          paramsFileName,
          logger,
        });
      },
      logger
    );
  } else {
    generate({
      baseDir: resolvedBaseDir,
      outputPath: resolvedOutputPath,
      paramsFileName,
      logger,
    });
  }

  return EXIT_SUCCESS;
};

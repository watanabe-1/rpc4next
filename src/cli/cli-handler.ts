import path from "path";
import { generate } from "./generator";
import { CliOptions, Logger } from "./types";
import { setupWatcher } from "./watcher";

export const handleCli = (
  baseDir: string,
  outputPath: string,
  options: CliOptions,
  logger: Logger
): number => {
  const resolvedBaseDir = path.resolve(baseDir).replace(/\\/g, "/");
  const resolvedOutputPath = path.resolve(outputPath).replace(/\\/g, "/");

  const paramsFileName =
    typeof options.paramsFile === "string" ? options.paramsFile : null;

  if (options.paramsFile !== undefined && !paramsFileName) {
    logger.error("Error: --params-file requires a filename.");

    return 1;
  }

  if (options.watch) {
    setupWatcher(
      resolvedBaseDir,
      () => {
        generate({
          baseDir: resolvedBaseDir,
          outputPath: resolvedOutputPath,
          paramsFileName: options.paramsFile || null,
          logger,
        });
      },
      logger
    );
  } else {
    generate({
      baseDir: resolvedBaseDir,
      outputPath: resolvedOutputPath,
      paramsFileName: options.paramsFile || null,
      logger,
    });
  }

  return 0;
};

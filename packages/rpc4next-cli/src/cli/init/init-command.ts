import fs from "node:fs";
import path from "node:path";

import { EXIT_FAILURE, EXIT_SUCCESS } from "../constants.js";
import { toPosixPath } from "../core/path-utils.js";
import { generate } from "../generator.js";
import type { ExitCode, Logger } from "../types.js";
import {
  INIT_BASE_DIR,
  INIT_GENERATED_RPC_PATH,
  INIT_PARAMS_FILE,
  INIT_TEMPLATE_FILES,
} from "./templates.js";

export interface InitCommandOptions {
  dryRun?: boolean;
  force?: boolean;
}

type InitFileStatus = "created" | "skipped" | "dry-run";

const logInitFile = (logger: Logger, status: InitFileStatus, filePath: string) => {
  logger.info(`${status} ${filePath}`);
};

const ensureParentDir = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const writeInitFile = ({
  filePath,
  content,
  options,
  logger,
}: {
  filePath: string;
  content: string;
  options: InitCommandOptions;
  logger: Logger;
}): InitFileStatus => {
  if (options.dryRun) {
    logInitFile(logger, "dry-run", filePath);

    return "dry-run";
  }

  if (fs.existsSync(filePath) && !options.force) {
    logInitFile(logger, "skipped", filePath);

    return "skipped";
  }

  ensureParentDir(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  logInitFile(logger, "created", filePath);

  return "created";
};

const writeGeneratedRpcFile = (options: InitCommandOptions, logger: Logger): InitFileStatus => {
  const outputPath = path.resolve(INIT_GENERATED_RPC_PATH);

  if (options.dryRun) {
    logInitFile(logger, "dry-run", INIT_GENERATED_RPC_PATH);

    return "dry-run";
  }

  if (fs.existsSync(outputPath) && !options.force) {
    logInitFile(logger, "skipped", INIT_GENERATED_RPC_PATH);

    return "skipped";
  }

  fs.mkdirSync(path.resolve(INIT_BASE_DIR), { recursive: true });
  ensureParentDir(outputPath);
  generate({
    baseDir: toPosixPath(path.resolve(INIT_BASE_DIR)),
    outputPath: toPosixPath(outputPath),
    paramsFileName: INIT_PARAMS_FILE,
    logger,
  });
  logInitFile(logger, "created", INIT_GENERATED_RPC_PATH);

  return "created";
};

export const handleInitCommand = (options: InitCommandOptions, logger: Logger): ExitCode => {
  try {
    logger.info("Initializing rpc4next...", { event: "init" });

    for (const file of INIT_TEMPLATE_FILES) {
      writeInitFile({
        filePath: file.path,
        content: file.content,
        options,
        logger,
      });
    }

    writeGeneratedRpcFile(options, logger);

    return EXIT_SUCCESS;
  } catch (error) {
    logger.error(
      `Failed to initialize rpc4next: ${error instanceof Error ? error.message : String(error)}`,
    );

    return EXIT_FAILURE;
  }
};

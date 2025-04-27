import fs from "fs";
import path from "path";
import {
  SUCCESS_SEPARATOR,
  SUCCESS_PAD_LENGTH,
  SUCCESS_INDENT_LEVEL,
} from "./constants";
import { generatePathStructure } from "./core/generate-path-structure";
import { relativeFromRoot } from "./core/path-utils";
import { padMessage } from "./logger";
import type { Logger } from "./types";

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

  const { pathStructure, paramsTypes } = generatePathStructure(
    outputPath,
    baseDir
  );

  fs.writeFileSync(outputPath, pathStructure);
  logger.success(
    padMessage(
      "Path structure type",
      relativeFromRoot(outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH
    ),
    { indentLevel: SUCCESS_INDENT_LEVEL }
  );

  if (paramsFileName) {
    paramsTypes.forEach(({ paramsType, dirPath }) => {
      const filePath = path.join(dirPath, paramsFileName);
      fs.writeFileSync(filePath, paramsType);
    });
    logger.success(
      padMessage(
        "Params types",
        paramsFileName,
        SUCCESS_SEPARATOR,
        SUCCESS_PAD_LENGTH
      ),
      {
        indentLevel: SUCCESS_INDENT_LEVEL,
      }
    );
  }
};

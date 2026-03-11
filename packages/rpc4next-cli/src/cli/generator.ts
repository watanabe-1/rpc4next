import fs from "node:fs";
import path from "node:path";
import {
  SUCCESS_INDENT_LEVEL,
  SUCCESS_PAD_LENGTH,
  SUCCESS_SEPARATOR,
} from "./constants.js";
import { generatePathStructure } from "./core/generate-path-structure.js";
import { relativeFromRoot } from "./core/path-utils.js";
import { padMessage } from "./logger.js";
import type { Logger } from "./types.js";

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
    baseDir,
  );

  fs.writeFileSync(outputPath, pathStructure);
  logger.success(
    padMessage(
      "Path structure type",
      relativeFromRoot(outputPath),
      SUCCESS_SEPARATOR,
      SUCCESS_PAD_LENGTH,
    ),
    { indentLevel: SUCCESS_INDENT_LEVEL },
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
        SUCCESS_PAD_LENGTH,
      ),
      {
        indentLevel: SUCCESS_INDENT_LEVEL,
      },
    );
  }
};

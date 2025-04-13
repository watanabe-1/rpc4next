import fs from "fs";
import path from "path";
import {
  SUCCESS_SEPARATOR,
  SUCCESS_PAD_LENGTH,
  SUCCESS_INDENT_LEVEL,
} from "./constants";
import { generatePages } from "./core/generate-path-structure";
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
  logger.info("Types regenerated due to file change", { event: "generate" });

  const { pathStructure, paramsTypes } = generatePages(outputPath, baseDir);

  fs.writeFileSync(outputPath, pathStructure);
  logger.success(
    padMessage(
      "Path structure type",
      path.relative(process.cwd(), outputPath),
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

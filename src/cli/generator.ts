import fs from "fs";
import { generatePages } from "./core/generate-path-structure";
import { Logger } from "./types";

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
  logger.info("Generating...");
  const { pathStructure, paramsTypes } = generatePages(outputPath, baseDir);

  fs.writeFileSync(outputPath, pathStructure);
  logger.success(`Generated types at ${outputPath}`);

  if (paramsFileName) {
    paramsTypes.forEach(({ paramsType, dirPath }) => {
      const filePath = `${dirPath}/${paramsFileName}`;
      fs.writeFileSync(filePath, paramsType);
    });
    logger.success(`Generated params type at ${paramsFileName}`);
  }
};

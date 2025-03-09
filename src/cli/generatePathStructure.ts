import { STATEMENT_TERMINATOR, NEWLINE } from "./constants";
import { scanAppDir } from "./routeScanner";

export const generatePages = (outputPath: string, baseDir: string) => {
  const { pathStructure, imports } = scanAppDir(outputPath, baseDir);
  const pathStructureType = `export type PathStructure = ${pathStructure}${STATEMENT_TERMINATOR}`;

  const importsStr = imports.length
    ? `${imports
        .sort((a, b) =>
          a.path.localeCompare(b.path, undefined, { numeric: true })
        )
        .map((v) => v.statement)
        .join(NEWLINE)}`
    : "";

  return `${importsStr}${NEWLINE}${NEWLINE}${pathStructureType}`;
};

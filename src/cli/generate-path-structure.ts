import { STATEMENT_TERMINATOR, NEWLINE, TYPE_KEYS } from "./constants";
import { scanAppDir } from "./route-scanner";
import { createImport } from "./type-utils";

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

  const keyTypes = TYPE_KEYS.filter((type) => pathStructure.includes(type));
  const keyTypesImportStr = createImport(
    keyTypes.join(" ,"),
    "rpc4next/client"
  );

  return `${keyTypesImportStr}${NEWLINE}${importsStr}${NEWLINE}${NEWLINE}${pathStructureType}`;
};

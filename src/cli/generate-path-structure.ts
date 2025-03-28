import {
  STATEMENT_TERMINATOR,
  NEWLINE,
  TYPE_KEYS,
  RPC4NEXT_CLIENT_IMPORT_PATH,
} from "./constants";
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
    RPC4NEXT_CLIENT_IMPORT_PATH
  );

  return `${keyTypesImportStr}${NEWLINE}${importsStr}${NEWLINE}${NEWLINE}${pathStructureType}`;
};

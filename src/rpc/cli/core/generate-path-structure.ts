import {
  STATEMENT_TERMINATOR,
  NEWLINE,
  TYPE_KEYS,
  RPC4NEXT_CLIENT_IMPORT_PATH,
} from "./constants";
import { scanAppDir } from "./route-scanner";
import { createImport } from "./type-utils";

export const generatePages = (outputPath: string, baseDir: string) => {
  const { pathStructure, imports, paramsTypes } = scanAppDir(
    outputPath,
    baseDir
  );
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
  const dirParamsTypes = paramsTypes.map(({ paramsType, dirPath }) => {
    const params = `export type Params = ${paramsType}${STATEMENT_TERMINATOR}`;

    return {
      paramsType: params,
      dirPath,
    };
  });

  return {
    pathStructure: `${keyTypesImportStr}${NEWLINE}${importsStr}${NEWLINE}${NEWLINE}${pathStructureType}`,
    paramsTypes: dirParamsTypes,
  };
};

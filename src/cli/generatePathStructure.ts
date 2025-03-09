import { STATEMENT_TERMINATOR, NEWLINE } from "./constants";
import {
  TYPE_KEY_PARAMS,
  TYPE_END_POINT,
  TYPE_KEY_QUERY,
  TYPE_KEY_OPTIONAL_QUERY,
} from "./constants";
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

  const keyTypes = [
    TYPE_END_POINT,
    TYPE_KEY_OPTIONAL_QUERY,
    TYPE_KEY_PARAMS,
    TYPE_KEY_QUERY,
  ].filter((type) => pathStructure.includes(type));

  return `${`import type { ${keyTypes.join(" ,")} } from "rpc4next/client"${STATEMENT_TERMINATOR}${NEWLINE}${importsStr}`}${NEWLINE}${NEWLINE}${pathStructureType}`;
};

import fs from "node:fs";
import type { HttpMethod } from "rpc4next-shared";
import { HTTP_METHODS_EXCLUDE_OPTIONS } from "rpc4next-shared";
import type { ImportAliasName } from "./alias.js";
import { createImportAlias } from "./alias.js";
import { QUERY_TYPES, TYPE_KEY_QUERY } from "./constants.js";
import { createRelativeImportPath } from "./path-utils.js";
import {
  createImport,
  createObjectType,
  createRecodeType,
} from "./type-utils.js";

type ScanDefinition<T extends ImportAliasName> = {
  importName: string;
  importPath: string;
  importStatement: string;
  type: string;
  exportName: T;
};

const buildDefinition = <T extends ImportAliasName>(
  outputFile: string,
  inputFile: string,
  exportName: T,
  typeCallBack: (type: T, importAlias: string) => string,
) => {
  const relativeImportPath = createRelativeImportPath(outputFile, inputFile);
  const importAlias = createImportAlias(relativeImportPath, exportName);

  return {
    importName: importAlias,
    importPath: relativeImportPath,
    importStatement: createImport(exportName, relativeImportPath, importAlias),
    type: typeCallBack(exportName, importAlias),
    exportName,
  };
};

const findQueryExport = (fileContents: string) => {
  return QUERY_TYPES.find((type) =>
    new RegExp(`export (interface ${type} ?{|type ${type} ?=)`).test(
      fileContents,
    ),
  );
};

const hasRouteExport = (fileContents: string, httpMethod: HttpMethod) => {
  return new RegExp(
    `export (async )?(function ${httpMethod} ?\\(|const ${httpMethod} ?=|\\{[^}]*\\b${httpMethod}\\b[^}]*\\} ?=|const \\{[^}]*\\b${httpMethod}\\b[^}]*\\} ?=|\\{[^}]*\\b${httpMethod}\\b[^}]*\\} from)`,
  ).test(fileContents);
};

export const scanEndpointFile = (
  outputFile: string,
  inputFile: string,
): {
  query?: ScanDefinition<(typeof QUERY_TYPES)[number]>;
  routes: ScanDefinition<HttpMethod>[];
} => {
  const fileContents = fs.readFileSync(inputFile, "utf8");

  const queryExport = findQueryExport(fileContents);
  const query = queryExport
    ? buildDefinition(outputFile, inputFile, queryExport, (_, importAlias) =>
        createRecodeType(TYPE_KEY_QUERY, importAlias),
      )
    : undefined;

  const routes = HTTP_METHODS_EXCLUDE_OPTIONS.filter((method) =>
    hasRouteExport(fileContents, method),
  ).map((method) =>
    buildDefinition(outputFile, inputFile, method, (type, importAlias) =>
      createObjectType([
        { name: `$${type.toLowerCase()}`, type: `typeof ${importAlias}` },
      ]),
    ),
  );

  return {
    ...(query ? { query } : {}),
    routes,
  };
};

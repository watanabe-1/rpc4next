import fs from "node:fs";
import { HTTP_METHODS_EXCLUDE_OPTIONS } from "rpc4next-shared";
import type { HttpMethod } from "rpc4next-shared";

import { createImportAlias } from "./alias.js";
import type { ImportAliasName } from "./alias.js";
import { QUERY_TYPES, TYPE_KEY_QUERY, TYPE_PROCEDURE_QUERY_INPUT } from "./constants.js";
import { createRelativeImportPath } from "./path-utils.js";
import {
  createDefaultImport,
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

type QueryScanDefinition = ScanDefinition<(typeof QUERY_TYPES)[number] | "Page">;

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
    new RegExp(`export (interface ${type} ?{|type ${type} ?=)`).test(fileContents),
  );
};

const hasDefaultPageQueryProcedure = (inputFile: string, fileContents: string) => {
  return (
    /[/\\]page\.tsx$/.test(inputFile) &&
    /\bexport\s+default\b/.test(fileContents) &&
    /\.query\s*\(/.test(fileContents) &&
    /\.nextPage\s*\(/.test(fileContents)
  );
};

const hasRouteExport = (fileContents: string, httpMethod: HttpMethod) => {
  const exportPatterns = [
    `async\\s+function\\s+${httpMethod}\\s*\\(`,
    `function\\s+${httpMethod}\\s*\\(`,
    `const\\s+${httpMethod}\\b\\s*(?::(?:[^=]|=>)*?)?=`,
    `const\\s+\\{[^}]*\\b${httpMethod}\\b[^}]*\\}\\s*=`,
    `\\{[^}]*\\b${httpMethod}\\b[^}]*\\}(?:\\s+from)?`,
  ];

  return new RegExp(`export\\s+(?:${exportPatterns.join("|")})`).test(fileContents);
};

export const scanEndpointFile = (
  outputFile: string,
  inputFile: string,
): {
  query?: QueryScanDefinition;
  routes: ScanDefinition<HttpMethod>[];
} => {
  const fileContents = fs.readFileSync(inputFile, "utf8");

  const queryExport = findQueryExport(fileContents);
  const query = queryExport
    ? buildDefinition(outputFile, inputFile, queryExport, (_, importAlias) =>
        createRecodeType(TYPE_KEY_QUERY, importAlias),
      )
    : hasDefaultPageQueryProcedure(inputFile, fileContents)
      ? (() => {
          const relativeImportPath = createRelativeImportPath(outputFile, inputFile);
          const importAlias = createImportAlias(relativeImportPath, "Page");

          return {
            importName: importAlias,
            importPath: relativeImportPath,
            importStatement: createDefaultImport(relativeImportPath, importAlias),
            type: createRecodeType(
              TYPE_KEY_QUERY,
              `${TYPE_PROCEDURE_QUERY_INPUT}<typeof ${importAlias}>`,
            ),
            exportName: "Page" as const,
          };
        })()
      : undefined;

  const routes = HTTP_METHODS_EXCLUDE_OPTIONS.filter((method) =>
    hasRouteExport(fileContents, method),
  ).map((method) =>
    buildDefinition(outputFile, inputFile, method, (type, importAlias) =>
      createObjectType([{ name: `$${type.toLowerCase()}`, type: `typeof ${importAlias}` }]),
    ),
  );

  return {
    ...(query ? { query } : {}),
    routes,
  };
};

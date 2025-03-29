import fs from "fs";
import { cntCache } from "./cache";
import {
  QUERY_TYPES,
  TYPE_KEY_QUERY,
  TYPE_KEY_OPTIONAL_QUERY,
} from "./constants";
import { createRelativeImportPath } from "./path-utils";
import { createImport, createRecodeType, createObjectType } from "./type-utils";
import { HttpMethod } from "../lib/types";

// 連番付与
export const createImportAlias = (type: string, key: string) => {
  if (!cntCache[key]) {
    cntCache[key] = 0;
  }

  return `${type}_${cntCache[key]++}`;
};

export const scanFile = <T extends string | undefined>(
  outputFile: string,
  inputFile: string,
  findCallBack: (fileContents: string) => T,
  typeCallBack: (type: NonNullable<T>, importAlias: string) => string
) => {
  const fileContents = fs.readFileSync(inputFile, "utf8");

  const type = findCallBack(fileContents);

  if (!type) return;

  const relativeImportPath = createRelativeImportPath(outputFile, inputFile);

  const importAlias = createImportAlias(type, type);

  return {
    importName: importAlias,
    importPath: relativeImportPath,
    importStatement: createImport(type, relativeImportPath, importAlias),
    type: typeCallBack(type, importAlias),
  };
};

// query定義作成
export const scanQuery = (outputFile: string, inputFile: string) => {
  return scanFile(
    outputFile,
    inputFile,
    (fileContents) => {
      return QUERY_TYPES.find((type) =>
        new RegExp(`export (interface ${type} ?{|type ${type} ?=)`).test(
          fileContents
        )
      );
    },
    (type, importAlias) =>
      type === "Query"
        ? createRecodeType(TYPE_KEY_QUERY, importAlias)
        : createRecodeType(TYPE_KEY_OPTIONAL_QUERY, importAlias)
  );
};

// route定義作成
export const scanRoute = (
  outputFile: string,
  inputFile: string,
  httpMethod: HttpMethod
) => {
  return scanFile(
    outputFile,
    inputFile,
    (fileContents) => {
      return [httpMethod].find((method) =>
        new RegExp(
          `export (async )?(function ${method} ?\\(|const ${method} ?=|\\{[^}]*\\b${method}\\b[^}]*\\} ?=|const \\{[^}]*\\b${method}\\b[^}]*\\} ?=|\\{[^}]*\\b${method}\\b[^}]*\\} from)`
        ).test(fileContents)
      );
    },
    (type, importAlias) =>
      createObjectType([
        { name: `$${type.toLowerCase()}`, type: `typeof ${importAlias}` },
      ])
  );
};

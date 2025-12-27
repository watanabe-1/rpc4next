import fs from "fs";
import { HttpMethod } from "rpc4next/lib/types";
import { createImportAlias } from "./alias";
import { QUERY_TYPES, TYPE_KEY_QUERY } from "./constants";
import { createRelativeImportPath } from "./path-utils";
import { createImport, createRecodeType, createObjectType } from "./type-utils";

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

  const importAlias = createImportAlias(relativeImportPath, type);

  return {
    importName: importAlias,
    importPath: relativeImportPath,
    importStatement: createImport(type, relativeImportPath, importAlias),
    type: typeCallBack(type, importAlias),
  };
};

// Create query definitions
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
    (_, importAlias) => createRecodeType(TYPE_KEY_QUERY, importAlias)
  );
};

// Create route definitions
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

/*!
 * Inspired by pathpida (https://github.com/aspida/pathpida),
 * especially the design and UX of its CLI.
 */

import fs from "fs";
import path from "path";

import {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHODS_EXCLUDE_OPTIONS,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared/constants";
import { END_POINT_FILE_NAMES } from "../constants";
import { scanAppDirCache, visitedDirsCache } from "./cache";
import { INDENT, NEWLINE, TYPE_END_POINT, TYPE_KEY_PARAMS } from "./constants";
import { toPosixPath } from "./path-utils";
import { scanQuery, scanRoute } from "./scan-utils";
import { createObjectType, createRecodeType } from "./type-utils";
import type { EndPointFileNames } from "../types";
import type { HttpMethod } from "rpc4next-shared/types";

type ImportObj = {
  statement: string;
  path: string;
};

type ParamsType = {
  paramsType: string;
  dirPath: string;
};

const endPointFileNames = new Set(END_POINT_FILE_NAMES);

export const hasTargetFiles = (dirPath: string): boolean => {
  if (visitedDirsCache.has(dirPath)) return visitedDirsCache.get(dirPath)!;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const { name } = entry;
    const entryPath = path.join(dirPath, name);

    if (
      name === "node_modules" ||
      // private
      name.startsWith("_") ||
      // intercepts
      name.startsWith("(.)") ||
      name.startsWith("(..)") ||
      name.startsWith("(...)")
    ) {
      visitedDirsCache.set(dirPath, false);

      return false;
    }

    if (entry.isFile() && endPointFileNames.has(name as EndPointFileNames)) {
      visitedDirsCache.set(dirPath, true);

      return true;
    }

    if (entry.isDirectory() && hasTargetFiles(entryPath)) {
      visitedDirsCache.set(dirPath, true);

      return true;
    }
  }

  visitedDirsCache.set(dirPath, false);

  return false;
};

const extractParamInfo = (
  entryName: string,
  {
    isDynamic,
    isCatchAll,
    isOptionalCatchAll,
  }: { isDynamic: boolean; isCatchAll: boolean; isOptionalCatchAll: boolean }
): { paramName: string; keyName: string } => {
  let param = entryName;

  // Remove brackets if it's a dynamic segment
  if (isDynamic) {
    param = param.replace(/^\[+|\]+$/g, "");
  }

  // Remove leading "..." if it's a catch-all segment
  if (isCatchAll || isOptionalCatchAll) {
    param = param.replace(/^\.{3}/, "");
  }

  const prefix = isOptionalCatchAll
    ? OPTIONAL_CATCH_ALL_PREFIX
    : isCatchAll
      ? CATCH_ALL_PREFIX
      : isDynamic
        ? DYNAMIC_PREFIX
        : "";

  return { paramName: param, keyName: `${prefix}${param}` };
};

export const scanAppDir = (
  output: string,
  input: string,
  indent = "",
  parentParams: {
    paramName: string;
    routeType: {
      isDynamic: boolean;
      isCatchAll: boolean;
      isOptionalCatchAll: boolean;
      isGroup: boolean;
      isParallel: boolean;
    };
  }[] = []
): {
  pathStructure: string;
  imports: ImportObj[];
  paramsTypes: ParamsType[];
} => {
  if (scanAppDirCache.has(input)) return scanAppDirCache.get(input)!;

  const previousIndent = indent;
  const currentIndent = indent + INDENT;
  const pathStructures: string[] = [];
  const imports: ImportObj[] = [];
  const typeFragments: string[] = [];
  const paramsTypes: ParamsType[] = [];
  const params = [...parentParams];

  // Get entries under the directory (only target files or directories) and sort them
  const entries = fs
    .readdirSync(input, { withFileTypes: true })
    .filter((entry) => {
      if (entry.isDirectory()) {
        const dirPath = path.join(input, entry.name);

        return hasTargetFiles(dirPath);
      }

      return endPointFileNames.has(entry.name as EndPointFileNames);
    })
    .sort();

  for (const entry of entries) {
    const fullPath = toPosixPath(path.join(input, entry.name));

    if (entry.isDirectory()) {
      const entryName = entry.name;
      const isGroup = entryName.startsWith("(") && entryName.endsWith(")");
      const isParallel = entryName.startsWith("@");
      const isOptionalCatchAll =
        entryName.startsWith("[[...") && entryName.endsWith("]]");
      const isCatchAll =
        entryName.startsWith("[...") && entryName.endsWith("]");
      const isDynamic = entryName.startsWith("[") && entryName.endsWith("]");

      const { paramName, keyName } = extractParamInfo(entryName, {
        isDynamic,
        isCatchAll,
        isOptionalCatchAll,
      });

      // If it's a dynamic segment, inherit the parameters
      const nextParams =
        isDynamic || isCatchAll || isOptionalCatchAll
          ? [
              ...params,
              {
                paramName,
                routeType: {
                  isDynamic,
                  isCatchAll,
                  isOptionalCatchAll,
                  isGroup,
                  isParallel,
                },
              },
            ]
          : params;

      const isSkipDir = isGroup || isParallel;

      const {
        pathStructure: childPathStructure,
        imports: childImports,
        paramsTypes: childParamsTypes,
      } = scanAppDir(
        output,
        fullPath,
        isSkipDir ? previousIndent : currentIndent,
        nextParams
      );

      imports.push(...childImports);
      paramsTypes.push(...childParamsTypes);

      if (isSkipDir) {
        // Extract only the inner part inside `{}` from the child output
        const match = childPathStructure.match(/^\s*\{([\s\S]*)\}\s*$/);
        if (match) {
          pathStructures.push(`${currentIndent}${match[1].trim()}`);
        }
      } else {
        pathStructures.push(
          `${currentIndent}"${keyName}": ${childPathStructure}`
        );
      }
    } else {
      // Process endpoint file
      const queryDef = scanQuery(output, fullPath);
      if (queryDef) {
        const { importStatement, importPath, type } = queryDef;
        imports.push({ statement: importStatement, path: importPath });
        typeFragments.push(type);
      }

      // Process routes for each HTTP method (excluding OPTIONS)
      HTTP_METHODS_EXCLUDE_OPTIONS.forEach((method: HttpMethod) => {
        const routeDef = scanRoute(output, fullPath, method);
        if (routeDef) {
          const { importStatement, importPath, type } = routeDef;
          imports.push({ statement: importStatement, path: importPath });
          typeFragments.push(type);
        }
      });

      // Add endpoint type
      typeFragments.push(TYPE_END_POINT);

      // If parameters exist, generate their type definition
      if (params.length > 0) {
        const fields = params.map(({ paramName, routeType }) => {
          const paramType = routeType.isCatchAll
            ? "string[]"
            : routeType.isOptionalCatchAll
              ? "string[] | undefined"
              : "string";

          return { name: paramName, type: paramType };
        });
        const paramsTypeStr = createObjectType(fields);
        paramsTypes.push({
          paramsType: paramsTypeStr,
          dirPath: path.dirname(fullPath),
        });
        typeFragments.push(createRecodeType(TYPE_KEY_PARAMS, paramsTypeStr));
      }
    }
  }

  // Combine all type definitions
  const typeString = typeFragments.join(" & ");

  // Construct the nested path structure
  const pathStructureBody =
    pathStructures.length > 0
      ? `{${NEWLINE}${pathStructures.join(`,${NEWLINE}`)}${NEWLINE}${previousIndent}}`
      : "";

  const pathStructure =
    typeString && pathStructureBody
      ? `${typeString} & ${pathStructureBody}`
      : typeString || pathStructureBody;

  const result = {
    pathStructure,
    imports,
    paramsTypes,
  };

  // Cache the result for reuse
  scanAppDirCache.set(input, result);

  return result;
};

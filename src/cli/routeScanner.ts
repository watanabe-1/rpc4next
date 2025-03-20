import fs from "fs";
import path from "path";

import {
  INDENT,
  TYPE_END_POINT,
  TYPE_KEY_PARAMS,
  NEWLINE,
  END_POINT_FILE_NAMES,
} from "./constants";
import { scanQuery, scanRoute } from "./scanUtils";
import { createObjectType, createRecodeType } from "./typeUtils";
import {
  OPTIONAL_CATCH_ALL_PREFIX,
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  HTTP_METHODS_EXCLUDE_OPTIONS,
} from "../lib/constants";
import type { EndPointFileNames } from "./types";

const endPointFileNames = new Set(END_POINT_FILE_NAMES);
const visitedDirs = new Map<string, boolean>();

export const hasTargetFiles = (dirPath: string): boolean => {
  // Return cached result if available
  if (visitedDirs.has(dirPath)) return visitedDirs.get(dirPath)!;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const { name } = entry;
    const entryPath = path.join(dirPath, name);

    if (
      name === "node_modules" ||
      // privete
      name.startsWith("_") ||
      // intercepts
      name.startsWith("(.)") ||
      name.startsWith("(..)") ||
      name.startsWith("(...)")
    ) {
      visitedDirs.set(dirPath, false);

      return false;
    }

    if (entry.isFile() && endPointFileNames.has(name as EndPointFileNames)) {
      visitedDirs.set(dirPath, true);

      return true;
    }

    if (entry.isDirectory()) {
      if (hasTargetFiles(entryPath)) {
        visitedDirs.set(dirPath, true);

        return true;
      }
    }
  }

  visitedDirs.set(dirPath, false);

  return false;
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
) => {
  indent += INDENT;
  const pathStructures: string[] = [];
  const imports: { statement: string; path: string }[] = [];
  const types: string[] = [];
  const params = [...parentParams];

  const entries = fs
    .readdirSync(input, { withFileTypes: true })
    .filter((entry) => {
      const { name } = entry;
      if (entry.isDirectory()) {
        const dirPath = path.join(input, name);

        return hasTargetFiles(dirPath);
      }

      return endPointFileNames.has(entry.name as EndPointFileNames);
    })
    .sort();

  entries.forEach((entry) => {
    const fullPath = path.join(input, entry.name);
    const nameWithoutExt = entry.isFile()
      ? entry.name.replace(/\.[^/.]+$/, "")
      : entry.name;

    if (entry.isDirectory()) {
      const isGroup =
        nameWithoutExt.startsWith("(") && nameWithoutExt.endsWith(")");
      const isParallel = nameWithoutExt.startsWith("@");
      const isOptionalCatchAll =
        nameWithoutExt.startsWith("[[...") && nameWithoutExt.endsWith("]]");
      const isCatchAll =
        nameWithoutExt.startsWith("[...") && nameWithoutExt.endsWith("]");
      const isDynamic =
        nameWithoutExt.startsWith("[") && nameWithoutExt.endsWith("]");

      const { paramName, keyName } = (() => {
        let param = nameWithoutExt;
        // Remove []
        if (isDynamic) {
          param = param.replace(/^\[+|\]+$/g, "");
        }
        // Remove ...
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
      })();

      if (isDynamic || isCatchAll || isOptionalCatchAll) {
        const routeType = {
          isGroup,
          isParallel,
          isOptionalCatchAll,
          isCatchAll,
          isDynamic,
        };

        params.push({ paramName, routeType });
      }

      const isSkipDir = isGroup || isParallel;

      const { pathStructure: child, imports: childQueries } = scanAppDir(
        output,
        fullPath,
        isSkipDir ? indent.replace(INDENT, "") : indent,
        [...params]
      );

      imports.push(...childQueries);

      if (isSkipDir) {
        // Extract the contents inside {}
        const match = child.match(/^\s*\{([\s\S]*)\}\s*$/);
        const childStr = match ? match[1].trim() : null;
        if (childStr) {
          pathStructures.push(`${indent}${childStr}`);
        }
      } else {
        pathStructures.push(`${indent}"${keyName}": ${child}`);
      }
    } else {
      const queryDef = scanQuery(output, fullPath);
      if (queryDef) {
        const { importStatement: statement, importPath: path, type } = queryDef;
        imports.push({ statement, path });
        types.push(type);
      }

      HTTP_METHODS_EXCLUDE_OPTIONS.forEach((method) => {
        const routeDef = scanRoute(output, fullPath, method);
        if (routeDef) {
          const {
            importStatement: statement,
            importPath: path,
            type,
          } = routeDef;
          imports.push({ statement, path });
          types.push(type);
        }
      });

      types.push(TYPE_END_POINT);

      if (params.length > 0) {
        const fields = params.map((param) => {
          const { paramName, routeType } = param;
          const { isCatchAll, isOptionalCatchAll } = routeType;
          const paramType = isCatchAll
            ? "string[]"
            : isOptionalCatchAll
              ? "string[] | undefined"
              : "string";

          return { name: paramName, type: paramType };
        });

        const paramsType = createObjectType(fields);
        types.push(createRecodeType(TYPE_KEY_PARAMS, paramsType));
      }
    }
  });

  const typeString = types.join(" & ");
  const pathStructure =
    pathStructures.length > 0
      ? `${typeString}${
          typeString ? " & " : ""
        }{${NEWLINE}${pathStructures.join(
          `,${NEWLINE}`
        )}${NEWLINE}${indent.replace(INDENT, "")}}`
      : typeString;

  return {
    pathStructure,
    imports,
  };
};

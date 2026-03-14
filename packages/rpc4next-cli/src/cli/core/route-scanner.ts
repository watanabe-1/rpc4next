/*!
 * Inspired by pathpida (https://github.com/aspida/pathpida),
 * especially the design and UX of its CLI.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared";
import { END_POINT_FILE_NAMES } from "../constants.js";
import type { EndPointFileNames } from "../types.js";
import { scanAppDirCache, visitedDirsCache } from "./cache.js";
import {
  INDENT,
  NEWLINE,
  TYPE_END_POINT,
  TYPE_KEY_PARAMS,
} from "./constants.js";
import { toPosixPath } from "./path-utils.js";
import { scanEndpointFile } from "./scan-utils.js";
import { createObjectType, createRecodeType } from "./type-utils.js";

type ImportObj = {
  statement: string;
  path: string;
};

type ParamsType = {
  paramsType: string;
  dirPath: string;
};

const endPointFileNames = new Set(END_POINT_FILE_NAMES);

const INTERCEPTING_SEGMENT_PREFIXES = ["(..)(..)", "(...)", "(..)", "(.)"];

const isInterceptingSegment = (entryName: string): boolean => {
  return INTERCEPTING_SEGMENT_PREFIXES.some((prefix) =>
    entryName.startsWith(prefix),
  );
};

const stripInterceptingSegmentPrefix = (entryName: string): string => {
  let segmentName = entryName;

  while (true) {
    const prefix = INTERCEPTING_SEGMENT_PREFIXES.find((candidate) =>
      segmentName.startsWith(candidate),
    );

    if (!prefix) {
      return segmentName;
    }

    segmentName = segmentName.slice(prefix.length);
  }
};

const decodeStaticSegment = (entryName: string): string => {
  try {
    const decoded = decodeURIComponent(entryName);

    return decoded.startsWith("_") ? entryName : decoded;
  } catch {
    return entryName;
  }
};

const getDirectoryMeta = (entryName: string) => {
  const isIntercept = isInterceptingSegment(entryName);
  const segmentName = isIntercept
    ? stripInterceptingSegmentPrefix(entryName)
    : entryName;
  const isGroup =
    !isIntercept && segmentName.startsWith("(") && segmentName.endsWith(")");
  const isParallel = !isIntercept && segmentName.startsWith("@");
  const isOptionalCatchAll =
    segmentName.startsWith("[[...") && segmentName.endsWith("]]");
  const isCatchAll =
    !isOptionalCatchAll &&
    segmentName.startsWith("[...") &&
    segmentName.endsWith("]");
  const isDynamic = segmentName.startsWith("[") && segmentName.endsWith("]");
  const isPrivate = !isIntercept && segmentName.startsWith("_");
  const staticKeyName = decodeStaticSegment(segmentName);

  return {
    isCatchAll,
    isDynamic,
    isGroup,
    isIntercept,
    isOptionalCatchAll,
    isParallel,
    isPrivate,
    segmentName,
    staticKeyName,
  };
};

export const hasTargetFiles = (dirPath: string): boolean => {
  const cachedHasTargetFiles = visitedDirsCache.get(dirPath);
  if (cachedHasTargetFiles !== undefined) return cachedHasTargetFiles;

  const dirName = path.basename(dirPath);
  const dirMeta = getDirectoryMeta(dirName);
  if (dirName === "node_modules" || dirMeta.isPrivate) {
    visitedDirsCache.set(dirPath, false);

    return false;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const { name } = entry;
    const entryPath = path.join(dirPath, name);
    const entryMeta = getDirectoryMeta(name);

    if (name === "node_modules" || entryMeta.isPrivate) {
      continue;
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
  }: { isDynamic: boolean; isCatchAll: boolean; isOptionalCatchAll: boolean },
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
  }[] = [],
): {
  pathStructure: string;
  imports: ImportObj[];
  paramsTypes: ParamsType[];
} => {
  const cachedScanResult = scanAppDirCache.get(input);
  if (cachedScanResult !== undefined) return cachedScanResult;

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
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = toPosixPath(path.join(input, entry.name));

    if (entry.isDirectory()) {
      const entryName = entry.name;
      const {
        isGroup,
        isParallel,
        isOptionalCatchAll,
        isCatchAll,
        isDynamic,
        isPrivate,
        isIntercept,
        segmentName,
        staticKeyName,
      } = getDirectoryMeta(entryName);

      if (isPrivate) {
        continue;
      }

      const { paramName, keyName } = extractParamInfo(segmentName, {
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
        nextParams,
      );

      paramsTypes.push(...childParamsTypes);

      if (isIntercept) {
        continue;
      }

      imports.push(...childImports);

      if (isSkipDir) {
        // Extract only the inner part inside `{}` from the child output
        const match = childPathStructure.match(/^\s*\{([\s\S]*)\}\s*$/);
        const trimmedChildPathStructure = childPathStructure.trim();
        if (!childPathStructure) {
          continue;
        }

        if (match) {
          pathStructures.push(`${currentIndent}${match[1].trim()}`);
        } else if (trimmedChildPathStructure) {
          // Preserve non-object child structures (e.g. "Endpoint")
          typeFragments.push(trimmedChildPathStructure);
        } else {
          throw new Error(
            `Invalid empty child path structure in grouped/parallel route: ${fullPath}`,
          );
        }
      } else {
        if (!childPathStructure.trim()) {
          continue;
        }

        const segmentKeyName =
          isDynamic || isCatchAll || isOptionalCatchAll
            ? keyName
            : staticKeyName;
        pathStructures.push(
          `${currentIndent}"${segmentKeyName}": ${childPathStructure}`,
        );
      }
    } else {
      // Process endpoint file
      const { query: queryDef, routes } = scanEndpointFile(output, fullPath);
      if (queryDef) {
        const { importStatement, importPath, type } = queryDef;
        imports.push({ statement: importStatement, path: importPath });
        typeFragments.push(type);
      }

      // Process routes for each HTTP method (excluding OPTIONS)
      routes.forEach((routeDef) => {
        const { importStatement, importPath, type } = routeDef;
        imports.push({ statement: importStatement, path: importPath });
        typeFragments.push(type);
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

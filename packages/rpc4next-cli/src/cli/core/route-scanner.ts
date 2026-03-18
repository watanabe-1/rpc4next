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
  TYPE_KEY_PARAMS,
  TYPE_RPC_ENDPOINT,
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

type RouteType = {
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isGroup: boolean;
  isParallel: boolean;
};

type ParentParam = {
  paramName: string;
  routeType: RouteType;
};

type DirectoryMeta = ReturnType<typeof getDirectoryMeta>;

type ScanResult = {
  pathStructure: string;
  imports: ImportObj[];
  paramsTypes: ParamsType[];
};

type ScanContext = {
  output: string;
  previousIndent: string;
  currentIndent: string;
  params: ParentParam[];
};

type ScanAccumulator = {
  pathStructures: string[];
  imports: ImportObj[];
  typeFragments: string[];
  paramsTypes: ParamsType[];
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

const createEmptyScanAccumulator = (): ScanAccumulator => ({
  pathStructures: [],
  imports: [],
  typeFragments: [],
  paramsTypes: [],
});

const isIgnoredDirectory = (dirName: string): boolean => {
  return dirName === "node_modules" || getDirectoryMeta(dirName).isPrivate;
};

const getScannableEntries = (dirPath: string) => {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => {
      if (entry.isDirectory()) {
        return hasTargetFiles(path.join(dirPath, entry.name));
      }

      return endPointFileNames.has(entry.name as EndPointFileNames);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const hasTargetFiles = (dirPath: string): boolean => {
  const cachedHasTargetFiles = visitedDirsCache.get(dirPath);
  if (cachedHasTargetFiles !== undefined) return cachedHasTargetFiles;

  const dirName = path.basename(dirPath);
  if (isIgnoredDirectory(dirName)) {
    visitedDirsCache.set(dirPath, false);

    return false;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const { name } = entry;
    const entryPath = path.join(dirPath, name);

    if (isIgnoredDirectory(name)) {
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
  routeType: Pick<RouteType, "isDynamic" | "isCatchAll" | "isOptionalCatchAll">,
): { paramName: string; keyName: string } => {
  let param = entryName;
  const { isDynamic, isCatchAll, isOptionalCatchAll } = routeType;

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

const appendParamsType = (
  accumulator: ScanAccumulator,
  params: ParentParam[],
  fullPath: string,
) => {
  if (params.length === 0) {
    return;
  }

  const fields = params.map(({ paramName, routeType }) => {
    const paramType = routeType.isCatchAll
      ? "string[]"
      : routeType.isOptionalCatchAll
        ? "string[] | undefined"
        : "string";

    return { name: paramName, type: paramType };
  });
  const paramsTypeStr = createObjectType(fields);

  accumulator.paramsTypes.push({
    paramsType: paramsTypeStr,
    dirPath: path.dirname(fullPath),
  });
  accumulator.typeFragments.push(
    createRecodeType(TYPE_KEY_PARAMS, paramsTypeStr),
  );
};

const appendEndpointFile = (
  accumulator: ScanAccumulator,
  context: Pick<ScanContext, "output" | "params">,
  fullPath: string,
) => {
  const { query: queryDef, routes } = scanEndpointFile(
    context.output,
    fullPath,
  );

  if (queryDef) {
    const { importStatement, importPath, type } = queryDef;
    accumulator.imports.push({ statement: importStatement, path: importPath });
    accumulator.typeFragments.push(type);
  }

  routes.forEach((routeDef) => {
    const { importStatement, importPath, type } = routeDef;
    accumulator.imports.push({ statement: importStatement, path: importPath });
    accumulator.typeFragments.push(type);
  });

  accumulator.typeFragments.push(TYPE_RPC_ENDPOINT);
  appendParamsType(accumulator, context.params, fullPath);
};

const mergeFlattenedChildPathStructure = (
  accumulator: ScanAccumulator,
  childPathStructure: string,
  fullPath: string,
  currentIndent: string,
) => {
  const match = childPathStructure.match(/^\s*\{([\s\S]*)\}\s*$/);
  const trimmedChildPathStructure = childPathStructure.trim();

  if (!childPathStructure) {
    return;
  }

  if (match) {
    accumulator.pathStructures.push(`${currentIndent}${match[1].trim()}`);

    return;
  }

  if (trimmedChildPathStructure) {
    accumulator.typeFragments.push(trimmedChildPathStructure);

    return;
  }

  throw new Error(
    `Invalid empty child path structure in grouped/parallel route: ${fullPath}`,
  );
};

const buildPathStructure = (
  typeFragments: string[],
  pathStructures: string[],
  previousIndent: string,
) => {
  const typeString = typeFragments.join(" & ");
  const pathStructureBody =
    pathStructures.length > 0
      ? `{${NEWLINE}${pathStructures.join(`,${NEWLINE}`)}${NEWLINE}${previousIndent}}`
      : "";

  return typeString && pathStructureBody
    ? `${typeString} & ${pathStructureBody}`
    : typeString || pathStructureBody;
};

const createNextParams = (
  params: ParentParam[],
  meta: DirectoryMeta,
): ParentParam[] => {
  if (!meta.isDynamic && !meta.isCatchAll && !meta.isOptionalCatchAll) {
    return params;
  }

  const { paramName } = extractParamInfo(meta.segmentName, meta);

  return [
    ...params,
    {
      paramName,
      routeType: {
        isDynamic: meta.isDynamic,
        isCatchAll: meta.isCatchAll,
        isOptionalCatchAll: meta.isOptionalCatchAll,
        isGroup: meta.isGroup,
        isParallel: meta.isParallel,
      },
    },
  ];
};

const appendChildDirectory = (
  accumulator: ScanAccumulator,
  context: ScanContext,
  fullPath: string,
  meta: DirectoryMeta,
) => {
  if (meta.isPrivate) {
    return;
  }

  const nextParams = createNextParams(context.params, meta);
  const isFlattenDir = meta.isGroup || meta.isParallel;
  const childIndent = isFlattenDir
    ? context.previousIndent
    : context.currentIndent;
  const childResult = scanAppDir(
    context.output,
    fullPath,
    childIndent,
    nextParams,
  );

  accumulator.paramsTypes.push(...childResult.paramsTypes);

  if (meta.isIntercept) {
    return;
  }

  accumulator.imports.push(...childResult.imports);

  if (isFlattenDir) {
    mergeFlattenedChildPathStructure(
      accumulator,
      childResult.pathStructure,
      fullPath,
      context.currentIndent,
    );

    return;
  }

  if (!childResult.pathStructure.trim()) {
    return;
  }

  const { keyName } = extractParamInfo(meta.segmentName, meta);
  const segmentKeyName =
    meta.isDynamic || meta.isCatchAll || meta.isOptionalCatchAll
      ? keyName
      : meta.staticKeyName;

  accumulator.pathStructures.push(
    `${context.currentIndent}"${segmentKeyName}": ${childResult.pathStructure}`,
  );
};

export const scanAppDir = (
  output: string,
  input: string,
  indent = "",
  parentParams: ParentParam[] = [],
): ScanResult => {
  const cachedScanResult = scanAppDirCache.get(input);
  if (cachedScanResult !== undefined) return cachedScanResult;

  const context: ScanContext = {
    output,
    previousIndent: indent,
    currentIndent: indent + INDENT,
    params: [...parentParams],
  };
  const accumulator = createEmptyScanAccumulator();
  const entries = getScannableEntries(input);

  for (const entry of entries) {
    const fullPath = toPosixPath(path.join(input, entry.name));

    if (entry.isDirectory()) {
      appendChildDirectory(
        accumulator,
        context,
        fullPath,
        getDirectoryMeta(entry.name),
      );
    } else {
      appendEndpointFile(accumulator, context, fullPath);
    }
  }

  const result = {
    pathStructure: buildPathStructure(
      accumulator.typeFragments,
      accumulator.pathStructures,
      context.previousIndent,
    ),
    imports: accumulator.imports,
    paramsTypes: accumulator.paramsTypes,
  };

  scanAppDirCache.set(input, result);

  return result;
};

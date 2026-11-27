import fs from "node:fs";
import path from "node:path";
import {
  CATCH_ALL_PREFIX,
  DYNAMIC_PREFIX,
  encodeRouteParamName,
  HTTP_METHOD_FUNC_KEYS,
  OPTIONAL_CATCH_ALL_PREFIX,
} from "rpc4next-shared";
import type { HttpMethod } from "rpc4next-shared";

import { END_POINT_FILE_NAMES } from "../constants.js";
import type { EndPointFileNames } from "../types.js";
import { createScanAppDirCacheKey, scanAppDirCache, visitedDirsCache } from "./cache.js";
import { INDENT, NEWLINE, TYPE_KEY_PARAMS, TYPE_RPC_ENDPOINT } from "./constants.js";
import { toPosixPath } from "./path-utils.js";
import { scanEndpointFile } from "./scan-utils.js";
import { createObjectType, createRecodeType, createStringLiteral } from "./type-utils.js";

type ImportObj = {
  statement: string;
  path: string;
};

type ParamsType = {
  paramsType: string;
  dirPath: string;
  pathname: string;
};

export type RouteManifest = {
  fullPath: string;
  methods: HttpMethod[];
  pathname: string;
};

export type PageManifest = {
  fullPath: string;
  pathname: string;
  queryExport?: "Query";
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

export type PathStructureNode = {
  typeFragments: string[];
  children: Map<string, PathStructureNode>;
};

type ScanResult = {
  wildcardExports?: { file: string; source: string }[];
  pathNode: PathStructureNode;
  pathStructure: string;
  imports: ImportObj[];
  paramsTypes: ParamsType[];
  pageManifests?: PageManifest[];
  routeManifests?: RouteManifest[];
};

type ScanContext = {
  output: string;
  rootDir: string;
  previousIndent: string;
  currentIndent: string;
  params: ParentParam[];
};

type ScanAccumulator = {
  wildcardExports: { file: string; source: string }[];
  children: Map<string, PathStructureNode>;
  imports: ImportObj[];
  typeFragments: string[];
  paramsTypes: ParamsType[];
  pageManifests: PageManifest[];
  routeManifests: RouteManifest[];
};

const endPointFileNames = new Set(END_POINT_FILE_NAMES);

const INTERCEPTING_SEGMENT_PREFIXES = ["(..)(..)", "(...)", "(..)", "(.)"];

const isInterceptingSegment = (entryName: string): boolean => {
  return INTERCEPTING_SEGMENT_PREFIXES.some((prefix) => entryName.startsWith(prefix));
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

const safeDecodeSegment = (entryName: string): string => {
  try {
    return decodeURIComponent(entryName);
  } catch {
    return entryName;
  }
};

const reservedStaticKeys = new Set<string>([
  "then",
  "$url",
  "$match",
  "$render",
  ...HTTP_METHOD_FUNC_KEYS,
]);

const getStaticSegmentKey = (entryName: string): string => {
  const decoded = safeDecodeSegment(entryName);

  // The proxy intercepts these keys; an encoded first character keeps the
  // static segment distinguishable while preserving its URL spelling.
  if (reservedStaticKeys.has(decoded)) {
    return `%${decoded.charCodeAt(0).toString(16).toUpperCase()}${decoded.slice(1)}`;
  }

  // The client accepts encoded static keys too. Preserve the original spelling
  // when decoding would leave an escape that the client could decode again.
  return decoded.startsWith("_") || /%[0-9A-Fa-f]{2}/.test(decoded) ? entryName : decoded;
};

const getDirectoryMeta = (entryName: string) => {
  const isIntercept = isInterceptingSegment(entryName);
  const segmentName = isIntercept ? stripInterceptingSegmentPrefix(entryName) : entryName;
  const isGroup = !isIntercept && segmentName.startsWith("(") && segmentName.endsWith(")");
  const isParallel = !isIntercept && segmentName.startsWith("@");
  const isOptionalCatchAll = segmentName.startsWith("[[...") && segmentName.endsWith("]]");
  const isCatchAll =
    !isOptionalCatchAll && segmentName.startsWith("[...") && segmentName.endsWith("]");
  const isDynamic = segmentName.startsWith("[") && segmentName.endsWith("]");
  const isPrivate = !isIntercept && segmentName.startsWith("_");
  const staticKeyName = getStaticSegmentKey(segmentName);

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
  wildcardExports: [],
  children: new Map(),
  imports: [],
  typeFragments: [],
  paramsTypes: [],
  pageManifests: [],
  routeManifests: [],
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

  return { paramName: param, keyName: prefix ? `${prefix}${encodeRouteParamName(param)}` : param };
};

const appendParamsType = (
  accumulator: ScanAccumulator,
  params: ParentParam[],
  fullPath: string,
  pathname: string,
) => {
  const fields = params.map(({ paramName, routeType }) => {
    const paramType = routeType.isCatchAll
      ? "string[]"
      : routeType.isOptionalCatchAll
        ? "string[] | undefined"
        : "string";

    return { name: paramName, type: paramType };
  });
  const paramsTypeStr = createObjectType(fields) || "{}";

  const dirPath = path.dirname(fullPath);
  const existingParamsType = accumulator.paramsTypes.find(
    (paramsType) => paramsType.dirPath === dirPath,
  );

  if (existingParamsType) {
    return;
  }

  accumulator.paramsTypes.push({
    paramsType: paramsTypeStr,
    dirPath,
    pathname,
  });

  if (fields.length > 0) {
    accumulator.typeFragments.push(createRecodeType(TYPE_KEY_PARAMS, paramsTypeStr));
  }
};

const toRoutePathname = (baseDir: string, fullPath: string): string => {
  const relativeDir = toPosixPath(path.relative(baseDir, path.dirname(fullPath)));
  const pathnameSegments: string[] = [];
  for (const segment of relativeDir.split("/").filter(Boolean)) {
    const meta = getDirectoryMeta(segment);

    if (meta.isGroup || meta.isParallel || meta.isPrivate) {
      continue;
    }

    if (meta.isIntercept) {
      const marker = INTERCEPTING_SEGMENT_PREFIXES.find((prefix) => segment.startsWith(prefix));
      if (marker === "(...)") pathnameSegments.length = 0;
      else if (marker === "(..)") pathnameSegments.splice(-1);
      else if (marker === "(..)(..)")
        pathnameSegments.splice(Math.max(0, pathnameSegments.length - 2));
    }
    if (meta.isDynamic || meta.isCatchAll || meta.isOptionalCatchAll) {
      pathnameSegments.push(meta.segmentName);
      continue;
    }

    // Encode each static segment independently so decoded slashes, percent
    // escapes and brackets cannot become route separators or parameters.
    pathnameSegments.push(encodeURIComponent(safeDecodeSegment(meta.segmentName)));
  }

  return pathnameSegments.length > 0 ? `/${pathnameSegments.join("/")}` : "/";
};

const appendEndpointFile = (
  accumulator: ScanAccumulator,
  context: Pick<ScanContext, "output" | "params" | "rootDir">,
  fullPath: string,
) => {
  const {
    page: pageDef,
    query: queryDef,
    routes,
    wildcardExports,
  } = scanEndpointFile(context.output, fullPath);
  accumulator.wildcardExports.push(
    ...wildcardExports.map((source) => ({ file: fullPath, source })),
  );

  if (queryDef) {
    const { importStatement, importPath, type } = queryDef;
    accumulator.imports.push({ statement: importStatement, path: importPath });
    accumulator.typeFragments.push(type);
  }

  if (pageDef) {
    accumulator.pageManifests.push({
      fullPath,
      pathname: toRoutePathname(context.rootDir, fullPath),
      ...(queryDef && queryDef.exportName !== "Page" ? { queryExport: queryDef.exportName } : {}),
    });
  }

  routes.forEach((routeDef) => {
    const { importStatement, importPath, type } = routeDef;
    accumulator.imports.push({ statement: importStatement, path: importPath });
    accumulator.typeFragments.push(type);
  });

  if (routes.length > 0) {
    accumulator.routeManifests.push({
      fullPath,
      methods: routes.map(({ exportName }) => exportName),
      pathname: toRoutePathname(context.rootDir, fullPath),
    });
  }

  accumulator.typeFragments.push(TYPE_RPC_ENDPOINT);
  appendParamsType(
    accumulator,
    context.params,
    fullPath,
    toRoutePathname(context.rootDir, fullPath),
  );
};

// Create merged nodes without mutating child results held in the scan cache.
const mergeFlattenedChildPathStructure = (target: PathStructureNode, child: PathStructureNode) => {
  target.typeFragments.push(...child.typeFragments);

  for (const [key, node] of child.children) {
    const existing = target.children.get(key);
    if (existing) {
      const merged = {
        typeFragments: [...existing.typeFragments],
        children: new Map(existing.children),
      };
      mergeFlattenedChildPathStructure(merged, node);
      target.children.set(key, merged);
    } else {
      target.children.set(key, node);
    }
  }
};

const buildPathStructure = (node: PathStructureNode, previousIndent: string): string => {
  const typeString = node.typeFragments.join(" & ");
  const currentIndent = previousIndent + INDENT;
  const pathStructures = [...node.children].map(
    ([key, child]) =>
      `${currentIndent}${createStringLiteral(key)}: ${buildPathStructure(child, currentIndent)}`,
  );
  const pathStructureBody =
    pathStructures.length > 0
      ? `{${NEWLINE}${pathStructures.join(`,${NEWLINE}`)}${NEWLINE}${previousIndent}}`
      : "";

  return typeString && pathStructureBody
    ? `${typeString} & ${pathStructureBody}`
    : typeString || pathStructureBody;
};

const createNextParams = (params: ParentParam[], meta: DirectoryMeta): ParentParam[] => {
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
  const childIndent = isFlattenDir ? context.previousIndent : context.currentIndent;
  const childResult = scanAppDir(
    context.output,
    fullPath,
    childIndent,
    nextParams,
    context.rootDir,
  );

  accumulator.paramsTypes.push(...childResult.paramsTypes);

  if (meta.isIntercept) {
    return;
  }

  accumulator.wildcardExports.push(...(childResult.wildcardExports ?? []));
  accumulator.routeManifests.push(...(childResult.routeManifests ?? []));
  accumulator.pageManifests.push(...(childResult.pageManifests ?? []));
  accumulator.imports.push(...childResult.imports);

  if (isFlattenDir) {
    mergeFlattenedChildPathStructure(accumulator, childResult.pathNode);

    return;
  }

  if (!childResult.pathStructure.trim()) {
    return;
  }

  const { keyName } = extractParamInfo(meta.segmentName, meta);
  const segmentKeyName =
    meta.isDynamic || meta.isCatchAll || meta.isOptionalCatchAll ? keyName : meta.staticKeyName;

  mergeFlattenedChildPathStructure(accumulator, {
    typeFragments: [],
    children: new Map([[segmentKeyName, childResult.pathNode]]),
  });
};

export const scanAppDir = (
  output: string,
  input: string,
  indent = "",
  parentParams: ParentParam[] = [],
  rootDir = input,
): ScanResult => {
  const cacheKey = createScanAppDirCacheKey({
    output,
    input,
    indent,
    rootDir,
    parentParams,
  });
  const cachedScanResult = scanAppDirCache.get(cacheKey);
  if (cachedScanResult !== undefined) return cachedScanResult;

  const context: ScanContext = {
    output,
    rootDir,
    previousIndent: indent,
    currentIndent: indent + INDENT,
    params: [...parentParams],
  };
  const accumulator = createEmptyScanAccumulator();
  const entries = getScannableEntries(input);

  for (const entry of entries) {
    const fullPath = toPosixPath(path.join(input, entry.name));

    if (entry.isDirectory()) {
      appendChildDirectory(accumulator, context, fullPath, getDirectoryMeta(entry.name));
    } else {
      appendEndpointFile(accumulator, context, fullPath);
    }
  }

  const result = {
    wildcardExports: accumulator.wildcardExports,
    pathNode: {
      typeFragments: accumulator.typeFragments,
      children: accumulator.children,
    },
    pathStructure: buildPathStructure(accumulator, context.previousIndent),
    imports: accumulator.imports,
    paramsTypes: accumulator.paramsTypes,
    pageManifests: accumulator.pageManifests,
    routeManifests: accumulator.routeManifests,
  };

  scanAppDirCache.set(cacheKey, result);

  return result;
};

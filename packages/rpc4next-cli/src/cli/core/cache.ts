import path from "node:path";
import type { scanAppDir } from "./route-scanner.js";

// Caches
export const visitedDirsCache = new Map<string, boolean>();
export const scanAppDirCache = new Map<string, ReturnType<typeof scanAppDir>>();

const normalizeCachePath = (targetPath: string): string => {
  return path.resolve(targetPath).replace(/\\/g, "/");
};

const SCAN_APP_DIR_CACHE_KEY_SEPARATOR = "\u0000";

export const createScanAppDirCacheKey = (
  scanContext: Record<string, unknown> & { input: string },
): string => {
  return [
    normalizeCachePath(scanContext.input),
    JSON.stringify({
      ...scanContext,
      input: normalizeCachePath(scanContext.input),
    }),
  ].join(SCAN_APP_DIR_CACHE_KEY_SEPARATOR);
};

const getCachePath = (cache: Map<string, unknown>, key: string): string => {
  if (cache === scanAppDirCache) {
    return key.split(SCAN_APP_DIR_CACHE_KEY_SEPARATOR, 1)[0] ?? key;
  }

  return key;
};

// Generic function to clear cache entries above a target path
const clearCacheAbove = (
  cache: Map<string, unknown>,
  targetPath: string,
): void => {
  const basePath = normalizeCachePath(targetPath);

  [...cache.keys()].forEach((key) => {
    const normalizedKey = normalizeCachePath(getCachePath(cache, key));
    if (
      normalizedKey === basePath ||
      basePath.startsWith(`${normalizedKey}/`)
    ) {
      cache.delete(key);
    }
  });
};

// Specific clear functions using the generic one
export const clearVisitedDirsCacheAbove = (targetPath: string): void => {
  clearCacheAbove(visitedDirsCache, targetPath);
};

export const clearScanAppDirCacheAbove = (targetPath: string): void => {
  clearCacheAbove(scanAppDirCache, targetPath);
};

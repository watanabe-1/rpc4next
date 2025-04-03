import path from "path";
import type { scanAppDir } from "./route-scanner";

// Caches
export const visitedDirsCache = new Map<string, boolean>();
export const scanAppDirCache = new Map<string, ReturnType<typeof scanAppDir>>();
export const cntCache: Record<string, number> = {};

// Clear count cache
export const clearCntCache = (): void => {
  Object.keys(cntCache).forEach((key) => {
    delete cntCache[key];
  });
};

// Generic function to clear cache entries above a target path
const clearCacheAbove = (
  cache: Map<string, unknown>,
  targetPath: string
): void => {
  const basePath = path.resolve(targetPath);

  [...cache.keys()].forEach((key) => {
    const normalizedKey = path.resolve(key);
    if (
      normalizedKey === basePath ||
      basePath.startsWith(normalizedKey + path.sep)
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

import path from "path";
import type { scanAppDir } from "./route-scanner";

export const visitedDirsCache = new Map<string, boolean>();
export const cntCache = {} as Record<string, number>;
export const scanAppDirCache = new Map<string, ReturnType<typeof scanAppDir>>();

export const clearCntCache = () => {
  Object.keys(cntCache).forEach((key) => delete cntCache[key]);
};

export const clearVisitedDirsCacheAbove = (targetPath: string) => {
  const basePath = path.resolve(targetPath);

  for (const key of visitedDirsCache.keys()) {
    const normalizedKey = path.resolve(key);
    if (
      normalizedKey === basePath ||
      basePath.startsWith(normalizedKey + path.sep)
    ) {
      visitedDirsCache.delete(key);
    }
  }
};

export const clearScanAppDirCache = (targetPath: string) => {
  const basePath = path.resolve(targetPath);

  for (const key of scanAppDirCache.keys()) {
    const normalizedKey = path.resolve(key);
    if (
      normalizedKey === basePath ||
      basePath.startsWith(normalizedKey + path.sep)
    ) {
      scanAppDirCache.delete(key);
    }
  }
};

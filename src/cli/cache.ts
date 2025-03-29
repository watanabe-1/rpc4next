import fs from "fs";
import path from "path";

export const visitedDirsCache = new Map<string, boolean>();
export const cntCache = {} as Record<string, number>;

export const clearCntCache = () => {
  Object.keys(cntCache).forEach((key) => delete cntCache[key]);
};

export const clearVisitedDirsCacheAbove = (targetPath: string) => {
  let basePath = path.resolve(targetPath);

  try {
    const stats = fs.statSync(basePath);
    if (stats.isFile()) {
      basePath = path.dirname(basePath);
    }
  } catch (_) {
    // nothing
  }

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

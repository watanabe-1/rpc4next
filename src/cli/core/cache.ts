import path from "path";

export const visitedDirsCache = new Map<string, boolean>();
export const cntCache = {} as Record<string, number>;

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

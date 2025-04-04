import chokidar from "chokidar";
import {
  clearScanAppDirCacheAbove,
  clearVisitedDirsCacheAbove,
} from "./core/cache";
import { debounceOnceRunningWithTrailing } from "./debounce";
import { Logger } from "./types";

export const setupWatcher = (
  baseDir: string,
  onGenerate: () => void,
  logger: Logger
) => {
  logger.info(`Watching ${baseDir}...`);

  const isTargetFiles = (path: string) =>
    path.endsWith("route.ts") || path.endsWith("page.tsx");

  const changedPaths = new Set<string>();

  // Once the debounced function starts executing, no new watcher events will be processed until it completes.
  // This is due to JavaScript's single-threaded event loop: the current debounced function runs to completion,
  // and any new change events are queued until the execution finishes.
  const debouncedGenerate = debounceOnceRunningWithTrailing(() => {
    changedPaths.forEach((path) => {
      clearVisitedDirsCacheAbove(path);
      clearScanAppDirCacheAbove(path);
    });
    changedPaths.clear();

    onGenerate();
  }, 300);

  const watcher = chokidar.watch(baseDir, {
    ignoreInitial: true,
    // If we exclude everything except files using ignored, the watch mode will terminate, so we added "only files" to the exclusion condition.
    ignored: (path, stats) => !!stats?.isFile() && !isTargetFiles(path),
  });

  watcher.on("ready", () => {
    watcher.on("all", (event, path) => {
      if (isTargetFiles(path)) {
        logger.info(`[${event}] ${path}`);
        changedPaths.add(path);
        debouncedGenerate();
      }
    });
  });
};

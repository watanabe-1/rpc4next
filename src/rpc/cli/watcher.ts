import chokidar from "chokidar";
import { END_POINT_FILE_NAMES } from "./constants";
import {
  clearScanAppDirCacheAbove,
  clearVisitedDirsCacheAbove,
} from "./core/cache";
import { relativeFromRoot } from "./core/path-utils";
import { debounceOnceRunningWithTrailing } from "./debounce";
import type { Logger } from "./types";

export const setupWatcher = (
  baseDir: string,
  onGenerate: () => void,
  logger: Logger
) => {
  logger.info(`${relativeFromRoot(baseDir)}`, {
    event: "watch",
  });

  const isTargetFiles = (path: string): boolean =>
    END_POINT_FILE_NAMES.some((fileName) => path.endsWith(fileName));

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
    // First execution
    debouncedGenerate();
    watcher.on("all", (event, filePath) => {
      if (isTargetFiles(filePath)) {
        const relativePath = relativeFromRoot(filePath);
        logger.info(relativePath, { event });
        changedPaths.add(filePath);
        debouncedGenerate();
      }
    });
  });

  watcher.on("error", (error) => {
    if (error instanceof Error) {
      logger.error(`Watcher error: ${error.message}`);
    } else {
      logger.error(`Unknown watcher error: ${String(error)}`);
    }
  });

  const cleanup = () => {
    watcher
      .close()
      .then(() => {
        logger.info("Watcher closed.", { event: "watch" });
      })
      .catch((err) => {
        logger.error(`Failed to close watcher: ${err.message}`);
      });
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
};

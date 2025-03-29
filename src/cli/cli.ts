#!/usr/bin/env node

import fs from "fs";
import path from "path";
import chalk from "chalk";
import chokidar from "chokidar";
import { Command } from "commander";
import { clearCntCache, clearVisitedDirsCacheAbove } from "./cache";
import { debounce } from "./cli-utils";
import { generatePages } from "./generate-path-structure";

const program = new Command();

program
  .description(
    "Generate RPC client type definitions based on the Next.js path structure."
  )
  .argument(
    "<baseDir>",
    "Base directory containing Next.js paths for type generation"
  )
  .argument("<outputPath>", "Output path for the generated type definitions")
  .option("-w, --watch", "Watch mode: regenerate on file changes")
  .action((baseDir: string, outputPath: string, options) => {
    const resolvedBaseDir = path.resolve(baseDir).replace(/\\/g, "/");
    const resolvedOutputPath = path.resolve(outputPath).replace(/\\/g, "/");

    const log = (msg: string) => {
      const time = new Date().toLocaleTimeString();
      console.log(`${chalk.gray(`[${time}]`)} ${msg}`);
    };

    const generate = () => {
      log(chalk.cyan("Generating..."));
      const outputContent = generatePages(resolvedOutputPath, resolvedBaseDir);
      fs.writeFileSync(resolvedOutputPath, outputContent);
      log(
        chalk.green(
          `RPC client type definitions generated at ${resolvedOutputPath}`
        )
      );
    };

    generate();

    if (options.watch) {
      log(chalk.yellow(`Watching ${resolvedBaseDir} for changes...`));
      const isTargetFiles = (path: string) =>
        path.endsWith("route.ts") || path.endsWith("page.tsx");

      const changedPaths = new Set<string>();

      // Once the debounced function starts executing, no new watcher events will be processed until it completes.
      // This is due to JavaScript's single-threaded event loop: the current debounced function runs to completion,
      // and any new change events are queued until the execution finishes.
      const debouncedGenerate = debounce(() => {
        changedPaths.forEach((path) => {
          clearVisitedDirsCacheAbove(path);
        });
        changedPaths.clear();

        clearCntCache();
        generate();
      }, 300);

      const watcher = chokidar.watch(resolvedBaseDir, {
        ignoreInitial: true,
        // If we exclude everything except files using ignored, the watch mode will terminate, so we added "only files" to the exclusion condition.
        ignored: (path, stats) => !!stats?.isFile() && !isTargetFiles(path),
      });

      watcher.on("ready", () => {
        watcher.on("all", (event, path) => {
          if (isTargetFiles(path)) {
            log(`${chalk.magenta(`[${event}]`)} ${chalk.blue(path)}`);
            changedPaths.add(path);
            debouncedGenerate();
          }
        });
      });
    }
  });

program.parse(process.argv);

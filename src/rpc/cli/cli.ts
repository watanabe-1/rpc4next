import { Command } from "commander";
import { handleCli } from "./cli-handler";
import { EXIT_FAILURE } from "./constants";
import { createLogger } from "./logger";
import { CliOptions, Logger } from "./types";

export const runCli = (argv: string[], logger: Logger = createLogger()) => {
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
    .option(
      "-p, --params-file [filename]",
      "Generate params types file with specified filename"
    )
    .action(
      async (baseDir: string, outputPath: string, options: CliOptions) => {
        try {
          const exitCode = await handleCli(
            baseDir,
            outputPath,
            options,
            logger
          );
          if (!options.watch) {
            process.exit(exitCode as number);
          }
        } catch (error) {
          logger.error(
            `Unexpected error occurred:${error instanceof Error ? error.message : String(error)}`
          );
          process.exit(EXIT_FAILURE as number);
        }
      }
    );

  program.parse(argv);
};

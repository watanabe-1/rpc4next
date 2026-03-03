import path from "node:path";
import { parseArgs } from "node:util";
import { handleCli } from "./cli-handler";
import { EXIT_FAILURE } from "./constants";
import { createLogger } from "./logger";
import type { CliOptions, Logger } from "./types";

/**
 * Normalize argv:
 * - If argv looks like process.argv (["node", "script", ...]) -> slice(2)
 * - If argv already looks like user args (["-w", ...]) -> keep as-is
 */
function normalizeUserArgs(argv: string[]): string[] {
  if (argv.length === 0) return [];

  // If the first arg starts with "-" it's almost certainly already user args.
  if (argv[0].startsWith("-")) return argv;

  // Only strip the first two tokens when argv clearly looks like process.argv.
  // Keep plain user args like ["src", "types.ts"] as-is.
  const runtimeToken = path.basename(argv[0]).toLowerCase();
  const knownRuntimes = new Set([
    "node",
    "node.exe",
    "bun",
    "bun.exe",
    "deno",
    "deno.exe",
  ]);
  if (knownRuntimes.has(runtimeToken) && argv.length >= 2) {
    return argv.slice(2);
  }

  return argv;
}

function printHelp(logger: Logger) {
  // Keep this simple (you can expand later if you want).
  const text = `
Generate RPC client type definitions based on the Next.js path structure.

Usage:
  rpc4next <baseDir> <outputPath> [options]

Arguments:
  baseDir       Base directory containing Next.js paths for type generation
  outputPath    Output path for the generated type definitions

Options:
  -w, --watch                   Watch mode: regenerate on file changes
  -p, --params-file [filename]  Generate params types file (optional filename)
  -h, --help                    Show help
`.trim();

  logger.info(text);
}

/**
 * Parse "-p/--params-file [filename]" where filename is OPTIONAL.
 * - If "-p" is provided without a value, set paramsFile = true.
 * - If "-p foo" is provided, set paramsFile = "foo".
 *
 * Note: util.parseArgs doesn't natively support "optional option value"
 * in the same way commander does, so we handle this flag manually.
 */
function extractOptionalValueFlag(
  args: string[],
  keys: string[],
): { args: string[]; value: true | string | undefined } {
  const out: string[] = [];
  let value: true | string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    // Support --params-file=foo
    let consumedByEqualsForm = false;
    for (const k of keys) {
      if (a.startsWith(k + "=")) {
        value = a.slice((k + "=").length) || true;
        consumedByEqualsForm = true;
        // do not push this arg (consumed)
        break;
      }
    }
    if (consumedByEqualsForm) continue;

    if (keys.includes(a)) {
      const next = args[i + 1];

      // If next token exists and is not another option, treat as value.
      if (typeof next === "string" && !next.startsWith("-")) {
        value = next;
        i++; // consume next
      } else {
        value = true;
      }
      continue; // consume current
    }

    out.push(a);
  }

  return { args: out, value };
}

export const runCli = (argv: string[], logger: Logger = createLogger()) => {
  try {
    const userArgs0 = normalizeUserArgs(argv);

    // Handle optional-value flag first (so parseArgs can stay strict/easy).
    const { args: userArgs1, value: paramsFileRaw } = extractOptionalValueFlag(
      userArgs0,
      ["-p", "--params-file"],
    );

    const { values, positionals } = parseArgs({
      args: userArgs1,
      options: {
        watch: { type: "boolean", short: "w" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
      strict: true,
    });

    if (values.help) {
      printHelp(logger);
      process.exit(0);
    }

    const baseDir = positionals[0];
    const outputPath = positionals[1];

    if (!baseDir || !outputPath) {
      logger.error("Missing required arguments: <baseDir> <outputPath>");
      printHelp(logger);
      process.exit(EXIT_FAILURE as number);
    }

    // Build CliOptions compatible with your existing handler.
    const options: CliOptions = {
      watch: Boolean(values.watch),
      // paramsFile semantics:
      // - undefined: not specified
      // - true: specified without filename
      // - string: specified with filename
      ...(paramsFileRaw !== undefined ? { paramsFile: paramsFileRaw } : {}),
    } as CliOptions;

    // Match your current behavior:
    // - in non-watch mode: exit with code
    // - in watch mode: do not exit (keep process alive)
    void (async () => {
      try {
        const exitCode = await handleCli(baseDir, outputPath, options, logger);
        if (!options.watch) {
          process.exit(exitCode as number);
        }
      } catch (error) {
        logger.error(
          `Unexpected error occurred:${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(EXIT_FAILURE as number);
      }
    })();
  } catch (error) {
    // parseArgs throws on unknown options in strict mode, etc.
    logger.error(
      error instanceof Error
        ? error.message
        : `Invalid arguments: ${String(error)}`,
    );
    printHelp(logger);
    process.exit(EXIT_FAILURE as number);
  }
};

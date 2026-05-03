import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE_NAME = "rpc4next.config.json";

export interface CliConfig {
  baseDir?: string;
  outputPath?: string;
  paramsFile?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const getConfigPath = (cwd = process.cwd()) => path.join(cwd, CONFIG_FILE_NAME);

export const loadCliConfig = (cwd = process.cwd()): CliConfig => {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown> | null;

  if (!raw || Array.isArray(raw)) {
    throw new Error(`${CONFIG_FILE_NAME} must contain a JSON object.`);
  }

  const config: CliConfig = {};

  if ("baseDir" in raw) {
    if (!isNonEmptyString(raw.baseDir)) {
      throw new Error(`${CONFIG_FILE_NAME} field "baseDir" must be a string.`);
    }
    config.baseDir = raw.baseDir;
  }

  if ("outputPath" in raw) {
    if (!isNonEmptyString(raw.outputPath)) {
      throw new Error(`${CONFIG_FILE_NAME} field "outputPath" must be a string.`);
    }
    config.outputPath = raw.outputPath;
  }

  if ("paramsFile" in raw) {
    if (!isNonEmptyString(raw.paramsFile)) {
      throw new Error(`${CONFIG_FILE_NAME} field "paramsFile" must be a string.`);
    }
    config.paramsFile = raw.paramsFile;
  }

  return config;
};

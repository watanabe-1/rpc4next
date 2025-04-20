import { styleText } from "node:util";
import { INDENT } from "./core/constants";
import type { Logger } from "./types";

const cyan = (text: string) => styleText(["cyan"], text);
const green = (text: string) => styleText(["green"], text);
const red = (text: string) => styleText(["red"], text);

export const padMessage = (
  label: string,
  value: string,
  separator = "→",
  targetLength = 24
) => {
  return label.padEnd(targetLength) + ` ${separator} ${value}`;
};

const createIndent = (level: number = 0) => INDENT.repeat(level);

export const createLogger = (): Logger => {
  return {
    info: (msg, options = {}) => {
      const { indentLevel = 0, event } = options;
      const prefix = event ? `${cyan(`[${event}]`)} ` : "";
      console.log(`${createIndent(indentLevel)}${prefix}${msg}`);
    },

    success: (msg, options = {}) => {
      const { indentLevel = 0 } = options;
      console.log(`${createIndent(indentLevel)}${green("✓")} ${msg}`);
    },

    error: (msg, options = {}) => {
      const { indentLevel = 0 } = options;
      console.error(`${createIndent(indentLevel)}${red("✗")} ${red(msg)}`);
    },
  };
};

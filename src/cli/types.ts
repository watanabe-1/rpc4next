import type { END_POINT_FILE_NAMES } from "./constants";

export type EndPointFileNames = (typeof END_POINT_FILE_NAMES)[number];

export interface CliOptions {
  watch?: boolean;
  paramsFile?: string;
}

type LogOptions = {
  indentLevel?: number;
  event?: string;
};

export interface Logger {
  info: (msg: string, options?: LogOptions) => void;
  success: (msg: string, options?: Pick<LogOptions, "indentLevel">) => void;
  error: (msg: string, options?: Pick<LogOptions, "indentLevel">) => void;
}

type BuildRange<
  N extends number,
  Result extends number[] = [],
> = Result["length"] extends N
  ? Result
  : BuildRange<N, [...Result, Result["length"]]>;

type NumericRange<F extends number, T extends number> =
  | Exclude<BuildRange<T>, BuildRange<F>>
  | F;

export type SuccessExitCode = 0;
export type ErrorExitCode = NumericRange<1, 256>;
export type ExitCode = SuccessExitCode | ErrorExitCode;

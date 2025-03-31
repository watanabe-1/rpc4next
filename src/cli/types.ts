export interface Logger {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
}

export interface CliOptions {
  watch?: boolean;
  paramsFile?: string;
}

import type { END_POINT_FILE_NAMES } from "./constants";

export type EndPointFileNames = (typeof END_POINT_FILE_NAMES)[number];

export interface Logger {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
}

import { ErrorExitCode, SuccessExitCode } from "./types";

export const END_POINT_FILE_NAMES = ["page.tsx", "route.ts"] as const;

export const EXIT_SUCCESS: SuccessExitCode = 0;
export const EXIT_FAILURE: ErrorExitCode = 1;

export const SUCCESS_INDENT_LEVEL = 1;
export const SUCCESS_PAD_LENGTH = 20;
export const SUCCESS_SEPARATOR = "→";

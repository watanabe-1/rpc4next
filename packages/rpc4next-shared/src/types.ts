import type { HTTP_METHODS } from "./constants";

export type HttpMethod = (typeof HTTP_METHODS)[number];

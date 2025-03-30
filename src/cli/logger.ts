import { Logger } from "./types";

export const createLogger = (): Logger => {
  return {
    info: (msg) => console.log(msg),
    success: (msg) => console.log(msg),
    error: (msg) => console.error(msg),
  };
};

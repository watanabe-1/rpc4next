import { z } from "zod";

export const searchQuerySchema = z
  .object({
    q: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .transform(({ q }) => ({
    q: Array.isArray(q) ? q[0] : q,
  }));

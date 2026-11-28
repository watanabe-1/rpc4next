import { z } from "zod";

export const querySchema = z.object({
  includePosts: z.enum(["true", "false"]).optional(),
});

export const paramsSchema = z.object({
  userId: z.string().min(1),
});

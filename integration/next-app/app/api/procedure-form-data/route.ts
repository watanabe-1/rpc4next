import { procedure } from "rpc4next/server";
import { z } from "zod";

import { onError } from "../_shared/on-error";
import { routeContract } from "./route-contract";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const { POST } = procedure
  .forRoute(routeContract)
  .formData(
    z.object({
      displayName: z.string().min(1).max(80),
      avatar: z
        .instanceof(File)
        .refine((file) => file.size <= MAX_AVATAR_BYTES, "Avatar file is too large.")
        .refine(
          (file) =>
            ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number]),
          "Avatar file type is not supported.",
        ),
      tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    }),
  )
  .output({
    _output: {
      ok: true as const,
      displayName: "" as string,
      filename: "" as string,
      tags: [] as string[],
      source: "procedure-form-data" as const,
    },
  })
  .handle(async ({ formData }) => ({
    status: 200,
    body: {
      ok: true,
      displayName: formData.displayName,
      filename: formData.avatar.name,
      tags: formData.tags ?? [],
      source: "procedure-form-data",
    },
  }))
  .nextRoute({ method: "POST", onError });

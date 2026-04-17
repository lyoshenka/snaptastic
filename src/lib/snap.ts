import { Result, err as nerr, ok } from "neverthrow";
import {
  MEDIA_TYPE,
  SPEC_VERSION_2,
  validateSnapResponse,
  type SnapResponse,
  type SnapHandlerResult,
} from "@farcaster/snap";
import { err, type AppError } from "./errors";
import type { Aspect } from "./image";

export const SNAP_MEDIA_TYPE = MEDIA_TYPE;

export type SnapInput = {
  blurredUrl: string;
  aspect: Aspect;
  revealUrl: string;
};

export function buildSnap(input: SnapInput): Result<SnapResponse, AppError> {
  const handler: SnapHandlerResult = {
    version: SPEC_VERSION_2,
    theme: { accent: "amber" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: { gap: "md" },
          children: ["img", "btn"],
        },
        img: {
          type: "image",
          props: { url: input.blurredUrl, aspect: input.aspect },
        },
        btn: {
          type: "button",
          props: { label: "View", variant: "primary" },
          on: {
            press: { action: "open_url", params: { target: input.revealUrl } },
          },
        },
      },
    },
  };

  const result = validateSnapResponse(handler);
  if (!result.valid) {
    return nerr(err.validation("snap response invalid", result.issues));
  }
  return ok(handler as unknown as SnapResponse);
}

/** Parse Accept header: true if client prefers snap JSON (or no explicit html). */
export function wantsSnapJson(accept: string | null): boolean {
  if (!accept) return true;
  const lower = accept.toLowerCase();
  if (lower.includes(MEDIA_TYPE)) return true;
  if (lower.includes("text/html")) return false;
  return true;
}

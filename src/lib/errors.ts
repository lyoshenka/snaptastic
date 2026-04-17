export type AppError =
  | { kind: "validation"; message: string; cause?: unknown }
  | { kind: "upload"; message: string; cause?: unknown }
  | { kind: "storage"; message: string; cause?: unknown }
  | { kind: "db"; message: string; cause?: unknown }
  | { kind: "image"; message: string; cause?: unknown }
  | { kind: "not_found"; message: string }
  | { kind: "id_collision"; message: string };

export const err = {
  validation: (message: string, cause?: unknown): AppError => ({ kind: "validation", message, cause }),
  upload: (message: string, cause?: unknown): AppError => ({ kind: "upload", message, cause }),
  storage: (message: string, cause?: unknown): AppError => ({ kind: "storage", message, cause }),
  db: (message: string, cause?: unknown): AppError => ({ kind: "db", message, cause }),
  image: (message: string, cause?: unknown): AppError => ({ kind: "image", message, cause }),
  notFound: (message = "not found"): AppError => ({ kind: "not_found", message }),
  collision: (message = "id collision"): AppError => ({ kind: "id_collision", message }),
};

export function errorToStatus(e: AppError): number {
  switch (e.kind) {
    case "validation":
    case "upload":
      return 400;
    case "not_found":
      return 404;
    case "id_collision":
      return 409;
    default:
      return 500;
  }
}

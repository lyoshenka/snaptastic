import { put, del } from "@vercel/blob";
import { ResultAsync } from "neverthrow";
import { err, type AppError } from "./errors";

export type StoredBlob = { url: string; pathname: string };

export function putBlob(pathname: string, body: Buffer, contentType: string): ResultAsync<StoredBlob, AppError> {
  return ResultAsync.fromPromise(
    put(pathname, body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    }).then((r) => ({ url: r.url, pathname: r.pathname })),
    (e) => err.storage(e instanceof Error ? e.message : "blob put failed", e),
  );
}

export function deleteBlob(url: string): ResultAsync<null, AppError> {
  return ResultAsync.fromPromise(
    del(url).then(() => null),
    (e) => err.storage(e instanceof Error ? e.message : "blob del failed", e),
  );
}

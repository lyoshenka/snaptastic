"use client";

import { useState, useCallback } from "react";
import Dropzone from "@/components/Dropzone";
import AlertDialog from "@/components/AlertDialog";

const MAX_BYTES = 10 * 1024 * 1024;

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; snapId: string; snapUrl: string; castUrl: string };

export default function Page() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const copySnapUrl = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setAlert({ title: "not an image", message: `got: ${file.type || "unknown"}` });
      return;
    }
    if (file.size > MAX_BYTES) {
      setAlert({
        title: "too big",
        message: `max 10 MB, got ${(file.size / 1024 / 1024).toFixed(1)} MB`,
      });
      return;
    }
    setState({ status: "uploading" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `upload failed (${res.status})`);
      }
      const data = (await res.json()) as { snapId: string; snapUrl: string; castUrl: string };
      setState({ status: "done", snapId: data.snapId, snapUrl: data.snapUrl, castUrl: data.castUrl });
    } catch (e) {
      setState({ status: "idle" });
      setAlert({
        title: "upload failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl">
        <header className="mb-6 sm:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">snaptastic</h1>
          <p className="text-sm sm:text-base opacity-70 mt-1">
            pay per snap
          </p>
        </header>

        {state.status !== "done" ? (
          <Dropzone onFile={handleFile} disabled={state.status === "uploading"} />
        ) : (
          <div className="block-card p-6 flex flex-col items-center gap-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold">ready to cast ✨</div>
            <div className="w-full flex items-center gap-2">
              <code className="flex-1 text-xs sm:text-sm bg-gray-100 border border-gray-300 rounded px-3 py-2 truncate text-left">
                {state.snapUrl}
              </code>
              <button
                type="button"
                onClick={() => copySnapUrl(state.snapUrl)}
                className="block-btn shrink-0 text-sm px-3 py-2 min-h-0"
                style={{ minHeight: 44 }}
                aria-label="Copy snap URL"
              >
                {copied ? "copied ✓" : "copy"}
              </button>
            </div>
            <a
              className="block-btn block-btn--accent w-full sm:w-auto"
              href={state.castUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              cast it
            </a>
            <button type="button" className="block-btn" onClick={reset}>
              make another
            </button>
          </div>
        )}

        {state.status === "uploading" && (
          <p className="mt-4 text-center text-sm opacity-70">uploading…</p>
        )}
      </div>

      <AlertDialog
        open={!!alert}
        title={alert?.title ?? ""}
        message={alert?.message ?? ""}
        onClose={() => setAlert(null)}
      />
    </main>
  );
}

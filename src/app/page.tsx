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

  async function normalizeToJpeg(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("canvas conversion failed")); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not decode image")); };
      img.src = url;
    });
  }

  async function handleFile(rawFile: File) {
    if (!rawFile.type.startsWith("image/")) {
      setAlert({ title: "not an image", message: `got: ${rawFile.type || "unknown"}` });
      return;
    }
    if (rawFile.size > MAX_BYTES) {
      setAlert({
        title: "too big",
        message: `max 10 MB, got ${(rawFile.size / 1024 / 1024).toFixed(1)} MB`,
      });
      return;
    }
    setState({ status: "uploading" });
    let file: File;
    try {
      // Convert non-JPEG/PNG to JPEG via canvas so the server always gets a sharp-compatible format.
      const needsConversion = !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(rawFile.type);
      file = needsConversion ? await normalizeToJpeg(rawFile) : rawFile;
    } catch (e) {
      setState({ status: "idle" });
      setAlert({ title: "could not read image", message: e instanceof Error ? e.message : String(e) });
      return;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.text();
        let message = `upload failed (${res.status})`;
        try {
          const json = JSON.parse(body) as { message?: string };
          if (json.message) message = json.message;
        } catch {
          if (body) message = body;
        }
        throw new Error(message);
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
            spicy snaps on fc
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

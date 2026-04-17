"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export default function Dropzone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={[
        "block-card flex flex-col items-center justify-center gap-3",
        "w-full min-h-[60vh] sm:min-h-[50vh] p-8 text-center cursor-pointer",
        "transition-transform",
        dragOver ? "translate-x-[2px] translate-y-[2px]" : "",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <div className="text-4xl sm:text-5xl">🫰</div>
      <div className="text-xl sm:text-2xl font-bold">
        {dragOver ? "drop it" : "drag image here"}
      </div>
      <div className="text-sm opacity-70">or tap to choose a file</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

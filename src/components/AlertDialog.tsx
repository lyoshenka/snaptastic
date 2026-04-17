"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export default function AlertDialog({ open, title, message, onClose }: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="block-card max-w-sm w-[min(92vw,24rem)] p-6 backdrop:bg-black/50"
    >
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p className="text-sm mb-4 whitespace-pre-wrap">{message}</p>
      <div className="flex justify-end">
        <button type="button" className="block-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </dialog>
  );
}

import { notFound } from "next/navigation";
import { findByImageId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RevealPage({
  params,
}: {
  params: Promise<{ imageId: string }>;
}) {
  const { imageId } = await params;
  const row = await findByImageId(imageId);
  if (row.isErr()) {
    if (row.error.kind === "not_found") notFound();
    throw new Error(row.error.message);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={row.value.originalUrl}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: "100dvh",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

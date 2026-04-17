import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "snaptastic — peek 👀",
  description: "Upload an image, cast a blurred snap. Tap View to reveal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/blocks.css@1.0.1/dist/blocks.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

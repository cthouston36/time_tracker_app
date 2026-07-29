import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crew Time Allocation",
  description: "Allocate field crew hours and completed quantities to project pay items.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chinchor Daily"
  },
  icons: {
    apple: [
      {
        sizes: "500x500",
        type: "image/png",
        url: "/apple-touch-icon.png"
      }
    ],
    icon: [
      {
        sizes: "32x32",
        type: "image/png",
        url: "/favicon.png"
      }
    ]
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

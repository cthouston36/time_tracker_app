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
    apple: "/chinchor-logo.png",
    icon: "/chinchor-logo.png"
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
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

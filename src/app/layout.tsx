import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { SyncProvider } from "@/components/SyncProvider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Flock — Poultry Processing Tracker",
  description:
    "Capture-first poultry processing tracker. One number per bird; derive every metric.",
  applicationName: "Flock",
};

export const viewport: Viewport = {
  themeColor: "#0e110f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${ibmPlexMono.variable} antialiased`}>
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  );
}

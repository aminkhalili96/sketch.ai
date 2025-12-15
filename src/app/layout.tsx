import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sketch.AI - Transform Hardware Sketches into Products",
  description: "AI-powered platform that transforms hardware sketches into manufacturable products with BOM, assembly instructions, firmware, and more.",
  keywords: ["hardware design", "AI", "prototyping", "electronics", "maker", "Arduino", "PCB"],
  authors: [{ name: "Sketch.AI Team" }],
  openGraph: {
    title: "Sketch.AI - AI Hardware Design Assistant",
    description: "From idea to prototype in minutes, not months.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="font-sans antialiased bg-white text-neutral-900 min-h-screen"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

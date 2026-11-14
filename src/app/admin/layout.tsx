import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./admin.css";

const sans = Manrope({ subsets: ["latin", "greek"], variable: "--font-manrope", display: "swap" });

// Every admin route reads the session at request time; allow it to block.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "OurWay Διαχείριση", template: "%s · OurWay Διαχείριση" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#12211d", colorScheme: "light" };

/** Separate root layout: the admin never loads the public site's styles, nav or animations. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el" className={sans.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

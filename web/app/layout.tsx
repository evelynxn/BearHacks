import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Punchi Pal",
  description: "A scrapbook journal for your everyday moments."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f2e8d8"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Church Attendance System",
  description: "Record and track Sunday service attendance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

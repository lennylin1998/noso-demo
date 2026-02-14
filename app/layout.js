import "./globals.css";
import { Fraunces, Space_Grotesk } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"]
});

const text = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-text",
  weight: ["400", "500", "600", "700"]
});

export const metadata = {
  title: "HVAC Call Analyzer",
  description: "Transcript analysis with versioned prompt artifacts"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}

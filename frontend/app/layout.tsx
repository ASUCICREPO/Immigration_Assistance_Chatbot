import type { Metadata } from "next";
import { Poppins, Open_Sans, Nunito, Nunito_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import AmplifyConfigClient from "@/components/AmplifyConfigClient";
import { LanguageProvider } from "@/contexts/LanguageContext";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Resource Assistant",
  description: "AI-powered resource assistant connecting you with local services and support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${openSans.variable} ${nunito.variable} ${nunitoSans.variable} ${dmSans.variable} antialiased`}
      >
        <LanguageProvider>
          <AmplifyConfigClient>
            {children}
          </AmplifyConfigClient>
        </LanguageProvider>
      </body>
    </html>
  );
}

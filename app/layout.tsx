import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "English Learning App",
  description: "Plataforma de aprendizaje de inglés",
};

// Script para detectar tema antes del renderizado (evita flash)
const themeScript = `
  (function() {
    try {
      var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.style.backgroundColor = '#0c1929';
      } else {
        document.documentElement.style.colorScheme = 'light';
        document.documentElement.style.backgroundColor = '#f8fafc';
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}

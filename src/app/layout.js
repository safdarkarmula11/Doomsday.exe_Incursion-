import "./globals.css";

export const metadata = {
  title: "Content & Marketing Studio",
  description: "Print-ready ID cards and publicity designs for ACM NIT Surat",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

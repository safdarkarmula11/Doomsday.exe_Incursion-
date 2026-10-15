import "./globals.css";
import NavBar from "@/components/ui/NavBar";
import Footer from "@/components/ui/Footer";

export const metadata = {
  title: "Content & Marketing Studio",
  description: "Print-ready ID cards and publicity designs for ACM NIT Surat",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <NavBar />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
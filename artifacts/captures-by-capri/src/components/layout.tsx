import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b border-transparent ${
          isScrolled ? "bg-background/80 backdrop-blur-md border-border/50 py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
          <Link href="/" className="z-50 relative">
            <img src="/logo.png" alt="Captures by Capri" className="h-20 w-auto brightness-0 invert" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide uppercase">
            <Link href="/" className="hover:text-primary/70 transition-colors">Home</Link>
            <Link href="/portfolio" className="hover:text-primary/70 transition-colors">Portfolio</Link>
            <Link href="/book" className="hover:text-primary/70 transition-colors">Book</Link>
          </nav>

          <button 
            className="md:hidden z-50 relative p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center gap-8 text-2xl font-serif"
          >
            <Link href="/" className="hover:text-primary/70 transition-colors">Home</Link>
            <Link href="/portfolio" className="hover:text-primary/70 transition-colors">Portfolio</Link>
            <Link href="/book" className="hover:text-primary/70 transition-colors">Book</Link>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col pt-24 md:pt-0">
        {children}
      </main>

      <footer className="py-24 border-t border-border/50 mt-auto">
        <div className="container mx-auto px-6 md:px-12 flex flex-col items-center text-center">
          <h2 className="font-serif text-3xl tracking-widest uppercase mb-8">Captures by Capri</h2>
          <div className="flex gap-6 mb-12 text-muted-foreground">
            <a href="https://www.instagram.com/capri.captures" className="hover:text-foreground transition-colors">Instagram</a>
          </div>
          <p className="text-muted-foreground text-sm tracking-wider uppercase">
            © {new Date().getFullYear()} Capri Photography. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { getSeason, toThumbnailUrl } from "@/lib/utils";

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[100dvh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={toThumbnailUrl("https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/hero.JPG", 1400, 80)}
            alt="Cinematic couple portrait" 
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto mt-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif text-balance mb-6"
          >
            Timeless, Intimate, Editorial.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground uppercase tracking-widest mb-10 max-w-2xl mx-auto"
          >
            Luxury lifestyle and portrait photography for those who want their story told with intention.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link href="/portfolio" className="border-b border-primary pb-1 text-sm tracking-widest uppercase hover:text-primary/70 hover:border-primary/70 transition-all">
              View Portfolio
            </Link>
            <Link href="/book" className="bg-primary text-primary-foreground px-8 py-4 text-sm tracking-widest uppercase hover:bg-primary/90 transition-all">
              Inquire Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Meet Me Section */}
      <section className="py-32 md:py-48 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1">
              <motion.img 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                src={toThumbnailUrl("https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/home/meet_me.JPG", 800, 75)} 
                alt="Self Portrait" 
                className="w-full aspect-[3/4] object-cover"
              />
            </div>
            <div className="order-1 md:order-2 space-y-8">
              <h2 className="text-sm tracking-[0.3em] text-muted-foreground uppercase">About Me</h2>
              <h3 className="text-4xl md:text-5xl font-serif leading-tight">
                I am a mom, a wife, and someone who genuinely loves seeing life through photos.
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                By day, I work as a CT technologist doing 3D image reconstruction, which basically means I am a photographer and Photoshop artist for the medical world full time. I am passionate about capturing details, telling stories through images, and finding beauty in everyday moments. 
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Work Grid */}
      <section className="py-32 bg-secondary/30">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex justify-between items-end mb-16">
            <h2 className="text-4xl font-serif">Selected Works</h2>
            <Link href="/portfolio" className="hidden md:block border-b border-foreground pb-1 text-sm tracking-widest uppercase hover:text-primary transition-colors">
              Full Portfolio
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { src: "https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/home/feature1.jpg", title: "Family" },
              { src: "https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/home/feature2.jpg", title: "Portrait", className: "md:mt-16" },
              { src: "https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/home/feature3.JPG", title: "Family", className: "md:mt-32" },
              { src: "https://sizdhvcsdtmhfkvddxmo.supabase.co/storage/v1/object/public/Photos/home/feature4.JPG", title: "Family", className: "md:mt-32" }
            ].map((img, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.2 }}
                className={`group cursor-pointer ${img.className || ''}`}
              >
                <div className="overflow-hidden aspect-[3/4] mb-4">
                  <img 
                    src={toThumbnailUrl(img.src, 800, 75)} 
                    alt={img.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <h4 className="text-sm tracking-widest uppercase">{img.title}</h4>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-12 text-center md:hidden">
            <Link href="/portfolio" className="inline-block border-b border-foreground pb-1 text-sm tracking-widest uppercase hover:text-primary transition-colors">
              Full Portfolio
            </Link>
          </div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-48 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-5xl md:text-7xl font-serif">Let's create something beautiful together.</h2>
          <p className="text-muted-foreground text-lg uppercase tracking-widest">Now booking for {getSeason()} {new Date().getFullYear()}.</p>
          <div className="pt-8">
            <Link href="/book" className="bg-foreground text-background px-12 py-5 text-sm tracking-widest uppercase hover:bg-foreground/90 transition-all">
              Request a Session
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

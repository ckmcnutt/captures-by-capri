import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { staticImages } from "@/lib/static-images";

export default function Portfolio() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const categories = ["Brand", "Couples", "Engagement", "Family", "Maternity", "Portrait", "Other"];

  const filteredImages = selectedCategory
    ? staticImages.filter(img => img.category === selectedCategory)
    : [];

  return (
    <div className="min-h-screen pt-32 pb-24 px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-20 text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-serif">Portfolio</h1>
          <p className="text-muted-foreground tracking-widest uppercase text-sm">A curated selection of works</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-12 mb-16">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-sm tracking-widest uppercase transition-all pb-1 border-b ${
                selectedCategory === cat
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Empty state */}
        <AnimatePresence>
          {!selectedCategory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-24 text-muted-foreground"
            >
              <p className="text-sm tracking-[0.3em] uppercase">Select a category above to view photos</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8"
        >
          <AnimatePresence mode="popLayout">
            {filteredImages.map((image) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="group relative aspect-[3/4] cursor-pointer overflow-hidden bg-secondary"
                onClick={() => setLightboxImage(image.url)}
              >
                <img
                  src={image.url}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Lightbox */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
              onClick={() => setLightboxImage(null)}
            >
              <button
                className="absolute top-6 right-6 text-foreground p-2 hover:opacity-70"
                onClick={() => setLightboxImage(null)}
              >
                <X size={32} />
              </button>
              <img
                src={lightboxImage}
                alt="Enlarged view"
                className="max-w-full max-h-full object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

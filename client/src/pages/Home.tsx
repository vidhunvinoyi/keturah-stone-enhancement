import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageComparisonSlider from '@/components/ImageComparisonSlider';
import { galleryItems, categories, marbleInfo, type MarbleType, type GalleryItem } from '@/data/galleryData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [selectedMarble, setSelectedMarble] = useState<MarbleType>('bardiglio');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);

  const filteredItems = selectedCategory === 'All'
    ? galleryItems
    : galleryItems.filter(item => item.category === selectedCategory);

  const getAfterImage = (item: GalleryItem) => {
    return selectedMarble === 'bardiglio' ? item.bardiglioImage : item.venatinoImage;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FAF8F5] via-[#F5F3F0] to-[#EDE8E3]" />
        
        {/* Decorative blobs */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <span className="inline-block text-sm tracking-[0.3em] text-muted-foreground uppercase mb-6 font-body">
              Luxury Material Transformation
            </span>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold text-foreground mb-6 leading-tight">
              Keturah Stone
              <br />
              <span className="text-primary">Enhancement</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover the transformation of 25 luxury spaces from Travertine marble 
              to the sophisticated elegance of Bardiglio and Venatino marble.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="px-8 py-6 text-base font-medium"
                onClick={() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Explore Gallery
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-base font-medium bg-transparent"
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 120L60 105C120 90 240 60 360 52.5C480 45 600 60 720 67.5C840 75 960 75 1080 67.5C1200 60 1320 45 1380 37.5L1440 30V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="currentColor"
              className="text-background"
            />
          </svg>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-background">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
              The Art of Transformation
            </h2>
            <p className="font-body text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Each space has been meticulously reimagined, replacing original Travertine surfaces 
              with premium Italian marble while preserving every detail—lighting, shadows, 
              perspective, and texture—for a seamless, photorealistic result.
            </p>
          </motion.div>

          {/* Marble Selection Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {(['bardiglio', 'venatino'] as MarbleType[]).map((marble) => (
              <motion.div
                key={marble}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: marble === 'venatino' ? 0.2 : 0 }}
                onClick={() => setSelectedMarble(marble)}
                className={`relative p-8 rounded-2xl cursor-pointer transition-all duration-300 ${
                  selectedMarble === marble
                    ? 'bg-card shadow-xl ring-2 ring-primary'
                    : 'bg-card/50 hover:bg-card hover:shadow-lg'
                }`}
              >
                <div
                  className="w-16 h-16 rounded-full mb-6"
                  style={{ backgroundColor: marbleInfo[marble].color }}
                />
                <h3 className="font-display text-2xl font-semibold text-foreground mb-2">
                  {marbleInfo[marble].fullName}
                </h3>
                <p className="font-body text-sm text-muted-foreground mb-4">
                  {marbleInfo[marble].origin}
                </p>
                <p className="font-body text-muted-foreground leading-relaxed">
                  {marbleInfo[marble].description}
                </p>
                {selectedMarble === marble && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-24 bg-muted/30">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
              Transformation Gallery
            </h2>
            <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Drag the slider on each image to reveal the transformation from Travertine to {marbleInfo[selectedMarble].name} marble.
            </p>

            {/* Category Filter */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full max-w-3xl mx-auto">
              <TabsList className="flex flex-wrap justify-center gap-2 bg-transparent h-auto p-0">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="px-4 py-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Gallery Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <ImageComparisonSlider
                      beforeImage={item.originalImage}
                      afterImage={getAfterImage(item)}
                      beforeLabel="Travertine"
                      afterLabel={marbleInfo[selectedMarble].name}
                    />
                    <div className="mt-4 px-2">
                      <h3 className="font-display text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="font-body text-sm text-muted-foreground mt-1">
                        {item.category}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-foreground text-background">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            {[
              { number: '25', label: 'Spaces Transformed' },
              { number: '8K', label: 'Ultra-High Resolution' },
              { number: '100%', label: 'Material Consistency' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="font-display text-6xl md:text-7xl font-semibold mb-4">
                  {stat.number}
                </div>
                <div className="font-body text-lg tracking-wide uppercase opacity-70">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t border-border">
        <div className="container text-center">
          <h3 className="font-display text-2xl font-semibold text-foreground mb-4">
            Keturah Stone Enhancement
          </h3>
          <p className="font-body text-muted-foreground mb-6">
            Luxury marble transformation for the Keturah Townhouse project.
          </p>
          <p className="font-body text-sm text-muted-foreground">
            Full resolution 8K images available in Google Drive.
          </p>
        </div>
      </footer>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <ImageComparisonSlider
                beforeImage={selectedItem.originalImage}
                afterImage={getAfterImage(selectedItem)}
                beforeLabel="Travertine"
                afterLabel={marbleInfo[selectedMarble].name}
                className="aspect-video"
              />
              <div className="mt-6 text-center text-white">
                <h3 className="font-display text-2xl font-semibold mb-2">
                  {selectedItem.name}
                </h3>
                <p className="font-body text-white/70 max-w-2xl mx-auto">
                  {selectedItem.description}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

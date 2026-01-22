import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, Loader2, Download, RefreshCw, X, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import ImageComparisonSlider from './ImageComparisonSlider';
import { marbleInfo, type MarbleType } from '@/data/galleryData';

type VisualizationState = {
  id: number;
  sessionId: string;
  originalImageUrl: string;
  bardiglioImageUrl?: string;
  venatinoImageUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
};

export default function VisualizeYourSpace() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMarble, setSelectedMarble] = useState<MarbleType>('bardiglio');
  const [visualization, setVisualization] = useState<VisualizationState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.visualization.upload.useMutation();
  const processMutation = trpc.visualization.process.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      // Create preview URL
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      // Upload to server
      const result = await uploadMutation.mutateAsync({
        imageBase64,
        mimeType: file.type,
      });

      setVisualization({
        id: result.id,
        sessionId: result.sessionId,
        originalImageUrl: result.originalImageUrl,
        status: 'pending',
      });

      toast.success('Image uploaded successfully! Select a marble type to visualize.');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image. Please try again.');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleProcess = async () => {
    if (!visualization) return;

    setIsProcessing(true);

    try {
      const result = await processMutation.mutateAsync({
        visualizationId: visualization.id,
        marbleType: selectedMarble,
      });

      setVisualization(prev => {
        if (!prev) return null;
        return {
          ...prev,
          [selectedMarble === 'bardiglio' ? 'bardiglioImageUrl' : 'venatinoImageUrl']: result.imageUrl,
          status: 'completed',
        };
      });

      toast.success(`${marbleInfo[selectedMarble].name} marble transformation complete!`);
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    const imageUrl = selectedMarble === 'bardiglio' 
      ? visualization?.bardiglioImageUrl 
      : visualization?.venatinoImageUrl;
    
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marble-visualization-${selectedMarble}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully!');
    } catch {
      toast.error('Download failed. Please try again.');
    }
  };

  const handleReset = () => {
    setVisualization(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentTransformedImage = selectedMarble === 'bardiglio' 
    ? visualization?.bardiglioImageUrl 
    : visualization?.venatinoImageUrl;

  const hasTransformation = !!currentTransformedImage;

  return (
    <section id="visualize" className="py-24 bg-gradient-to-b from-background to-muted/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-foreground mb-6">
            Visualize Your Space
          </h2>
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Upload a photo of your room and see how it would look with premium Italian marble. 
            Our AI-powered visualization creates photorealistic transformations.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {!visualization ? (
              // Upload Zone
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 md:p-16 transition-all duration-300 cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.02]'
                      : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center justify-center text-center">
                    {isUploading ? (
                      <>
                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                        <p className="font-display text-xl font-semibold text-foreground mb-2">
                          Uploading your image...
                        </p>
                        <p className="font-body text-muted-foreground">
                          Please wait while we prepare your visualization
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                          <Upload className="w-10 h-10 text-primary" />
                        </div>
                        <p className="font-display text-xl font-semibold text-foreground mb-2">
                          {isDragging ? 'Drop your image here' : 'Drag and drop your room photo'}
                        </p>
                        <p className="font-body text-muted-foreground mb-4">
                          or click to browse files
                        </p>
                        <p className="font-body text-sm text-muted-foreground/70">
                          Supports JPEG, PNG • Max 10MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              // Visualization View
              <motion.div
                key="visualization"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Marble Type Selector */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {(['bardiglio', 'venatino'] as MarbleType[]).map((marble) => (
                    <button
                      key={marble}
                      onClick={() => setSelectedMarble(marble)}
                      disabled={isProcessing}
                      className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 ${
                        selectedMarble === marble
                          ? 'bg-card shadow-lg ring-2 ring-primary'
                          : 'bg-card/50 hover:bg-card hover:shadow-md'
                      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: marbleInfo[marble].color }}
                      />
                      <div className="text-left">
                        <p className="font-display font-semibold text-foreground">
                          {marbleInfo[marble].name}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {marbleInfo[marble].origin}
                        </p>
                      </div>
                      {selectedMarble === marble && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center ml-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Image Display */}
                <div className="relative rounded-2xl overflow-hidden bg-card shadow-xl">
                  {hasTransformation ? (
                    // Before/After Comparison
                    <ImageComparisonSlider
                      beforeImage={visualization.originalImageUrl}
                      afterImage={currentTransformedImage}
                      beforeLabel="Original"
                      afterLabel={marbleInfo[selectedMarble].name}
                      className="aspect-video"
                    />
                  ) : (
                    // Original Image with Processing Overlay
                    <div className="relative aspect-video">
                      <img
                        src={previewUrl || visualization.originalImageUrl}
                        alt="Your uploaded room"
                        className="w-full h-full object-cover"
                      />
                      {isProcessing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                          <Loader2 className="w-16 h-16 text-white animate-spin mb-4" />
                          <p className="font-display text-xl font-semibold text-white mb-2">
                            Transforming your space...
                          </p>
                          <p className="font-body text-white/70">
                            AI is applying {marbleInfo[selectedMarble].name} marble
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  {!hasTransformation ? (
                    <Button
                      size="lg"
                      onClick={handleProcess}
                      disabled={isProcessing}
                      className="px-8 py-6 text-base font-medium gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Apply {marbleInfo[selectedMarble].name} Marble
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        onClick={handleDownload}
                        className="px-8 py-6 text-base font-medium gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download Result
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleProcess}
                        disabled={isProcessing}
                        className="px-8 py-6 text-base font-medium gap-2 bg-transparent"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5" />
                            Try {selectedMarble === 'bardiglio' ? 'Venatino' : 'Bardiglio'}
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={isProcessing}
                    className="px-8 py-6 text-base font-medium gap-2"
                  >
                    <X className="w-5 h-5" />
                    Start Over
                  </Button>
                </div>

                {/* Info Text */}
                {hasTransformation && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center font-body text-sm text-muted-foreground"
                  >
                    Drag the slider to compare your original room with the {marbleInfo[selectedMarble].name} marble transformation
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

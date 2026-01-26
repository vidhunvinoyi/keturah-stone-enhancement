import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Upload, 
  Loader2, 
  Download, 
  RefreshCw, 
  X, 
  Sparkles, 
  ScanSearch,
  Layers,
  ImagePlus,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  Palette
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import ImageComparisonSlider from './ImageComparisonSlider';
import { marbleInfo, type MarbleType } from '@/data/galleryData';
import { Link } from 'wouter';

type SurfaceDetection = {
  walls: {
    detected: boolean;
    confidence: number;
    material: string;
    description: string;
  };
  floors: {
    detected: boolean;
    confidence: number;
    material: string;
    description: string;
  };
  ceilings: {
    detected: boolean;
    confidence: number;
    material: string;
    description: string;
  };
  overallAnalysis: string;
  canAutoDetect: boolean;
};

type CustomMarble = {
  id: number;
  name: string;
  origin?: string | null;
  baseColor?: string | null;
  veiningPattern?: string | null;
  description?: string | null;
  imageUrl: string;
  googleDriveLink?: string | null;
  analysis?: {
    baseColor: string;
    veiningColors: string[];
    veiningPattern: string;
    texture: string;
    characteristics: string;
    suggestedApplications: string[];
  } | null;
};

type VisualizationState = {
  id: number;
  sessionId: string;
  originalImageUrl: string;
  bardiglioImageUrl?: string;
  venatinoImageUrl?: string;
  customMarbleImageUrl?: string;
  highlightImageUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  surfaceDetection?: SurfaceDetection;
  materialSamples?: Array<{
    surfaceType: string;
    sampleUrl: string;
    analysis: {
      materialType: string;
      colorPalette: string[];
      patterns: string;
      characteristics: string;
    };
  }>;
};

type SurfaceSelection = {
  walls: boolean;
  floors: boolean;
  ceilings: boolean;
};

type MarbleSelection = 'bardiglio' | 'venatino' | 'custom';

export default function VisualizeYourSpace() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const [isCreatingCustomMarble, setIsCreatingCustomMarble] = useState(false);
  const [selectedMarbleType, setSelectedMarbleType] = useState<MarbleSelection>('bardiglio');
  const [selectedCustomMarble, setSelectedCustomMarble] = useState<CustomMarble | null>(null);
  const [visualization, setVisualization] = useState<VisualizationState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [surfaceSelection, setSurfaceSelection] = useState<SurfaceSelection>({
    walls: true,
    floors: true,
    ceilings: false,
  });
  const [showSampleUpload, setShowSampleUpload] = useState(false);
  const [showCustomMarbleForm, setShowCustomMarbleForm] = useState(false);
  const [sampleSurfaceType, setSampleSurfaceType] = useState<'walls' | 'floors' | 'ceilings'>('walls');
  const [customMarbles, setCustomMarbles] = useState<CustomMarble[]>([]);
  
  // Custom marble form state
  const [customMarbleForm, setCustomMarbleForm] = useState({
    name: '',
    origin: '',
    baseColor: '',
    veiningPattern: '',
    description: '',
    googleDriveLink: '',
  });
  const [customMarblePreview, setCustomMarblePreview] = useState<string | null>(null);
  const [customMarbleFile, setCustomMarbleFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleInputRef = useRef<HTMLInputElement>(null);
  const customMarbleInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.visualization.upload.useMutation();
  const detectSurfacesMutation = trpc.visualization.detectSurfaces.useMutation();
  const uploadSampleMutation = trpc.visualization.uploadMaterialSample.useMutation();
  const processSelectiveMutation = trpc.visualization.processSelective.useMutation();
  const processWithCustomMarbleMutation = trpc.visualization.processWithCustomMarble.useMutation();
  const createCustomMarbleMutation = trpc.customMarble.create.useMutation();
  const generateHighlightMutation = trpc.visualization.generateHighlight.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

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

      toast.success('Image uploaded! Analyzing surfaces...');
      
      // Automatically detect surfaces after upload
      await handleDetectSurfaces(result.id);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image. Please try again.');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDetectSurfaces = async (visualizationId: number) => {
    setIsDetecting(true);
    try {
      const result = await detectSurfacesMutation.mutateAsync({
        visualizationId,
      });

      setVisualization(prev => {
        if (!prev) return null;
        return {
          ...prev,
          surfaceDetection: result.detection,
        };
      });

      // Auto-select detected surfaces
      if (result.detection) {
        setSurfaceSelection({
          walls: result.detection.walls.detected && result.detection.walls.confidence > 50,
          floors: result.detection.floors.detected && result.detection.floors.confidence > 50,
          ceilings: result.detection.ceilings.detected && result.detection.ceilings.confidence > 50,
        });
      }

      if (!result.detection.canAutoDetect) {
        toast.info('Some surfaces may need manual identification. You can upload a material sample for better accuracy.');
        setShowSampleUpload(true);
      } else {
        toast.success('Surfaces detected! Select which surfaces to transform.');
      }
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Surface detection failed. You can still proceed with manual selection.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleGenerateHighlight = async () => {
    if (!visualization) return;
    
    setIsProcessing(true);
    try {
      const result = await generateHighlightMutation.mutateAsync({
        visualizationId: visualization.id,
      });
      
      setVisualization(prev => {
        if (!prev) return null;
        return {
          ...prev,
          highlightImageUrl: result.highlightImageUrl,
        };
      });
      
      toast.success('Surface highlights generated!');
    } catch (error) {
      console.error('Highlight generation error:', error);
      toast.error('Failed to generate surface highlights.');
    } finally {
      setIsProcessing(false);
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

  const handleSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !visualization) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploadingSample(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const sampleBase64 = await base64Promise;

      const result = await uploadSampleMutation.mutateAsync({
        visualizationId: visualization.id,
        sampleBase64,
        mimeType: file.type,
        surfaceType: sampleSurfaceType,
      });

      setVisualization(prev => {
        if (!prev) return null;
        const existingSamples = prev.materialSamples || [];
        return {
          ...prev,
          materialSamples: [...existingSamples, result.sample],
        };
      });

      toast.success(`${sampleSurfaceType.charAt(0).toUpperCase() + sampleSurfaceType.slice(1)} material sample analyzed!`);
      setShowSampleUpload(false);
    } catch (error) {
      console.error('Sample upload error:', error);
      toast.error('Failed to analyze material sample.');
    } finally {
      setIsUploadingSample(false);
      if (sampleInputRef.current) {
        sampleInputRef.current.value = '';
      }
    }
  };

  const handleCustomMarbleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Image size must be less than 50MB for 300 DPI images');
      return;
    }

    setCustomMarbleFile(file);
    const preview = URL.createObjectURL(file);
    setCustomMarblePreview(preview);
  };

  const handleCreateCustomMarble = async () => {
    if (!customMarbleForm.name.trim()) {
      toast.error('Please enter a marble name');
      return;
    }

    if (!customMarbleFile) {
      toast.error('Please upload a 300 DPI marble image');
      return;
    }

    setIsCreatingCustomMarble(true);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(customMarbleFile);
      const imageBase64 = await base64Promise;

      const result = await createCustomMarbleMutation.mutateAsync({
        name: customMarbleForm.name,
        origin: customMarbleForm.origin || undefined,
        baseColor: customMarbleForm.baseColor || undefined,
        veiningPattern: customMarbleForm.veiningPattern || undefined,
        description: customMarbleForm.description || undefined,
        imageBase64,
        mimeType: customMarbleFile.type,
        googleDriveLink: customMarbleForm.googleDriveLink || undefined,
      });

      const newMarble: CustomMarble = {
        id: result.id,
        name: result.name,
        origin: customMarbleForm.origin || null,
        baseColor: result.analysis?.baseColor || customMarbleForm.baseColor || null,
        veiningPattern: result.analysis?.veiningPattern || customMarbleForm.veiningPattern || null,
        description: customMarbleForm.description || null,
        imageUrl: result.imageUrl,
        googleDriveLink: result.googleDriveLink,
        analysis: result.analysis,
      };

      setCustomMarbles(prev => [...prev, newMarble]);
      setSelectedCustomMarble(newMarble);
      setSelectedMarbleType('custom');
      
      // Reset form
      setCustomMarbleForm({
        name: '',
        origin: '',
        baseColor: '',
        veiningPattern: '',
        description: '',
        googleDriveLink: '',
      });
      setCustomMarbleFile(null);
      setCustomMarblePreview(null);
      setShowCustomMarbleForm(false);

      toast.success(`${result.name} marble added successfully!`);
    } catch (error) {
      console.error('Custom marble creation error:', error);
      toast.error('Failed to create custom marble. Please try again.');
    } finally {
      setIsCreatingCustomMarble(false);
    }
  };

  const handleProcess = async () => {
    if (!visualization) return;

    const hasSelectedSurface = surfaceSelection.walls || surfaceSelection.floors || surfaceSelection.ceilings;
    if (!hasSelectedSurface) {
      toast.error('Please select at least one surface to transform');
      return;
    }

    setIsProcessing(true);

    try {
      if (selectedMarbleType === 'custom' && selectedCustomMarble) {
        // Process with custom marble
        const result = await processWithCustomMarbleMutation.mutateAsync({
          visualizationId: visualization.id,
          customMarbleId: selectedCustomMarble.id,
          surfaces: surfaceSelection,
          useMaterialSample: (visualization.materialSamples?.length || 0) > 0,
        });

        setVisualization(prev => {
          if (!prev) return null;
          return {
            ...prev,
            customMarbleImageUrl: result.imageUrl,
            status: 'completed',
          };
        });

        const surfaceNames = [];
        if (surfaceSelection.walls) surfaceNames.push('walls');
        if (surfaceSelection.floors) surfaceNames.push('floors');
        if (surfaceSelection.ceilings) surfaceNames.push('ceilings');

        toast.success(`${selectedCustomMarble.name} marble applied to ${surfaceNames.join(', ')}!`);
      } else {
        // Process with preset marble (bardiglio or venatino)
        const marbleType = selectedMarbleType as MarbleType;
        const result = await processSelectiveMutation.mutateAsync({
          visualizationId: visualization.id,
          marbleType,
          surfaces: surfaceSelection,
          useMaterialSample: (visualization.materialSamples?.length || 0) > 0,
        });

        setVisualization(prev => {
          if (!prev) return null;
          return {
            ...prev,
            [marbleType === 'bardiglio' ? 'bardiglioImageUrl' : 'venatinoImageUrl']: result.imageUrl,
            status: 'completed',
          };
        });

        const surfaceNames = [];
        if (surfaceSelection.walls) surfaceNames.push('walls');
        if (surfaceSelection.floors) surfaceNames.push('floors');
        if (surfaceSelection.ceilings) surfaceNames.push('ceilings');

        toast.success(`${marbleInfo[marbleType].name} marble applied to ${surfaceNames.join(', ')}!`);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    let imageUrl: string | undefined;
    let marbleName: string;
    
    if (selectedMarbleType === 'custom' && selectedCustomMarble) {
      imageUrl = visualization?.customMarbleImageUrl;
      marbleName = selectedCustomMarble.name;
    } else {
      imageUrl = selectedMarbleType === 'bardiglio' 
        ? visualization?.bardiglioImageUrl 
        : visualization?.venatinoImageUrl;
      marbleName = marbleInfo[selectedMarbleType as MarbleType].name;
    }
    
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marble-visualization-${marbleName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
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
    setShowSampleUpload(false);
    setShowCustomMarbleForm(false);
    setSurfaceSelection({ walls: true, floors: true, ceilings: false });
    setSelectedMarbleType('bardiglio');
    setSelectedCustomMarble(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCurrentTransformedImage = () => {
    if (selectedMarbleType === 'custom' && selectedCustomMarble) {
      return visualization?.customMarbleImageUrl;
    }
    return selectedMarbleType === 'bardiglio' 
      ? visualization?.bardiglioImageUrl 
      : visualization?.venatinoImageUrl;
  };

  const currentTransformedImage = getCurrentTransformedImage();
  const hasTransformation = !!currentTransformedImage;
  const hasDetection = !!visualization?.surfaceDetection;

  const getSurfaceIcon = (detected: boolean, confidence: number) => {
    if (!detected) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    if (confidence >= 70) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  const getMarbleDisplayName = () => {
    if (selectedMarbleType === 'custom' && selectedCustomMarble) {
      return selectedCustomMarble.name;
    }
    return marbleInfo[selectedMarbleType as MarbleType].name;
  };

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
          <p className="font-body text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            Upload a photo of your room and our AI will detect walls, floors, and ceilings. 
            Choose which surfaces to transform with premium Italian marble or upload your own custom marble.
          </p>
          <Link href="/library">
            <Button variant="outline" className="gap-2">
              <Palette className="w-4 h-4" />
              View Marble Library
            </Button>
          </Link>
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
                {/* Add Custom Marble Button - Available before upload */}
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCustomMarbleForm(true);
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Custom Marble
                  </Button>
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
                {/* Surface Detection Status */}
                {isDetecting && (
                  <div className="bg-card rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-4">
                      <ScanSearch className="w-8 h-8 text-primary animate-pulse" />
                      <div>
                        <p className="font-display font-semibold text-foreground">
                          Analyzing your image...
                        </p>
                        <p className="font-body text-sm text-muted-foreground">
                          AI is detecting walls, floors, and ceilings
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Surface Selection Panel */}
                {hasDetection && !isDetecting && (
                  <div className="bg-card rounded-xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        <h3 className="font-display font-semibold text-foreground">
                          Select Surfaces to Transform
                        </h3>
                      </div>
                      {visualization.surfaceDetection && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateHighlight}
                          disabled={isProcessing}
                          className="text-xs"
                        >
                          <Palette className="w-3 h-3 mr-1" />
                          Show Highlights
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      {(['walls', 'floors', 'ceilings'] as const).map((surface) => {
                        const detection = visualization.surfaceDetection?.[surface];
                        return (
                          <label
                            key={surface}
                            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              surfaceSelection[surface]
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-primary/50'
                            }`}
                          >
                            <Checkbox
                              checked={surfaceSelection[surface]}
                              onCheckedChange={(checked) =>
                                setSurfaceSelection(prev => ({ ...prev, [surface]: !!checked }))
                              }
                              disabled={isProcessing}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-display font-semibold text-foreground capitalize">
                                  {surface}
                                </span>
                                {detection && getSurfaceIcon(detection.detected, detection.confidence)}
                              </div>
                              {detection && (
                                <>
                                  <p className="font-body text-xs text-muted-foreground mt-1">
                                    {detection.detected 
                                      ? `${detection.material} (${detection.confidence}% confidence)`
                                      : 'Not detected'}
                                  </p>
                                  {detection.detected && (
                                    <p className="font-body text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                                      {detection.description}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Material Sample Upload Option */}
                    {(showSampleUpload || !visualization.surfaceDetection?.canAutoDetect) && (
                      <div className="border-t border-muted pt-4 mt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ImagePlus className="w-4 h-4 text-primary" />
                          <span className="font-body text-sm text-foreground">
                            Need help identifying materials? Upload a sample
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(['walls', 'floors', 'ceilings'] as const).map((surface) => (
                            <Button
                              key={surface}
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSampleSurfaceType(surface);
                                sampleInputRef.current?.click();
                              }}
                              disabled={isUploadingSample}
                              className="text-xs capitalize"
                            >
                              {isUploadingSample && sampleSurfaceType === surface ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <ImagePlus className="w-3 h-3 mr-1" />
                              )}
                              {surface} sample
                            </Button>
                          ))}
                        </div>
                        <input
                          ref={sampleInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleSampleUpload}
                          className="hidden"
                        />
                        {visualization.materialSamples && visualization.materialSamples.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {visualization.materialSamples.map((sample, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {sample.surfaceType}: {sample.analysis.materialType}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Overall Analysis */}
                    {visualization.surfaceDetection?.overallAnalysis && (
                      <p className="font-body text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
                        <strong>AI Analysis:</strong> {visualization.surfaceDetection.overallAnalysis}
                      </p>
                    )}
                  </div>
                )}

                {/* Marble Type Selector */}
                <div className="space-y-4">
                  <h3 className="font-display font-semibold text-foreground text-center">
                    Choose Your Marble
                  </h3>
                  
                  {/* Preset Marbles */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    {(['bardiglio', 'venatino'] as MarbleType[]).map((marble) => (
                      <button
                        key={marble}
                        onClick={() => {
                          setSelectedMarbleType(marble);
                          setSelectedCustomMarble(null);
                        }}
                        disabled={isProcessing}
                        className={`flex items-center gap-3 px-6 py-4 rounded-xl transition-all duration-300 ${
                          selectedMarbleType === marble
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
                        {selectedMarbleType === marble && (
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center ml-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Marbles */}
                  {customMarbles.length > 0 && (
                    <div className="flex flex-wrap gap-3 justify-center">
                      {customMarbles.map((marble) => (
                        <button
                          key={marble.id}
                          onClick={() => {
                            setSelectedMarbleType('custom');
                            setSelectedCustomMarble(marble);
                          }}
                          disabled={isProcessing}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                            selectedMarbleType === 'custom' && selectedCustomMarble?.id === marble.id
                              ? 'bg-card shadow-lg ring-2 ring-primary'
                              : 'bg-card/50 hover:bg-card hover:shadow-md'
                          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <img
                            src={marble.imageUrl}
                            alt={marble.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="text-left">
                            <p className="font-display font-semibold text-foreground text-sm">
                              {marble.name}
                            </p>
                            {marble.origin && (
                              <p className="font-body text-xs text-muted-foreground">
                                {marble.origin}
                              </p>
                            )}
                          </div>
                          {marble.googleDriveLink && (
                            <a
                              href={marble.googleDriveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {selectedMarbleType === 'custom' && selectedCustomMarble?.id === marble.id && (
                            <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Add Custom Marble Button */}
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowCustomMarbleForm(true)}
                      disabled={isProcessing}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Custom Marble
                    </Button>
                  </div>
                </div>

                {/* Image Display */}
                <div className="relative rounded-2xl overflow-hidden bg-card shadow-xl">
                  {hasTransformation ? (
                    <ImageComparisonSlider
                      beforeImage={visualization.originalImageUrl}
                      afterImage={currentTransformedImage}
                      beforeLabel="Original"
                      afterLabel={getMarbleDisplayName()}
                      className="aspect-video"
                    />
                  ) : visualization.highlightImageUrl ? (
                    <div className="relative aspect-video">
                      <img
                        src={visualization.highlightImageUrl}
                        alt="Surface highlights"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-3">
                        <p className="font-body text-sm text-white text-center">
                          <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span> Walls
                          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mx-2 ml-4"></span> Floors
                          <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mx-2 ml-4"></span> Ceilings
                        </p>
                      </div>
                    </div>
                  ) : (
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
                            Transforming selected surfaces...
                          </p>
                          <p className="font-body text-white/70">
                            AI is applying {getMarbleDisplayName()} marble to{' '}
                            {[
                              surfaceSelection.walls && 'walls',
                              surfaceSelection.floors && 'floors',
                              surfaceSelection.ceilings && 'ceilings',
                            ].filter(Boolean).join(', ')}
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
                      disabled={isProcessing || isDetecting || !(surfaceSelection.walls || surfaceSelection.floors || surfaceSelection.ceilings)}
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
                          Apply {getMarbleDisplayName()} Marble
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
                            Try Different Options
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
                    Drag the slider to compare your original room with the {getMarbleDisplayName()} marble transformation
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Marble Form Modal - Moved outside conditional for global access */}
          <AnimatePresence>
            {showCustomMarbleForm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowCustomMarbleForm(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-display text-xl font-semibold text-foreground">
                      Add Custom Marble
                    </h3>
                    <button
                      onClick={() => setShowCustomMarbleForm(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Marble Image Upload */}
                    <div>
                      <Label htmlFor="marbleImage" className="font-body text-sm">
                        300 DPI Marble Image *
                      </Label>
                      <div
                        onClick={() => customMarbleInputRef.current?.click()}
                        className={`mt-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
                          customMarblePreview
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/30 hover:border-primary/50'
                        }`}
                      >
                        {customMarblePreview ? (
                          <div className="relative">
                            <img
                              src={customMarblePreview}
                              alt="Custom marble preview"
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <p className="font-body text-xs text-muted-foreground mt-2 text-center">
                              Click to change image
                            </p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="font-body text-sm text-muted-foreground">
                              Upload 300 DPI marble image
                            </p>
                            <p className="font-body text-xs text-muted-foreground/70 mt-1">
                              Max 50MB • JPEG, PNG
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={customMarbleInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCustomMarbleImageSelect}
                        className="hidden"
                      />
                    </div>

                    {/* Marble Name */}
                    <div>
                      <Label htmlFor="marbleName" className="font-body text-sm">
                        Marble Name *
                      </Label>
                      <Input
                        id="marbleName"
                        value={customMarbleForm.name}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Calacatta Gold"
                        className="mt-1"
                      />
                    </div>

                    {/* Origin */}
                    <div>
                      <Label htmlFor="marbleOrigin" className="font-body text-sm">
                        Origin / Quarry Location
                      </Label>
                      <Input
                        id="marbleOrigin"
                        value={customMarbleForm.origin}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, origin: e.target.value }))}
                        placeholder="e.g., Carrara, Italy"
                        className="mt-1"
                      />
                    </div>

                    {/* Base Color */}
                    <div>
                      <Label htmlFor="marbleColor" className="font-body text-sm">
                        Base Color
                      </Label>
                      <Input
                        id="marbleColor"
                        value={customMarbleForm.baseColor}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, baseColor: e.target.value }))}
                        placeholder="e.g., Warm white with gold undertones"
                        className="mt-1"
                      />
                    </div>

                    {/* Veining Pattern */}
                    <div>
                      <Label htmlFor="marbleVeining" className="font-body text-sm">
                        Veining Pattern
                      </Label>
                      <Input
                        id="marbleVeining"
                        value={customMarbleForm.veiningPattern}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, veiningPattern: e.target.value }))}
                        placeholder="e.g., Bold gold and gray veining"
                        className="mt-1"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <Label htmlFor="marbleDescription" className="font-body text-sm">
                        Description
                      </Label>
                      <Textarea
                        id="marbleDescription"
                        value={customMarbleForm.description}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the marble characteristics..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    {/* Google Drive Link */}
                    <div>
                      <Label htmlFor="marbleGoogleDrive" className="font-body text-sm">
                        Google Drive Link (Optional)
                      </Label>
                      <Input
                        id="marbleGoogleDrive"
                        value={customMarbleForm.googleDriveLink}
                        onChange={(e) => setCustomMarbleForm(prev => ({ ...prev, googleDriveLink: e.target.value }))}
                        placeholder="https://drive.google.com/..."
                        className="mt-1"
                      />
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        Link to full-resolution marble image collection
                      </p>
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowCustomMarbleForm(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateCustomMarble}
                        disabled={isCreatingCustomMarble || !customMarbleForm.name || !customMarbleFile}
                        className="flex-1"
                      >
                        {isCreatingCustomMarble ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Marble
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

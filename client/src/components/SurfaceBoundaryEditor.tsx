import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  MousePointer2,
  Pencil,
  RotateCcw,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Move,
  Check,
  X,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';

// Types for surface boundaries
export interface Point {
  x: number;
  y: number;
}

export interface SurfaceBoundary {
  id: string;
  type: 'walls' | 'floors' | 'ceilings';
  points: Point[];
  visible: boolean;
}

interface SurfaceBoundaryEditorProps {
  imageUrl: string;
  initialBoundaries?: SurfaceBoundary[];
  onSave: (boundaries: SurfaceBoundary[]) => void;
  onCancel: () => void;
}

type Tool = 'select' | 'draw' | 'pan';

const SURFACE_COLORS = {
  walls: { fill: 'rgba(59, 130, 246, 0.3)', stroke: '#3B82F6', name: 'Walls' },
  floors: { fill: 'rgba(34, 197, 94, 0.3)', stroke: '#22C55E', name: 'Floors' },
  ceilings: { fill: 'rgba(234, 179, 8, 0.3)', stroke: '#EAB308', name: 'Ceilings' },
};

export default function SurfaceBoundaryEditor({
  imageUrl,
  initialBoundaries = [],
  onSave,
  onCancel,
}: SurfaceBoundaryEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [boundaries, setBoundaries] = useState<SurfaceBoundary[]>(initialBoundaries);
  const [selectedBoundary, setSelectedBoundary] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ boundaryId: string; pointIndex: number } | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeSurfaceType, setActiveSurfaceType] = useState<'walls' | 'floors' | 'ceilings'>('walls');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [history, setHistory] = useState<SurfaceBoundary[][]>([initialBoundaries]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageDimensions({ width: img.width, height: img.height });
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Save to history
  const saveToHistory = useCallback((newBoundaries: SurfaceBoundary[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newBoundaries)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setBoundaries(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setBoundaries(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [history, historyIndex]);

  // Reset to initial
  const handleReset = useCallback(() => {
    setBoundaries(JSON.parse(JSON.stringify(initialBoundaries)));
    saveToHistory(initialBoundaries);
  }, [initialBoundaries, saveToHistory]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: ((e.clientX - rect.left) * scaleX - pan.x) / zoom,
      y: ((e.clientY - rect.top) * scaleY - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // Find point near cursor
  const findNearbyPoint = useCallback((pos: Point, threshold: number = 10): { boundaryId: string; pointIndex: number } | null => {
    const scaledThreshold = threshold / zoom;
    
    for (const boundary of boundaries) {
      if (!boundary.visible) continue;
      for (let i = 0; i < boundary.points.length; i++) {
        const point = boundary.points[i];
        const distance = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
        if (distance < scaledThreshold) {
          return { boundaryId: boundary.id, pointIndex: i };
        }
      }
    }
    return null;
  }, [boundaries, zoom]);

  // Find boundary containing point
  const findBoundaryAtPoint = useCallback((pos: Point): string | null => {
    for (const boundary of boundaries) {
      if (!boundary.visible) continue;
      if (isPointInPolygon(pos, boundary.points)) {
        return boundary.id;
      }
    }
    return null;
  }, [boundaries]);

  // Check if point is inside polygon
  const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);

    if (activeTool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'select') {
      const nearbyPoint = findNearbyPoint(pos);
      if (nearbyPoint) {
        setSelectedPoint(nearbyPoint);
        setSelectedBoundary(nearbyPoint.boundaryId);
        return;
      }

      const boundaryId = findBoundaryAtPoint(pos);
      if (boundaryId) {
        setSelectedBoundary(boundaryId);
        setSelectedPoint(null);
      } else {
        setSelectedBoundary(null);
        setSelectedPoint(null);
      }
    }

    if (activeTool === 'draw') {
      if (!isDrawing) {
        setIsDrawing(true);
        setDrawingPoints([pos]);
      } else {
        setDrawingPoints(prev => [...prev, pos]);
      }
    }
  }, [activeTool, getCanvasCoords, findNearbyPoint, findBoundaryAtPoint, isDrawing, pan]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (selectedPoint && activeTool === 'select') {
      const pos = getCanvasCoords(e);
      setBoundaries(prev => prev.map(boundary => {
        if (boundary.id === selectedPoint.boundaryId) {
          const newPoints = [...boundary.points];
          newPoints[selectedPoint.pointIndex] = pos;
          return { ...boundary, points: newPoints };
        }
        return boundary;
      }));
    }
  }, [isPanning, panStart, selectedPoint, activeTool, getCanvasCoords]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (selectedPoint) {
      saveToHistory(boundaries);
      setSelectedPoint(null);
    }
  }, [isPanning, selectedPoint, boundaries, saveToHistory]);

  // Handle double click to complete drawing
  const handleDoubleClick = useCallback(() => {
    if (activeTool === 'draw' && isDrawing && drawingPoints.length >= 3) {
      const newBoundary: SurfaceBoundary = {
        id: `${activeSurfaceType}-${Date.now()}`,
        type: activeSurfaceType,
        points: drawingPoints,
        visible: true,
      };
      
      const newBoundaries = [...boundaries, newBoundary];
      setBoundaries(newBoundaries);
      saveToHistory(newBoundaries);
      setDrawingPoints([]);
      setIsDrawing(false);
    }
  }, [activeTool, isDrawing, drawingPoints, activeSurfaceType, boundaries, saveToHistory]);

  // Cancel drawing with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        setDrawingPoints([]);
        setIsDrawing(false);
      }
      if (e.key === 'Delete' && selectedBoundary) {
        const newBoundaries = boundaries.filter(b => b.id !== selectedBoundary);
        setBoundaries(newBoundaries);
        saveToHistory(newBoundaries);
        setSelectedBoundary(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, selectedBoundary, boundaries, saveToHistory, handleUndo, handleRedo]);

  // Toggle boundary visibility
  const toggleBoundaryVisibility = useCallback((id: string) => {
    setBoundaries(prev => prev.map(b => 
      b.id === id ? { ...b, visible: !b.visible } : b
    ));
  }, []);

  // Delete selected boundary
  const deleteSelectedBoundary = useCallback(() => {
    if (selectedBoundary) {
      const newBoundaries = boundaries.filter(b => b.id !== selectedBoundary);
      setBoundaries(newBoundaries);
      saveToHistory(newBoundaries);
      setSelectedBoundary(null);
    }
  }, [selectedBoundary, boundaries, saveToHistory]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !imageLoaded) return;

    // Set canvas size
    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw boundaries
    for (const boundary of boundaries) {
      if (!boundary.visible || boundary.points.length < 2) continue;

      const colors = SURFACE_COLORS[boundary.type];
      const isSelected = boundary.id === selectedBoundary;

      // Draw filled polygon
      ctx.beginPath();
      ctx.moveTo(boundary.points[0].x, boundary.points[0].y);
      for (let i = 1; i < boundary.points.length; i++) {
        ctx.lineTo(boundary.points[i].x, boundary.points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = colors.fill;
      ctx.fill();

      // Draw outline
      ctx.strokeStyle = isSelected ? '#fff' : colors.stroke;
      ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom;
      ctx.stroke();

      // Draw control points
      for (let i = 0; i < boundary.points.length; i++) {
        const point = boundary.points[i];
        const isPointSelected = selectedPoint?.boundaryId === boundary.id && selectedPoint?.pointIndex === i;

        ctx.beginPath();
        ctx.arc(point.x, point.y, (isPointSelected ? 8 : 6) / zoom, 0, Math.PI * 2);
        ctx.fillStyle = isPointSelected ? '#fff' : colors.stroke;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : colors.stroke;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
    }

    // Draw current drawing
    if (isDrawing && drawingPoints.length > 0) {
      const colors = SURFACE_COLORS[activeSurfaceType];

      ctx.beginPath();
      ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
      for (let i = 1; i < drawingPoints.length; i++) {
        ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
      }
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw points
      for (const point of drawingPoints) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = colors.stroke;
        ctx.fill();
      }
    }

    ctx.restore();
  }, [boundaries, selectedBoundary, selectedPoint, drawingPoints, isDrawing, activeSurfaceType, zoom, pan, imageLoaded, imageDimensions]);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Adjust Surface Boundaries
          </h2>
          <span className="text-sm text-muted-foreground">
            Click and drag control points to adjust • Double-click to complete drawing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(boundaries)}>
            <Check className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-card/90 backdrop-blur border-r border-border flex flex-col items-center py-4 gap-2">
          <div className="text-xs text-muted-foreground mb-2">Tools</div>
          
          <Button
            variant={activeTool === 'select' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveTool('select')}
            title="Select & Move (V)"
          >
            <MousePointer2 className="w-5 h-5" />
          </Button>
          
          <Button
            variant={activeTool === 'draw' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveTool('draw')}
            title="Draw Polygon (P)"
          >
            <Pencil className="w-5 h-5" />
          </Button>
          
          <Button
            variant={activeTool === 'pan' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setActiveTool('pan')}
            title="Pan (Space + Drag)"
          >
            <Move className="w-5 h-5" />
          </Button>

          <div className="w-8 h-px bg-border my-2" />
          
          <div className="text-xs text-muted-foreground mb-2">View</div>
          
          <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In (+)">
            <ZoomIn className="w-5 h-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out (-)">
            <ZoomOut className="w-5 h-5" />
          </Button>

          <div className="w-8 h-px bg-border my-2" />
          
          <div className="text-xs text-muted-foreground mb-2">History</div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-5 h-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset to AI Detection">
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-neutral-900 flex items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full cursor-crosshair"
            style={{
              cursor: activeTool === 'pan' ? 'grab' : activeTool === 'draw' ? 'crosshair' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
          />
        </div>

        {/* Right Panel - Layers */}
        <div className="w-64 bg-card/90 backdrop-blur border-l border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-foreground">Surface Layers</span>
            </div>

            {/* Surface Type Selector for Drawing */}
            {activeTool === 'draw' && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Drawing Surface Type:</div>
                {(['walls', 'floors', 'ceilings'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveSurfaceType(type)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      activeSurfaceType === type
                        ? 'bg-primary/20 border border-primary'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: SURFACE_COLORS[type].stroke }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Boundary List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs text-muted-foreground mb-2">
              {boundaries.length} surface{boundaries.length !== 1 ? 's' : ''} detected
            </div>
            
            <div className="space-y-2">
              {boundaries.map((boundary) => (
                <div
                  key={boundary.id}
                  onClick={() => setSelectedBoundary(boundary.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedBoundary === boundary.id
                      ? 'bg-primary/20 border border-primary'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: SURFACE_COLORS[boundary.type].stroke }}
                  />
                  <span className="text-sm flex-1 capitalize">{boundary.type}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBoundaryVisibility(boundary.id);
                    }}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {boundary.visible ? (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {boundaries.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No surfaces detected.
                <br />
                Use the draw tool to add surfaces.
              </div>
            )}
          </div>

          {/* Actions */}
          {selectedBoundary && (
            <div className="p-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={deleteSelectedBoundary}
              >
                Delete Selected Surface
              </Button>
            </div>
          )}

          {/* Legend */}
          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">Legend</div>
            <div className="space-y-1">
              {Object.entries(SURFACE_COLORS).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: colors.stroke }}
                  />
                  <span className="text-xs text-muted-foreground">{colors.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card/90 backdrop-blur border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span>•</span>
          <span>Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
          {isDrawing && (
            <>
              <span>•</span>
              <span className="text-primary">Drawing {activeSurfaceType} ({drawingPoints.length} points)</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Press ESC to cancel drawing</span>
          <span>•</span>
          <span>Delete key to remove selected surface</span>
        </div>
      </div>
    </motion.div>
  );
}

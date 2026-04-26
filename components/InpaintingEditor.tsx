'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Paintbrush, Eraser, RotateCcw, X, Loader2, Trash2, ArrowUpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SaveInpaintDialog } from './SaveInpaintDialog';

interface InpaintingEditorProps {
  imageUrl: string;
  originalFilename: string;
  onClose: () => void;
  onSave: (resultUrl: string, filename: string, replaceOriginal: boolean) => Promise<void>;
  replicateApiKey?: string;
  embedded?: boolean;
}

export function InpaintingEditor({ imageUrl, originalFilename, onClose, onSave, replicateApiKey, embedded = false }: InpaintingEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'inpaint' | 'remove' | 'upscale'>('inpaint');

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;
      
      // Save original image in ref
      originalImageRef.current = img;
      
      // Calculate display size (max 70vh)
      const maxHeight = window.innerHeight * 0.7;
      const maxWidth = window.innerWidth - 400; // Account for sidebar
      
      let width = img.width;
      let height = img.height;
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      setImageDimensions({ width: img.width, height: img.height });
      setCanvasDimensions({ width, height });
      
      // Set up image canvas
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      // Set up mask canvas (transparent)
      maskCanvas.width = width;
      maskCanvas.height = height;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
    // Sharp white mask - 100% opaque, no blur
    ctx.fillStyle = tool === 'brush' ? 'rgba(255, 255, 255, 1.0)' : 'transparent';
    ctx.strokeStyle = tool === 'brush' ? 'rgba(255, 255, 255, 1.0)' : 'transparent';
    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (lastPos) {
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      const steps = Math.max(Math.abs(x - lastPos.x), Math.abs(y - lastPos.y));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ix = lastPos.x + (x - lastPos.x) * t;
        const iy = lastPos.y + (y - lastPos.y) * t;
        ctx.beginPath();
        ctx.arc(ix, iy, brushSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    }

    setLastPos({ x, y });
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const rect = maskCanvas.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    if (!isDrawing) return;
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  };

  const generateMask = (): string => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return '';
    
    // Create final mask canvas with original image dimensions
    const finalMask = document.createElement('canvas');
    finalMask.width = imageDimensions.width;
    finalMask.height = imageDimensions.height;
    const maskCtx = finalMask.getContext('2d');
    if (!maskCtx) return '';

    // Fill with white (unchanged area)
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, finalMask.width, finalMask.height);
    
    // Get mask drawing and scale it to original image size
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return '';
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Create a temporary canvas to scale the mask
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '';
    
    // Draw BLACK where user drew (inpainting area), WHITE for unchanged
    const tempImageData = tempCtx.createImageData(maskCanvas.width, maskCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        // User drew here - BLACK for inpainting
        tempImageData.data[i] = 0;
        tempImageData.data[i + 1] = 0;
        tempImageData.data[i + 2] = 0;
        tempImageData.data[i + 3] = 255;
      } else {
        // User didn't draw - WHITE for unchanged
        tempImageData.data[i] = 255;
        tempImageData.data[i + 1] = 255;
        tempImageData.data[i + 2] = 255;
        tempImageData.data[i + 3] = 255;
      }
    }
    tempCtx.putImageData(tempImageData, 0, 0);
    
    // Scale to original image size
    maskCtx.drawImage(tempCanvas, 0, 0, maskCanvas.width, maskCanvas.height, 0, 0, imageDimensions.width, imageDimensions.height);
    
    return finalMask.toDataURL('image/png');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    if (!replicateApiKey) {
      toast.error('Please add Replicate API key in Settings');
      return;
    }

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;
    
    console.log('Mask canvas dimensions:', maskCanvas.width, 'x', maskCanvas.height);
    
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    let hasDrawing = false;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) {
        hasDrawing = true;
        break;
      }
    }
    
    console.log('Has drawing:', hasDrawing);
    
    if (!hasDrawing) {
      toast.error('Please draw a mask first');
      return;
    }

    setIsGenerating(true);

    try {
      // Generate mask first
      const maskDataUrl = generateMask();
      
      console.log('Image dimensions (original):', imageDimensions);
      console.log('Canvas dimensions (display):', canvasDimensions);
      console.log('Mask canvas dimensions:', maskCanvasRef.current?.width, 'x', maskCanvasRef.current?.height);
      
      // IMPORTANT: Send image in ORIGINAL dimensions to match the mask
      // The mask is already scaled to original dimensions in generateMask()
      // So we need to send the original image, not the display canvas
      const canvas = canvasRef.current;
      const img = originalImageRef.current;
      if (!canvas || !img) return;
      
      // Create a canvas with original image dimensions
      const fullSizeCanvas = document.createElement('canvas');
      fullSizeCanvas.width = imageDimensions.width;
      fullSizeCanvas.height = imageDimensions.height;
      const fullSizeCtx = fullSizeCanvas.getContext('2d');
      if (!fullSizeCtx) return;
      
      // Draw original image at full size
      fullSizeCtx.drawImage(img, 0, 0, imageDimensions.width, imageDimensions.height);
      const imageBase64 = fullSizeCanvas.toDataURL('image/jpeg', 0.95);
      
      const response = await fetch('/api/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          mask: maskDataUrl,
          prompt: prompt,
          apiKey: replicateApiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate inpainting');
      }

      const data = await response.json();
      
      console.log('API response data:', data);
      console.log('Output URL:', data.output);
      
      if (!data.output) {
        throw new Error('No output received from API');
      }
      
      // Ideogram preserves dimensions - use result directly
      setPreviewUrl(data.output);
      setPrompt('');
      toast.success('Inpainting generated!');
    } catch (error) {
      console.error('Inpainting error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate inpainting';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveClick = () => {
    if (!previewUrl) return;
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async (filename: string, replaceOriginal: boolean) => {
    if (!previewUrl) return;
    await onSave(previewUrl, filename, replaceOriginal);
    setShowSaveDialog(false);
    onClose();
  };

  const handleTryAgain = () => {
    // Hide preview to show canvas
    setPreviewUrl(null);
    
    // Redraw original image and reset mask canvas on next frame
    setTimeout(() => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const img = originalImageRef.current;
      if (!canvas || !maskCanvas || !img) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Restore canvas dimensions
      canvas.width = canvasDimensions.width;
      canvas.height = canvasDimensions.height;
      
      // Restore mask canvas dimensions
      maskCanvas.width = canvasDimensions.width;
      maskCanvas.height = canvasDimensions.height;
      
      // Redraw image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvasDimensions.width, canvasDimensions.height);
      
      // Clear mask
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    }, 0);
  };

  return (
    <>
    <div className={embedded ? "fixed inset-0 z-[60] flex pointer-events-none" : "fixed inset-0 bg-zinc-950 z-[60] flex"}>
      {/* Left Tool Panel */}
      <div className={`w-20 bg-zinc-900/95 border-r-2 border-zinc-800/80 flex flex-col items-center py-6 gap-3 shadow-xl ${embedded ? 'pointer-events-auto' : ''}`}>
        <div className="text-center mb-2">
          <button 
            onClick={onClose}
            className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          >
            <span className="text-base">✨</span>
          </button>
        </div>
        
        <button
          onClick={() => setSelectedTool('inpaint')}
          className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
            selectedTool === 'inpaint'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500/50'
              : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200 border-2 border-zinc-700/60'
          }`}
        >
          <Paintbrush className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[9px] font-semibold tracking-wide uppercase">Inpaint</span>
        </button>
        
        <button
          onClick={() => setSelectedTool('remove')}
          className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 opacity-30 cursor-not-allowed ${
            selectedTool === 'remove'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500/50'
              : 'bg-zinc-800/60 text-zinc-500 border-2 border-zinc-700/60'
          }`}
          disabled
        >
          <Trash2 className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[9px] font-semibold tracking-wide uppercase">Erase</span>
        </button>
        
        <button
          onClick={() => setSelectedTool('upscale')}
          className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 opacity-30 cursor-not-allowed ${
            selectedTool === 'upscale'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500/50'
              : 'bg-zinc-800/60 text-zinc-500 border-2 border-zinc-700/60'
          }`}
          disabled
        >
          <ArrowUpCircle className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[9px] font-semibold tracking-wide uppercase">Upscale</span>
        </button>
        
        <div className="flex-1" />
        
        <div className="text-center">
          <div className="w-10 h-px bg-zinc-700/40 mx-auto mb-2" />
          <span className="text-[8px] text-zinc-600 font-medium uppercase tracking-wide">More</span>
        </div>
      </div>
      
      {/* Center Image Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Result"
              className="max-w-full max-h-[70vh] object-contain"
              onError={(e) => {
                toast.error('Failed to load result image');
                setPreviewUrl(null);
              }}
            />
          </div>
        ) : (
          <div className="relative inline-block border-2 border-primary/20">
            <canvas
              ref={canvasRef}
              className="block"
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
            <canvas
              ref={maskCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={() => {
                stopDrawing();
                setShowCursor(false);
              }}
              onMouseEnter={() => setShowCursor(true)}
              className="absolute top-0 left-0"
              style={{ maxWidth: '100%', maxHeight: '70vh', cursor: 'none' }}
            />
            {showCursor && (
              <div
                className="absolute pointer-events-none border-2 rounded-full"
                style={{
                  left: cursorPos.x,
                  top: cursorPos.y,
                  width: brushSize * 2,
                  height: brushSize * 2,
                  transform: 'translate(-50%, -50%)',
                  borderColor: tool === 'brush' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 0, 0, 0.8)',
                  backgroundColor: tool === 'brush' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Right Settings Panel */}
      <div className="w-96 bg-zinc-900/95 border-l-2 border-zinc-800/80 flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b-2 border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">Edit Image</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-zinc-800/80 transition-colors">
              <X className="w-5 h-5 text-zinc-400" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-6">

        {selectedTool === 'inpaint' && !previewUrl ? (
          <div className="space-y-6">
            {/* Brush Settings */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Brush Settings</div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTool('brush')}
                  className={`flex-1 h-9 gap-1.5 text-xs font-medium rounded-lg border-2 shadow-sm transition-all duration-200 ${
                    tool === 'brush'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-zinc-800/90 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  Brush
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTool('eraser')}
                  className={`flex-1 h-9 gap-1.5 text-xs font-medium rounded-lg border-2 shadow-sm transition-all duration-200 ${
                    tool === 'eraser'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-zinc-800/90 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  Eraser
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">Size</label>
                  <span className="text-sm font-semibold text-purple-400">{brushSize}px</span>
                </div>
                <Slider
                  value={[brushSize]}
                  onValueChange={(value: number[]) => setBrushSize(value[0])}
                  min={5}
                  max={100}
                  step={5}
                />
              </div>
            </div>

            {/* Mask Settings */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Mask Settings</div>
              <Button 
                variant="outline" 
                onClick={clearMask} 
                className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-zinc-800/90 border-2 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100 shadow-sm transition-all duration-200"
              >
                <RotateCcw className="w-4 h-4" />
                Clear Mask
              </Button>
            </div>

            {/* Inpainting Prompt */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inpainting Prompt</div>
              <div className="space-y-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what to generate in the masked area..."
                  className="w-full h-20 px-4 py-3 bg-zinc-800/90 border-2 border-zinc-600/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all shadow-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <p className="text-[10px] text-zinc-500">Ctrl+Enter to generate</p>
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating} 
                variant="outline"
                size="sm"
                className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-primary text-white border-2 border-primary hover:bg-primary/90 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </div>
          </div>
        ) : selectedTool === 'inpaint' && previewUrl ? (
          <div className="space-y-6">
            <div className="p-5 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl">
              <p className="text-base text-purple-200 font-semibold">✨ Preview Generated</p>
              <p className="text-xs text-zinc-400 mt-2">Choose an action to continue</p>
            </div>
            <Button 
              onClick={handleSaveClick} 
              className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500/50 transition-all duration-200"
            >
              Save Image
            </Button>
            <Button 
              onClick={handleTryAgain} 
              variant="outline" 
              className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-zinc-800/90 border-2 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100 shadow-sm transition-all duration-200"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <span className="text-3xl">🚧</span>
              </div>
              <p className="text-sm font-medium text-zinc-400">Coming Soon</p>
              <p className="text-xs text-zinc-600 mt-2">This tool is under development</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
    
    <SaveInpaintDialog
      isOpen={showSaveDialog}
      onClose={() => setShowSaveDialog(false)}
      onSave={handleSaveConfirm}
      originalFilename={originalFilename}
    />
  </>
  );
}

'use client';

import { useRef, useState, useEffect } from 'react';

interface EditCanvasProps {
  imageUrl: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
  onMaskChange?: (maskDataUrl: string) => void;
  onClearMask?: () => void;
}

export function EditCanvas({ imageUrl, brushSize, tool, onMaskChange, onClearMask }: EditCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  
  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  };
  
  const getMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    if (!maskCanvas || !canvas) return null;
    
    // Hämta original bildstorlek från canvas
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    
    // Skapa final mask canvas med original dimensioner
    const finalMask = document.createElement('canvas');
    finalMask.width = originalWidth;
    finalMask.height = originalHeight;
    const maskCtx = finalMask.getContext('2d');
    if (!maskCtx) return null;

    // Fyll med vitt (oförändrat område)
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(0, 0, finalMask.width, finalMask.height);
    
    // Hämta mask-data
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Skapa temporär canvas för att konvertera mask
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;
    
    // Rita SVART där användaren ritade (inpainting-område), VIT för oförändrat
    const tempImageData = tempCtx.createImageData(maskCanvas.width, maskCanvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        // Användaren ritade här - SVART för inpainting
        tempImageData.data[i] = 0;
        tempImageData.data[i + 1] = 0;
        tempImageData.data[i + 2] = 0;
        tempImageData.data[i + 3] = 255;
      } else {
        // Användaren ritade inte - VIT för oförändrat
        tempImageData.data[i] = 255;
        tempImageData.data[i + 1] = 255;
        tempImageData.data[i + 2] = 255;
        tempImageData.data[i + 3] = 255;
      }
    }
    tempCtx.putImageData(tempImageData, 0, 0);
    
    // Skala till original bildstorlek
    maskCtx.drawImage(tempCanvas, 0, 0, maskCanvas.width, maskCanvas.height, 0, 0, originalWidth, originalHeight);
    
    return finalMask.toDataURL('image/png');
  };
  
  // Exponera clearMask och getMask via window-objektet
  useEffect(() => {
    (window as any).__editCanvasClearMask = clearMask;
    (window as any).__editCanvasGetMask = getMask;
    return () => {
      delete (window as any).__editCanvasClearMask;
      delete (window as any).__editCanvasGetMask;
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;

      // Beräkna tillgängligt utrymme (viewport minus EditToolbar och EditPanel)
      const availableWidth = window.innerWidth - 256 - 400 - 100; // minus toolbars och padding
      const availableHeight = window.innerHeight - 78 - 50; // minus header och padding
      
      // Beräkna skalning för att passa tillgängligt utrymme
      const scaleX = availableWidth / img.width;
      const scaleY = availableHeight / img.height;
      const scale = Math.min(scaleX, scaleY, 1); // Max 1 för att inte förstora
      
      const displayWidth = img.width * scale;
      const displayHeight = img.height * scale;

      canvas.width = displayWidth;
      canvas.height = displayHeight;
      maskCanvas.width = displayWidth;
      maskCanvas.height = displayHeight;

      const ctx = canvas.getContext('2d');
      const maskCtx = maskCanvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      }
      
      if (maskCtx) {
        maskCtx.fillStyle = 'rgba(0, 0, 0, 0)';
        maskCtx.fillRect(0, 0, displayWidth, displayHeight);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setLastPos({ x, y });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (lastPos) {
      ctx.beginPath();
      ctx.moveTo(lastPos.x, lastPos.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = tool === 'brush' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0)';
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.stroke();
    }
    
    setLastPos({ x, y });
    
    if (onMaskChange) {
      onMaskChange(canvas.toDataURL('image/png'));
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="block"
        />
        <canvas
          ref={maskCanvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  );
}

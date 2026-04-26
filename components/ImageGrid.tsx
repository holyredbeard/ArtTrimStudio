'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useMemo, useState, useEffect } from 'react';
import { ImageRecord } from '@/lib/db';
import { Badge } from './ui/badge';
import { Trash2, MessageCircle, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { EditCanvas } from './EditCanvas';

interface ImageGridProps {
  images: ImageRecord[];
  rootHandle: FileSystemDirectoryHandle | null;
  onImageClick?: (image: ImageRecord) => void;
  onFullSizeClick?: (image: ImageRecord) => void;
  selectedImages: Set<string>;
  onToggleSelect?: (relativePath: string, shiftKey?: boolean, index?: number) => void;
  onNormalClick?: (relativePath: string, index?: number) => void;
  onDelete?: (image: ImageRecord) => void;
  thumbnailSize?: 'small' | 'medium' | 'large';
  onMarqueeSelect?: (indices: number[]) => void;
  isModalOpen?: boolean;
  selectedImage?: ImageRecord | null;
  onNavigate?: (direction: 'prev' | 'next') => void;
  isTagManagerOpen?: boolean;
  isFullscreenImage?: boolean;
  onToggleFullscreen?: () => void;
  onToggleTagManager?: () => void;
  isEditMode?: boolean;
  editImageUrl?: string;
  brushTool?: 'brush' | 'eraser';
  brushSize?: number;
}

export function ImageGrid({ images, rootHandle, onImageClick, onFullSizeClick, selectedImages, onToggleSelect, onNormalClick, onDelete, thumbnailSize = 'medium', onMarqueeSelect, isModalOpen, selectedImage, onNavigate, isTagManagerOpen, isFullscreenImage, onToggleFullscreen, onToggleTagManager, isEditMode, editImageUrl, brushTool, brushSize }: ImageGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });

  const COLUMN_COUNT = thumbnailSize === 'small' ? 10 : thumbnailSize === 'large' ? 3 : 5;
  const GAP = thumbnailSize === 'small' ? 8 : 16;
  const ITEM_SIZE = thumbnailSize === 'small' ? 120 : thumbnailSize === 'large' ? 380 : 280;

  const rows = useMemo(() => {
    const result: ImageRecord[][] = [];
    for (let i = 0; i < images.length; i += COLUMN_COUNT) {
      result.push(images.slice(i, i + COLUMN_COUNT));
    }
    return result;
  }, [images, COLUMN_COUNT]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE + GAP,
    overscan: 3,
  });

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No images found. Select a folder and scan to get started.</p>
      </div>
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = parentRef.current?.getBoundingClientRect();
      if (rect) {
        setIsMarqueeActive(true);
        setMarqueeStart({ x: e.clientX - rect.left, y: e.clientY - rect.top + parentRef.current!.scrollTop });
        setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top + parentRef.current!.scrollTop });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMarqueeActive) {
      const rect = parentRef.current?.getBoundingClientRect();
      if (rect) {
        setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top + parentRef.current!.scrollTop });
      }
    }
  };

  const handleMouseUp = () => {
    if (isMarqueeActive) {
      setIsMarqueeActive(false);
      
      // Calculate which images are within the marquee
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      
      const selectedIndices: number[] = [];
      
      // Calculate grid width to properly position items
      const parentWidth = parentRef.current?.clientWidth || 0;
      const totalGapWidth = (COLUMN_COUNT - 1) * GAP;
      const availableWidth = parentWidth - totalGapWidth;
      const actualItemWidth = availableWidth / COLUMN_COUNT;
      
      rows.forEach((row, rowIndex) => {
        row.forEach((image, colIndex) => {
          const flatIndex = rowIndex * COLUMN_COUNT + colIndex;
          
          // Calculate actual position based on grid layout
          const itemX = colIndex * (actualItemWidth + GAP);
          const itemY = rowIndex * (ITEM_SIZE + GAP);
          
          // Check if marquee intersects with this item (center point method for accuracy)
          const itemCenterX = itemX + actualItemWidth / 2;
          const itemCenterY = itemY + ITEM_SIZE / 2;
          
          if (itemCenterX >= minX && itemCenterX <= maxX &&
              itemCenterY >= minY && itemCenterY <= maxY) {
            selectedIndices.push(flatIndex);
          }
        });
      });
      
      onMarqueeSelect?.(selectedIndices);
    }
  };

  const marqueeStyle = {
    left: Math.min(marqueeStart.x, marqueeEnd.x),
    top: Math.min(marqueeStart.y, marqueeEnd.y),
    width: Math.abs(marqueeEnd.x - marqueeStart.x),
    height: Math.abs(marqueeEnd.y - marqueeStart.y),
  };

  if (isModalOpen && selectedImage) {
    return (
      <FocusedImageView
        images={images}
        selectedImage={selectedImage}
        rootHandle={rootHandle}
        onNavigate={onNavigate}
        isTagManagerOpen={isTagManagerOpen}
        isFullscreenImage={isFullscreenImage}
        onToggleFullscreen={onToggleFullscreen}
        onToggleTagManager={onToggleTagManager}
        isEditMode={isEditMode}
        editImageUrl={editImageUrl}
        brushTool={brushTool}
        brushSize={brushSize}
      />
    );
  }

  return (
    <div 
      ref={parentRef} 
      className="h-full overflow-auto relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        // Clear selections when clicking on empty space (not on images)
        // But don't clear if modal is open
        if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isModalOpen) {
          onNormalClick?.('', undefined);
        }
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
        onClick={(e) => {
          // Also handle clicks on the inner container
          // But don't clear if modal is open
          if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isModalOpen) {
            onNormalClick?.('', undefined);
          }
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${ITEM_SIZE}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={(e) => {
                // Clear selections when clicking on row background
                // But don't clear if modal is open
                if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isModalOpen) {
                  onNormalClick?.('', undefined);
                }
              }}
            >
              <div 
                className={`grid gap-6 auto-rows-fr ${
                  thumbnailSize === 'small' ? 'grid-cols-10' :
                  thumbnailSize === 'large' ? 'grid-cols-3' :
                  'grid-cols-5'
                }`}
                onClick={(e) => {
                  // Clear selections when clicking on grid gaps
                  // But don't clear if modal is open
                  if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isModalOpen) {
                    onNormalClick?.('', undefined);
                  }
                }}
              >
                {row.map((image, colIndex) => (
                  <ImageCard
                    key={image.relativePath}
                    image={image}
                    rootHandle={rootHandle}
                    isSelected={selectedImages.has(image.relativePath)}
                    onToggleSelect={(shiftKey) => {
                      const flatIndex = virtualRow.index * COLUMN_COUNT + colIndex;
                      onToggleSelect?.(image.relativePath, shiftKey, flatIndex);
                    }}
                    onNormalClick={() => {
                      const flatIndex = virtualRow.index * COLUMN_COUNT + colIndex;
                      onNormalClick?.(image.relativePath, flatIndex);
                    }}
                    onDelete={() => onDelete?.(image)}
                    thumbnailSize={thumbnailSize}
                    onOpenChat={() => onImageClick?.(image)}
                    onOpenFullSize={() => onFullSizeClick?.(image)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {isMarqueeActive && (
        <div
          className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
          style={marqueeStyle}
        />
      )}
    </div>
  );
}

interface ImageCardProps {
  image: ImageRecord;
  rootHandle: FileSystemDirectoryHandle | null;
  isSelected: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  onNormalClick?: () => void;
  onDelete?: () => void;
  thumbnailSize?: 'small' | 'medium' | 'large';
  onOpenChat?: () => void;
  onOpenFullSize?: () => void;
}

function ImageCard({ image, rootHandle, isSelected, onToggleSelect, onNormalClick, onDelete, thumbnailSize = 'medium', onOpenChat, onOpenFullSize }: ImageCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    
    async function loadThumbnail() {
      if (!rootHandle) return;
      
      try {
        const url = await getThumbnailUrl(rootHandle, image.thumbnailPath);
        if (mounted) {
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
      }
    }

    loadThumbnail();

    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [image.thumbnailPath, rootHandle]);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd click - toggle selection for batch operations
      e.stopPropagation();
      onToggleSelect?.(false);
    } else if (e.shiftKey) {
      // Shift click - range selection
      e.stopPropagation();
      onToggleSelect?.(true);
    } else {
      // Normal click - open modal
      e.stopPropagation();
      onOpenChat?.();
    }
  };

  return (
    <div
      className={`group relative bg-card rounded-lg overflow-hidden border transition-all cursor-pointer shadow-sm hover:shadow-lg ${
        isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-zinc-800 hover:border-violet-500'
      }`}
      onClick={handleClick}
      style={{ transform: 'scale(1)' }}
    >
      <div className="aspect-square bg-muted relative">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={image.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {isSelected && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {image.reviewStatus && image.reviewStatus !== 'keep' && image.reviewStatus !== 'discard' && (
          <div className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-bold ${
            image.reviewStatus === 'upgrade' ? 'bg-yellow-500/90 text-white' :
            'bg-blue-500/90 text-white'
          }`}>
            {image.reviewStatus === 'upgrade' ? '↑ IMPROVE' : '✓ READY'}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat?.();
          }}
          className="absolute bottom-2 left-2 w-8 h-8 bg-white/90 hover:bg-white/90 text-black opacity-0 group-hover:opacity-100 transition-opacity"
          title="Open chat"
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onOpenFullSize?.();
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white/90 text-black opacity-0 group-hover:opacity-100 transition-opacity"
          title="View full size"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="absolute bottom-2 right-2 w-8 h-8 bg-destructive/80 hover:bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity"
          title="Move to trash"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {thumbnailSize !== 'small' && (
        <div className="p-2">
          <p className="text-xs font-medium truncate mb-1">{image.filename}</p>
          <div className="flex flex-wrap gap-1">
            {image.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-secondary-foreground">
                {tag}
              </span>
            ))}
            {image.tags.length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                +{image.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { getThumbnailUrl } from '@/lib/thumbnail';
import { ChevronLeft, ChevronRight, X, ChevronDown, Check, ArrowUp, Paintbrush } from 'lucide-react';

interface FocusedImageViewProps {
  images: ImageRecord[];
  selectedImage: ImageRecord;
  rootHandle: FileSystemDirectoryHandle | null;
  onNavigate?: (direction: 'prev' | 'next') => void;
  isTagManagerOpen?: boolean;
  isFullscreenImage?: boolean;
  onToggleFullscreen?: () => void;
  onToggleTagManager?: () => void;
  isEditMode?: boolean;
  editImageUrl?: string;
  brushTool?: 'brush' | 'eraser';
  brushSize?: number;
}

function FocusedImageView({ images, selectedImage, rootHandle, onNavigate, isTagManagerOpen, isFullscreenImage, onToggleFullscreen, onToggleTagManager, isEditMode, editImageUrl, brushTool, brushSize }: FocusedImageViewProps) {
  const currentIndex = images.findIndex(img => img.relativePath === selectedImage.relativePath);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onNavigate?.('prev');
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNavigate?.('next');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onNavigate]);

  return (
    <div 
      className={`h-full overflow-hidden relative bg-zinc-950 z-[45] transition-all duration-500 ease-in-out ${
        isFullscreenImage ? 'p-0' : isEditMode ? 'pl-[256px] pr-[400px]' : isTagManagerOpen ? 'pl-[300px] pr-[500px]' : 'pr-[500px]'
      }`}
      onClick={(e) => e.stopPropagation()}
      data-image-area="true"
    >
      <div 
        className="w-full h-full relative"
      >
        {/* Kontroller som alltid ligger ytterst i den tillgängliga ytan */}
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.('prev');
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-50 p-2.5 rounded-xl bg-black/40 hover:bg-primary/80 text-white transition-all duration-200 shadow-xl"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.('next');
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-50 p-2.5 rounded-xl bg-black/40 hover:bg-primary/80 text-white transition-all duration-200 shadow-xl"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.('close' as any);
          }}
          className="absolute top-6 left-6 z-50 p-3 rounded-lg bg-black/40 hover:bg-red-500/80 text-white transition-all duration-200 shadow-lg"
          aria-label="Close"
        >
          <X className="w-7 h-7" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFullscreen?.();
          }}
          className="absolute top-6 right-6 z-50 p-2 rounded-lg bg-black/40 hover:bg-primary/80 text-white transition-all duration-200 shadow-lg"
          aria-label="Toggle fullscreen"
        >
          <Maximize2 className="w-6 h-6" />
        </button>

        {/* Behållare för bilden med rejäl padding i modalläge för att undvika ikonerna */}
        <div 
          className={`w-full h-full flex items-center justify-center transition-all duration-500 ease-in-out ${
            isFullscreenImage ? 'p-0' : 'p-16'
          }`}
          onClick={() => {
            if (isFullscreenImage) {
              onToggleFullscreen?.();
            }
          }}
        >
          {isEditMode && editImageUrl ? (
            <EditCanvas
              imageUrl={editImageUrl}
              brushSize={brushSize || 20}
              tool={brushTool || 'brush'}
            />
          ) : (
            <FocusedMainImage
              image={selectedImage}
              rootHandle={rootHandle}
              isFullscreen={isFullscreenImage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface FocusedSideImageProps {
  image: ImageRecord;
  rootHandle: FileSystemDirectoryHandle | null;
  side: 'left' | 'right';
  isHovered: boolean;
}

function FocusedSideImage({ image, rootHandle, side, isHovered }: FocusedSideImageProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    
    async function loadThumbnail() {
      if (!rootHandle) return;
      
      try {
        const url = await getThumbnailUrl(rootHandle, image.thumbnailPath);
        if (mounted) {
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
      }
    }

    loadThumbnail();

    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [image.thumbnailPath, rootHandle]);

  return (
    <div className="relative w-full h-full">
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={image.filename}
          className="w-full h-full object-cover"
        />
      )}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: isHovered ? 0.3 : 0.75 }}
      />
      <div
        className={`absolute top-1/2 -translate-y-1/2 text-white transition-opacity duration-200 ${
          side === 'left' ? 'left-4' : 'right-4'
        }`}
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        {side === 'left' ? (
          <ChevronLeft className="w-12 h-12" />
        ) : (
          <ChevronRight className="w-12 h-12" />
        )}
      </div>
    </div>
  );
}

interface FocusedMainImageProps {
  image: ImageRecord;
  rootHandle: FileSystemDirectoryHandle | null;
}

function FocusedMainImage({ image, rootHandle, isFullscreen }: FocusedMainImageProps & { isFullscreen?: boolean }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [fullResUrl, setFullResUrl] = useState<string>('');
  const [isFullResLoaded, setIsFullResLoaded] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    
    // START loading new image
    async function loadImages() {
      if (!rootHandle) return;
      
      // Stage 1: Load thumbnail
      try {
        const thumbUrl = await getThumbnailUrl(rootHandle, image.thumbnailPath);
        if (mounted) {
          setThumbnailUrl(thumbUrl);
        }
      } catch (error) {
        console.error('Failed to load placeholder:', error);
      }

      // Stage 2: Load full-resolution image
      try {
        const pathParts = image.relativePath.split('/');
        let currentDir: FileSystemDirectoryHandle = rootHandle;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
        }
        
        const fileName = pathParts[pathParts.length - 1];
        const fileHandle = await currentDir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const fullUrl = URL.createObjectURL(file);
        
        if (mounted) {
          setFullResUrl(fullUrl);
          setIsFullResLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load full size image:', error);
      }
    }

    // Reset state IMMEDIATELY for new image
    setIsFullResLoaded(false);
    setFullResUrl('');
    setThumbnailUrl(''); // Clear old thumbnail too to prevent flicker
    
    loadImages();

    return () => {
      mounted = false;
      // Note: revoking here might be risky if the next render still needs it, 
      // but standard practice for object URLs.
    };
  }, [image.relativePath, image.thumbnailPath, rootHandle]);

  const getPadding = () => {
    if (isFullscreen) return 'p-0';
    return isPortrait ? 'p-2' : 'p-4';
  };

  return (
    <div className={`w-full h-full flex items-center justify-center ${getPadding()}`}>
      {fullResUrl || thumbnailUrl ? (
        <img
          src={fullResUrl || thumbnailUrl}
          alt={image.filename}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-opacity duration-300"
          style={{ opacity: isFullResLoaded ? 1 : 0.7 }}
          onLoad={(e) => {
            const img = e.currentTarget;
            setIsPortrait(img.naturalHeight > img.naturalWidth);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

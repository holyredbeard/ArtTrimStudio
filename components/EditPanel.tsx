'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Paintbrush, Eraser, Loader2 } from 'lucide-react';

interface EditPanelProps {
  selectedTool: string;
  brushTool: 'brush' | 'eraser';
  onBrushToolChange: (tool: 'brush' | 'eraser') => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onGenerate?: (prompt: string) => void;
  onSave?: () => void;
  generatedImageUrl?: string;
  isGenerating?: boolean;
}

export function EditPanel({ selectedTool, brushTool, onBrushToolChange, brushSize, onBrushSizeChange, onGenerate, onSave, generatedImageUrl, isGenerating }: EditPanelProps) {
  const [prompt, setPrompt] = useState('');
  
  const handleGenerate = () => {
    if (onGenerate && prompt.trim()) {
      onGenerate(prompt);
    }
  };

  return (
    <div className="fixed right-0 top-[78px] bottom-0 w-[400px] bg-zinc-900 border-l-2 border-l-primary flex flex-col z-50 shadow-xl">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-100">Edit Settings</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {/* Brush Settings */}
          {selectedTool === 'inpaint' && (
            <>
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Brush Settings</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onBrushToolChange('brush')}
                    className={`flex-1 h-8 gap-1.5 text-xs font-medium rounded-lg border-2 shadow-sm transition-all duration-200 ${
                      brushTool === 'brush'
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
                    onClick={() => onBrushToolChange('eraser')}
                    className={`flex-1 h-8 gap-1.5 text-xs font-medium rounded-lg border-2 shadow-sm transition-all duration-200 ${
                      brushTool === 'eraser'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-zinc-800/90 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100'
                    }`}
                  >
                    <Eraser className="w-4 h-4" />
                    Eraser
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-400">Size</label>
                    <span className="text-xs text-zinc-500">{brushSize}px</span>
                  </div>
                  <Slider
                    value={[brushSize]}
                    onValueChange={(value) => onBrushSizeChange(value[0])}
                    min={5}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Mask Settings */}
              <div className="space-y-2 pt-4 border-t border-zinc-800/60">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Mask Settings</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if ((window as any).__editCanvasClearMask) {
                      (window as any).__editCanvasClearMask();
                    }
                  }}
                  className="w-full h-8 text-xs font-medium rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-red-500/30 hover:text-red-100 hover:border-red-500 border-2 border-zinc-600/80 shadow-sm transition-all duration-200"
                >
                  Clear Mask
                </Button>
              </div>

              {/* Inpainting Prompt */}
              <div className="space-y-2 pt-4 border-zinc-800/60">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inpainting Prompt</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  placeholder="Describe what to generate in the masked area..."
                  className="w-full h-24 px-3 py-2 bg-zinc-800/90 border-2 border-zinc-600/80 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none transition-all shadow-sm"
                />
                <p className="text-[10px] text-zinc-500">Ctrl+Enter to generate</p>
              </div>

              {isGenerating ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-primary text-white border-2 border-primary opacity-75 shadow-sm transition-all duration-200"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="w-full h-9 gap-1.5 text-xs font-medium rounded-lg bg-primary text-white border-2 border-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
                >
                  Generate
                </Button>
              )}
            </>
          )}

          {/* Placeholder for other tools */}
          {selectedTool !== 'inpaint' && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-400">
                {selectedTool === 'erase' && 'Erase tool settings will appear here'}
                {selectedTool === 'upscale' && 'Upscale settings will appear here'}
                {selectedTool === 'remove' && 'Remove object settings will appear here'}
                {selectedTool === 'enhance' && 'Enhance settings will appear here'}
                {selectedTool === 'magic' && 'Magic tool settings will appear here'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

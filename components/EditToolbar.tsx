'use client';

import { Button } from '@/components/ui/button';
import { Paintbrush, Eraser, Wand2, Trash2, Sparkles, Maximize2 } from 'lucide-react';

interface EditToolbarProps {
  selectedTool: string;
  onToolChange: (tool: string) => void;
}

export function EditToolbar({ selectedTool, onToolChange }: EditToolbarProps) {
  const tools = [
    { id: 'inpaint', label: 'Inpaint', icon: Paintbrush },
    { id: 'erase', label: 'Erase', icon: Eraser },
    { id: 'upscale', label: 'Upscale', icon: Maximize2 },
    { id: 'remove', label: 'Remove', icon: Trash2 },
    { id: 'enhance', label: 'Enhance', icon: Sparkles },
    { id: 'magic', label: 'Magic', icon: Wand2 },
  ];

  return (
    <div className="fixed left-0 top-[78px] bottom-0 w-64 bg-zinc-900 border-r border-zinc-700 flex flex-col z-50">
      <div className="px-6 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">Edit Tools</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Button
                key={tool.id}
                variant="outline"
                size="sm"
                onClick={() => onToolChange(tool.id)}
                className={`w-full h-10 justify-start gap-3 text-sm font-medium rounded-lg border-2 shadow-sm transition-all duration-200 ${
                  selectedTool === tool.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-zinc-800/90 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tool.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

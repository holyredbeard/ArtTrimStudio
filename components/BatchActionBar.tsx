'use client';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { Check, ArrowUp, X, Tag, Sparkles, Download, FolderInput } from 'lucide-react';
import { useState } from 'react';

interface BatchActionBarProps {
  selectedCount: number;
  onKeep: () => void;
  onUpgrade: () => void;
  onDiscard: () => void;
  onAddTags: (tags: string[]) => void;
  onBatchReview: () => void;
  onExport: () => void;
  onMoveToFolder: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  onKeep,
  onUpgrade,
  onDiscard,
  onAddTags,
  onBatchReview,
  onExport,
  onMoveToFolder,
  onClearSelection
}: BatchActionBarProps) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const handleAddTags = () => {
    if (tagInput.trim()) {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      onAddTags(tags);
      setTagInput('');
      setShowTagInput(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary shadow-lg z-40">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-semibold">
              {selectedCount} selected
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
              Clear
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onKeep}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Keep
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onUpgrade}
              className="gap-2"
            >
              <ArrowUp className="w-4 h-4" />
              Upgrade
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDiscard}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Discard
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {showTagInput ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Enter tags (comma-separated)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTags();
                  } else if (e.key === 'Escape') {
                    setShowTagInput(false);
                    setTagInput('');
                  }
                }}
                className="w-64"
                autoFocus
              />
              <Button size="sm" onClick={handleAddTags}>
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowTagInput(false);
                  setTagInput('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTagInput(true)}
              className="gap-2"
            >
              <Tag className="w-4 h-4" />
              Add tags...
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onBatchReview}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Review selected
          </Button>

          <div className="h-6 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export...
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onMoveToFolder}
            className="gap-2"
          >
            <FolderInput className="w-4 h-4" />
            Move to folder...
          </Button>
        </div>
      </div>
    </div>
  );
}

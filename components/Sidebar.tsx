'use client';

import { ImageRecord } from '@/lib/filedb';
import { Badge } from './ui/badge';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface SidebarProps {
  images: ImageRecord[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  masterTags?: string[];
}

export function Sidebar({ images, selectedTags, onTagToggle, onAddTag, onRemoveTag, masterTags = [] }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sharingStep, setSharingStep] = useState<'platform' | 'caption'>('platform');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [caption, setCaption] = useState('');

  const tagCounts = useMemo(() => {
    // Get counts from images
    const counts = new Map<string, number>();
    images.forEach((image) => {
      image.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    // Include all master tags even if count is 0
    masterTags.forEach(tag => {
      if (!counts.has(tag)) {
        counts.set(tag, 0);
      }
    });

    return Array.from(counts.entries())
      .sort((a, b) => {
        // Sort by count descending, but put 0-count tags at the end
        if (a[1] === 0 && b[1] === 0) return a[0].localeCompare(b[0]);
        if (a[1] === 0) return 1;
        if (b[1] === 0) return -1;
        return b[1] - a[1];
      })
      .slice(0, 100);
  }, [images, masterTags]);

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-border bg-card flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          title="Expand tags"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const handleAddTag = () => {
    if (newTag.trim() && onAddTag) {
      onAddTag(newTag.trim().toLowerCase());
      setNewTag('');
      setShowAddTag(false);
    }
  };

  const handleStartEdit = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(tag);
    setEditValue(tag);
  };

  const handleSaveEdit = async (oldTag: string) => {
    const newTagValue = editValue.trim().toLowerCase();
    if (newTagValue && newTagValue !== oldTag && onRemoveTag && onAddTag) {
      await onRemoveTag(oldTag);
      await onAddTag(newTagValue);
    }
    setEditingTag(null);
    setEditValue('');
  };

  const handleDeleteTag = async (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemoveTag && window.confirm(`Delete tag "${tag}" from master list?`)) {
      await onRemoveTag(tag);
    }
  };

  return (
    <div className="w-64 border-r border-border bg-card p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tags</h2>
        <div className="flex items-center gap-1">
          {onAddTag && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddTag(!showAddTag)}
              title="Add new tag"
            >
              +
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            title="Collapse tags"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {showAddTag && onAddTag && (
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="New tag..."
            className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
            autoFocus
          />
          <Button size="sm" onClick={handleAddTag}>
            Add
          </Button>
        </div>
      )}
      
      <div className="space-y-1">
        {tagCounts.map(([tag, count]) => {
          const isSelected = selectedTags.includes(tag);
          const isEditing = editingTag === tag;
          
          return (
            <div
              key={tag}
              className={`group relative flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(tag);
                    if (e.key === 'Escape') setEditingTag(null);
                  }}
                  onBlur={() => handleSaveEdit(tag)}
                  className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                  autoFocus
                />
              ) : (
                <>
                  <button
                    onClick={() => onTagToggle(tag)}
                    className="flex-1 text-left truncate mr-2"
                  >
                    {tag}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isSelected ? 'secondary' : 'outline'}
                      className="text-xs min-w-[2rem] justify-center"
                    >
                      {count}
                    </Badge>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onAddTag && onRemoveTag && (
                        <button
                          onClick={(e) => handleStartEdit(tag, e)}
                          className="p-1 hover:bg-background/50 rounded"
                          title="Rename tag"
                        >
                          ✎
                        </button>
                      )}
                      {onRemoveTag && (
                        <button
                          onClick={(e) => handleDeleteTag(tag, e)}
                          className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded"
                          title="Delete tag"
                        >  
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Sharing Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Share to Social Media</h3>
        </div>

        {sharingStep === 'platform' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-2 block">Select Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Choose a platform...</option>
                <option value="instagram">Instagram</option>
                <option value="etsy">Etsy</option>
                <option value="pinterest">Pinterest</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">Twitter/X</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <Button
              onClick={() => setSharingStep('caption')}
              disabled={!selectedPlatform}
              size="sm"
              className="w-full"
            >
              Next
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-2 block">
                Caption for {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)}
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption here..."
                rows={3}
                className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setSharingStep('platform');
                  setCaption('');
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  toast.success(`Sharing to ${selectedPlatform}!`, {
                    description: 'This is a placeholder - integration coming soon'
                  });
                }}
                disabled={!caption.trim()}
                size="sm"
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { filedb } from '@/lib/filedb';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TagManagerProps {
  onClose: () => void;
}

export function TagManager({ onClose }: TagManagerProps) {
  const [masterTags, setMasterTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await filedb.getMasterTags();
      setMasterTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async () => {
    const trimmed = newTag.trim().toLowerCase();
    if (!trimmed) return;

    if (masterTags.includes(trimmed)) {
      toast.error('Tag already exists');
      return;
    }

    try {
      await filedb.addMasterTag(trimmed);
      setMasterTags([...masterTags, trimmed].sort());
      setNewTag('');
      toast.success(`Tag "${trimmed}" added`);
    } catch (error) {
      console.error('Failed to add tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await filedb.removeMasterTag(tag);
      setMasterTags(masterTags.filter(t => t !== tag));
      toast.success(`Tag "${tag}" removed`);
    } catch (error) {
      console.error('Failed to remove tag:', error);
      toast.error('Failed to remove tag');
    }
  };

  const handleBulkImport = async () => {
    const input = prompt('Enter tags separated by commas:');
    if (!input) return;

    const tags = input
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    try {
      const allTags = [...new Set([...masterTags, ...tags])].sort();
      await filedb.setMasterTags(allTags);
      setMasterTags(allTags);
      toast.success(`Imported ${tags.length} tags`);
    } catch (error) {
      console.error('Failed to import tags:', error);
      toast.error('Failed to import tags');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Tag Manager</h2>
            <span className="text-sm text-muted-foreground">({masterTags.length} tags)</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add new tag..."
              className="flex-1"
            />
            <Button onClick={handleAddTag} disabled={!newTag.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
            <Button onClick={handleBulkImport} variant="outline">
              Bulk Import
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : masterTags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TagIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tags yet. Add your first tag above.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {masterTags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md"
                >
                  <span className="text-sm">{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground">
            Tags are matched against image filenames during scanning. For example, "folklore" will match "folklore_gnome.png".
          </p>
        </div>
      </div>
    </div>
  );
}

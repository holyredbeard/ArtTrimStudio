'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X } from 'lucide-react';

interface SaveInpaintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (filename: string, replaceOriginal: boolean) => Promise<void>;
  originalFilename: string;
}

export function SaveInpaintDialog({ isOpen, onClose, onSave, originalFilename }: SaveInpaintDialogProps) {
  const [saveMode, setSaveMode] = useState<'new' | 'replace'>('new');
  const [filename, setFilename] = useState(() => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const baseName = originalFilename.replace(/\.[^/.]+$/, '');
    return `${baseName}_inpaint_${date}.png`;
  });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log('SaveInpaintDialog - saveMode:', saveMode);
      console.log('SaveInpaintDialog - replaceOriginal:', saveMode === 'replace');
      console.log('SaveInpaintDialog - filename:', filename);
      await onSave(filename, saveMode === 'replace');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Save inpainted image</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-zinc-800/50"
              style={{
                borderColor: saveMode === 'replace' ? 'rgb(168, 85, 247)' : 'rgb(63, 63, 70)',
                backgroundColor: saveMode === 'replace' ? 'rgba(168, 85, 247, 0.1)' : 'transparent'
              }}>
              <input
                type="radio"
                name="saveMode"
                value="replace"
                checked={saveMode === 'replace'}
                onChange={() => setSaveMode('replace')}
                className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="font-medium">Replace original</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Original file will be backed up in _backup folder
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-zinc-800/50"
              style={{
                borderColor: saveMode === 'new' ? 'rgb(168, 85, 247)' : 'rgb(63, 63, 70)',
                backgroundColor: saveMode === 'new' ? 'rgba(168, 85, 247, 0.1)' : 'transparent'
              }}>
              <input
                type="radio"
                name="saveMode"
                value="new"
                checked={saveMode === 'new'}
                onChange={() => setSaveMode('new')}
                className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="font-medium">Save as new file</div>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Filename</label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename..."
              className="w-full"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !filename.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            {isSaving ? 'Saving...' : 'Save to Library'}
          </Button>
        </div>
      </div>
    </div>
  );
}

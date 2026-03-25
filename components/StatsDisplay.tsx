'use client';

import { useState, useEffect } from 'react';
import { ImageRecord } from '@/lib/filedb';

interface StatsDisplayProps {
  images: ImageRecord[];
  rootHandle: FileSystemDirectoryHandle | null;
}

export function StatsDisplay({ images, rootHandle }: StatsDisplayProps) {
  const [deletedCount, setDeletedCount] = useState(0);
  
  useEffect(() => {
    async function loadDeletedCount() {
      if (!rootHandle) {
        setDeletedCount(0);
        return;
      }
      try {
        const trashDir = await rootHandle.getDirectoryHandle('._trash');
        let count = 0;
        for await (const entry of trashDir.values()) {
          if (entry.kind === 'file') count++;
        }
        setDeletedCount(count);
      } catch {
        setDeletedCount(0);
      }
    }
    loadDeletedCount();
  }, [rootHandle]);

  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="grid grid-cols-3 gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Review Status</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-500">IMPROVE</span>
              <span className="font-semibold">{images.filter(img => img.reviewStatus === 'upgrade').length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-500">READY</span>
              <span className="font-semibold">{images.filter(img => img.reviewStatus === 'fixed').length}</span>
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-2">Basic Status</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Keep</span>
              <span className="font-semibold">{images.filter(img => img.status === 'keep').length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Discard</span>
              <span className="font-semibold">{images.filter(img => img.status === 'discard').length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Unreviewed</span>
              <span className="font-semibold">{images.filter(img => img.status === 'unreviewed').length}</span>
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-xs text-muted-foreground mb-2">Trash</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deleted</span>
              <span className="font-semibold">{deletedCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

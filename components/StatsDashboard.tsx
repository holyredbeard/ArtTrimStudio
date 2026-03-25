'use client';

import { useMemo, useState, useEffect } from 'react';
import { ImageRecord } from '@/lib/filedb';
import { Button } from './ui/button';
import { ChevronDown, ChevronUp, Image as ImageIcon, FolderSearch } from 'lucide-react';

interface StatsDashboardProps {
  images: ImageRecord[];
  onScan?: () => void;
  isScanning?: boolean;
  rootHandle?: FileSystemDirectoryHandle | null;
}

export function StatsDashboard({ images, onScan, isScanning, rootHandle }: StatsDashboardProps) {
  const [showStats, setShowStats] = useState(false);
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

  const stats = useMemo(() => {
    if (images.length === 0) {
      return {
        totalImages: 0,
        avgAesthetic: 0,
        avgQuality: 0,
        avgTotal: 0,
        topTags: [],
        keepCount: 0,
        discardCount: 0,
        unreviewedCount: 0
      };
    }

    const keepCount = images.filter(img => img.status === 'keep').length;
    const discardCount = images.filter(img => img.status === 'discard').length;
    const unreviewedCount = images.filter(img => img.status === 'unreviewed').length;

    const upgradeCount = images.filter(img => img.reviewStatus === 'upgrade').length;
    const fixedCount = images.filter(img => img.reviewStatus === 'fixed').length;
    const reviewKeepCount = images.filter(img => img.reviewStatus === 'keep').length;
    const reviewDiscardCount = images.filter(img => img.reviewStatus === 'discard').length;

    return {
      totalImages: images.length,
      keepCount,
      discardCount,
      unreviewedCount,
      upgradeCount,
      fixedCount,
      reviewKeepCount,
      reviewDiscardCount
    };
  }, [images]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Images</p>
              <p className="text-3xl font-bold">{stats.totalImages}</p>
            </div>
          </div>
          
          {onScan && (
            <Button
              onClick={onScan}
              disabled={isScanning}
              size="sm"
              className="gap-2"
            >
              <FolderSearch className="w-4 h-4" />
              {isScanning ? 'Scanning...' : 'Scan for new'}
            </Button>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStats(!showStats)}
          className="gap-2"
        >
          {showStats ? (
            <>
              Hide stats
              <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show stats
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
      
      {showStats && (
        <div className="mt-2 p-4 bg-card border border-border rounded-lg">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Review Status</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-500">KEEP</span>
                  <span className="font-semibold">{stats.reviewKeepCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-500">UPGRADE</span>
                  <span className="font-semibold">{stats.upgradeCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-500">DISCARD</span>
                  <span className="font-semibold">{stats.reviewDiscardCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-500">FIXED</span>
                  <span className="font-semibold">{stats.fixedCount}</span>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground mb-1">Basic Status</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Keep</span>
                  <span className="font-semibold">{stats.keepCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Discard</span>
                  <span className="font-semibold">{stats.discardCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Unreviewed</span>
                  <span className="font-semibold">{stats.unreviewedCount}</span>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground mb-1">Trash</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deleted</span>
                  <span className="font-semibold">{deletedCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

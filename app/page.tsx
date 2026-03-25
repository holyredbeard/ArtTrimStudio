'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { filedb, ImageRecord } from '@/lib/filedb';
import { scanFolder, ScanProgress } from '@/lib/scanner';
import { retagAllImages, RetagProgress } from '@/lib/retagger';
import { clearAllTagsNow } from '@/lib/clearalltags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ImageGrid } from '@/components/ImageGrid';
import { Sidebar } from '@/components/Sidebar';
import { StatsDisplay } from '@/components/StatsDisplay';
import { VisionChat } from '@/components/VisionChat';
import { TrashView } from '@/components/TrashView';
import { TagManager } from '@/components/TagManager';
import { FolderOpen, Search, Sparkles, SortAsc, Trash2, Download, Check, X as XIcon, ChevronUp, ChevronDown, ArrowUp, Tag, FolderInput, Database, Upload, Grid3x3, Grid2x2, LayoutGrid, Tags } from 'lucide-react';
import { exportDatabaseToFile, importDatabaseFromFile, checkForBackup, getBackupInfo } from '@/lib/backup';
import { saveRootHandle, loadRootHandle } from '@/lib/handlestore';

type SortOption = 'newest' | 'name';
type StatusFilter = 'all' | 'keep' | 'upgrade' | 'discard' | 'fixed' | 'unreviewed';

export default function Home() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [newImageCount, setNewImageCount] = useState(0);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [fullSizeImage, setFullSizeImage] = useState<ImageRecord | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [backupAvailable, setBackupAvailable] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showTagManager, setShowTagManager] = useState(false);
  const [tagsStateBeforeModal, setTagsStateBeforeModal] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false);
  const [retagProgress, setRetagProgress] = useState<RetagProgress | null>(null);
  const [masterTags, setMasterTags] = useState<string[]>([]);

  const [images, setImages] = useState<ImageRecord[]>([]);

  // Load images from file database
  const loadImages = async () => {
    if (!rootHandle) return;
    await filedb.setRootHandle(rootHandle);
    const allImages = await filedb.toArray();
    setImages(allImages);
  };

  useEffect(() => {
    if (rootHandle) {
      loadImages();
      // No auto-refresh - only refresh on explicit user actions
    }
  }, [rootHandle]);

  useEffect(() => {
    // Load thumbnail size preference from localStorage
    const savedSize = localStorage.getItem('thumbnailSize') as 'small' | 'medium' | 'large' | null;
    if (savedSize) {
      setThumbnailSize(savedSize);
    }
  }, []);

  const handleThumbnailSizeChange = (size: 'small' | 'medium' | 'large') => {
    setThumbnailSize(size);
    localStorage.setItem('thumbnailSize', size);
  };

  useEffect(() => {
    async function loadSavedHandle() {
      try {
        const handle = await loadRootHandle();
        if (handle) {
          setRootHandle(handle);
          await filedb.setRootHandle(handle);
          
          // EMERGENCY: Clear ALL tags from ALL images
          const cleared = await clearAllTagsNow();
          if (cleared > 0) {
            const { toast } = await import('sonner');
            toast.success('ALL OLD TAGS CLEARED!', {
              description: `Removed tags from ${cleared} images. Sidebar is now empty.`,
              duration: 5000
            });
          }
          
          // Load master tags
          const tags = await filedb.getMasterTags();
          setMasterTags(tags);
          
          await loadImages();
          
          const { toast } = await import('sonner');
          const count = await filedb.count();
          if (count > 0) {
            toast.success('Database loaded!', {
              description: `${count} images restored from previous session`,
              duration: 3000
            });
          }
        }
      } catch (error) {
        console.error('Failed to load saved handle:', error);
      }
    }

    loadSavedHandle();
  }, []);

  const handleSelectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setRootHandle(handle);
      await saveRootHandle(handle);
      await filedb.setRootHandle(handle);
      await loadImages();
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleClearAllTags = async () => {
    if (!rootHandle) return;

    const confirmed = window.confirm(
      'This will REMOVE ALL TAGS from ALL IMAGES. This cannot be undone. Continue?'
    );

    if (!confirmed) return;

    setIsRetagging(true);
    setRetagProgress({ total: 0, processed: 0, status: 'Clearing tags...' });

    try {
      const allImages = await filedb.toArray();
      let cleared = 0;
      
      for (const image of allImages) {
        if (image.tags.length > 0) {
          await filedb.update(image.relativePath, { tags: [] });
          cleared++;
        }
        
        if (cleared % 100 === 0) {
          await filedb.forceSave();
          setRetagProgress({ 
            total: allImages.length, 
            processed: cleared, 
            status: `Cleared ${cleared} images...` 
          });
        }
      }
      
      await filedb.forceSave();
      await loadImages();

      const { toast } = await import('sonner');
      toast.success('All tags cleared!', {
        description: `Removed tags from ${cleared} images`,
        duration: 5000
      });
    } catch (error) {
      console.error('Clear tags failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to clear tags', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    } finally {
      setIsRetagging(false);
      setRetagProgress(null);
    }
  };

  const handleRetag = async () => {
    if (!rootHandle) return;

    const confirmed = window.confirm(
      'This will re-tag all images based on their filenames and your master tag list. Old tags will be replaced. Continue?'
    );

    if (!confirmed) return;

    setIsRetagging(true);
    setRetagProgress({ total: 0, processed: 0, status: 'Starting...' });

    try {
      const result = await retagAllImages((progress) => {
        setRetagProgress(progress);
      });

      await loadImages();

      const { toast } = await import('sonner');
      toast.success('Re-tagging complete!', {
        description: `${result.updated} of ${result.total} images updated`,
        duration: 5000
      });
    } catch (error) {
      console.error('Re-tagging failed:', error);
      const { toast } = await import('sonner');
      toast.error('Re-tagging failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    } finally {
      setIsRetagging(false);
      setRetagProgress(null);
    }
  };

  const handleScan = async (forceRescan: boolean = false) => {
    if (!rootHandle) return;

    setIsScanning(true);
    setScanProgress({ total: 0, processed: 0, newImages: 0, status: forceRescan ? 'Force rescanning all images...' : 'Starting scan...' });

    try {
      const result = await scanFolder(rootHandle, (progress) => {
        setScanProgress(progress);
      }, forceRescan);
      setNewImageCount(result.newImages);
      await loadImages();
      
      if (forceRescan) {
        const { toast } = await import('sonner');
        toast.success('Alla bilder uppdaterade', {
          description: `${result.totalImages} bilder scannade om`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanProgress(null), 3000);
    }
  };

  const filteredAndSortedImages = useMemo(() => {
    if (!images) return [];

    let filtered = images;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (img) =>
          img.filename.toLowerCase().includes(query) ||
          img.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((img) =>
        selectedTags.every((tag) => img.tags.includes(tag))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'unreviewed') {
        filtered = filtered.filter((img) => !img.reviewStatus);
      } else {
        filtered = filtered.filter((img) => img.reviewStatus === statusFilter);
      }
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => b.dateAdded - a.dateAdded);
        break;
      case 'name':
        sorted.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
    }

    return sorted;
  }, [images, searchQuery, selectedTags, sortBy, statusFilter]);

  const currentImageIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return filteredAndSortedImages.findIndex(img => img.relativePath === selectedImage.relativePath);
  }, [selectedImage, filteredAndSortedImages]);

  const handleNavigateImage = (direction: 'prev' | 'next') => {
    console.log('handleNavigateImage called:', direction, 'currentIndex:', currentImageIndex, 'total:', filteredAndSortedImages.length);
    const newIndex = direction === 'prev' ? currentImageIndex - 1 : currentImageIndex + 1;
    console.log('newIndex:', newIndex);
    if (newIndex >= 0 && newIndex < filteredAndSortedImages.length) {
      const newImage = filteredAndSortedImages[newIndex];
      console.log('Navigating to:', newImage.filename);
      setSelectedImage(newImage);
      setSelectedImages(new Set([newImage.relativePath]));
    } else {
      console.log('Navigation blocked - index out of bounds');
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleNormalClick = (relativePath: string, index?: number) => {
    // Empty path means click on background - clear all selections
    if (!relativePath) {
      setSelectedImages(new Set());
      return;
    }
    
    // Normal click - toggle selection if already selected, otherwise select only this image
    setSelectedImages((prev) => {
      if (prev.has(relativePath) && prev.size === 1) {
        // If this is the only selected image, deselect it
        return new Set();
      } else if (prev.has(relativePath)) {
        // If this image is selected among others, select only this one
        return new Set([relativePath]);
      } else {
        // If not selected, clear all and select only this one
        return new Set([relativePath]);
      }
    });
    
    if (index !== undefined) {
      setLastClickedIndex(index);
    }
  };

  const handleMarqueeSelect = (indices: number[]) => {
    // Marquee selection - add selected images to existing selection
    const newSelection = new Set(selectedImages);
    indices.forEach(index => {
      if (index < filteredAndSortedImages.length) {
        newSelection.add(filteredAndSortedImages[index].relativePath);
      }
    });
    setSelectedImages(newSelection);
    
    if (indices.length > 0) {
      setLastClickedIndex(indices[indices.length - 1]);
    }
  };

  const handleToggleSelect = (relativePath: string, shiftKey?: boolean, index?: number) => {
    if (shiftKey && lastClickedIndex !== null && index !== undefined) {
      // Range selection
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSet = new Set(selectedImages);
      
      for (let i = start; i <= end; i++) {
        if (i < filteredAndSortedImages.length) {
          newSet.add(filteredAndSortedImages[i].relativePath);
        }
      }
      
      setSelectedImages(newSet);
      if (index !== undefined) {
        setLastClickedIndex(index);
      }
    } else {
      // Individual toggle (Ctrl/Cmd click)
      setSelectedImages((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(relativePath)) {
          newSet.delete(relativePath);
        } else {
          newSet.add(relativePath);
        }
        return newSet;
      });
      
      if (index !== undefined) {
        setLastClickedIndex(index);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedImages.size === filteredAndSortedImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredAndSortedImages.map(img => img.relativePath)));
    }
  };

  const handleDeleteImage = async (image: ImageRecord) => {
    if (!rootHandle) return;

    const confirmed = window.confirm(
      `Are you sure you want to move "${image.filename}" to trash?\n\nThe file will be moved to the ._trash folder.`
    );
    
    if (!confirmed) return;

    try {
      const pathParts = image.relativePath.split('/');
      let currentDir: FileSystemDirectoryHandle = rootHandle;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
      }
      
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      
      let trashDir: FileSystemDirectoryHandle;
      try {
        trashDir = await rootHandle.getDirectoryHandle('._trash');
      } catch {
        trashDir = await rootHandle.getDirectoryHandle('._trash', { create: true });
      }
      
      const newFileHandle = await trashDir.getFileHandle(fileName, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      
      await currentDir.removeEntry(fileName);
      await filedb.delete(image.relativePath);
      await loadImages();
      
      const { toast } = await import('sonner');
      toast.success('Image moved to trash', {
        description: image.filename,
        duration: 8000,
        action: {
          label: 'Ångra',
          onClick: async () => {
            try {
              const trashFileHandle = await trashDir.getFileHandle(fileName);
              const trashFile = await trashFileHandle.getFile();
              
              let restoreDir: FileSystemDirectoryHandle = rootHandle;
              for (let i = 0; i < pathParts.length - 1; i++) {
                restoreDir = await restoreDir.getDirectoryHandle(pathParts[i], { create: true });
              }
              
              const restoredFileHandle = await restoreDir.getFileHandle(fileName, { create: true });
              const restoredWritable = await restoredFileHandle.createWritable();
              await restoredWritable.write(trashFile);
              await restoredWritable.close();
              
              await trashDir.removeEntry(fileName);
              await filedb.put(image);
              await loadImages();
              
              toast.success('Bilden återställdes', {
                description: image.filename,
                duration: 3000
              });
            } catch (error) {
              console.error('Failed to restore image:', error);
              toast.error('Kunde inte återställa bilden', {
                description: error instanceof Error ? error.message : 'Okänt fel',
                duration: 5000
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to move to trash:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to move image to trash', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedImages.size === 0) return;
    if (!rootHandle) return;
    
    const count = selectedImages.size;
    if (!confirm(`Move ${count} images to trash?`)) return;

    try {
      const { toast } = await import('sonner');
      toast.info(`Moving ${count} images to trash...`, { duration: 2000 });

      // Get or create trash directory
      let trashDir: FileSystemDirectoryHandle;
      try {
        trashDir = await rootHandle.getDirectoryHandle('._trash');
      } catch {
        trashDir = await rootHandle.getDirectoryHandle('._trash', { create: true });
      }

      // Get all selected image records
      const imagesToDelete = await filedb.bulkGet(Array.from(selectedImages));
      
      let movedCount = 0;
      
      // Move each file to trash
      for (const image of imagesToDelete) {
        if (!image) continue;
        
        try {
          const pathParts = image.relativePath.split('/');
          let currentDir: FileSystemDirectoryHandle = rootHandle;
          
          // Navigate to the file's directory
          for (let i = 0; i < pathParts.length - 1; i++) {
            currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
          }
          
          const fileName = pathParts[pathParts.length - 1];
          const fileHandle = await currentDir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          
          // Copy to trash
          const newFileHandle = await trashDir.getFileHandle(fileName, { create: true });
          const writable = await newFileHandle.createWritable();
          await writable.write(file);
          await writable.close();
          
          // Remove from original location
          await currentDir.removeEntry(fileName);
          
          movedCount++;
        } catch (error) {
          console.error(`Failed to move file ${image.relativePath} to trash:`, error);
        }
      }

      // Remove from database
      await filedb.bulkDelete(Array.from(selectedImages));
      await loadImages();
      setSelectedImages(new Set());
      
      toast.success(`${movedCount} images moved to trash`, {
        duration: 3000
      });
    } catch (error) {
      console.error('Batch delete failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to move images to trash', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleBatchExport = async () => {
    if (selectedImages.size === 0) return;

    const selected = await filedb.bulkGet(Array.from(selectedImages));
    const data = selected.filter(Boolean);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe-library-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchStatus = async (status: 'keep' | 'upgrade' | 'discard' | 'fixed') => {
    if (selectedImages.size === 0) return;

    try {
      const count = selectedImages.size;
      
      // Update all selected images
      for (const relativePath of selectedImages) {
        await filedb.update(relativePath, { reviewStatus: status });
      }
      await loadImages();
      
      // Clear selection after update
      setSelectedImages(new Set());
      
      const { toast } = await import('sonner');
      toast.success(`${count} images marked as ${status.toUpperCase()}`, {
        duration: 2000
      });
    } catch (error) {
      console.error('Batch status update failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to update images', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000
      });
    }
  };

  const handleBatchAddTags = async (tags: string[]) => {
    if (selectedImages.size === 0 || tags.length === 0) return;

    try {
      const count = selectedImages.size;
      
      for (const relativePath of selectedImages) {
        const img = await filedb.get(relativePath);
        if (img) {
          const existingTags = new Set(img.tags);
          tags.forEach(tag => existingTags.add(tag));
          await filedb.update(relativePath, { tags: Array.from(existingTags) });
        }
      }
      await loadImages();
      
      const { toast } = await import('sonner');
      toast.success(`Added tags to ${count} images`, {
        description: tags.join(', '),
        duration: 3000
      });
    } catch (error) {
      console.error('Batch tag update failed:', error);
      const { toast } = await import('sonner');
      toast.error('Failed to add tags', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000
      });
    }
  };

  const handleBatchReview = async () => {
    const { toast } = await import('sonner');
    toast.info('Batch AI review coming soon!', {
      description: `${selectedImages.size} images selected`,
      duration: 3000
    });
  };

  const handleBatchMoveToFolder = async () => {
    const { toast } = await import('sonner');
    toast.info('Move to folder coming soon!', {
      description: `${selectedImages.size} images selected`,
      duration: 3000
    });
  };

  const handleBatchOpenInExplorer = async () => {
    if (selectedImages.size !== 1 || !rootHandle) return;
    
    const { toast } = await import('sonner');
    const imagePath = Array.from(selectedImages)[0];
    const image = images.find(img => img.relativePath === imagePath);
    
    if (!image) return;

    try {
      let absoluteRootPath = localStorage.getItem('rootAbsolutePath');
      
      if (!absoluteRootPath) {
        const userPath = prompt(
          `Enter the full path to your image folder:\n\nExample: D:\\AI-images or C:\\Users\\Name\\Pictures\\AI\n\nThis path will be saved and only needs to be entered once.`
        );
        
        if (!userPath) {
          toast.info('Cancelled', {
            description: 'You can try again anytime',
            duration: 3000
          });
          return;
        }
        
        absoluteRootPath = userPath.trim();
        localStorage.setItem('rootAbsolutePath', absoluteRootPath);
        
        toast.success('Path saved!', {
          description: 'Opening Explorer...',
          duration: 2000
        });
      }

      const windowsPath = image.relativePath.replace(/\//g, '\\');
      const fullPath = `${absoluteRootPath}\\${windowsPath}`;

      const response = await fetch('/api/open-explorer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: fullPath }),
      });

      if (response.ok) {
        toast.success('Opened Explorer!', {
          description: `File "${image.filename}" is selected`,
          duration: 3000
        });
      } else {
        const error = await response.json();
        toast.error('Failed to open Explorer', {
          description: error.details || 'Unknown error',
          duration: 5000
        });
      }
      
    } catch (error) {
      toast.error('Failed to open in Explorer', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleExportBackup = async () => {
    if (!rootHandle) return;
    
    try {
      await exportDatabaseToFile(rootHandle);
      const count = await filedb.count();
      const { toast } = await import('sonner');
      toast.success('Backup saved!', {
        description: `${count} images backed up to .vibe-backup.json`,
        duration: 3000
      });
      setBackupAvailable(true);
    } catch (error) {
      const { toast } = await import('sonner');
      toast.error('Backup failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleRestoreBackup = async () => {
    if (!rootHandle) return;
    
    const confirmed = window.confirm(
      'This will replace all current data with the backup. Continue?'
    );
    
    if (!confirmed) return;
    
    try {
      const restored = await importDatabaseFromFile(rootHandle);
      await loadImages();
      const { toast } = await import('sonner');
      toast.success('Backup restored!', {
        description: `${restored} images recovered`,
        duration: 5000
      });
    } catch (error) {
      const { toast } = await import('sonner');
      toast.error('Restore failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const totalImages = images?.length || 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <img 
                src="/arttrim-logo.png" 
                alt="ArtTrim Studio" 
                className="h-10"
              />
            </div>
            {rootHandle && !isHeaderCollapsed && (
              <div className="text-sm text-muted-foreground">
                📁 {rootHandle.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {totalImages} images
              {newImageCount > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  (+{newImageCount} new)
                </span>
              )}
            </div>
            <Button onClick={handleSelectFolder} variant="outline" size="sm">
              <FolderOpen className="w-4 h-4" />
              Select Folder
            </Button>
            <Button
              onClick={() => handleScan(false)}
              disabled={!rootHandle || isScanning}
              size="sm"
            >
              {isScanning ? 'Scanning...' : 'Scan Folder'}
            </Button>
            <Button
              onClick={() => handleScan(true)}
              disabled={!rootHandle || isScanning}
              variant="outline"
              size="sm"
              title="Scanna om alla bilder och uppdatera filnamn"
            >
              Force Rescan
            </Button>
            <Button
              onClick={() => setShowStats(!showStats)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {showStats ? 'Hide stats' : 'Show stats'}
            </Button>
            <Button
              onClick={handleExportBackup}
              disabled={!rootHandle}
              variant="outline"
              size="sm"
              className="gap-2"
              title="Spara backup av databasen"
            >
              <Database className="w-4 h-4" />
              Backup
            </Button>
            {backupAvailable && (
              <Button
                onClick={handleRestoreBackup}
                disabled={!rootHandle}
                variant="outline"
                size="sm"
                className="gap-2"
                title="Återställ från backup"
              >
                <Upload className="w-4 h-4" />
                Restore
              </Button>
            )}
            <Button
              onClick={() => setShowTrash(true)}
              disabled={!rootHandle}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              TRASH
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              title={isHeaderCollapsed ? 'Expand filters' : 'Collapse filters'}
            >
              {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {!isHeaderCollapsed && scanProgress && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{scanProgress.status}</span>
              <span className="font-medium">
                {scanProgress.processed} / {scanProgress.total}
              </span>
            </div>
            <Progress
              value={
                scanProgress.total > 0
                  ? (scanProgress.processed / scanProgress.total) * 100
                  : 0
              }
            />
          </div>
        )}
      </header>

      {showStats && (
        <StatsDisplay images={images} rootHandle={rootHandle} />
      )}

      {!isHeaderCollapsed && (
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-card">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search images or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:bg-accent"
          >
            <option value="newest">Newest</option>
            <option value="name">Name</option>
          </select>
          <div className="flex items-center gap-1 border border-border rounded-md p-1">
            <Button
              variant={thumbnailSize === 'small' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleThumbnailSizeChange('small')}
              className="h-7 px-2"
              title="Small thumbnails (8-10 per row)"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={thumbnailSize === 'medium' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleThumbnailSizeChange('medium')}
              className="h-7 px-2"
              title="Medium thumbnails (5 per row)"
            >
              <Grid2x2 className="w-4 h-4" />
            </Button>
            <Button
              variant={thumbnailSize === 'large' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleThumbnailSizeChange('large')}
              className="h-7 px-2"
              title="Large thumbnails (3 per row)"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:bg-accent"
          >
            <option value="all">All Status</option>
            <option value="upgrade">Improve</option>
            <option value="fixed">Ready</option>
            <option value="unreviewed">Unreviewed</option>
          </select>
        </div>

        {selectedImages.size > 0 ? (
          <div className="flex items-center gap-3 ml-auto bg-card border border-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-sm font-semibold whitespace-nowrap">
                {selectedImages.size}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImages(new Set())}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBatchStatus('upgrade')}
                className="h-8 gap-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
              >
                <ArrowUp className="w-4 h-4" />
                <span className="text-xs font-medium">Improve</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchDelete}
                className="h-8 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium">Delete</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBatchStatus('fixed')}
                className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
              >
                <Check className="w-4 h-4" />
                <span className="text-xs font-medium">Ready</span>
              </Button>
            </div>
            
            <div className="h-6 w-px bg-border" />
            
            <BatchTagInput onAddTags={handleBatchAddTags} selectedCount={selectedImages.size} />
            
            <div className="h-6 w-px bg-border" />
            
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchReview}
                className="h-8 gap-1.5 hover:bg-accent"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">Review</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBatchExport}
                className="h-8 gap-1.5 hover:bg-accent"
              >
                <Download className="w-4 h-4" />
                <span className="text-xs font-medium">Export</span>
              </Button>
              {selectedImages.size === 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBatchOpenInExplorer}
                  className="h-8 gap-1.5 hover:bg-accent"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-xs font-medium">Open</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
              >
                Clear filters ({selectedTags.length})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedImages.size === filteredAndSortedImages.length ? 'Deselect All' : 'Select All'}
            </Button>
          </>
        )}

        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          images={filteredAndSortedImages}
          selectedTags={selectedTags}
          onTagToggle={handleTagToggle}
          onAddTag={async (tag) => {
            await filedb.addMasterTag(tag);
            const tags = await filedb.getMasterTags();
            setMasterTags(tags);
            await loadImages();
            const { toast } = await import('sonner');
            toast.success(`Tag "${tag}" added to master list`);
          }}
          masterTags={masterTags}
          onRemoveTag={async (tag) => {
            // Remove tag from master list
            await filedb.removeMasterTag(tag);
            
            // Remove tag from ALL images that have it
            const allImages = await filedb.toArray();
            let removed = 0;
            for (const image of allImages) {
              if (image.tags.includes(tag)) {
                const newTags = image.tags.filter(t => t !== tag);
                await filedb.update(image.relativePath, { tags: newTags });
                removed++;
              }
            }
            
            await filedb.forceSave();
            const tags = await filedb.getMasterTags();
            setMasterTags(tags);
            await loadImages();
            
            const { toast } = await import('sonner');
            toast.success(`Tag "${tag}" removed`, {
              description: `Removed from ${removed} images`,
              duration: 3000
            });
          }}
        />
        <main className="flex-1 p-6">
          <ImageGrid
            images={filteredAndSortedImages}
            rootHandle={rootHandle}
            onImageClick={(image) => {
              setSelectedImage(image);
              setSelectedImages(new Set([image.relativePath]));
              setIsHeaderCollapsed(false);
              setTagsStateBeforeModal(showTagManager);
              setShowTagManager(false);
            }}
            onFullSizeClick={setFullSizeImage}
            selectedImages={selectedImages}
            onToggleSelect={handleToggleSelect}
            onNormalClick={handleNormalClick}
            onDelete={handleDeleteImage}
            thumbnailSize={thumbnailSize}
            onMarqueeSelect={handleMarqueeSelect}
            isModalOpen={!!selectedImage}
            selectedImage={selectedImage}
            onNavigate={handleNavigateImage}
          />
        </main>
      </div>

      {selectedImage && rootHandle && (
        <VisionChat
          image={selectedImage}
          rootHandle={rootHandle}
          onClose={() => {
            setSelectedImage(null);
            setSelectedImages(new Set());
            setShowTagManager(tagsStateBeforeModal);
          }}
          onImageDeleted={() => {
            setSelectedImage(null);
            setSelectedImages(new Set());
          }}
          onTagsChanged={loadImages}
        />
      )}

      {showTrash && rootHandle && (
        <TrashView
          rootHandle={rootHandle}
          onClose={() => setShowTrash(false)}
          onRestore={loadImages}
        />
      )}

      {showTagManager && (
        <TagManager onClose={() => setShowTagManager(false)} />
      )}

      {fullSizeImage && rootHandle && (
        <div 
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-8"
          onClick={() => setFullSizeImage(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setFullSizeImage(null)}
          >
            <XIcon className="w-6 h-6" />
          </Button>
          <FullSizeImageView image={fullSizeImage} rootHandle={rootHandle} />
        </div>
      )}
    </div>
  );
}

function FullSizeImageView({ image, rootHandle }: { image: ImageRecord; rootHandle: FileSystemDirectoryHandle }) {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    
    async function loadImage() {
      try {
        const pathParts = image.relativePath.split('/');
        let currentDir: FileSystemDirectoryHandle = rootHandle;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
        }
        
        const fileName = pathParts[pathParts.length - 1];
        const fileHandle = await currentDir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        
        if (mounted) {
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Failed to load full size image:', error);
      }
    }

    loadImage();

    return () => {
      mounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [image.relativePath, rootHandle]);

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={image.filename}
      className="max-w-full max-h-full object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// Inline BatchTagInput component
function BatchTagInput({ onAddTags, selectedCount }: { onAddTags: (tags: string[]) => void; selectedCount: number }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [masterTags, setMasterTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    filedb.getMasterTags().then(setMasterTags);
  }, []);

  const handleToggleTag = (tag: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    setSelectedTags(newSet);
  };

  const handleApply = () => {
    if (selectedTags.size > 0) {
      onAddTags(Array.from(selectedTags));
      setSelectedTags(new Set());
      setShowDropdown(false);
    }
  };

  if (showDropdown) {
    return (
      <div className="relative">
        <div className="absolute top-full mt-2 right-0 bg-card border border-border rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Add tags to {selectedCount} images</span>
            <Button variant="ghost" size="sm" onClick={() => setShowDropdown(false)}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
          {masterTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags in master list. Add tags in Tag Manager first.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {masterTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedTags.has(tag)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleApply}
                disabled={selectedTags.size === 0}
                size="sm"
                className="w-full"
              >
                Add {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDropdown(false)}
          className="gap-2"
        >
          <Tag className="w-4 h-4" />
          Add Tags
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowDropdown(true)}
      className="gap-2"
    >
      <Tag className="w-4 h-4" />
      Add Tags
    </Button>
  );
}

// Old inline input version (replaced with dropdown)
function OldBatchTagInput({ onAddTags }: { onAddTags: (tags: string[]) => void }) {
  const [showInput, setShowInput] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const handleAddTags = () => {
    if (tagInput.trim()) {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      onAddTags(tags);
      setTagInput('');
      setShowInput(false);
    }
  };

  if (showInput) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddTags();
            } else if (e.key === 'Escape') {
              setShowInput(false);
              setTagInput('');
            }
          }}
          className="w-48 h-8"
          autoFocus
        />
        <Button size="sm" onClick={handleAddTags}>
          Add
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowInput(false);
            setTagInput('');
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowInput(true)}
      className="gap-1"
    >
      <Tag className="w-4 h-4" />
      Add tags
    </Button>
  );
}

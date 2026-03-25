'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TrashViewProps {
  rootHandle: FileSystemDirectoryHandle;
  onClose: () => void;
  onRestore: () => void;
}

interface TrashFile {
  name: string;
  handle: FileSystemFileHandle;
  url: string;
}

export function TrashView({ rootHandle, onClose, onRestore }: TrashViewProps) {
  const [trashFiles, setTrashFiles] = useState<TrashFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrashFiles();
  }, [rootHandle]);

  const loadTrashFiles = async () => {
    setIsLoading(true);
    try {
      const trashDir = await rootHandle.getDirectoryHandle('._trash');
      const files: TrashFile[] = [];

      for await (const entry of trashDir.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          files.push({ name: entry.name, handle: fileHandle, url });
        }
      }

      setTrashFiles(files);
    } catch (error) {
      console.error('Failed to load trash:', error);
      if ((error as any).name === 'NotFoundError') {
        setTrashFiles([]);
      } else {
        toast.error('Kunde inte läsa papperskorgen', {
          description: error instanceof Error ? error.message : 'Okänt fel',
          duration: 5000
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (file: TrashFile) => {
    try {
      const trashDir = await rootHandle.getDirectoryHandle('._trash');
      const fileData = await file.handle.getFile();

      const restoredFileHandle = await rootHandle.getFileHandle(file.name, { create: true });
      const writable = await restoredFileHandle.createWritable();
      await writable.write(fileData);
      await writable.close();

      await trashDir.removeEntry(file.name);

      toast.success('Bilden återställdes', {
        description: file.name,
        duration: 3000
      });

      URL.revokeObjectURL(file.url);
      setTrashFiles(prev => prev.filter(f => f.name !== file.name));
      onRestore();
    } catch (error) {
      console.error('Failed to restore file:', error);
      toast.error('Kunde inte återställa bilden', {
        description: error instanceof Error ? error.message : 'Okänt fel',
        duration: 5000
      });
    }
  };

  const handlePermanentDelete = async (file: TrashFile) => {
    const confirmed = window.confirm(
      `Är du säker på att du vill ta bort "${file.name}" permanent?\n\nDenna åtgärd kan inte ångras.`
    );

    if (!confirmed) return;

    try {
      const trashDir = await rootHandle.getDirectoryHandle('._trash');
      await trashDir.removeEntry(file.name);

      toast.success('Bilden togs bort permanent', {
        description: file.name,
        duration: 3000
      });

      URL.revokeObjectURL(file.url);
      setTrashFiles(prev => prev.filter(f => f.name !== file.name));
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Kunde inte ta bort bilden', {
        description: error instanceof Error ? error.message : 'Okänt fel',
        duration: 5000
      });
    }
  };

  const handleEmptyTrash = async () => {
    if (trashFiles.length === 0) return;

    const confirmed = window.confirm(
      `Är du säker på att du vill tömma papperskorgen?\n\n${trashFiles.length} filer kommer att tas bort permanent.\n\nDenna åtgärd kan inte ångras.`
    );

    if (!confirmed) return;

    try {
      const trashDir = await rootHandle.getDirectoryHandle('._trash');

      for (const file of trashFiles) {
        await trashDir.removeEntry(file.name);
        URL.revokeObjectURL(file.url);
      }

      toast.success('Papperskorgen tömdes', {
        description: `${trashFiles.length} filer togs bort`,
        duration: 3000
      });

      setTrashFiles([]);
    } catch (error) {
      console.error('Failed to empty trash:', error);
      toast.error('Kunde inte tömma papperskorgen', {
        description: error instanceof Error ? error.message : 'Okänt fel',
        duration: 5000
      });
    }
  };

  useEffect(() => {
    return () => {
      trashFiles.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-destructive" />
              <h1 className="text-2xl font-bold">Papperskorg</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {trashFiles.length} {trashFiles.length === 1 ? 'fil' : 'filer'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTrashFiles}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEmptyTrash}
              disabled={trashFiles.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              Töm papperskorg
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trashFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Trash2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Papperskorgen är tom</h2>
            <p className="text-muted-foreground">
              Filer du tar bort kommer att visas här
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {trashFiles.map((file) => (
              <div
                key={file.name}
                className="group relative bg-card rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all"
              >
                <div className="aspect-square bg-muted relative">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate mb-2">{file.name}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(file)}
                      className="flex-1 text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Återställ
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handlePermanentDelete(file)}
                      className="flex-1 text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Ta bort
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

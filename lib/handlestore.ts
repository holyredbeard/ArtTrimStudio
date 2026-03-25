// Store directory handles in IndexedDB so they persist between sessions
import Dexie, { Table } from 'dexie';

interface StoredHandle {
  id: string;
  handle: FileSystemDirectoryHandle;
}

class HandleStore extends Dexie {
  handles!: Table<StoredHandle, string>;

  constructor() {
    super('VibeLibraryHandles');
    this.version(1).stores({
      handles: 'id'
    });
  }
}

export const handleStore = new HandleStore();

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await handleStore.handles.put({ id: 'root', handle });
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const stored = await handleStore.handles.get('root');
    if (!stored?.handle) return null;
    
    // Verify we still have permission
    const permission = await stored.handle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return stored.handle;
    }
    
    // Request permission again
    const newPermission = await stored.handle.requestPermission({ mode: 'readwrite' });
    if (newPermission === 'granted') {
      return stored.handle;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to load root handle:', error);
    return null;
  }
}

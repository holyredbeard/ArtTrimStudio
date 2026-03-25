/**
 * Thumbnail generation utilities
 */

const MAX_THUMBNAIL_SIZE = 420;

export async function generateThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_THUMBNAIL_SIZE) {
          height = (height * MAX_THUMBNAIL_SIZE) / width;
          width = MAX_THUMBNAIL_SIZE;
        }
      } else {
        if (height > MAX_THUMBNAIL_SIZE) {
          width = (width * MAX_THUMBNAIL_SIZE) / height;
          height = MAX_THUMBNAIL_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail blob'));
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export async function saveThumbnail(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  thumbnailBlob: Blob
): Promise<string> {
  const thumbnailDir = await rootHandle.getDirectoryHandle('._thumbnails', { create: true });
  
  const thumbnailPath = relativePath.replace(/\.[^.]+$/, '.jpg');
  const pathParts = thumbnailPath.split('/');
  
  let currentDir = thumbnailDir;
  for (let i = 0; i < pathParts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
  }
  
  const filename = pathParts[pathParts.length - 1];
  const fileHandle = await currentDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(thumbnailBlob);
  await writable.close();
  
  return `._thumbnails/${thumbnailPath}`;
}

export async function getThumbnailUrl(
  rootHandle: FileSystemDirectoryHandle,
  thumbnailPath: string
): Promise<string> {
  try {
    const pathParts = thumbnailPath.split('/').filter(p => p);
    let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = rootHandle;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentHandle = await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(pathParts[i]);
    }
    
    const fileHandle = await (currentHandle as FileSystemDirectoryHandle).getFileHandle(
      pathParts[pathParts.length - 1]
    );
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (error) {
    console.error('Failed to load thumbnail:', error);
    return '';
  }
}

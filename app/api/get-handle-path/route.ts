import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Unfortunately, FileSystemDirectoryHandle doesn't expose absolute path
    // This is a security feature of the File System Access API
    // We need to use a different approach
    
    return NextResponse.json(
      { error: 'Cannot get absolute path from FileSystemDirectoryHandle due to browser security restrictions' },
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get path', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

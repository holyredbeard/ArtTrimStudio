import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    console.log('Opening in Explorer:', filePath);

    // Use spawn with /select, and path as TWO separate arguments
    // This is the correct format for Windows Explorer
    return new Promise((resolve) => {
      const explorerProcess = spawn('explorer.exe', ['/select,', filePath]);
      
      // Bring Explorer window to front after a short delay
      setTimeout(() => {
        const bringToFront = spawn('powershell.exe', [
          '-Command',
          `$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('File Explorer')`
        ]);
        bringToFront.on('error', (err) => console.error('Failed to bring window to front:', err));
      }, 500);
      
      explorerProcess.on('error', (error) => {
        console.error('Failed to spawn explorer:', error);
        resolve(NextResponse.json(
          { error: 'Failed to open in explorer', details: error.message },
          { status: 500 }
        ));
      });

      explorerProcess.on('close', (code) => {
        console.log('Explorer process closed with code:', code);
        if (code === 0 || code === null || code === 1) {
          // Code 1 is also success for explorer.exe
          resolve(NextResponse.json({ success: true }));
        } else {
          resolve(NextResponse.json(
            { error: 'Explorer exited with error', code },
            { status: 500 }
          ));
        }
      });

      // Set a timeout - explorer usually returns immediately
      setTimeout(() => {
        console.log('Explorer timeout - assuming success');
        resolve(NextResponse.json({ success: true }));
      }, 2000);
    });
  } catch (error) {
    console.error('Failed to open in explorer:', error);
    return NextResponse.json(
      { error: 'Failed to open in explorer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

'use client';

import { Button } from '@/components/ui/button';

interface PreviewGeneratedModalProps {
  isOpen: boolean;
  onSave: () => void;
  onTryAgain: () => void;
}

export function PreviewGeneratedModal({ isOpen, onSave, onTryAgain }: PreviewGeneratedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      <div className="bg-zinc-900/95 border-2 border-purple-500/50 rounded-2xl shadow-2xl max-w-md w-full p-8 pointer-events-auto backdrop-blur-sm">
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-purple-200 mb-2">Preview Generated</h2>
            <p className="text-sm text-zinc-400">Choose an action to continue</p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onSave} 
              className="w-full h-11 gap-2 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-500/50 transition-all duration-200"
            >
              Save Image
            </Button>
            <Button 
              onClick={onTryAgain}
              variant="outline" 
              className="w-full h-11 gap-2 text-sm font-medium rounded-xl bg-zinc-800/90 border-2 border-zinc-600/80 hover:bg-primary/30 hover:text-white hover:border-primary text-zinc-100 shadow-sm transition-all duration-200"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

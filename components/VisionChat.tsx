'use client';

import { useState, useEffect, useRef } from 'react';
import { ImageRecord, ChatMessage as DBChatMessage } from '@/lib/filedb';
import { filedb } from '@/lib/filedb';
import { sendToAI, imageToBase64, getApiKey, setApiKey, getModel, setModel, ChatMessage, getProvider, setProvider, getGrokApiKey, setGrokApiKey, getGrokModel, setGrokModel, getActiveModel, getActiveApiKey, AIProvider } from '@/lib/deepseek';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Send, Settings, Loader2, Maximize2, FileSearch, Check, ArrowUp, Trash2, Copy, FolderOpen, ChevronDown, ChevronUp, Paintbrush } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { InpaintingEditor } from './InpaintingEditor';
import { getThumbnailUrl, generateThumbnail, saveThumbnail } from '@/lib/thumbnail';

interface VisionChatProps {
  image: ImageRecord;
  rootHandle: FileSystemDirectoryHandle;
  onClose: () => void;
  onImageDeleted: () => void;
  onTagsChanged?: () => void;
  isFullscreen?: boolean;
  hideStatusAndEdit?: boolean;
  onStatusChange?: (status: 'keep' | 'upgrade' | 'discard' | 'fixed') => void;
  onEditImage?: () => void;
  onDelete?: () => void;
}

export function VisionChat({ image, rootHandle, onClose, onImageDeleted, onTagsChanged, isFullscreen, hideStatusAndEdit, onStatusChange, onEditImage, onDelete }: VisionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProviderState] = useState<AIProvider>('gemini');
  const [apiKey, setApiKeyState] = useState('');
  const [grokApiKey, setGrokApiKeyState] = useState('');
  const [model, setModelState] = useState<string>('gemini-3.1-pro-preview');
  const [grokModel, setGrokModelState] = useState<string>('grok-4.20');
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [showSettings, setShowSettings] = useState(false);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [showFullImage, setShowFullImage] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'keep' | 'upgrade' | 'discard' | 'fixed' | undefined>(image.reviewStatus);
  const [masterTags, setMasterTags] = useState<string[]>([]);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [lastAIResponse, setLastAIResponse] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const [isQuickActionsCollapsed, setIsQuickActionsCollapsed] = useState(false);
  const [showInpainting, setShowInpainting] = useState(false);
  const [replicateApiKey, setReplicateApiKeyState] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state for new image
    setMessages([]);
    setLastAIResponse('');
    setIsLoading(false);
    setImageBase64('');
    
    const currentProvider = getProvider();
    setProviderState(currentProvider);
    
    const geminiKey = getApiKey();
    if (geminiKey) {
      setApiKeyState(geminiKey);
    }
    
    const grokKey = getGrokApiKey();
    if (grokKey) {
      setGrokApiKeyState(grokKey);
    }
    
    const replicateKey = localStorage.getItem('replicate_api_key');
    if (replicateKey) {
      setReplicateApiKeyState(replicateKey);
    }
    
    // Show settings if no API key for current provider
    const activeKey = getActiveApiKey();
    if (!activeKey) {
      setShowSettings(true);
    }
    
    setModelState(getModel());
    setGrokModelState(getGrokModel());
    
    // Load master tags
    filedb.getMasterTags().then(setMasterTags);
    
    // Load chat history ONLY if it exists for THIS image
    if (image.chatHistory && image.chatHistory.length > 0) {
      const loadedMessages: ChatMessage[] = image.chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      setMessages(loadedMessages);
      const lastModel = image.chatHistory.filter(m => m.role === 'model').pop();
      if (lastModel) {
        setLastAIResponse(lastModel.content);
      }
    }
  }, [image.relativePath, image.chatHistory]); // Track relativePath to reset

  useEffect(() => {
    async function loadImage() {
      try {
        // Request permission before accessing file system
        const permission = await rootHandle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          console.error('Permission not granted');
          return;
        }

        const pathParts = image.relativePath.split('/');
        let currentHandle: FileSystemDirectoryHandle | FileSystemFileHandle = rootHandle;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentHandle = await (currentHandle as FileSystemDirectoryHandle).getDirectoryHandle(pathParts[i]);
        }
        
        const fileHandle = await (currentHandle as FileSystemDirectoryHandle).getFileHandle(
          pathParts[pathParts.length - 1]
        );
        const file = await fileHandle.getFile();
        const base64 = await imageToBase64(file);
        setImageBase64(base64);
        setImageMimeType(file.type || 'image/jpeg');
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    }
    loadImage();
  }, [image, rootHandle]);

  // Disabled click-outside to close - only close button should close the modal
  // This allows users to interact with arrows, batch bar, and other UI elements
  // while the modal is open

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullImage) {
          setShowFullImage(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, showFullImage]);

  const handleReview = async () => {
    const hasSentImage = messages.some(msg => msg.imageBase64);
    const reviewMessage: ChatMessage = {
      role: 'user',
      content: 'Review this image according to your instructions.',
      imageBase64: !hasSentImage ? imageBase64 : undefined,
      mimeType: !hasSentImage ? imageMimeType : undefined
    };

    setMessages(prev => [...prev, reviewMessage]);
    setIsLoading(true);

    try {
      const currentApiKey = provider === 'grok' ? grokApiKey : apiKey;
      const currentModel = provider === 'grok' ? grokModel : model;
      
      if (!currentApiKey) {
        toast.error(provider === 'grok' ? 'Grok API key required' : 'Gemini API key required', {
          description: 'Add your API key in Settings',
          duration: 5000
        });
        setIsLoading(false);
        return;
      }
      
      const response = await sendToAI(
        [...messages, reviewMessage],
        { provider, apiKey: currentApiKey, model: currentModel }
      );

      const modelMessage = {
        role: 'model' as const,
        content: response
      };
      setMessages(prev => [...prev, modelMessage]);
      setLastAIResponse(response);
      
      await saveChatHistory([...messages, reviewMessage, modelMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'model' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      };
      setMessages(prev => [...prev, errorMessage]);
      
      await saveChatHistory([...messages, reviewMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (overrideContent?: string) => {
    const finalContent = overrideContent || input;
    if (!finalContent.trim() || !apiKey) return;

    const hasSentImage = messages.some(msg => msg.imageBase64);
    const userMessage: ChatMessage = {
      role: 'user',
      content: finalContent,
      imageBase64: !hasSentImage ? imageBase64 : undefined,
      mimeType: !hasSentImage ? imageMimeType : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideContent) setInput('');
    setIsLoading(true);

    try {
      const currentApiKey = provider === 'grok' ? grokApiKey : apiKey;
      const currentModel = provider === 'grok' ? grokModel : model;
      
      if (!currentApiKey) {
        toast.error(provider === 'grok' ? 'Grok API key required' : 'Gemini API key required', {
          description: 'Add your API key in Settings',
          duration: 5000
        });
        setIsLoading(false);
        return;
      }
      
      const response = await sendToAI(
        [...messages, userMessage],
        { provider, apiKey: currentApiKey, model: currentModel }
      );

      const modelMessage = {
        role: 'model' as const,
        content: response
      };
      setMessages(prev => [...prev, modelMessage]);
      setLastAIResponse(response);
      
      await saveChatHistory([...messages, userMessage, modelMessage]);
    } catch (error) {
      const errorMessage = {
        role: 'model' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      };
      setMessages(prev => [...prev, errorMessage]);
      
      await saveChatHistory([...messages, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveChatHistory = async (msgs: ChatMessage[]) => {
    const chatHistory: DBChatMessage[] = msgs.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: Date.now()
    }));
    await filedb.update(image.relativePath, { chatHistory });
  };

  const handleReviewStatusChange = async (status: 'keep' | 'upgrade' | 'discard' | 'fixed') => {
    // Toggle off if clicking the same status
    const newStatus = reviewStatus === status ? undefined : status;
    setReviewStatus(newStatus);
    await filedb.update(image.relativePath, { reviewStatus: newStatus });
    await filedb.forceSave();
    image.reviewStatus = newStatus;
    onTagsChanged?.();
    
    // Better toast messages
    if (newStatus === undefined) {
      toast.success('Status cleared');
    } else if (newStatus === 'upgrade') {
      toast.success('Status changed to Improve');
    } else if (newStatus === 'fixed') {
      toast.success('Status changed to Ready');
    } else {
      toast.success(`Status changed to ${newStatus}`);
    }
  };

  const handleAddTag = async (tag: string) => {
    if (!image.tags.includes(tag)) {
      const newTags = [...image.tags, tag];
      await filedb.update(image.relativePath, { tags: newTags });
      image.tags = newTags;
      onTagsChanged?.();
      toast.success(`Tag "${tag}" added`);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    const newTags = image.tags.filter(t => t !== tag);
    await filedb.update(image.relativePath, { tags: newTags });
    image.tags = newTags;
    onTagsChanged?.();
    toast.success(`Tag "${tag}" removed`);
  };

  const handleCreateAndAddTag = async () => {
    const trimmed = newTag.trim().toLowerCase();
    if (!trimmed) return;
    
    if (!masterTags.includes(trimmed)) {
      await filedb.addMasterTag(trimmed);
      setMasterTags([...masterTags, trimmed].sort());
    }
    
    await handleAddTag(trimmed);
    setNewTag('');
  };

  const handleMoveToTrash = async () => {
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
      
      const originalPath = image.relativePath;
      await filedb.delete(image.relativePath);
      
      toast.success('Image moved to trash', {
        description: image.filename,
        duration: 8000,
        action: {
          label: 'Undo',
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
              
              toast.success('Image restored', {
                description: image.filename,
                duration: 3000
              });
              
              onImageDeleted?.();
            } catch (error) {
              console.error('Failed to restore image:', error);
              toast.error('Failed to restore image', {
                description: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
              });
            }
          }
        }
      });
      
      onClose();
      onImageDeleted?.();
      
    } catch (error) {
      console.error('Failed to move to trash:', error);
      toast.error('Failed to move image to trash', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleCopyFix = () => {
    const improvementSection = lastAIResponse.match(/## IMPROVEMENT SUGGESTIONS([\s\S]*?)(?=##|$)/i);
    if (improvementSection && improvementSection[1]) {
      const suggestions = improvementSection[1].trim();
      navigator.clipboard.writeText(suggestions);
      toast.success('Copied!', {
        description: 'Improvement suggestions copied to clipboard',
        duration: 2000
      });
    } else {
      toast.error('No improvement suggestions found', {
        duration: 2000
      });
    }
  };

  const renderReviewContent = (content: string, isLatest: boolean) => {
    const recommendationMatch = content.match(/## RECOMMENDATION\s*([\s\S]*?)(?=##|$)/i);
    const qualityMatch = content.match(/## (QUALITY|OVERALL QUALITY)\s*([\s\S]*?)(?=##|$)/i);
    const commercialMatch = content.match(/## COMMERCIAL POTENTIAL\s*([\s\S]*?)(?=##|$)/i);
    const strengthsMatch = content.match(/## STRENGTHS\s*([\s\S]*?)(?=##|$)/i);
    const weaknessesMatch = content.match(/## WEAKNESSES\s*([\s\S]*?)(?=##|$)/i);
    const improvementsMatch = content.match(/## IMPROVEMENT SUGGESTIONS\s*([\s\S]*?)(?=##|$)/i);
    
    const sections = {
      recommendation: recommendationMatch && recommendationMatch[1] ? recommendationMatch[1].trim() : '',
      quality: qualityMatch && qualityMatch[2] ? qualityMatch[2].trim() : '',
      commercial: commercialMatch && commercialMatch[1] ? commercialMatch[1].trim() : '',
      strengths: strengthsMatch && strengthsMatch[1] ? strengthsMatch[1].trim() : '',
      weaknesses: weaknessesMatch && weaknessesMatch[1] ? weaknessesMatch[1].trim() : '',
      improvements: improvementsMatch && improvementsMatch[1] ? improvementsMatch[1].trim() : ''
    };

    const hasStructuredFormat = sections.recommendation || sections.quality;

    if (!hasStructuredFormat) {
      return (
        <div className="text-sm markdown-content">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1" {...props} />,
              p: ({node, ...props}) => <p className="mb-2" {...props} />,
              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
              em: ({node, ...props}) => <em className="italic" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
              li: ({node, ...props}) => <li className="ml-1" {...props} />,
              code: ({node, ...props}) => <code className="bg-muted/50 px-1 rounded text-xs" {...props} />,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    const recommendation = sections.recommendation.toUpperCase();
    const isKeep = recommendation.includes('KEEP') && !recommendation.includes('UPGRADE');
    const isUpgrade = recommendation.includes('KEEP') && recommendation.includes('UPGRADE');
    const isDiscard = recommendation.includes('DISCARD');

    let badgeColor = 'bg-muted text-muted-foreground';
    if (isKeep) badgeColor = 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30';
    if (isUpgrade) badgeColor = 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30';
    if (isDiscard) badgeColor = 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30';

    return (
      <div className="space-y-4 text-sm">
        <div className={`${badgeColor} border-2 rounded-lg px-4 py-3 text-center font-bold text-base`}>
          {sections.recommendation.replace(/\*\*/g, '').trim()}
        </div>

        {sections.quality && (
          <div className="space-y-1">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Overall quality</div>
            <div>{sections.quality}</div>
          </div>
        )}

        {sections.commercial && (
          <div className="space-y-1">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Commercial potential</div>
            <div>{sections.commercial}</div>
          </div>
        )}

        {sections.strengths && sections.strengths.trim() && (
          <div className="space-y-1">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Strengths</div>
            <div className="space-y-1">
              {sections.strengths.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => {
                const text = line.replace(/^-\s*/, '');
                const parts = text.split(/\*\*(.*?)\*\*/g);
                return (
                  <div key={i} className="flex gap-2">
                    <span className="text-green-500">✓</span>
                    <span>
                      {parts.map((part, idx) => 
                        idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sections.weaknesses && sections.weaknesses.trim() && (
          <div className="space-y-1">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Weaknesses</div>
            <div className="space-y-1">
              {sections.weaknesses.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => {
                const text = line.replace(/^-\s*/, '');
                const parts = text.split(/\*\*(.*?)\*\*/g);
                return (
                  <div key={i} className="flex gap-2">
                    <span className="text-red-500">✕</span>
                    <span>
                      {parts.map((part, idx) => 
                        idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isUpgrade && sections.improvements && sections.improvements.trim() && (
          <div className="space-y-2">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Improvement suggestions</div>
            <div className="space-y-1">
              {sections.improvements.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => {
                const text = line.replace(/^-\s*/, '');
                const parts = text.split(/\*\*(.*?)\*\*/g);
                return (
                  <div key={i} className="flex gap-2">
                    <span className="text-yellow-500">↑</span>
                    <span>
                      {parts.map((part, idx) => 
                        idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {isLatest && (
              <Button
                onClick={handleCopyFix}
                variant="outline"
                size="sm"
                className="w-full gap-2 mt-2"
              >
                <Copy className="w-3 h-3" />
                Copy improvement suggestions
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleOpenInExplorer = async () => {
    try {
      const folderHandleRecord = localStorage.getItem('rootAbsolutePath');
      let absoluteRootPath = folderHandleRecord;
      
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

      console.log('Sending to API:', fullPath);

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
        console.error('API error:', error);
        toast.error('Failed to open Explorer', {
          description: error.details || 'Unknown error',
          duration: 5000
        });
      }
      
    } catch (error) {
      console.error('Failed to open in explorer:', error);
      toast.error('Failed to open in Explorer', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000
      });
    }
  };

  const handleSaveSettings = () => {
    setProvider(provider);
    setApiKey(apiKey);
    setModel(model);
    setGrokApiKey(grokApiKey);
    setGrokModel(grokModel);
    localStorage.setItem('replicate_api_key', replicateApiKey);
    setShowSettings(false);
    toast.success('Settings saved!', {
      description: `Using ${provider === 'grok' ? 'Grok' : 'Gemini'} as provider`,
      duration: 3000
    });
  };

  return (
    <>
    <div 
      ref={panelRef} 
      className={`fixed ${hideStatusAndEdit ? 'top-[64px]' : 'top-[78px]'} right-0 w-[500px] bottom-0 bg-zinc-900 border-l-2 border-l-primary flex flex-col z-50 shadow-xl transition-all duration-500 ease-in-out ${
        isClosing || isFullscreen ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
      }`}
    >
      <div className="px-6 py-4 border-b-2 border-zinc-800/80 bg-zinc-900/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div 
              className="w-10 h-10 rounded overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all flex-shrink-0"
              onClick={() => setShowFullImage(true)}
              title="Show full size"
            >
              {imageBase64 && (
                <img
                  src={`data:${imageMimeType};base64,${imageBase64}`}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <h2 className="text-base font-semibold truncate flex-1" title={image.filename}>
              {image.filename}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsQuickActionsCollapsed(!isQuickActionsCollapsed)}
              title={isQuickActionsCollapsed ? 'Show quick actions' : 'Hide quick actions'}
            >
              {isQuickActionsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
        
      {!isQuickActionsCollapsed && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4 pb-2">
            {!hideStatusAndEdit && (
              <>
            {/* Status Section */}
            <div className="space-y-3 pb-6 border-b border-zinc-800/60">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewStatusChange('fixed')}
                  className={`h-9 gap-1.5 text-xs font-medium rounded-lg flex-1 transition-all duration-200 ${
                    reviewStatus === 'fixed'
                      ? 'bg-green-500/40 text-green-100 border-2 border-green-400 ring-2 ring-green-500/50 shadow-sm'
                      : 'bg-green-500/20 text-green-200 hover:bg-green-500/30 hover:text-green-100 border-2 border-green-500/50 shadow-sm'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">Ready</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReviewStatusChange('upgrade')}
                  className={`h-9 gap-1.5 text-xs font-medium rounded-lg flex-1 transition-all duration-200 ${
                    reviewStatus === 'upgrade'
                      ? 'bg-yellow-500/40 text-yellow-100 border-2 border-yellow-400 ring-2 ring-yellow-500/50 shadow-sm'
                      : 'bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30 hover:text-yellow-100 border-2 border-yellow-500/50 shadow-sm'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Improve</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMoveToTrash}
                  className="h-9 gap-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 hover:text-red-100 border-2 border-red-500/50 shadow-sm flex-1 transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Delete</span>
                </Button>
              </div>
            </div>

            {/* Edit Tools Section */}
            <div className="space-y-3 pb-6 border-b border-zinc-800/60">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Edit Tools</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInpainting(true)}
                className="text-xs h-9 w-full rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200"
              >
                <Paintbrush className="w-4 h-4 mr-1" />
                Edit Image
              </Button>
            </div>
            </>
            )}
            
            {/* AI Review Section */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">AI Review</div>
              <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReview}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSend('Give me a brutal, honest, and hyper-critical review of this image. Do not hold back – point out every single technical flaw, anatomical error, or creative misstep using the structured review format.');
                }}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Brutal Review
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSend('List the most significant technical and artistic weaknesses of this image. What makes it look amateur or unpolished? Answer directly without the structured format.');
                }}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weaknesses
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSend('Analyze the style and subject of this image and provide a highly detailed, professional AI prompt (Stable Diffusion/Midjourney style) that would produce a significantly improved version of this same concept.');
                }}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Improve Prompt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSend('Is this image commercially sellable for stock sites, posters, or merch? Evaluate its market appeal and suggest which specific platforms or niches it would be most successful in.');
                }}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sellable?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleSend('Give me 5 creative ideas for variations or series based on this image. What other subjects or color palettes would work well in this exact style?');
                }}
                disabled={isLoading || !imageBase64 || (provider === 'grok' ? !grokApiKey : !apiKey)}
                className="text-xs h-8 px-2 rounded-lg bg-zinc-800/90 text-zinc-100 hover:bg-primary/30 hover:text-white hover:border-primary border-2 border-zinc-600/80 font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                More Ideas
              </Button>
            </div>
          </div>
        </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-zinc-900 z-[70] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-6">
            {/* Chat AI Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary border-b border-border pb-2">Chat AI</h4>
              
              <div>
                <label className="text-xs font-medium mb-1 block">AI Provider</label>
                <div className="flex gap-2">
                  <Button
                    variant={provider === 'gemini' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProviderState('gemini')}
                    className="flex-1"
                  >
                    Gemini
                  </Button>
                  <Button
                    variant={provider === 'grok' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProviderState('grok')}
                    className="flex-1"
                  >
                    Grok
                  </Button>
                </div>
              </div>
              
              {provider === 'gemini' && (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Gemini API Key</label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKeyState(e.target.value)}
                      placeholder="AIza..."
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Gemini Model</label>
                    <Select value={model} onValueChange={setModelState}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</SelectItem>
                        <SelectItem value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</SelectItem>
                        <SelectItem value="gemini-3-flash-preview">gemini-3-flash-preview</SelectItem>
                        <SelectItem value="gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                        <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                        <SelectItem value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</SelectItem>
                        <SelectItem value="gemini-3.1-flash-image-preview">gemini-3.1-flash-image-preview</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {provider === 'grok' && (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Grok API Key</label>
                    <Input
                      type="password"
                      value={grokApiKey}
                      onChange={(e) => setGrokApiKeyState(e.target.value)}
                      placeholder="xai-..."
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Grok Model</label>
                    <Select value={grokModel} onValueChange={setGrokModelState}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grok-4.20">grok-4.20</SelectItem>
                        <SelectItem value="grok-4.20-0309-reasoning">grok-4.20-0309-reasoning</SelectItem>
                        <SelectItem value="grok-4.20-0309-non-reasoning">grok-4.20-0309-non-reasoning</SelectItem>
                        <SelectItem value="grok-4.20-multi-agent-0309">grok-4.20-multi-agent-0309</SelectItem>
                        <SelectItem value="grok-4.20-beta">grok-4.20-beta</SelectItem>
                        <SelectItem value="grok-4">grok-4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            
            {/* Inpainting AI Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary border-b border-border pb-2">Inpainting AI</h4>
              
              <div>
                <label className="text-xs font-medium mb-1 block">Replicate API Key</label>
                <Input
                  type="password"
                  value={replicateApiKey}
                  onChange={(e) => setReplicateApiKeyState(e.target.value)}
                  placeholder="r8_..."
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for AI-powered image inpainting with Stable Diffusion
                </p>
              </div>
            </div>
            
            <Button onClick={handleSaveSettings} size="sm" className="w-full">
              Save Settings
            </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">Ask anything about this image...</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.role === 'model' ? (
                <div className="space-y-3 w-full">
                  {renderReviewContent(msg.content, idx === messages.length - 1)}
                </div>
              ) : (
                <div className="space-y-2">
                  {msg.imageBase64 && msg.mimeType && (
                    <img
                      src={`data:${msg.mimeType};base64,${msg.imageBase64}`}
                      alt="Uploaded image"
                      className="max-w-full rounded-lg"
                      onError={(e) => {
                        console.error('Failed to load image in message');
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

    <div className="border-t border-border px-6 py-3">
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask about this image..."
          disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
          className="flex-1"
        />
        <Button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim() || (provider === 'grok' ? !grokApiKey : !apiKey)}
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      <div className="text-[10px] text-zinc-600 mt-2 text-center">
        Active model: {provider === 'grok' ? grokModel : model}
      </div>
    </div>
  </div>

  {showFullImage && (
    <div 
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-8"
      onClick={() => setShowFullImage(false)}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={() => setShowFullImage(false)}
      >
        <X className="w-6 h-6" />
      </Button>
      <img
        src={`data:${imageMimeType};base64,${imageBase64}`}
        alt={image.filename}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
    )}
    
    {showInpainting && imageBase64 && (
      <InpaintingEditor
        imageUrl={`data:${imageMimeType};base64,${imageBase64}`}
        originalFilename={image.filename}
        onClose={() => setShowInpainting(false)}
        onSave={async (resultUrl: string, filename: string, replaceOriginal: boolean) => {
          try {
            console.log('VisionChat onSave - replaceOriginal:', replaceOriginal);
            console.log('VisionChat onSave - filename:', filename);
            console.log('VisionChat onSave - original filename:', image.filename);
            
            // Download the result image
            const response = await fetch(resultUrl);
            const blob = await response.blob();
            
            // Get the directory where the original image is located
            const dirPath = image.relativePath.split('/').slice(0, -1).join('/');
            let targetDir = rootHandle;
            
            // Navigate to the directory
            if (dirPath) {
              const parts = dirPath.split('/');
              for (const part of parts) {
                targetDir = await targetDir.getDirectoryHandle(part);
              }
            }
            
            console.log('VisionChat - About to check replaceOriginal:', replaceOriginal);
            
            if (replaceOriginal) {
              // Create backup directory if it doesn't exist
              let backupDir: FileSystemDirectoryHandle;
              try {
                backupDir = await targetDir.getDirectoryHandle('_backup', { create: true });
              } catch (error) {
                console.error('Failed to create backup directory:', error);
                throw new Error('Failed to create backup directory');
              }
              
              // Backup original file
              try {
                const originalFile = await targetDir.getFileHandle(image.filename);
                const originalBlob = await originalFile.getFile();
                const timestamp = Date.now();
                const backupFilename = `${image.filename.replace(/\.[^/.]+$/, '')}_backup_${timestamp}.${image.filename.split('.').pop()}`;
                const backupFileHandle = await backupDir.getFileHandle(backupFilename, { create: true });
                const writable = await backupFileHandle.createWritable();
                await writable.write(originalBlob);
                await writable.close();
              } catch (error) {
                console.error('Failed to backup original file:', error);
                throw new Error('Failed to backup original file');
              }
              
              // Replace original file
              const fileHandle = await targetDir.getFileHandle(image.filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              
              // Update the image in the database
              await filedb.update(image.relativePath, {
                lastModified: Date.now(),
                size: blob.size
              });
              await filedb.forceSave();
              
              toast.success('Image replaced!', {
                description: 'Original backed up to _backup folder'
              });
            } else {
              // Save as new file
              const fileHandle = await targetDir.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
              
              // Generate and save thumbnail
              const file = new File([blob], filename, { type: blob.type });
              const thumbnailBlob = await generateThumbnail(file);
              const newRelativePath = dirPath ? `${dirPath}/${filename}` : filename;
              const thumbnailPath = await saveThumbnail(rootHandle, newRelativePath, thumbnailBlob);
              
              // Add new image to database
              await filedb.put({
                relativePath: newRelativePath,
                filename: filename,
                size: blob.size,
                lastModified: Date.now(),
                tags: image.tags || [],
                aestheticScore: 0,
                qualityScore: 0,
                totalScore: 0,
                dateAdded: Date.now(),
                thumbnailPath: thumbnailPath,
                status: 'unreviewed',
                chatHistory: []
              });
              
              toast.success('Image saved!', {
                description: filename
              });
            }
            
            setShowInpainting(false);
            onTagsChanged?.();
          } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save image');
          }
        }}
        replicateApiKey={replicateApiKey}
      />
    )}
    </>
  );
}

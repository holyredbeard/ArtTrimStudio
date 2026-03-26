'use client';

import { useState, useEffect, useRef } from 'react';
import { ImageRecord, ChatMessage as DBChatMessage } from '@/lib/filedb';
import { filedb } from '@/lib/filedb';
import { sendToAI, imageToBase64, getApiKey, setApiKey, getModel, setModel, ChatMessage, getProvider, setProvider, getGrokApiKey, setGrokApiKey, getGrokModel, setGrokModel, getActiveModel, getActiveApiKey, AIProvider } from '@/lib/deepseek';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Send, Settings, Loader2, Maximize2, FileSearch, Check, ArrowUp, Trash2, Copy, FolderOpen, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Card } from './ui/card';
import { toast } from 'sonner';

interface VisionChatProps {
  image: ImageRecord;
  rootHandle: FileSystemDirectoryHandle;
  onClose: () => void;
  onImageDeleted: () => void;
  onTagsChanged?: () => void;
}

export function VisionChat({ image, rootHandle, onClose, onImageDeleted, onTagsChanged }: VisionChatProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    
    // Show settings if no API key for current provider
    const activeKey = getActiveApiKey();
    if (!activeKey) {
      setShowSettings(true);
    }
    
    setModelState(getModel());
    setGrokModelState(getGrokModel());
    
    // Load master tags
    filedb.getMasterTags().then(setMasterTags);
    
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
  }, [image.chatHistory]);

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
    const reviewMessage: ChatMessage = {
      role: 'user',
      content: 'Review this image according to your instructions.',
      imageBase64: messages.length === 0 ? imageBase64 : undefined,
      mimeType: messages.length === 0 ? imageMimeType : undefined
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

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      imageBase64: messages.length === 0 ? imageBase64 : undefined,
      mimeType: messages.length === 0 ? imageMimeType : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
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
    setReviewStatus(status);
    await filedb.update(image.relativePath, { reviewStatus: status });
    await filedb.forceSave();
    image.reviewStatus = status;
    onTagsChanged?.();
    toast.success(`Status changed to ${status.toUpperCase()}`);
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
          {sections.recommendation}
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
              {sections.strengths.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-green-500">âœ“</span>
                  <span>{line.replace(/^-\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.weaknesses && sections.weaknesses.trim() && (
          <div className="space-y-1">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Weaknesses</div>
            <div className="space-y-1">
              {sections.weaknesses.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-red-500">âœ—</span>
                  <span>{line.replace(/^-\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isUpgrade && sections.improvements && sections.improvements.trim() && (
          <div className="space-y-2">
            <div className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Improvement suggestions</div>
            <div className="space-y-1">
              {sections.improvements.split('\n').filter(line => line.trim().startsWith('-')).map((line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-yellow-500">â†‘</span>
                  <span>{line.replace(/^-\s*/, '')}</span>
                </div>
              ))}
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
    setShowSettings(false);
    toast.success('Settings saved!', {
      description: `Using ${provider === 'grok' ? 'Grok' : 'Gemini'} as provider`,
      duration: 3000
    });
  };

  return (
    <>
    <div ref={panelRef} className={`fixed top-[151px] right-0 w-[500px] bottom-0 bg-zinc-900 border-l-[6px] border-l-primary flex flex-col z-50 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`} style={{ backgroundColor: '#35383f', boxShadow: '-6px 0 16px -4px rgba(139, 92, 246, 0.15), -3px 0 8px -2px rgba(0, 0, 0, 0.5)' }}>
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div 
              className="w-10 h-10 rounded overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all flex-shrink-0"
              onClick={() => setShowFullImage(true)}
              title="Show full size"
            >
              {imageBase64 && (
                <img
                  src={`data:image/jpeg;base64,${imageBase64}`}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <h2 className="text-lg font-semibold truncate flex-1" title={image.filename}>
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
              onClick={() => {
                setIsClosing(true);
                setTimeout(onClose, 300);
              }}
            >
              <X className="w-5 h-5" />
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
        {!isQuickActionsCollapsed && (
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReview}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Review
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('Give me a brutal, honest review of this image. What are its biggest flaws?');
                handleSend();
              }}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Brutal Review
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('What are the main weaknesses of this image?');
                handleSend();
              }}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Weaknesses
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('Give me a detailed prompt to improve this image.');
                handleSend();
              }}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Improve Prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('Is this image sellable? What market would it fit?');
                handleSend();
              }}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              Sellable?
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput('Give me 5 creative ideas based on this image.');
                handleSend();
              }}
              disabled={isLoading || (provider === 'grok' ? !grokApiKey : !apiKey)}
              className="text-xs h-8 hover:bg-primary/10 hover:text-primary hover:border-primary"
            >
              More Ideas
            </Button>
          </div>
        )}
      </div>


      {showSettings && (
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="space-y-3">
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
            
            <Button onClick={handleSaveSettings} size="sm" className="w-full">
              Save Settings
            </Button>
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
          onClick={handleSend}
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
    </>
  );
}

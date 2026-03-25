# Vibe Library v0.1

A local AI image management tool built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- 📁 **Folder Selection & Persistence** - Select a root folder and the app remembers it
- 🔄 **Incremental Scanning** - Only processes new or modified images
- 🖼️ **Thumbnail Generation** - Creates optimized thumbnails (max 420px)
- 🏷️ **Tag Filtering** - Click tags in the sidebar to filter images
- 🔍 **Search** - Search by filename or tags
- 📊 **Sorting** - Sort by aesthetic score, newest, or name
- ⚡ **Virtualized Grid** - Handles 8000+ images smoothly
- 🌙 **Dark Mode** - Beautiful violet accent theme

## Installation

Due to PowerShell execution policy restrictions, you need to install dependencies using one of these methods:

### Option 1: Enable script execution temporarily
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
npm install
```

### Option 2: Use cmd instead
Open Command Prompt (cmd.exe) and run:
```cmd
cd "c:\Users\henri\Desktop\AI image\vibe-library"
npm install
```

### Option 3: Use PowerShell with bypass
```powershell
powershell -ExecutionPolicy Bypass -Command "npm install"
```

## Running the App

After installing dependencies:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click "Select Folder" to choose your image root directory
2. Click "Scan Folder" to analyze images
3. Use the search bar to find images
4. Click tags in the sidebar to filter
5. Sort images by aesthetic score, date, or name

## Tech Stack

- **Next.js 15** - App Router with React 19
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Dexie.js** - IndexedDB wrapper
- **@tanstack/react-virtual** - Virtualized grid
- **File System Access API** - Local file access

## Mock Analysis

The current version uses mock data for tags and aesthetic scores. The `analyzeImage()` function in `lib/analyzer.ts` is clearly marked for replacement with real CLIP + LAION Aesthetic models.

## Browser Compatibility

Requires a browser that supports the File System Access API:
- Chrome/Edge 86+
- Opera 72+

Not supported in Firefox or Safari yet.

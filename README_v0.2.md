# Vibe Library v0.2 🎨

En lokal AI-bildhanteringsapp byggd med Next.js 15, TypeScript och Tailwind CSS.

## 🚀 Nya funktioner i v0.2

### 1. Riktig AI-Scoring
- **Aesthetic Score** - Analyserar färgrikedom, mättnad, ljusstyrka, kontrast och komposition
- **Quality Score** - Bedömer upplösning, kontrast, skärpa och exponering
- **Total Score** - Kombinerad poäng (60% estetik + 40% kvalitet)
- Alla tre scores visas på varje bild med färgkodade badges

### 2. DeepSeek Vision Chat
- Klicka på en bild för att öppna AI-chat
- Ställ frågor om bilden med DeepSeek-VL2 eller Janus-Pro
- API-nyckel sparas lokalt
- Konversationshistorik bevaras per session

### 3. Batch-operationer
- **Ctrl/Cmd + Klick** för att välja flera bilder
- **Keep/Discard** - Markera bilder för att behålla eller kasta
- **Export** - Exportera metadata som JSON
- **Delete** - Ta bort från databas

### 4. Status-filter
- Filtrera på: All, Keep, Discard, Unreviewed
- Alla nya bilder börjar som "Unreviewed"
- Bygg ditt workflow för bildgranskning

### 5. Stats Dashboard
- Total antal bilder
- Genomsnittliga scores (Aesthetic, Quality, Total)
- Top 5 tags med antal
- Visuell översikt av ditt bibliotek

## 📦 Installation

```bash
cd "c:\Users\henri\Desktop\AI image\vibe-library"
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000)

## 🎯 Användning

### Grundläggande workflow
1. **Välj mapp** - Klicka "Select Folder" och välj din bildmapp
2. **Scanna** - Klicka "Scan Folder" för att analysera bilder
3. **Utforska** - Bläddra i gridet, sök, filtrera på tags
4. **Granska** - Markera bilder som Keep/Discard
5. **Chat** - Klicka på en bild för att chatta med AI om den

### Batch-operationer
1. Håll **Ctrl** (Windows) eller **Cmd** (Mac) och klicka bilder
2. Valda bilder får en checkmark och violett ring
3. Använd toolbar-knapparna: Keep, Discard, Export, Delete
4. "Select All" för att välja alla synliga bilder

### DeepSeek Vision Chat
1. Klicka på en bild
2. Första gången: Ange din DeepSeek API-nyckel
3. Välj modell (deepseek-vl2 eller janus-pro)
4. Ställ frågor: "Vad finns i bilden?", "Beskriv färgerna", etc.
5. Stäng med X-knappen

### Sortering & Filtrering
- **Sort by**: Total Score (default), Aesthetic, Quality, Newest, Name
- **Status filter**: All, Keep, Discard, Unreviewed
- **Tag filter**: Klicka tags i sidebar
- **Sök**: Sök på filnamn eller tags

## 🏗️ Teknisk stack

- **Next.js 15** - App Router, React 19
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Dexie.js** - IndexedDB wrapper
- **@tanstack/react-virtual** - Virtualized grid
- **File System Access API** - Lokal filåtkomst

## 📊 Scoring-algoritmer

### Aesthetic Score
Analyserar:
- **Colorfulness** (25%) - Färgrikedom och variation
- **Saturation** (25%) - Färgmättnad
- **Brightness** (20%) - Optimal ljusstyrka (runt 128/255)
- **Contrast** (15%) - Kontrast mellan pixlar
- **Composition** (15%) - Bildformat och proportioner

### Quality Score
Analyserar:
- **Resolution** (30%) - Bildstorlek i pixlar
- **Contrast** (25%) - Pixelvarians
- **Sharpness** (25%) - Kantdetektering
- **Exposure** (20%) - Ljusstyrkefördelning

### Total Score
`Total = (Aesthetic × 0.6) + (Quality × 0.4)`

## 🎨 UI-funktioner

### Bildkort
- Tre färgkodade score-badges:
  - 🟣 **A** - Aesthetic (violett)
  - 🔵 **Q** - Quality (blå)
  - 🟢 **T** - Total (grön)
- Första 3 tags + räknare för resten
- Hover-effekt med border-färg
- Selection-indikator (checkmark)

### Stats Dashboard
5 kort som visar:
1. Total antal bilder
2. Genomsnittlig Aesthetic Score
3. Genomsnittlig Quality Score
4. Genomsnittlig Total Score
5. Top 3 tags

### Vision Chat
- Fast position nere till höger (500×600px)
- Bildminiatyr i header
- Inställningar för API-nyckel och modell
- Scrollbar för lång konversation
- Skicka med Enter

## 🔐 Privacy & Säkerhet

- ✅ All bildanalys sker lokalt i webbläsaren
- ✅ Inga bilder laddas upp till servrar
- ✅ API-nyckel sparas endast i localStorage
- ✅ Endast DeepSeek chat skickar data (bild + text)
- ✅ Thumbnails sparas i `._thumbnails` mapp lokalt

## 🚀 Prestanda

- **8000+ bilder** - Virtualiserat grid hanterar stora bibliotek
- **Snabb analys** - Canvas-baserad bildbearbetning
- **Incremental scan** - Endast nya/ändrade bilder bearbetas
- **Lazy loading** - Thumbnails laddas vid behov
- **Batch updates** - Effektiva databasoperationer

## 📁 Projektstruktur

```
vibe-library/
├── app/
│   ├── page.tsx              # Huvudapplikation
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styling
├── components/
│   ├── ImageGrid.tsx         # Virtualiserat grid
│   ├── Sidebar.tsx           # Tag-filter sidebar
│   ├── StatsDashboard.tsx    # Analytics dashboard
│   ├── VisionChat.tsx        # DeepSeek chat
│   └── ui/                   # shadcn/ui komponenter
├── lib/
│   ├── db.ts                 # Dexie schema
│   ├── scanner.ts            # Folder scanning
│   ├── thumbnail.ts          # Thumbnail generation
│   ├── analyzer.ts           # Scoring algorithms
│   └── deepseek.ts           # DeepSeek API client
└── types/
    └── file-system-access.d.ts
```

## 🔮 Framtida förbättringar

- [ ] CLIP-baserad semantisk tagging (ersätt mock tags)
- [ ] Bildlikhetssökning (hitta liknande bilder)
- [ ] Duplikatdetektering
- [ ] Redigerbara tags
- [ ] Exportera valda bilder (filer + metadata)
- [ ] Tangentbordsgenvägar
- [ ] Undo/Redo för batch-operationer
- [ ] Bulk-redigering av metadata

## 🐛 Felsökning

### Bilder visas inte
- Kontrollera att mappen har läs-/skrivrättigheter
- Verifiera att bildformaten är .jpg, .jpeg, .png eller .webp

### Scan går långsamt
- Första scanningen genererar thumbnails (tar längre tid)
- Nästa scan är snabbare (endast nya bilder)

### DeepSeek chat fungerar inte
- Kontrollera att API-nyckeln är korrekt
- Verifiera att du har kredit på ditt DeepSeek-konto
- Testa att byta modell (deepseek-vl2 ↔ janus-pro)

### Browser-kompatibilitet
Kräver File System Access API:
- ✅ Chrome/Edge 86+
- ✅ Opera 72+
- ❌ Firefox (ej stöd än)
- ❌ Safari (ej stöd än)

## 📝 Changelog

Se [CHANGELOG_v0.2.md](./CHANGELOG_v0.2.md) för fullständig lista över ändringar.

## 📄 Licens

MIT License - Fri att använda och modifiera.

---

**Vibe Library v0.2** - Bygg ditt perfekta bildbibliotek med AI-assistans! 🎨✨

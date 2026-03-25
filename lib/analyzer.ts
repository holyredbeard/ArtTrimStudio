export interface AnalysisResult {
  tags: string[];
  aestheticScore: number;
  qualityScore: number;
  totalScore: number;
}

async function calculateAestheticScore(file: File): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(50);
        return;
      }

      const maxSize = 512;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      let colorfulness = 0;
      let saturation = 0;
      let brightness = 0;
      let contrast = 0;
      let prevBrightness = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;

        colorfulness += delta;
        brightness += (r + g + b) / 3;
        
        if (max > 0) {
          saturation += delta / max;
        }

        if (i > 0) {
          contrast += Math.abs(brightness / (i / 4) - prevBrightness);
        }
        prevBrightness = brightness / ((i / 4) + 1);
      }

      const pixelCount = data.length / 4;
      const avgColorfulness = colorfulness / pixelCount;
      const avgSaturation = (saturation / pixelCount) * 100;
      const avgBrightness = brightness / pixelCount;
      const avgContrast = contrast / pixelCount;

      const aspectRatio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
      const compositionScore = aspectRatio < 2 ? 100 : Math.max(0, 100 - (aspectRatio - 2) * 20);

      const colorScore = Math.min(100, avgColorfulness * 0.5);
      const saturationScore = Math.min(100, avgSaturation);
      const brightnessScore = 100 - Math.abs(avgBrightness - 128) * 0.6;
      const contrastScore = Math.min(100, avgContrast * 3);

      const aestheticScore = Math.round(
        colorScore * 0.25 +
        saturationScore * 0.25 +
        brightnessScore * 0.2 +
        contrastScore * 0.15 +
        compositionScore * 0.15
      );

      resolve(Math.max(0, Math.min(100, aestheticScore)));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(50);
    };

    img.src = url;
  });
}

async function calculateQualityScore(file: File): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(50);
        return;
      }

      const maxSize = 512;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      let totalVariance = 0;
      let totalBrightness = 0;
      let edgeStrength = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        if (i > 0) {
          const prevBrightness = (data[i - 4] + data[i - 3] + data[i - 2]) / 3;
          const diff = Math.abs(brightness - prevBrightness);
          totalVariance += diff;
          if (diff > 30) edgeStrength++;
        }
      }

      const pixelCount = data.length / 4;
      const avgBrightness = totalBrightness / pixelCount;
      const avgVariance = totalVariance / pixelCount;
      const edgeRatio = edgeStrength / pixelCount;

      const resolutionScore = Math.min(100, (img.width * img.height) / 10000);
      const contrastScore = Math.min(100, avgVariance * 2);
      const sharpnessScore = Math.min(100, edgeRatio * 1000);
      const exposureScore = 100 - Math.abs(avgBrightness - 128) * 0.8;

      const qualityScore = Math.round(
        resolutionScore * 0.3 +
        contrastScore * 0.25 +
        sharpnessScore * 0.25 +
        exposureScore * 0.2
      );

      resolve(Math.max(0, Math.min(100, qualityScore)));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(50);
    };

    img.src = url;
  });
}

export async function analyzeImage(file: File): Promise<AnalysisResult> {
  const [aestheticScore, qualityScore] = await Promise.all([
    calculateAestheticScore(file),
    calculateQualityScore(file)
  ]);

  const totalScore = Math.round((aestheticScore * 0.6) + (qualityScore * 0.4));

  return {
    tags: [], // Tags will be generated from filename matching against master tag list
    aestheticScore,
    qualityScore,
    totalScore
  };
}

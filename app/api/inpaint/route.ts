import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function POST(request: NextRequest) {
  try {
    const { image, mask, prompt, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Replicate API key is required' },
        { status: 400 }
      );
    }

    console.log('Starting inpainting with prompt:', prompt);
    console.log('Image size:', image.length, 'bytes');
    console.log('Mask size:', mask.length, 'bytes');

    const replicate = new Replicate({
      auth: apiKey,
    });

    // Using a working inpainting model with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout after 120 seconds')), 120000)
    );

    // Log input sizes for debugging
    console.log('Sending to Replicate...');
    console.log('Prompt:', prompt);
    
    // Use Ideogram v2 Turbo - fast inpainting (7-12 seconds)
    const replicatePromise = replicate.run(
      "ideogram-ai/ideogram-v2-turbo",
      {
        input: {
          image: image,
          mask: mask,
          prompt: prompt,
          magic_prompt_option: "Auto",
        }
      }
    );

    const output = await Promise.race([replicatePromise, timeoutPromise]);

    console.log('Replicate raw output type:', typeof output);
    console.log('Is array?', Array.isArray(output));
    
    // Replicate SDK returns FileOutput objects, we need to convert to URL string
    let resultUrl: string;
    
    if (Array.isArray(output)) {
      // Array of FileOutput objects
      const firstItem = output[0];
      if (typeof firstItem === 'string') {
        resultUrl = firstItem;
      } else if (firstItem && typeof firstItem === 'object' && 'toString' in firstItem) {
        resultUrl = firstItem.toString();
      } else {
        resultUrl = String(firstItem);
      }
    } else if (typeof output === 'string') {
      resultUrl = output;
    } else if (output && typeof output === 'object' && 'toString' in output) {
      // FileOutput object with toString method
      resultUrl = output.toString();
    } else {
      // Last resort - try to convert to string
      resultUrl = String(output);
    }
    
    console.log('Converted URL:', resultUrl);
    console.log('URL type:', typeof resultUrl);
    
    if (!resultUrl) {
      console.error('No URL found in output');
      throw new Error('No image URL received from Replicate');
    }
    
    if (typeof resultUrl !== 'string') {
      console.error('URL is not a string:', typeof resultUrl, resultUrl);
      throw new Error(`Invalid URL type: ${typeof resultUrl}`);
    }
    
    console.log('Final URL to return:', resultUrl);
    console.log('URL starts with http?', resultUrl.startsWith('http'));
    
    return NextResponse.json({ output: resultUrl });
  } catch (error) {
    console.error('Inpainting error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate inpainting';
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

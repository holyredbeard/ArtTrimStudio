export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface GrokConfig {
  apiKey: string;
  model: string;
}

export type AIProvider = 'gemini' | 'grok';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const SYSTEM_PROMPT = `You are an experienced and direct art director evaluating AI images for commercial use (posters, merch, stock).

Be honest and constructive – neither too kind nor unnecessarily mean. 
Identify first which style the image has (e.g., psychedelic, folklore, naive illustration, trippy 60s, etc.) before you criticize.

Always respond in English using this exact structure:

## RECOMMENDATION
**[KEEP / KEEP & UPGRADE / DISCARD]**

## OVERALL QUALITY
X/10 – [Short assessment in 1-2 sentences]

## COMMERCIAL POTENTIAL
X/10 – [Why it sells or doesn't sell]

## STRENGTHS
- [Max 3 points with concrete strengths]

## WEAKNESSES
- [Max 4 points with concrete weaknesses]

## IMPROVEMENT SUGGESTIONS
[Include ONLY if the recommendation is KEEP & UPGRADE, otherwise leave empty]
- [Concrete improvement suggestions]

Rules:
- Always respond in English
- Be specific and technical, but keep the tone professional
- Focus on what actually works or doesn't work for sales
- Identify the style before you evaluate
- No polite intros or outros
- Use the exact header format above

For other specific questions about the image, answer directly and concisely without the structured format.`;

export async function sendToGemini(
  messages: ChatMessage[],
  config: GeminiConfig
): Promise<string> {
  try {
    const contents = messages.map(msg => {
      const parts: any[] = [];
      
      if (msg.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: msg.mimeType || 'image/jpeg',
            data: msg.imageBase64
          }
        });
      }
      
      if (msg.content) {
        parts.push({
          text: msg.content
        });
      }

      return {
        role: msg.role,
        parts
      };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('Gemini API full response:', JSON.stringify(data, null, 2));
    
    // Validate response structure
    if (!data || !data.candidates || data.candidates.length === 0) {
      console.error('Invalid Gemini response - no candidates:', data);
      throw new Error('Gemini API returned invalid response structure');
    }
    
    const candidate = data.candidates[0];
    console.log('Candidate:', JSON.stringify(candidate, null, 2));
    
    if (!candidate) {
      console.error('No candidate found');
      throw new Error('Gemini API response missing candidate');
    }
    
    if (!candidate.content) {
      console.error('Candidate has no content:', candidate);
      throw new Error('Gemini API response missing content');
    }
    
    if (!candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('Candidate content has no parts:', candidate.content);
      throw new Error('Gemini API response missing content parts');
    }
    
    const text = candidate.content.parts.map((part: any) => part.text || '').join('');
    if (!text) {
      console.error('Candidate content parts contain no text:', candidate.content.parts);
      throw new Error('Gemini API response missing text');
    }
    
    return text;
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gemini_api_key');
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gemini_api_key', key);
}

export function getModel(): string {
  if (typeof window === 'undefined') return 'gemini-3.1-pro-preview';
  return localStorage.getItem('gemini_model') || 'gemini-3.1-pro-preview';
}

export function getActiveModel(): string {
  const provider = getProvider();
  if (provider === 'grok') {
    return getGrokModel();
  }
  return getModel();
}

export function getActiveApiKey(): string | null {
  const provider = getProvider();
  if (provider === 'grok') {
    return getGrokApiKey();
  }
  return getApiKey();
}

export function setModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gemini_model', model);
}

// Grok API functions
export function getGrokApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('grok_api_key');
}

export function setGrokApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('grok_api_key', key);
}

export function getProvider(): AIProvider {
  if (typeof window === 'undefined') return 'gemini';
  return (localStorage.getItem('ai_provider') as AIProvider) || 'gemini';
}

export function setProvider(provider: AIProvider): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ai_provider', provider);
}

export function getGrokModel(): string {
  if (typeof window === 'undefined') return 'grok-4.20';
  return localStorage.getItem('grok_model') || 'grok-4.20';
}

export function setGrokModel(model: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('grok_model', model);
}

export async function sendToGrok(
  messages: ChatMessage[],
  config: GrokConfig
): Promise<string> {
  try {
    // Convert messages to Grok format
    const grokMessages: any[] = [];
    
    // Add system message
    grokMessages.push({
      role: 'system',
      content: SYSTEM_PROMPT
    });
    
    // Add user messages with images
    for (const msg of messages) {
      if (msg.role === 'user') {
        const content: any[] = [];
        
        if (msg.imageBase64) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:${msg.mimeType || 'image/jpeg'};base64,${msg.imageBase64}`
            }
          });
        }
        
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content
          });
        }
        
        grokMessages.push({
          role: 'user',
          content
        });
      } else {
        grokMessages.push({
          role: 'assistant',
          content: msg.content
        });
      }
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: grokMessages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Grok API call failed:', error);
    throw error;
  }
}

// Unified send function that routes to correct provider
export async function sendToAI(
  messages: ChatMessage[],
  config: AIConfig
): Promise<string> {
  if (config.provider === 'grok') {
    return sendToGrok(messages, { apiKey: config.apiKey, model: config.model });
  } else {
    return sendToGemini(messages, { apiKey: config.apiKey, model: config.model });
  }
}

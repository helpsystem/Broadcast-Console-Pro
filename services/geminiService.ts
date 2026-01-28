import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey });

export const generateSermonContent = async (topic: string, language: 'en' | 'fa' | 'bilingual') => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a brief sermon outline or scripture slide content for the topic: "${topic}". 
      Language mode: ${language}.
      If bilingual, provide Persian (Farsi) and English.
      Format the output specifically for a presentation slide.
      Ensure theological accuracy.`,
      config: {
        thinkingConfig: {
          thinkingBudget: 32768, // Max budget for deep reasoning on theology/translation
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            scriptureReference: { type: Type.STRING },
            mainTextPrimary: { type: Type.STRING, description: "Main text in primary language (or Persian)" },
            mainTextSecondary: { type: Type.STRING, description: "Main text in secondary language (English), if applicable" },
            bulletPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini generation error:", error);
    throw error;
  }
};

export const translateText = async (text: string, targetLang: 'en' | 'fa') => {
  if (!apiKey || !text) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Use Flash for fast translation
      contents: `Translate the following text to ${targetLang === 'fa' ? 'Persian (Farsi)' : 'English'}. 
      Return ONLY the translated text without quotes or explanations.
      Text: "${text}"`,
    });

    return response.text?.trim();
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
};

export const fetchScripture = async (reference: string) => {
    if (!apiKey || !reference) return null;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Fetch the bible verse text for "${reference}". 
        Provide both English (NIV or ESV) and Persian (Farsi - NMV or similar).
        Return a JSON object with specific fields.`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    book: { type: Type.STRING },
                    chapter: { type: Type.STRING },
                    verses: { type: Type.STRING },
                    textPrimary: { type: Type.STRING, description: "Persian Text" },
                    textSecondary: { type: Type.STRING, description: "English Text" }
                }
            }
        }
      });
  
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Scripture fetch error:", error);
      return null;
    }
  };
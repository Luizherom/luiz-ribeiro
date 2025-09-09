
import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface AudioData {
    mimeType: string;
    data: string;
}

/**
 * Transcribes an audio file using the Gemini API.
 * @param audioData - An object containing the MIME type and base64 encoded audio data.
 * @returns A promise that resolves to the transcribed text.
 */
export const transcribeAudio = async (audioData: AudioData): Promise<string> => {
    try {
        const audioPart = {
            inlineData: {
                mimeType: audioData.mimeType,
                data: audioData.data,
            },
        };

        const textPart = {
            text: "Realize uma transcrição verbatim deste áudio. Reproduza as palavras exatamente como são ditas, incluindo hesitações, repetições e pausas. Mantenha a pontuação e os parágrafos se houver pausas significativas. O idioma do áudio é português brasileiro.",
        };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });

        if (!response.text) {
             throw new Error("A API não retornou uma transcrição de texto.");
        }

        return response.text;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Não foi possível comunicar com a API de IA. Verifique sua chave de API e a conexão com a internet.");
    }
};
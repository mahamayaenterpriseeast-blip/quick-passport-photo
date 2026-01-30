
import { GoogleGenAI } from "@google/genai";

export const removeBackground = async (base64Image: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  // Strip prefix from base64 if it exists
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png',
          },
        },
        {
          text: "Remove the background from this image and replace it with a solid, professional plain white background (#FFFFFF). Keep the person's face and shoulders perfectly. The output should be only the modified image.",
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("Could not process image background removal.");
};

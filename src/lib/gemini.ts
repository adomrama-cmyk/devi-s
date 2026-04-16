import { GoogleGenAI, Type } from "@google/genai";
import { Product } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getProductRecommendations(userPreferences: string[], recentPurchases: string[], allProducts: Product[]): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  const productContext = allProducts.map(p => ({ id: p.id, name: p.name, category: p.category, description: p.description }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on user preferences: ${userPreferences.join(", ")}, 
                 recent purchases: ${recentPurchases.join(", ")},
                 and available products: ${JSON.stringify(productContext)},
                 recommend the top 5 product IDs that the user might be interested in.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini recommendation error:", error);
    return [];
  }
}

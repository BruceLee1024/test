import { GoogleGenAI } from "@google/genai";
import { TestType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLabReport = async (
  testType: TestType,
  peakStress: number,
  peakLoad: number,
  duration: number
): Promise<string> => {
  const typeStr = testType === TestType.COMPRESSION ? "Compressive Strength (Cube Test - ASTM C39 / BS EN 12390-3)" : "Splitting Tensile Strength (Brazilian Test - ASTM C496)";
  
  const prompt = `
    You are a Senior Material Scientist analyzing concrete failure data from a Universal Testing Machine.
    
    Test Metadata:
    - Standard: ${typeStr}
    - Ultimate Load: ${peakLoad.toFixed(2)} kN
    - Ultimate Strength (f_cu or f_ct): ${peakStress.toFixed(2)} MPa
    - Time to Failure: ${duration.toFixed(1)} s

    Generate a concise technical observation report (Markdown).
    
    Structure:
    1. **Grade Classification**: Estimate the likely Concrete Grade (e.g., C20/25, C40/50) based on the result.
    2. **Failure Mechanics**: Describe the theoretical failure mode for this stress (e.g., "The formation of columnar cracks indicates elimination of end restraint," or "Diagonal shear failure typical of normal friction").
    3. **Quality Assessment**: Comment on the loading rate. Was the failure brittle or ductile?
    
    Keep tone clinical and professional. Max 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Analysis system offline.";
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('API_KEY') || errorMessage.includes('key')) {
      return "API 密钥未配置。请在 .env.local 文件中设置 GEMINI_API_KEY。";
    }
    return `分析系统错误: ${errorMessage}`;
  }
};
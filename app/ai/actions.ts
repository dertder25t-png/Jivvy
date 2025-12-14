"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface SpecItem {
    id: string;
    label: string;
    checked: boolean;
    category?: string;
}

export interface GenerateSpecResult {
    specs: SpecItem[];
    error?: string;
}

/**
 * Extract design specifications from a PDF using Gemini AI
 */
export async function generateSpecSheet(pdfUrl: string): Promise<GenerateSpecResult> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return { specs: [], error: "Gemini API key not configured" };
        }

        // Fetch the PDF content
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            return { specs: [], error: "Failed to fetch PDF" };
        }

        const pdfBuffer = await response.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

        // Use Gemma 3 12B
        const model = genAI.getGenerativeModel({ model: "gemma-3-12b-it" });

        const prompt = `You are analyzing a design brief PDF. Extract all technical specifications and constraints mentioned in this document.

Return a JSON array of specification items. Each item should have:
- "label": A concise description of the requirement (e.g., "A3 Format (Portrait)", "CMYK Color Mode", "3mm Bleed Required")
- "category": One of: "format", "color", "typography", "imagery", "delivery", "other"

Focus on extracting:
- Page size and orientation
- Color mode (CMYK, RGB, Pantone)
- Bleed and margin requirements
- Typography requirements
- Image resolution requirements (DPI)
- File format requirements
- Delivery specifications
- Brand guidelines mentioned

Return ONLY valid JSON, no markdown or explanations. Example format:
[
  {"label": "A3 Format (297x420mm)", "category": "format"},
  {"label": "CMYK Color Mode", "category": "color"}
]

If you cannot extract any specifications, return an empty array: []`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                },
            },
        ]);

        const responseText = result.response.text();

        // Parse the JSON response
        let parsedSpecs: Array<{ label: string; category?: string }> = [];

        try {
            // Try to extract JSON from the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                parsedSpecs = JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            return { specs: [], error: "Failed to parse AI response" };
        }

        // Convert to SpecItem format
        const specs: SpecItem[] = parsedSpecs.map((spec, index) => ({
            id: `ai-${index + 1}`,
            label: spec.label,
            checked: false,
            category: spec.category,
        }));

        return { specs };
    } catch (error) {
        console.error("Error generating spec sheet:", error);
        return {
            specs: [],
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

export interface SearchQueryResult {
    queries: string[];
    error?: string;
}

/**
 * Generate expert search queries for design references using Gemini AI
 */
export async function generateSearchQueries(text: string): Promise<SearchQueryResult> {
    console.log("[Server] generateSearchQueries called with:", text);

    try {
        if (!process.env.GEMINI_API_KEY) {
            console.log("[Server] No GEMINI_API_KEY found");
            return { queries: [], error: "Gemini API key not configured" };
        }

        console.log("[Server] API key found, length:", process.env.GEMINI_API_KEY.length);

        if (!text || text.trim().length === 0) {
            return { queries: [], error: "No text provided" };
        }

        // Use Gemma 3 12B
        const model = genAI.getGenerativeModel({ model: "gemma-3-12b-it" });
        console.log("[Server] Model initialized, making API call...");

        const prompt = `Generate 3 expert search queries to find visual examples of "${text.trim()}" on high-quality design archives like Behance and Pinterest.

Return ONLY a JSON array of 3 search query strings. No explanations, no markdown, just the JSON array.

Example format:
["minimalist brutalist architecture", "concrete building photography", "raw industrial design interiors"]`;

        const result = await model.generateContent([{ text: prompt }]);
        console.log("[Server] API call completed");

        const responseText = result.response.text();
        console.log("[Server] Response text:", responseText);

        // Parse the JSON response
        let queries: string[] = [];

        try {
            // Try to extract JSON array from the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                queries = JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            console.error("Failed to parse AI response:", parseError);
            return { queries: [], error: "Failed to parse AI response" };
        }

        // Ensure we have exactly 3 queries
        if (!Array.isArray(queries) || queries.length === 0) {
            return { queries: [], error: "No queries generated" };
        }

        return { queries: queries.slice(0, 3) };
    } catch (error) {
        console.error("Error generating search queries:", error);
        return {
            queries: [],
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";
import pdf from "pdf-parse";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Rate limit: 10 requests per minute per user
const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
});

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
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { specs: [], error: "Unauthorized" };
        }

        try {
            await limiter.check(10, user.id);
        } catch {
            return { specs: [], error: "Rate limit exceeded. Please try again later." };
        }

        if (!process.env.GEMINI_API_KEY) {
            return { specs: [], error: "Gemini API key not configured" };
        }

        // Fetch the PDF content
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            return { specs: [], error: "Failed to fetch PDF" };
        }

        const pdfBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(pdfBuffer);

        // Extract text from PDF using pdf-parse (Gemma is text-only)
        const pdfData = await pdf(buffer);
        const pdfText = pdfData.text;

        // Truncate text if needed (Gemma 2 has 8k context, keeping safe margin)
        const truncatedText = pdfText.slice(0, 20000);

        // Use Large Gemma (27B) for complex extraction
        const model = genAI.getGenerativeModel({ model: "gemma-2-27b-it" });

        const prompt = `You are analyzing a design brief PDF. Extract all technical specifications and constraints mentioned in this document.

Document Text:
"""
${truncatedText}
"""

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

        const result = await model.generateContent([{ text: prompt }]);

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

export interface RewriteTextResult {
    rewrittenText: string | null;
    error?: string;
}

/**
 * Rewrite text with a specific tone using Gemini AI
 * Accepts optional sampleText for custom tone matching.
 */
export async function rewriteText(text: string, tone: string, sampleText?: string): Promise<RewriteTextResult> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { rewrittenText: null, error: "Unauthorized" };
        }

        try {
            await limiter.check(15, user.id);
        } catch {
            return { rewrittenText: null, error: "Rate limit exceeded. Please try again later." };
        }

        if (!process.env.GEMINI_API_KEY) {
            return { rewrittenText: null, error: "Gemini API key not configured" };
        }

        if (!text || text.trim().length === 0) {
            return { rewrittenText: null, error: "No text provided" };
        }

        // Use Large Gemma (27B) for nuanced tone matching
        const model = genAI.getGenerativeModel({ model: "gemma-2-27b-it" });

        let prompt = "";

        if (tone === "custom" && sampleText) {
             prompt = `Rewrite the target text to match the tone, sentence structure, and style of the sample text provided.

             Sample Text (Style Reference):
             "${sampleText}"

             Target Text (To Rewrite):
             "${text}"

             Rules:
             - Analyze the sample text's vocabulary, sentence length, and rhythm.
             - Apply those characteristics to the target text.
             - Maintain the original meaning of the target text.
             - Return ONLY the rewritten text, no explanations.`;
        } else {
            prompt = `Rewrite the following text to have a "${tone}" tone.

            Rules:
            - Maintain the original meaning.
            - Fix grammar and spelling errors.
            - Improve flow and clarity.
            - Return ONLY the rewritten text, no explanations or quotes.

            Text to rewrite:
            "${text}"`;
        }

        const result = await model.generateContent([{ text: prompt }]);
        const responseText = result.response.text();

        return { rewrittenText: responseText.trim() };

    } catch (error) {
        console.error("Error rewriting text:", error);
        return {
            rewrittenText: null,
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
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { queries: [], error: "Unauthorized" };
        }

        try {
            await limiter.check(20, user.id); // Higher limit for search queries
        } catch {
            return { queries: [], error: "Rate limit exceeded. Please try again later." };
        }

        if (!process.env.GEMINI_API_KEY) {
            console.log("[Server] No GEMINI_API_KEY found");
            return { queries: [], error: "Gemini API key not configured" };
        }

        console.log("[Server] API key found, length:", process.env.GEMINI_API_KEY.length);

        if (!text || text.trim().length === 0) {
            return { queries: [], error: "No text provided" };
        }

        // Use Small Gemma (9B) for simple search queries (faster/cheaper)
        const model = genAI.getGenerativeModel({ model: "gemma-2-9b-it" });
        console.log("[Server] Model initialized, making API call...");

        // Fetch user profile to check tier
        const { data: profile } = await supabase
            .from("profiles")
            .select("tier")
            .eq("id", user.id)
            .single();

        const isPro = profile?.tier === "pro";
        const queryCount = isPro ? 6 : 3;
        const platforms = isPro
            ? "Behance, Pinterest, Dribbble, ArtStation, Savee, and Awwwards"
            : "Behance and Pinterest";

        // Use Small Gemma (9B) for search queries
        const model = genAI.getGenerativeModel({ model: "gemma-2-9b-it" });
        console.log("[Server] Model initialized, making API call...");

        const prompt = `Generate ${queryCount} expert search queries to find visual examples of "${text.trim()}" on high-quality design archives like ${platforms}.

Return ONLY a JSON array of ${queryCount} search query strings. No explanations, no markdown, just the JSON array.

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

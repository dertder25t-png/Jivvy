"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500,
});

export interface CritiqueResult {
    critique: string | null;
    error?: string;
}

/**
 * Critique a design crop (Mode A)
 * Uses Gemini 1.5 Flash (Vision) as Gemma is text-only.
 */
export async function critiqueCrop(formData: FormData): Promise<CritiqueResult> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { critique: null, error: "Unauthorized" };
        }

        try {
            await limiter.check(10, user.id);
        } catch {
            return { critique: null, error: "Rate limit exceeded. Please try again later." };
        }

        const imageFile = formData.get("image") as File;
        const issue = formData.get("issue") as string;

        if (!imageFile || !issue) {
            return { critique: null, error: "Missing image or issue" };
        }

        if (!process.env.GEMINI_API_KEY) {
            return { critique: null, error: "Gemini API key not configured" };
        }

        // Validate image size (e.g. 4MB limit)
        if (imageFile.size > 4 * 1024 * 1024) {
            return { critique: null, error: "Image too large (max 4MB)" };
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString("base64");

        // Use Gemini 1.5 Flash for Vision tasks (Gemma is text-only)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are a strict, expert Design Doctor. Critique this design crop based specifically on the user's concern: "${issue}".

        Rules:
        - Be direct and concise (max 3 sentences).
        - Focus ONLY on the visual evidence in the crop.
        - Give one actionable fix.
        - Do not use flowery language.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: imageFile.type,
                },
            },
        ]);

        return { critique: result.response.text() };

    } catch (error) {
        console.error("Critique error:", error);
        return { critique: null, error: "Failed to analyze design" };
    }
}

/**
 * Full Canvas Critique (Mode B)
 * Analyzes full canvas snapshot JSON + Screenshot (if available, mostly JSON text for now if Gemma, but we need Vision for "Vibes")
 * The roadmap says "Canvas PNG", so we assume we send an image.
 */
export async function critiqueFullCanvas(formData: FormData): Promise<CritiqueResult> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { critique: null, error: "Unauthorized" };
        }

        try {
            await limiter.check(5, user.id); // Stricter limit for full analysis
        } catch {
            return { critique: null, error: "Rate limit exceeded." };
        }

        const imageFile = formData.get("image") as File;

        if (!imageFile) {
            return { critique: null, error: "Missing canvas snapshot" };
        }

        // Use Gemini 1.5 Pro for deep "Vibe" analysis if available, else Flash
        // Roadmap says "Gemini 1.5 Pro"
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `You are an elite Art Director. Ignore technical constraints for a moment. Judge the EMOTION, COLOR PALETTE, and VIBE of this entire canvas.

        Rules:
        - What is the dominant mood?
        - Is the visual hierarchy working for that mood?
        - Rate the "Vibe Check" from 0-100.
        - Be esoteric but insightful.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: Buffer.from(await imageFile.arrayBuffer()).toString("base64"),
                    mimeType: imageFile.type,
                },
            },
        ]);

        return { critique: result.response.text() };

    } catch (error) {
        console.error("Full critique error:", error);
        return { critique: null, error: "Failed to analyze canvas" };
    }
}

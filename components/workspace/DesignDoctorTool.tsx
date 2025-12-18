"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, Crop, Sparkles, Upload, X, ScanEye } from "lucide-react";
import { critiqueCrop, critiqueFullCanvas } from "@/app/critique/actions";
import { cn } from "@/lib/utils";

// This component will be integrated into the SmartContextBar or a new floating tool
// For layout separation, we might place this as a distinct tool in the Canvas view

export function DesignDoctorTool() {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<"crop" | "full">("crop");
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [issue, setIssue] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setResult(null);
        }
    };

    const handleSubmit = async () => {
        if (!image) return;
        setLoading(true);

        const formData = new FormData();
        formData.append("image", image);

        if (mode === "crop") {
            formData.append("issue", issue || "General critique");
            const res = await critiqueCrop(formData);
            setResult(res.critique || res.error || "Error");
        } else {
            const res = await critiqueFullCanvas(formData);
            setResult(res.critique || res.error || "Error");
        }

        setLoading(false);
    };

    const reset = () => {
        setImage(null);
        setPreview(null);
        setResult(null);
        setIssue("");
    };

    return (
        <>
            {/* Trigger Button (Floating Bottom Right) */}
            <button
                onClick={() => setIsOpen(true)}
                className="absolute bottom-6 right-6 z-30 bg-surfaceHighlight/90 backdrop-blur-xl border border-zinc-700 p-3 rounded-full shadow-2xl active:scale-95 transition-transform group"
            >
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <Sparkles size={20} className="text-white group-hover:text-lime-400 transition-colors" />
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-surface border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="bg-lime-400 text-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">PRO</span>
                                Design Doctor
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors active:scale-90">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mode Switcher */}
                        <div className="flex p-2 gap-2 bg-surface">
                            <button
                                onClick={() => { setMode("crop"); reset(); }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95",
                                    mode === "crop" ? "bg-zinc-800 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                )}
                            >
                                <Crop size={14} /> Quick Critique
                            </button>
                            <button
                                onClick={() => { setMode("full"); reset(); }}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95",
                                    mode === "full" ? "bg-zinc-800 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                )}
                            >
                                <ScanEye size={14} /> Vibe Check
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-4">
                            {!preview ? (
                                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-800 rounded-3xl cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group">
                                    <div className="bg-zinc-900 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform">
                                        <Upload size={20} className="text-zinc-500 group-hover:text-lime-400 transition-colors" />
                                    </div>
                                    <span className="text-xs text-zinc-500 font-medium">Upload Screenshot</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>
                            ) : (
                                <div className="relative rounded-3xl overflow-hidden border border-zinc-800 group bg-black">
                                    <Image src={preview} alt="Preview" width={400} height={300} className="w-full h-auto object-contain max-h-60" />
                                    <button
                                        onClick={reset}
                                        className="absolute top-2 right-2 bg-black/50 backdrop-blur p-2 rounded-full text-white hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {mode === "crop" && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">The Issue</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Is the typography readable?"
                                        value={issue}
                                        onChange={(e) => setIssue(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-sm text-white focus:outline-none focus:border-lime-400 transition-colors placeholder:text-zinc-700"
                                    />
                                </div>
                            )}

                            {result && (
                                <div className="bg-zinc-900/50 p-4 rounded-3xl border border-lime-400/20 animate-in fade-in slide-in-from-bottom-2">
                                    <h4 className="text-xs font-bold text-lime-400 uppercase mb-2 flex items-center gap-2">
                                        <Sparkles size={14} /> Diagnosis
                                    </h4>
                                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{result}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-zinc-800 bg-surface">
                            <button
                                onClick={handleSubmit}
                                disabled={!image || loading || (mode === "crop" && !issue)}
                                className="w-full bg-lime-400 text-black font-bold py-3.5 rounded-full hover:bg-lime-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(163,230,53,0.2)] disabled:shadow-none"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                {mode === "crop" ? "Diagnose Issue" : "Check Vibes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

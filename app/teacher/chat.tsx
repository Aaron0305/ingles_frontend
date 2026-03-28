"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    Send, Bot, User, Loader2, Sparkles,
    Image as ImageIcon, Paperclip, Mic,
    Copy, Check, Trash2, ChevronDown,
    Lightbulb, BookOpen, ClipboardList, Brain
} from "lucide-react";
import { aiApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface TeacherChatProps {
    isDark: boolean;
}

const SUGGESTIONS = [
    { icon: BookOpen, label: "Planifica una clase", prompt: "Ayúdame a planificar una clase de 50 minutos sobre..." },
    { icon: ClipboardList, label: "Crea un examen", prompt: "Crea un examen de 10 preguntas sobre el tema..." },
    { icon: Brain, label: "Explica un concepto", prompt: "Explícame cómo enseñar el concepto de..." },
    { icon: Lightbulb, label: "Actividades creativas", prompt: "Dame 5 actividades creativas para enseñar..." },
];

export default function TeacherChat({ isDark }: TeacherChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const streamScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isBusy = isLoading || isStreaming;
    const d = isDark;

    /* ── Helpers ─────────────────────────────────────────── */
    const getTeacherId = (): string | null => {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("userId") || localStorage.getItem("teacherId") || null;
    };

    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, []);

    /* ── Auto-resize textarea ────────────────────────────── */
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }, [inputValue]);

    /* ── Scroll button visibility ────────────────────────── */
    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };

    /* ── Load history ────────────────────────────────────── */
    useEffect(() => {
        const teacherId = getTeacherId();
        if (!teacherId || historyLoaded) return;
        aiApi.getHistory(teacherId, 50)
            .then(({ messages: history }) => {
                if (history.length > 0) {
                    setMessages(history.map((m, i) => ({
                        id: `hist-${i}`,
                        role: m.role,
                        content: m.content,
                        timestamp: new Date(m.created_at),
                    })));
                }
            })
            .catch(err => console.warn("No se pudo cargar historial:", err))
            .finally(() => setHistoryLoaded(true));
    }, [historyLoaded]);

    /* ── Auto-scroll when new message appears ────────────── */
    useEffect(() => {
        if (!showScrollBtn) scrollToBottom();
    }, [messages.length, isLoading, showScrollBtn, scrollToBottom]);

    /* ── Copy message ────────────────────────────────────── */
    const handleCopy = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    /* ── Send ────────────────────────────────────────────── */
    const handleSendMessage = async (overrideText?: string) => {
        const text = (overrideText ?? inputValue).trim();
        if (!text || isBusy) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date(),
        };
        const aiMsgId = (Date.now() + 1).toString();

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");
        setIsLoading(true);
        setIsStreaming(true);

        try {
            const historyContext = [...messages, userMsg].map(m => ({
                role: m.role,
                content: m.content,
            }));
            const teacherId = getTeacherId();
            let fullResponse = "";

            await aiApi.sendMessageStream(
                text,
                historyContext,
                teacherId || undefined,
                (chunk: string) => {
                    fullResponse += chunk;
                }
            );

            // Mostrar todo el texto de una vez al terminar
            setIsLoading(false);
            setMessages(prev => [
                ...prev,
                { id: aiMsgId, role: "assistant", content: fullResponse, timestamp: new Date() },
            ]);
        } catch {
            setIsLoading(false);
            const errMsg: Message = {
                id: aiMsgId,
                role: "assistant",
                content: "Lo siento, hubo un problema al conectar con el servidor. Por favor intenta de nuevo.",
                timestamp: new Date(),
            };
            setMessages(prev =>
                prev.some(m => m.id === aiMsgId)
                    ? prev.map(m => (m.id === aiMsgId ? errMsg : m))
                    : [...prev, errMsg]
            );
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setTimeout(() => scrollToBottom(), 80);
            textareaRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    /* ── Render ──────────────────────────────────────────── */
    return (
        <div className={`flex flex-col h-full rounded-2xl border overflow-hidden transition-colors
            ${d ? "bg-[#080f1f] border-white/[0.06]" : "bg-white border-slate-200/80"}`}>

            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
                ${d ? "border-white/[0.06] bg-[#0a1225]" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2
                            ${d ? "border-[#0a1225]" : "border-white"}`} />
                    </div>
                    <div>
                        <h2 className={`text-sm font-semibold tracking-tight ${d ? "text-white" : "text-slate-800"}`}>
                            Asistente IA
                        </h2>
                        <p className={`text-xs ${d ? "text-slate-400" : "text-slate-500"}`}>
                            {isStreaming ? (
                                <span className={`flex items-center gap-1 ${d ? "text-cyan-400" : "text-blue-500"}`}>
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                    Escribiendo…
                                </span>
                            ) : "Siempre disponible"}
                        </p>
                    </div>
                </div>

                {messages.length > 0 && (
                    <button
                        onClick={() => setMessages([])}
                        title="Limpiar conversación"
                        className={`p-2 rounded-lg transition-all
                            ${d
                                ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                : "text-slate-400 hover:text-red-500 hover:bg-red-50"}`}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className={`flex-1 overflow-y-auto px-4 py-6 space-y-5
                    ${d ? "bg-[#060c1a]" : "bg-slate-50/60"}`}
                style={{ scrollbarWidth: "thin", scrollbarColor: d ? "#1e2a45 transparent" : "#d1d5db transparent" }}
            >
                {/* Welcome / empty state */}
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-7 px-4 select-none">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 mb-4">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h3 className={`text-lg font-semibold ${d ? "text-white" : "text-slate-800"}`}>
                                ¿En qué puedo ayudarte?
                            </h3>
                            <p className={`text-sm mt-1 max-w-xs mx-auto ${d ? "text-slate-400" : "text-slate-500"}`}>
                                Soy tu asistente docente. Escribe lo que necesites o elige una sugerencia.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                            {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                                <button
                                    key={label}
                                    onClick={() => handleSendMessage(prompt)}
                                    className={`flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all
                                        hover:scale-[1.02] active:scale-[0.98]
                                        ${d
                                            ? "bg-[#0e1830] border-white/[0.07] hover:border-cyan-500/30 hover:bg-[#121e38] text-slate-300"
                                            : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700"}`}
                                >
                                    <Icon className={`w-4 h-4 ${d ? "text-cyan-400" : "text-blue-500"}`} />
                                    <span className="text-xs font-medium leading-snug">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Messages */}
                {messages.map((msg, idx) => {
                    const isAi = msg.role === "assistant";
                    const isLast = idx === messages.length - 1;

                    return (
                        <div
                            key={msg.id}
                            className={`flex gap-3 max-w-3xl group
                                ${isAi ? "mr-auto" : "ml-auto flex-row-reverse"}
                                ${isLast ? "animate-[fadeInUp_0.25s_ease_both]" : ""}`}
                        >
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 self-end mb-6
                                ${isAi
                                    ? "bg-gradient-to-br from-cyan-400 to-blue-600 shadow-md shadow-cyan-500/20"
                                    : d ? "bg-slate-700" : "bg-slate-200"}`}
                            >
                                {isAi
                                    ? <Bot className="w-4 h-4 text-white" />
                                    : <User className={`w-4 h-4 ${d ? "text-slate-300" : "text-slate-500"}`} />
                                }
                            </div>

                            <div className={`flex flex-col gap-1.5 ${isAi ? "items-start" : "items-end"}`}>
                                {/* Bubble */}
                                <div className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed
                                    max-w-[420px] lg:max-w-[520px]
                                    ${isAi
                                        ? d
                                            ? "bg-[#0e1830] text-slate-200 border border-white/[0.07] rounded-tl-sm"
                                            : "bg-white text-slate-700 border border-slate-200/80 shadow-sm rounded-tl-sm"
                                        : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 rounded-tr-sm"}`}
                                >
                                    {isAi ? (
                                        <div className="prose prose-sm max-w-none dark:prose-invert
                                            prose-p:my-1 prose-ul:my-1.5 prose-li:my-0.5
                                            prose-headings:my-2 prose-strong:font-semibold
                                            prose-code:text-xs prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                            prose-pre:text-xs prose-pre:rounded-lg">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span className="whitespace-pre-wrap">{msg.content}</span>
                                    )}

                                    {/* Copy button on hover */}
                                    {msg.content && (
                                        <button
                                            onClick={() => handleCopy(msg.id, msg.content)}
                                            title="Copiar"
                                            className={`absolute -top-2.5 ${isAi ? "right-2" : "left-2"}
                                                opacity-0 group-hover:opacity-100 transition-opacity
                                                p-1 rounded-md
                                                ${d
                                                    ? "bg-[#1a2540] border border-white/10 text-slate-400 hover:text-white"
                                                    : "bg-white border border-slate-200 text-slate-400 hover:text-slate-700 shadow-sm"}`}
                                        >
                                            {copiedId === msg.id
                                                ? <Check className="w-3 h-3 text-emerald-500" />
                                                : <Copy className="w-3 h-3" />
                                            }
                                        </button>
                                    )}
                                </div>

                                {/* Timestamp — on hover only */}
                                <span className={`text-[10px] px-1 opacity-0 group-hover:opacity-100 transition-opacity
                                    ${d ? "text-slate-600" : "text-slate-400"}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Typing dots */}
                {isLoading && (
                    <div className="flex gap-3 max-w-3xl mr-auto">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0 self-end mb-6 shadow-md shadow-cyan-500/20">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className={`px-4 py-3.5 rounded-2xl rounded-tl-sm border
                            ${d ? "bg-[#0e1830] border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
                            <div className="flex items-center gap-1.5 py-0.5">
                                {[0, 150, 300].map(delay => (
                                    <span key={delay}
                                        className={`w-2 h-2 rounded-full animate-bounce ${d ? "bg-slate-500" : "bg-slate-400"}`}
                                        style={{ animationDelay: `${delay}ms` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Scroll to bottom button */}
            {showScrollBtn && (
                <div className="relative h-0 overflow-visible flex justify-center">
                    <button
                        onClick={() => scrollToBottom()}
                        className={`absolute -top-12 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg
                            ${d
                                ? "bg-[#1a2a4a] border border-white/10 text-slate-300 hover:bg-[#1f3060]"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-md"}`}
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                        Bajar
                    </button>
                </div>
            )}

            {/* Input area */}
            <div className={`px-4 py-3 border-t shrink-0
                ${d ? "bg-[#0a1225] border-white/[0.06]" : "bg-white border-slate-100"}`}>
                <div className={`flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all
                    ${d
                        ? "bg-[#0e1830] border-white/[0.08] focus-within:border-cyan-500/40"
                        : "bg-slate-50 border-slate-200 focus-within:border-blue-400 focus-within:bg-white"}`}>

                    {/* Attachment buttons */}
                    <div className="flex gap-0.5 pb-1.5">
                        {[
                            { Icon: ImageIcon, title: "Adjuntar imagen" },
                            { Icon: Paperclip, title: "Adjuntar archivo" },
                        ].map(({ Icon, title }) => (
                            <button key={title} title={title}
                                className={`p-1.5 rounded-lg transition-colors
                                    ${d
                                        ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"}`}>
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>

                    {/* Textarea (auto-resize) */}
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pregúntale a la IA sobre un tema, clase o estudiante…"
                        disabled={isBusy}
                        className={`flex-1 bg-transparent resize-none outline-none text-sm py-1.5 leading-relaxed
                            ${d ? "text-white placeholder:text-slate-600" : "text-slate-800 placeholder:text-slate-400"}`}
                        style={{ minHeight: "36px", maxHeight: "160px" }}
                    />

                    {/* Mic + Send */}
                    <div className="flex items-end gap-1 pb-1.5">
                        <button title="Usar micrófono"
                            className={`p-1.5 rounded-lg transition-colors
                                ${d
                                    ? "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"}`}>
                            <Mic className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => handleSendMessage()}
                            disabled={!inputValue.trim() || isBusy}
                            className={`p-2 rounded-xl transition-all
                                ${inputValue.trim() && !isBusy
                                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 hover:scale-105 active:scale-95"
                                    : d ? "bg-white/5 text-slate-600" : "bg-slate-200 text-slate-400"}`}>
                            {isStreaming
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <p className={`text-[10px] text-center mt-2 ${d ? "text-slate-600" : "text-slate-400"}`}>
                    Presiona{" "}
                    <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono
                        ${d ? "bg-white/10 text-slate-400" : "bg-slate-100 text-slate-500"}`}>Enter</kbd>
                    {" "}para enviar ·{" "}
                    <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono
                        ${d ? "bg-white/10 text-slate-400" : "bg-slate-100 text-slate-500"}`}>Shift+Enter</kbd>
                    {" "}para nueva línea
                </p>
            </div>

            {/* Keyframe for new message animation */}
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0);   }
                }
            `}</style>
        </div>
    );
}
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Image as ImageIcon, Paperclip, Mic } from "lucide-react";
import { aiApi } from "@/lib/api";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface TeacherChatProps {
    isDark: boolean;
}

export default function TeacherChat({ isDark }: TeacherChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "¡Hola! Soy tu asistente de IA. Estoy aquí para ayudarte a planificar clases, buscar recursos o resolver dudas. ¿En qué puedo ayudarte hoy?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom every time messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isTyping) return;

        const newUserMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInputValue("");
        setIsTyping(true);

        // Connect to real API
        try {
            // We pass the previous history excluding the newly added user message to avoid duplicate contexts if not needed
            // Our API expects { role, content } format for context
            const historyContext = messages.map(msg => ({ role: msg.role, content: msg.content }));
            
            const response = await aiApi.sendMessage(inputValue.trim(), historyContext);
            
            const newAiMsg: Message = {
                id: Date.now().toString(),
                role: "assistant",
                content: response.reply,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, newAiMsg]);
        } catch (error) {
            console.error("Error AI Chat:", error);
            const errorMsg: Message = {
                id: Date.now().toString(),
                role: "assistant",
                content: "Lo siento, hubo un problema al conectar con el servidor de la inteligencia artificial. Por favor intenta de nuevo.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Estilos dinámicos basados en isDark
    const surfaceClass = isDark ? "bg-[#0a1124]/80 border-white/5" : "bg-white border-slate-200";
    const inputBgClass = isDark ? "bg-[#131c33] border-white/10 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400";
    
    return (
        <div className={`flex flex-col h-full rounded-2xl border ${surfaceClass} shadow-xl overflow-hidden`}>
            {/* Chat Header */}
            <div className={`p-4 sm:p-5 flex items-center gap-4 border-b ${isDark ? "border-white/5 bg-[#0a1124]" : "border-slate-200 bg-white"}`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-800"}`}>Asistente IA</h2>
                    <p className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? "text-cyan-400" : "text-blue-600"}`}>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        En línea y listo
                    </p>
                </div>
            </div>

            {/* Chat Messages */}
            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${isDark ? "bg-[#040914]/50" : "bg-slate-50/50"}`}>
                {messages.map((msg) => {
                    const isAi = msg.role === "assistant";
                    
                    return (
                        <div key={msg.id} className={`flex gap-3 sm:gap-4 max-w-3xl ${isAi ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                            {/* Avatar */}
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                                isAi 
                                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20" 
                                    : "bg-slate-200 dark:bg-slate-700"
                            }`}>
                                {isAi ? <Bot className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-slate-500 dark:text-slate-300" />}
                            </div>

                            {/* Burbuja */}
                            <div className={`flex flex-col gap-1 min-w-[120px] ${isAi ? "items-start" : "items-end"}`}>
                                <div className={`px-4 sm:px-5 py-3 rounded-2xl text-[15px] leading-relaxed relative group whitespace-pre-wrap ${
                                    isAi 
                                        ? isDark 
                                            ? "bg-[#131c33] text-slate-200 border border-white/5 rounded-tl-sm" 
                                            : "bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-sm"
                                        : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 rounded-tr-sm"
                                }`}>
                                    {msg.content}
                                </div>
                                <span className={`text-[10px] sm:text-xs px-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Status: Escribiendo... */}
                {isTyping && (
                    <div className="flex gap-4 max-w-3xl mr-auto items-end animate-fade-in">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
                            <Bot className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div className={`px-5 py-4 rounded-2xl rounded-tl-sm border ${
                            isDark ? "bg-[#131c33] border-white/5" : "bg-white border-slate-200 shadow-sm"
                        }`}>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Chat Input Area */}
            <div className={`p-4 border-t ${isDark ? "bg-[#0a1124] border-white/5" : "bg-white border-slate-200"}`}>
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    
                    {/* Botones de acción (adjuntos) */}
                    <div className="flex gap-1 pb-2">
                        <button className={`p-2 rounded-xl transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`} title="Adjuntar imagen">
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <button className={`p-2 rounded-xl transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`} title="Adjuntar documento">
                            <Paperclip className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Caja de texto */}
                    <div className={`flex-1 relative rounded-2xl border transition-colors ${inputBgClass} ${isDark ? "focus-within:border-cyan-500/50 focus-within:bg-[#1a2540]" : "focus-within:border-blue-500 focus-within:bg-white"}`}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pregúntale a la IA sobre un tema, clase o estudiante..."
                            className="w-full bg-transparent px-4 py-3.5 pr-12 outline-none text-sm font-medium"
                            disabled={isTyping}
                        />
                        <button 
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Botón de enviar */}
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isTyping}
                        className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
                            inputValue.trim() && !isTyping
                                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95"
                                : isDark 
                                    ? "bg-[#131c33] text-slate-500" 
                                    : "bg-slate-100 text-slate-400"
                        }`}
                    >
                        {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
                
                <p className={`text-[10px] text-center mt-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    La IA puede cometer errores. Considera verificar la información importante sobre los estudiantes.
                </p>
            </div>
        </div>
    );
}

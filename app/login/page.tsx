"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Eye, EyeOff, Loader2, Lock, Mail, ChevronRight, Zap, Globe, ShieldCheck, Sun, Moon, Laptop } from "lucide-react";
import Image from "next/image";

interface LoginFormData {
    email: string;
    password: string;
}

interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
}

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginFormData>({
        email: "",
        password: "",
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateTheme = () => {
            const systemDark = mediaQuery.matches;
            if (theme === 'system') {
                setIsDark(systemDark);
            } else {
                setIsDark(theme === 'dark');
            }
        };

        updateTheme();
        mediaQuery.addEventListener('change', updateTheme);
        setMounted(true);

        return () => mediaQuery.removeEventListener('change', updateTheme);
    }, [theme]);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.email.trim()) newErrors.email = "El email es requerido";
        if (!formData.password) newErrors.password = "La contraseña es requerida";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            const response = await authApi.login(formData.email, formData.password);
            if (response.success) {
                localStorage.setItem("token", response.token);
                localStorage.setItem("userType", response.user.role);
                localStorage.setItem("userName", response.user.name);
                router.push(response.user.role === "superadmin" ? "/admin" : "/dashboard");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al conectar con el servidor";
            setErrors({ general: message });
        } finally {
            setIsLoading(false);
        }
    };

    // Prevent hydration mismatch
    if (!mounted) return null;

    // --- Dynamic Styles based on isDark ---
    const bgClass = isDark
        ? "bg-[#000510] text-white"
        : "bg-slate-50 text-slate-800";

    const glassCardClass = isDark
        ? "bg-[#0a1124]/80 backdrop-blur-2xl border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)]"
        : "bg-white/70 backdrop-blur-2xl border-white/60 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]";

    const inputBgClass = isDark
        ? "bg-[#131c33] text-white border-white/5 focus:bg-[#1a2540] placeholder:text-slate-500"
        : "bg-white text-slate-800 border-slate-200 focus:bg-slate-50 placeholder:text-slate-400 shadow-sm";

    const iconColorClass = isDark
        ? "text-slate-500 group-focus-within:text-cyan-400"
        : "text-slate-400 group-focus-within:text-blue-600";

    const labelColorClass = isDark
        ? "text-cyan-500"
        : "text-blue-600";

    return (
        <div className={`relative min-h-screen w-full overflow-hidden transition-colors duration-500 font-sans ${bgClass}`}>

            {/* 
              =======================================================================
              BACKGROUND LAYERS (Adaptive)
              ======================================================================= 
            */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                {/* 1. Base Gradient */}
                <div className={`absolute inset-0 transition-colors duration-1000 ${isDark
                    ? "bg-gradient-to-br from-[#000510] via-[#020c1b] to-[#041025]"
                    : "bg-gradient-to-br from-slate-50 via-blue-50/50 to-white"
                    }`} />

                {/* 2. Orbs / Atmosphere */}
                <div className={`absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] animate-pulse-slow transition-colors duration-1000 ${isDark ? "bg-blue-900/20" : "bg-blue-200/40"
                    }`} />
                <div className={`absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] rounded-full blur-[120px] animate-pulse-slow delay-1000 transition-colors duration-1000 ${isDark ? "bg-cyan-900/20" : "bg-purple-200/40"
                    }`} />

                {/* 3. Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.1]"
                    style={{
                        backgroundImage: `
                            linear-gradient(${isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(37, 99, 235, 0.2)'} 1px, transparent 1px),
                            linear-gradient(90deg, ${isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(37, 99, 235, 0.2)'} 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                        maskImage: 'linear-gradient(to bottom, transparent, black 40%, black 80%, transparent)'
                    }}
                />

                {/* 4. Particles */}
                <div className={`absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-float-particle opacity-60 ${isDark ? 'bg-cyan-400' : 'bg-blue-400'}`} />
                <div className={`absolute top-3/4 left-1/3 w-3 h-3 rounded-full animate-float-particle-delayed opacity-40 ${isDark ? 'bg-blue-500' : 'bg-purple-400'}`} />
                <div className={`absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full animate-float-particle opacity-80 ${isDark ? 'bg-white' : 'bg-slate-400'}`} />
            </div>

            {/* 
              =======================================================================
              THEME TOGGLE
              ======================================================================= 
            */}
            <div className="absolute top-6 right-6 z-50 flex gap-2 p-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
                <button
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-full transition-all ${theme === 'light' ? (isDark ? 'bg-white/20 text-white' : 'bg-white shadow-sm text-amber-500') : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                    <Sun className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-full transition-all ${theme === 'dark' ? (isDark ? 'bg-white/20 text-white' : 'bg-slate-800 text-white') : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                    <Moon className="w-4 h-4" />
                </button>
            </div>

            {/* 
              =======================================================================
              MAIN CONTAINER
              ======================================================================= 
            */}
            <div className="relative z-10 min-h-screen flex flex-col lg:flex-row items-center justify-center lg:justify-between p-4 sm:p-6 lg:p-0">

                {/* LEFT PANE: FORM AREA */}
                <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center items-center lg:h-screen relative animate-slide-in-left">

                    <div className="w-full max-w-[420px] relative">
                        {/* Glow Behind Card */}
                        <div className={`absolute -inset-1 rounded-[2.5rem] blur-xl opacity-40 animate-tilt transition-colors duration-1000 ${isDark
                            ? "bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600"
                            : "bg-gradient-to-tr from-blue-300 via-cyan-300 to-purple-300"
                            }`}></div>

                        {/* CARD */}
                        <div className={`relative px-8 py-10 sm:px-10 rounded-[2rem] border transition-all duration-300 ${glassCardClass}`}>

                            {/* Header */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative w-20 h-20 mb-4 group cursor-pointer hover:scale-105 transition-transform duration-500">
                                    <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${isDark ? 'bg-cyan-500/20' : 'bg-blue-400/20'}`}></div>
                                    <Image
                                        src="/image/logo_mensaje.png"
                                        alt="Logo"
                                        width={80}
                                        height={80}
                                        className="object-contain relative z-10"
                                    />
                                </div>
                                <h1 className={`text-3xl font-black text-transparent bg-clip-text text-center tracking-tight mb-2 ${isDark
                                    ? "bg-gradient-to-r from-white via-cyan-100 to-slate-400"
                                    : "bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-500"
                                    }`}>
                                    BIENVENIDO
                                </h1>
                                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Panel de Control Académico</p>
                            </div>

                            {/* Alert Box */}
                            {errors.general && (
                                <div className={`mb-6 p-3 rounded-xl border flex items-center gap-3 animate-shake ${isDark
                                    ? "bg-red-500/10 border-red-500/20"
                                    : "bg-red-50 border-red-100"
                                    }`}>
                                    <div className={`p-1.5 rounded-full ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                                        <Zap className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                                    </div>
                                    <p className={`text-sm font-medium ${isDark ? 'text-red-200' : 'text-red-700'}`}>{errors.general}</p>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-5">
                                    {/* Email */}
                                    <div className="group relative">
                                        <label className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 block ml-4 opacity-0 group-focus-within:opacity-100 transition-all transform translate-y-2 group-focus-within:translate-y-0 ${labelColorClass}`}>
                                            Correo Institucional
                                        </label>
                                        <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.02]">
                                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${iconColorClass}`}>
                                                <Mail className="w-5 h-5" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className={`w-full pl-12 pr-4 py-4 rounded-2xl border focus:ring-1 focus:ring-cyan-500/50 transition-all outline-none font-medium ${inputBgClass} ${isDark ? 'focus:border-cyan-500/50' : 'focus:border-blue-400'}`}
                                                placeholder="usuario@institucion.edu"
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="group relative">
                                        <label className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 block ml-4 opacity-0 group-focus-within:opacity-100 transition-all transform translate-y-2 group-focus-within:translate-y-0 ${labelColorClass}`}>
                                            Contraseña
                                        </label>
                                        <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.02]">
                                            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${iconColorClass}`}>
                                                <Lock className="w-5 h-5" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className={`w-full pl-12 pr-12 py-4 rounded-2xl border focus:ring-1 focus:ring-cyan-500/50 transition-all outline-none font-medium tracking-wide ${inputBgClass} ${isDark ? 'focus:border-cyan-500/50' : 'focus:border-blue-400'}`}
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1 rounded-lg ${isDark ? 'text-slate-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`relative w-full group overflow-hidden rounded-2xl p-[2px] mt-4 transition-all duration-300 active:scale-95 shadow-lg ${isDark
                                        ? "shadow-cyan-900/40"
                                        : "shadow-blue-500/20"
                                        }`}
                                >
                                    <div className={`absolute inset-0 animate-gradient-xy ${isDark
                                        ? "bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600"
                                        : "bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500"
                                        }`}></div>

                                    <div className={`relative h-full w-full rounded-[14px] px-6 py-4 flex items-center justify-center gap-3 transition-colors ${isDark
                                        ? "bg-[#0f172a] text-white group-hover:bg-opacity-80"
                                        : "bg-white text-blue-600 group-hover:bg-opacity-90"
                                        }`}>
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <span className="font-bold tracking-wide text-sm sm:text-base">INICIAR SESIÓN</span>
                                                <div className={`p-1 rounded-full group-hover:translate-x-1 transition-transform ${isDark ? 'bg-white/10' : 'bg-blue-50'}`}>
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>


                        </div>
                    </div>
                </div>

                {/* RIGHT PANE: IMMERSIVE VISUAL */}
                <div className="hidden lg:flex flex-1 h-screen relative items-center justify-center perspective-1000">

                    {/* Floating Island Base */}
                    <div className="relative w-[600px] h-[600px] animate-float-slow">

                        {/* 3D Holographic Rings */}
                        <div className={`absolute inset-0 border rounded-full animate-[spin_20s_linear_infinite] transition-colors duration-1000 ${isDark ? 'border-cyan-500/20' : 'border-blue-500/20'
                            }`} style={{ transform: 'rotateX(60deg)' }}></div>

                        <div className={`absolute inset-[10%] border rounded-full animate-[spin_15s_linear_infinite_reverse] transition-colors duration-1000 ${isDark ? 'border-blue-500/20' : 'border-purple-500/20'
                            }`} style={{ transform: 'rotateX(60deg) rotateY(10deg)' }}></div>

                        {/* Mascot Container */}
                        <div className="absolute inset-0 flex items-center justify-center transform hover:scale-105 transition-transform duration-700">
                            {/* Back Glow */}
                            <div className={`absolute w-[300px] h-[300px] rounded-full blur-[80px] transition-colors duration-1000 ${isDark ? 'bg-cyan-500/10' : 'bg-blue-400/20'
                                }`}></div>

                            <Image
                                src="/image/mascota_hde.png"
                                alt="Mascota"
                                width={800}
                                height={800}
                                quality={100}
                                priority
                                className="object-contain drop-shadow-[0_10px_40px_rgba(6,182,212,0.3)] relative z-10"
                            />

                            <div className="absolute -bottom-10 w-[200px] h-[20px] bg-black/40 blur-xl rounded-[100%]"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Style Injections for Animations */}
            <style jsx global>{`
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(1.1); }
                }
                .animate-pulse-slow { animation: pulse-slow 8s infinite alternate; }

                @keyframes float-particle {
                    0% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
                    50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
                    100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
                }
                .animate-float-particle { animation: float-particle 5s infinite ease-in-out; }
                .animate-float-particle-delayed { animation: float-particle 7s infinite ease-in-out reverse; }

                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                .animate-float-slow { animation: float-slow 6s infinite ease-in-out; }

                @keyframes gradient-xy {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient-xy { background-size: 200% 200%; animation: gradient-xy 3s ease infinite; }

                @keyframes tilt {
                    0%, 50%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(1deg); }
                    75% { transform: rotate(-1deg); }
                }
                .animate-tilt { animation: tilt 10s infinite linear; }

                @keyframes slide-in-left {
                    0% { opacity: 0; transform: translateX(-50px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-left { animation: slide-in-left 0.8s ease-out forwards; }
            `}</style>
        </div>
    );
}

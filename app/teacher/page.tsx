"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { LogOut, BookOpen, User, Bell, Calendar as CalendarIcon, Settings, Layers, Search, GraduationCap, Sparkles as SparklesIcon, Bot } from "lucide-react";
import Image from "next/image";
import TeacherChat from "./chat";


export default function TeacherDashboard() {
    const router = useRouter();
    const [userName, setUserName] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "classes" | "schedule" | "students" | "settings">("dashboard");

    // Theme state for a consistent futuristic look
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Authenticate the user and ensure they are a teacher
        const token = localStorage.getItem("token");
        const userType = authApi.getUserType();

        if (!token) {
            router.replace("/login");
            return;
        }

        if (userType !== "teacher") {
            router.replace("/admin");
            return;
        }

        const name = authApi.getUserName() || "Profesor";
        setUserName(name);
        setIsLoading(false);

        // Optional: Theme handling logic (assuming system theme or default dark)
        const checkTheme = () => {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(systemDark); // Or default to true if the app prefers dark mode always
        };

        checkTheme();
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => setIsDark(e.matches));

        return () => mediaQuery.removeEventListener('change', (e) => setIsDark(e.matches));
    }, [router]);

    const handleLogout = () => {
        authApi.logout();
        router.replace("/login");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#000510]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
            </div>
        );
    }

    const bgClass = isDark ? "bg-[#000510] text-white" : "bg-slate-50 text-slate-800";
    const headerClass = isDark ? "bg-[#0a1124]/80 border-white/10" : "bg-white/80 border-slate-200";
    const surfaceClass = isDark ? "bg-[#0a1124] border-white/5" : "bg-white border-slate-200";

    return (
        <div className={`min-h-screen w-full transition-colors duration-500 ${bgClass} font-sans relative overflow-hidden`}>

            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className={`absolute inset-0 ${isDark ? "bg-gradient-to-br from-[#000510] via-[#020c1b] to-[#041025]" : "bg-gradient-to-br from-slate-50 to-blue-50/30"}`} />
                <div className={`absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[100px] animate-pulse-slow ${isDark ? "bg-cyan-900/20" : "bg-blue-300/20"}`} />
                <div className={`absolute bottom-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] animate-pulse-slow delay-700 ${isDark ? "bg-purple-900/20" : "bg-indigo-300/10"}`} />
            </div>

            {/* Sidebar / Navigation (Vertical navigation concept) */}
            <div className={`fixed left-0 top-0 bottom-0 w-[80px] sm:w-[240px] z-30 flex flex-col backdrop-blur-xl border-r transition-all duration-300 ${headerClass}`}>

                {/* Brand Area */}
                <div className="h-20 flex items-center justify-center sm:justify-start sm:px-6 border-b border-inherit">
                    <div className="w-10 h-10 relative">
                        <Image src="/image/logo_mensaje.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <span className={`hidden sm:block ml-3 font-bold text-lg tracking-wide ${isDark ? "text-white" : "text-blue-900"}`}>
                        What Time Is It?
                    </span>
                </div>

                {/* Nav Links */}
                <div className="flex-1 py-8 px-3 sm:px-4 space-y-2">
                    <NavItem icon={<Layers />} label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} isDark={isDark} />
                    <NavItem icon={<Bot />} label="Asistente IA" active={activeTab === "chat"} onClick={() => setActiveTab("chat")} isDark={isDark} />
                    <NavItem icon={<BookOpen />} label="Mis Clases" active={activeTab === "classes"} onClick={() => setActiveTab("classes")} isDark={isDark} />
                    <NavItem icon={<CalendarIcon />} label="Horario" active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} isDark={isDark} />
                    <NavItem icon={<User />} label="Estudiantes" active={activeTab === "students"} onClick={() => setActiveTab("students")} isDark={isDark} />
                    <NavItem icon={<Settings />} label="Configuración" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} isDark={isDark} />
                </div>

                <div className="p-4 border-t border-inherit">
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center justify-center sm:justify-start gap-3 py-3 px-3 rounded-xl transition-all ${isDark ? "hover:bg-red-500/10 text-red-400" : "hover:bg-red-50 text-red-600"}`}
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="hidden sm:inline font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="relative z-10 ml-[80px] sm:ml-[240px] min-h-screen flex flex-col">

                {/* Header Navbar */}
                <header className={`h-20 flex items-center justify-between px-6 sm:px-10 backdrop-blur-md border-b sticky top-0 z-20 ${headerClass}`}>
                    <div className="flex items-center gap-4">
                        <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                            Panel de Maestro
                        </h1>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                        <button className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
                            <Search className="w-5 h-5" />
                        </button>
                        <button className={`p-2 rounded-full transition-colors relative ${isDark ? "hover:bg-white/10 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}>
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-inherit" />
                        </button>

                        <div className="w-px h-8 bg-current opacity-20 hidden sm:block"></div>

                        <div className="flex items-center gap-3">
                            <div className="hidden sm:block text-right">
                                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>{userName}</p>
                                <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-cyan-400" : "text-blue-600"}`}>Teacher</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Elements */}
                <div className="p-6 sm:p-10 flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden">
                    {activeTab === "chat" ? (
                        /* CHAT TAB */
                        <div className="flex-1 h-full w-full max-w-6xl mx-auto">
                            <TeacherChat isDark={isDark} />
                        </div>
                    ) : (
                        /* DASHBOARD TAB (default) */
                        <div className="overflow-y-auto h-full pr-2">
                            {/* Welcome Banner */}
                            <div className={`relative overflow-hidden rounded-[2rem] p-8 sm:p-12 mb-8 border shadow-2xl ${isDark ? "bg-gradient-to-br from-[#121c36] to-[#0a1124] border-white/5 shadow-blue-900/20" : "bg-gradient-to-br from-blue-600 to-indigo-700 border-transparent shadow-blue-500/30"}`}>
                                
                                {/* Decorative background shapes */}
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                                
                                <div className="relative z-10 max-w-2xl">
                                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight drop-shadow-md">
                                        ¡Hola, {userName.split(" ")[0]}! Bienvenido de nuevo.
                                    </h2>
                                    <p className={`text-lg mb-8 max-w-xl ${isDark ? "text-slate-300" : "text-blue-100"}`}>
                                        Este es tu nuevo portal de maestro. Pronto podrás visualizar tus clases asignadas, herramientas de IA para material de clase, y progreso de tus estudiantes.
                                    </p>
                                    <button 
                                        onClick={() => setActiveTab("chat")}
                                        className="px-6 py-3 rounded-xl bg-white text-blue-600 font-bold hover:bg-slate-50 transition-colors shadow-lg shadow-black/10 inline-flex items-center gap-2"
                                    >
                                        <Bot className="w-5 h-5" />
                                        Hablar con IA (Beta)
                                    </button>
                                </div>

                                {/* Illustration/Icon */}
                                <div className="absolute right-10 bottom-0 opacity-20 sm:opacity-100 pointer-events-none transform translate-y-10 hidden md:block">
                                    <GraduationCap className="w-64 h-64 text-white opacity-30 drop-shadow-lg" />
                                </div>
                            </div>

                            {/* Stats / Widgets */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                <Widget title="Clases Hoy" value="-" subtitle="Pendiente integración" icon={<CalendarIcon />} isDark={isDark} surfaceClass={surfaceClass} color="blue" />
                                <Widget title="Estudiantes Activos" value="-" subtitle="Alumnos a tu cargo" icon={<UsersIcon />} isDark={isDark} surfaceClass={surfaceClass} color="cyan" />
                                <Widget title="Materiales de IA" value="-" subtitle="Base de conocimiento" icon={<SparklesIcon />} isDark={isDark} surfaceClass={surfaceClass} color="purple" />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <style jsx global>{`
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.05); }
                }
                .animate-pulse-slow { animation: pulse-slow 8s infinite alternate; }
            `}</style>
        </div>
    );
}

// Subcomponents helper
function NavItem({ icon, label, active = false, onClick, isDark }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isDark: boolean }) {
    const activeClass = active
        ? isDark ? "bg-cyan-500/10 text-cyan-400 font-semibold" : "bg-blue-50 text-blue-600 font-semibold"
        : isDark ? "text-slate-400 hover:bg-white/5 hover:text-slate-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800";

    return (
        <button onClick={onClick} className={`w-full flex items-center justify-center sm:justify-start gap-4 px-3 py-3.5 rounded-xl cursor-pointer transition-all ${activeClass}`}>
            <span className="shrink-0">{icon}</span>
            <span className="hidden sm:inline text-sm">{label}</span>
        </button>
    );
}

function Widget({ title, value, subtitle, icon, isDark, surfaceClass, color }: any) {
    const iconColors = {
        blue: "from-blue-500 to-indigo-500 shadow-blue-500/20",
        cyan: "from-cyan-400 to-blue-500 shadow-cyan-500/20",
        purple: "from-purple-500 to-pink-500 shadow-purple-500/20"
    };

    return (
        <div className={`p-6 rounded-2xl border ${surfaceClass} flex items-center gap-5 hover:transform hover:-translate-y-1 transition-transform duration-300 shadow-sm`}>
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${iconColors[color as keyof typeof iconColors]} flex items-center justify-center text-white shadow-lg shrink-0`}>
                {icon}
            </div>
            <div>
                <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{title}</p>
                <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-slate-800"}`}>{value}</p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{subtitle}</p>
            </div>
        </div>
    );
}

function UsersIcon() {
    return <User />;
}


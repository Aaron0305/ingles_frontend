"use client";

import { useState } from "react";
import { Student } from "./credential";
import CredentialModal from "./credential";
import { Search, QrCode, Shield, Filter, IdCard, Sparkles, ArrowRight, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CredentialsPanelProps {
    students: Student[];
}

// Obtener color del túnel/ripple según nivel
function getTunnelColor(level: string) {
    if (level.startsWith("Beginner")) {
        return {
            shadow: "rgba(59, 130, 246, 0.5)",   // blue
            glow: "rgba(59, 130, 246, 0.5)",
            accent: "#3b82f6",
            accentLight: "rgba(59, 130, 246, 0.2)",
            accentMid: "rgba(59, 130, 246, 0.1)",
            gradient: "from-blue-100 to-white dark:from-blue-950/30 dark:to-black",
            borderDark: "dark:border-blue-800/50",
            textAccent: "text-blue-500",
            hoverText: "group-hover/start:text-blue-600 dark:group-hover/start:text-blue-400",
            btnFrom: "from-blue-500/10",
            btnVia: "via-blue-500/5",
            darkBtnFrom: "dark:hover:from-blue-500/20",
            darkBtnVia: "dark:hover:via-blue-500/10",
        };
    }
    if (level.startsWith("Intermediate")) {
        return {
            shadow: "rgba(245, 158, 11, 0.5)",   // amber
            glow: "rgba(245, 158, 11, 0.5)",
            accent: "#f59e0b",
            accentLight: "rgba(245, 158, 11, 0.2)",
            accentMid: "rgba(245, 158, 11, 0.1)",
            gradient: "from-amber-100 to-white dark:from-amber-950/30 dark:to-black",
            borderDark: "dark:border-amber-800/50",
            textAccent: "text-amber-500",
            hoverText: "group-hover/start:text-amber-600 dark:group-hover/start:text-amber-400",
            btnFrom: "from-amber-500/10",
            btnVia: "via-amber-500/5",
            darkBtnFrom: "dark:hover:from-amber-500/20",
            darkBtnVia: "dark:hover:via-amber-500/10",
        };
    }
    // Advanced
    return {
        shadow: "rgba(16, 185, 129, 0.5)",   // emerald
        glow: "rgba(16, 185, 129, 0.5)",
        accent: "#10b981",
        accentLight: "rgba(16, 185, 129, 0.2)",
        accentMid: "rgba(16, 185, 129, 0.1)",
        gradient: "from-emerald-100 to-white dark:from-emerald-950/30 dark:to-black",
        borderDark: "dark:border-emerald-800/50",
        textAccent: "text-emerald-500",
        hoverText: "group-hover/start:text-emerald-600 dark:group-hover/start:text-emerald-400",
        btnFrom: "from-emerald-500/10",
        btnVia: "via-emerald-500/5",
        darkBtnFrom: "dark:hover:from-emerald-500/20",
        darkBtnVia: "dark:hover:via-emerald-500/10",
    };
}

function getLevelBadgeColor(level: string) {
    switch (level) {
        case 'Beginner 1': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
        case 'Beginner 2': return 'bg-blue-50 text-blue-500 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
        case 'Intermediate 1': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
        case 'Intermediate 2': return 'bg-amber-50 text-amber-500 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
        case 'Advanced 1': return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
        case 'Advanced 2': return 'bg-emerald-50 text-emerald-500 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
        default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
}

// ============================
// CARD FLIP COMPONENT
// ============================
interface StudentCardFlipProps {
    student: Student;
    index: number;
    onViewCredential: (student: Student) => void;
}

function StudentCardFlip({ student, index, onViewCredential }: StudentCardFlipProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const tunnel = getTunnelColor(student.level);

    const features = [
        `Nivel: ${student.level}`,
        `Esquema: ${student.paymentScheme === 'weekly' ? 'Semanal' : student.paymentScheme === 'biweekly' ? 'Catorcenal' : student.paymentScheme === 'daily' ? 'Diario' : 'Mensual'}`,
        `Inscrito: ${student.enrollmentDate
            ? new Date(student.enrollmentDate.replace(/-/g, "/")).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
            : student.createdAt
                ? new Date(student.createdAt.replace(/-/g, "/")).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                : "N/A"
        }`,
        `Estado: ${student.status === 'active' ? 'Activo' : student.status === 'baja' ? 'Baja' : 'Inactivo'}`,
    ];

    return (
        <div
            className="card-animate group relative h-[320px] w-full [perspective:2000px]"
            style={{ animationDelay: `${index * 0.06}s` }}
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
        >
            <div
                className={cn(
                    "relative h-full w-full",
                    "[transform-style:preserve-3d]",
                    "transition-all duration-700",
                    isFlipped
                        ? "[transform:rotateY(180deg)]"
                        : "[transform:rotateY(0deg)]"
                )}
            >
                {/* ========= FRONT ========= */}
                <div
                    className={cn(
                        "absolute inset-0 h-full w-full",
                        "[backface-visibility:hidden] [transform:rotateY(0deg)]",
                        "overflow-hidden rounded-2xl",
                        "bg-zinc-50 dark:bg-zinc-900",
                        "border border-zinc-200 dark:border-zinc-800/50",
                        "shadow-sm dark:shadow-lg",
                        "transition-all duration-700",
                        "group-hover:shadow-lg dark:group-hover:shadow-xl",
                        isFlipped ? "opacity-0" : "opacity-100"
                    )}
                >
                    <div className={cn(
                        "relative h-full overflow-hidden bg-gradient-to-b",
                        tunnel.gradient
                    )}>
                        {/* Tunnel / Ripple Animation */}
                        <div className="absolute inset-0 flex items-start justify-center pt-16">
                            <div className="relative flex h-[100px] w-[200px] items-center justify-center">
                                {[...Array(10)].map((_, i) => (
                                    <div
                                        className={cn(
                                            "absolute h-[50px] w-[50px]",
                                            "rounded-[140px]",
                                            "animate-[scale_3s_linear_infinite]",
                                            "opacity-0",
                                            "group-hover:animate-[scale_2s_linear_infinite]"
                                        )}
                                        key={i}
                                        style={{
                                            animationDelay: `${i * 0.3}s`,
                                            boxShadow: `0 0 50px ${tunnel.shadow}`,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Front Content - Bottom */}
                    <div className="absolute right-0 bottom-0 left-0 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1.5">
                                {/* Level badge */}
                                <div className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getLevelBadgeColor(student.level)} mb-1`}>
                                    {student.level}
                                </div>
                                <h3 className="font-semibold text-lg text-zinc-900 leading-snug tracking-tighter transition-all duration-500 ease-out group-hover:translate-y-[-4px] dark:text-white line-clamp-1">
                                    {student.name}
                                </h3>
                                <p className="line-clamp-1 text-sm text-zinc-600 tracking-tight transition-all delay-[50ms] duration-500 ease-out group-hover:translate-y-[-4px] dark:text-zinc-200 font-mono">
                                    #{student.studentNumber}
                                </p>
                            </div>
                            <div className="group/icon relative">
                                <div
                                    className={cn(
                                        "absolute inset-[-8px] rounded-lg transition-opacity duration-300",
                                    )}
                                    style={{
                                        background: `linear-gradient(to bottom right, ${tunnel.accentLight}, ${tunnel.accentMid}, transparent)`,
                                    }}
                                />
                                <Repeat2
                                    className={cn(
                                        "group-hover/icon:-rotate-12 relative z-10 h-4 w-4 transition-transform duration-300 group-hover/icon:scale-110",
                                        tunnel.textAccent
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status indicator */}
                    <div className="absolute top-3 left-3">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border backdrop-blur-sm",
                            student.status === 'active'
                                ? 'bg-green-50/90 text-green-600 border-green-200 dark:bg-green-900/40 dark:text-green-400 dark:border-green-800'
                                : 'bg-gray-50/90 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700'
                        )}>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                student.status === 'active' ? 'bg-green-500 pulse-dot' : 'bg-gray-400'
                            )} />
                            {student.status === 'active' ? 'Activo' : student.status === 'baja' ? 'Baja' : 'Inactivo'}
                        </div>
                    </div>
                </div>

                {/* ========= BACK ========= */}
                <div
                    className={cn(
                        "absolute inset-0 h-full w-full",
                        "[backface-visibility:hidden] [transform:rotateY(180deg)]",
                        "rounded-2xl p-5",
                        "bg-gradient-to-b from-zinc-100 to-white dark:from-zinc-900 dark:to-black",
                        "border border-zinc-200 dark:border-zinc-800",
                        "shadow-sm dark:shadow-lg",
                        "flex flex-col",
                        "transition-all duration-700",
                        "group-hover:shadow-lg dark:group-hover:shadow-xl",
                        isFlipped ? "opacity-100" : "opacity-0"
                    )}
                >
                    <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getLevelBadgeColor(student.level)}`}>
                                    {student.level}
                                </div>
                            </div>
                            <h3 className="font-semibold text-lg text-zinc-900 leading-snug tracking-tight transition-all duration-500 ease-out group-hover:translate-y-[-2px] dark:text-white line-clamp-1">
                                {student.name}
                            </h3>
                            <p className="text-sm text-zinc-600 tracking-tight transition-all duration-500 ease-out group-hover:translate-y-[-2px] dark:text-zinc-400 font-mono">
                                #{student.studentNumber}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {features.map((feature, featureIndex) => (
                                <div
                                    className="flex items-center gap-2 text-sm text-zinc-700 transition-all duration-500 dark:text-zinc-300"
                                    key={feature}
                                    style={{
                                        transform: isFlipped
                                            ? "translateX(0)"
                                            : "translateX(-10px)",
                                        opacity: isFlipped ? 1 : 0,
                                        transitionDelay: `${featureIndex * 100 + 200}ms`,
                                    }}
                                >
                                    <ArrowRight className={cn("h-3 w-3 flex-shrink-0", tunnel.textAccent)} />
                                    <span className="truncate">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 border-zinc-200 border-t pt-4 dark:border-zinc-800">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewCredential(student);
                            }}
                            className={cn(
                                "group/start relative",
                                "flex items-center justify-between w-full",
                                "-m-2 rounded-xl p-3",
                                "transition-all duration-300",
                                "bg-gradient-to-r from-zinc-100 via-zinc-100 to-zinc-100",
                                "dark:from-zinc-800 dark:via-zinc-800 dark:to-zinc-800",
                                `hover:from-0% hover:${tunnel.btnFrom} hover:via-100% hover:${tunnel.btnVia} hover:to-100% hover:to-transparent`,
                                `${tunnel.darkBtnFrom} ${tunnel.darkBtnVia} dark:hover:to-100% dark:hover:to-transparent`,
                                "hover:scale-[1.02] hover:cursor-pointer"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <IdCard className={cn("h-4 w-4", tunnel.textAccent)} />
                                <span className={cn(
                                    "font-medium text-sm text-zinc-900 transition-colors duration-300 dark:text-white",
                                    tunnel.hoverText
                                )}>
                                    Ver Credencial
                                </span>
                            </div>
                            <div className="group/icon relative">
                                <div
                                    className={cn(
                                        "absolute inset-[-6px] rounded-lg transition-all duration-300",
                                        "scale-90 opacity-0 group-hover/start:scale-100 group-hover/start:opacity-100"
                                    )}
                                    style={{
                                        background: `linear-gradient(to bottom right, ${tunnel.accentLight}, ${tunnel.accentMid}, transparent)`,
                                    }}
                                />
                                <ArrowRight className={cn(
                                    "relative z-10 h-4 w-4 transition-all duration-300 group-hover/start:translate-x-0.5 group-hover/start:scale-110",
                                    tunnel.textAccent
                                )} />
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================
// MAIN PANEL
// ============================

export default function CredentialsPanel({ students }: CredentialsPanelProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [showCredentialModal, setShowCredentialModal] = useState(false);

    // Filtrar estudiantes
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase().trim();
        const isNumeric = /^\d+$/.test(search);

        const matchesSearch = search === "" || (
            isNumeric
                ? student.studentNumber.toString().includes(search)
                : (
                    student.studentNumber.toLowerCase().includes(search) ||
                    student.name.toLowerCase().includes(search)
                )
        );

        const matchesLevel = filterLevel === "all" || student.level === filterLevel;
        const matchesStatus = filterStatus === "all" || student.status === filterStatus;

        return matchesSearch && matchesLevel && matchesStatus;
    });

    const handleViewCredential = (student: Student) => {
        setSelectedStudent(student);
        setShowCredentialModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Estilos de animación CSS */}
            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes scale {
                    0% {
                        transform: scale(2);
                        opacity: 0;
                    }
                    50% {
                        transform: translate(0px, -5px) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(0px, 5px) scale(0.1);
                        opacity: 0;
                    }
                }
                
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                
                @keyframes pulse-ring {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                }
                
                .card-animate {
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }
                
                .pulse-dot {
                    animation: pulse-ring 2s ease-in-out infinite;
                }
            `}</style>

            {/* Header y Filtros */}
            <div className="p-5 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/50 bg-white dark:bg-slate-800/50 backdrop-blur-sm transition-all hover:shadow-md animate-fade-in">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                    {/* Buscador */}
                    <div className="relative flex-1 w-full lg:max-w-xl group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o matrícula..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-24 py-3 rounded-xl border border-gray-200 dark:border-gray-700/50 bg-gray-50/50 dark:bg-slate-900/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                            <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm hover:shadow-md">
                                Buscar
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative min-w-[160px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Sparkles className="h-4 w-4 text-gray-400" />
                            </div>
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="block w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none text-gray-700 dark:text-gray-200"
                            >
                                <option value="all">Nivel: Todos</option>
                                <option value="Beginner 1">Beginner 1</option>
                                <option value="Beginner 2">Beginner 2</option>
                                <option value="Intermediate 1">Intermediate 1</option>
                                <option value="Intermediate 2">Intermediate 2</option>
                                <option value="Advanced 1">Advanced 1</option>
                                <option value="Advanced 2">Advanced 2</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <Filter className="h-3 w-3 text-gray-400" />
                            </div>
                        </div>

                        <div className="relative min-w-[160px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <IdCard className="h-4 w-4 text-gray-400" />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="block w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none text-gray-700 dark:text-gray-200"
                            >
                                <option value="all">Estado: Todos</option>
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <Filter className="h-3 w-3 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de Cards Flip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStudents.length === 0 ? (
                    <div className="col-span-full py-16 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No se encontraron estudiantes</h3>
                        <p className="text-gray-500 text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                ) : (
                    filteredStudents.map((student, index) => (
                        <StudentCardFlip
                            key={student.id}
                            student={student}
                            index={index}
                            onViewCredential={handleViewCredential}
                        />
                    ))
                )}
            </div>

            {/* Modal de Credencial */}
            {selectedStudent && (
                <CredentialModal
                    isOpen={showCredentialModal}
                    student={selectedStudent}
                    onClose={() => setShowCredentialModal(false)}
                />
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import { Student } from "./credential";
import CredentialModal from "./credential";
import { Search, QrCode, Shield, Filter, IdCard, Sparkles } from "lucide-react";

interface CredentialsPanelProps {
    students: Student[];
}

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

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'Beginner': return 'from-blue-500 to-cyan-500';
            case 'Intermediate': return 'from-amber-500 to-orange-500';
            case 'Advanced': return 'from-emerald-500 to-teal-500';
            default: return 'from-gray-500 to-slate-500';
        }
    };

    const getLevelBadgeColor = (level: string) => {
        switch (level) {
            case 'Beginner': return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
            case 'Intermediate': return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
            case 'Advanced': return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
            default: return 'bg-gray-50 text-gray-600 border-gray-200';
        }
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
                
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                
                @keyframes pulse-ring {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                }
                
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .card-animate {
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }
                
                .shimmer-effect {
                    animation: shimmer 3s infinite;
                }
                
                .pulse-dot {
                    animation: pulse-ring 2s ease-in-out infinite;
                }
                
                .spin-slow {
                    animation: spin-slow 8s linear infinite;
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
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
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

            {/* Grid de Cards con animaciones CSS */}
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
                        <div
                            key={student.id}
                            className="card-animate group relative bg-white dark:bg-slate-800 rounded-2xl p-1 shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 border border-gray-200 dark:border-gray-700/50 flex flex-col overflow-hidden"
                            style={{ animationDelay: `${index * 0.06}s` }}
                        >
                            {/* Efecto de brillo en hover */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                            {/* Borde brillante animado */}
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{ background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent)' }}
                            />

                            <div className="relative flex-1 p-5 flex flex-col items-center">
                                {/* Badge de Nivel */}
                                <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getLevelBadgeColor(student.level)} transform translate-x-0 opacity-100 transition-all duration-300`}>
                                    {student.level}
                                </div>

                                {/* Status */}
                                <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${student.status === 'active'
                                    ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-green-500 pulse-dot' : 'bg-gray-400'}`} />
                                    {student.status === 'active' ? 'Activo' : 'Inactivo'}
                                </div>

                                {/* Avatar con anillo brillante */}
                                <div className="mt-6 mb-4 relative">
                                    {/* Anillo giratorio brillante (solo visible en hover) */}
                                    <div
                                        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 spin-slow"
                                        style={{ background: 'conic-gradient(from 0deg, transparent, rgba(59, 130, 246, 0.3), transparent, rgba(16, 185, 129, 0.3), transparent)' }}
                                    />

                                    <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${getLevelColor(student.level)} p-0.5 shadow-lg group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300`}>
                                        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-[14px] flex items-center justify-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-800 to-gray-500 dark:from-white dark:to-gray-400">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                    </div>

                                    {/* Icono QR */}
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-md border border-gray-100 dark:border-gray-700 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">
                                        <QrCode className="w-4 h-4 text-blue-500" />
                                    </div>
                                </div>

                                {/* Información */}
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1 line-clamp-1 w-full" title={student.name}>
                                    {student.name}
                                </h3>

                                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-4 bg-gray-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                    #{student.studentNumber}
                                </p>

                                {/* Detalles */}
                                <div className="w-full grid grid-cols-2 gap-2 text-center mb-5">
                                    <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Inscrito</p>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                                            {student.enrollmentDate
                                                ? new Date(student.enrollmentDate.replace(/-/g, "/")).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
                                                : student.createdAt
                                                    ? new Date(student.createdAt.replace(/-/g, "/")).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
                                                    : ""
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Esquema</p>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                                            {student.paymentScheme === 'weekly' ? 'Semanal' : student.paymentScheme === 'biweekly' ? 'Catorcenal' : student.paymentScheme === 'daily' ? 'Diario' : 'Mensual'}
                                        </p>
                                    </div>
                                </div>

                                {/* Botón con efecto shimmer */}
                                <button
                                    onClick={() => handleViewCredential(student)}
                                    className="relative w-full mt-auto py-2.5 px-4 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center gap-2 text-white font-medium overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {/* Efecto shimmer */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent shimmer-effect" />
                                    <IdCard className="w-4 h-4 relative z-10" />
                                    <span className="relative z-10">Ver Credencial</span>
                                </button>
                            </div>
                        </div>
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

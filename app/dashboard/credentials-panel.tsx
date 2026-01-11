"use client";

import { useState } from "react";
import { Student } from "./credential";
import CredentialModal from "./credential";
import { Search, QrCode, Shield, Download, Filter, IdCard, Sparkles, MoreVertical } from "lucide-react";

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
            {/* Header y Filtros Avanzados */}
            <div className="p-5 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/50 bg-white dark:bg-slate-800/50 backdrop-blur-sm transition-all hover:shadow-md">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                    {/* Buscador Potenciado */}
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
                            <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm">
                                Buscar
                            </button>
                        </div>
                    </div>

                    {/* Filtros Dropdown */}
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

            {/* Grid de Cards Premium */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredStudents.length === 0 ? (
                    <div className="col-span-full py-16 text-center">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No se encontraron estudiantes</h3>
                        <p className="text-gray-500 text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                ) : (
                    filteredStudents.map((student) => (
                        <div
                            key={student.id}
                            className="group relative bg-white dark:bg-slate-800 rounded-2xl p-1 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-200 dark:border-gray-700/50 flex flex-col"
                        >
                            <div className="relative flex-1 p-5 flex flex-col items-center">
                                {/* Badge de Nivel Absoluto */}
                                <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getLevelBadgeColor(student.level)}`}>
                                    {student.level}
                                </div>

                                {/* Status Dot */}
                                <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border ${student.status === 'active'
                                    ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                    {student.status === 'active' ? 'Activo' : 'Inactivo'}
                                </div>

                                {/* Avatar con Gradiente Activo */}
                                <div className="mt-6 mb-4 relative">
                                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getLevelColor(student.level)} p-0.5 shadow-lg`}>
                                        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-[14px] flex items-center justify-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-800 to-gray-500 dark:from-white dark:to-gray-400">
                                            {student.name.charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-md border border-gray-100 dark:border-gray-700">
                                        <QrCode className="w-4 h-4 text-blue-500" />
                                    </div>
                                </div>

                                {/* Información del Estudiante */}
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-1 line-clamp-1 w-full" title={student.name}>
                                    {student.name}
                                </h3>
                                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-4 bg-gray-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                                    #{student.studentNumber}
                                </p>

                                {/* Detalles Rápidos */}
                                <div className="w-full grid grid-cols-2 gap-2 text-center mb-5">
                                    <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-2">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Inscrito</p>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                                            {new Date(student.createdAt).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-700/30 rounded-lg p-2">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Esquema</p>
                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                                            {student.paymentScheme === 'weekly' ? 'Semanal' : student.paymentScheme === 'biweekly' ? 'Catorcenal' : 'Mensual'}
                                        </p>
                                    </div>
                                </div>

                                {/* Botón de Acción */}
                                <button
                                    onClick={() => handleViewCredential(student)}
                                    className="w-full mt-auto py-2.5 px-4 bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-700 dark:text-white font-medium hover:bg-black hover:text-white dark:hover:bg-blue-600 hover:border-transparent transition-all duration-300 group-hover/btn:scale-[1.02]"
                                >
                                    <IdCard className="w-4 h-4" />
                                    <span>Ver Credencial</span>
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

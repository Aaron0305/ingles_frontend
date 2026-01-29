
"use client";

import { useState, useEffect } from "react";
import { Student } from "./credential";
import { studentsApi } from "@/lib/api";
import { Search, X, Trash2, Pencil, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface EditStudentForm {
    name: string;
    email: string;
    emergencyPhone: string;
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
}

interface StudentsPanelProps {
    students: Student[];
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

export default function StudentsPanel({ students, setStudents }: StudentsPanelProps) {
    // Filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 10;

    // Modales y estados de acción
    const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
    const [showEditStudentModal, setShowEditStudentModal] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [editFormData, setEditFormData] = useState<EditStudentForm>({
        name: "",
        email: "",
        emergencyPhone: "",
        level: "Beginner 1",
    });
    const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [showStatusModal, setShowStatusModal] = useState(false);
    const [studentToToggle, setStudentToToggle] = useState<Student | null>(null);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    // Helpers
    const getLevelBadge = (level: string) => {
        switch (level) {
            case "Beginner 1":
                return "bg-blue-500/20 text-blue-500 border-blue-500/30";
            case "Beginner 2":
                return "bg-blue-400/20 text-blue-400 border-blue-400/30";
            case "Intermediate 1":
                return "bg-amber-500/20 text-amber-500 border-amber-500/30";
            case "Intermediate 2":
                return "bg-amber-400/20 text-amber-400 border-amber-400/30";
            case "Advanced 1":
                return "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
            case "Advanced 2":
                return "bg-emerald-400/20 text-emerald-400 border-emerald-400/30";
            default:
                return "bg-gray-500/20 text-gray-500 border-gray-500/30";
        }
    };

    const formatDate = (dateString: string): string => {
        try {
            if (!dateString) return "";
            const date = new Date(dateString.replace(/-/g, "/"));
            return date.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch {
            return dateString;
        }
    };

    // Filtrar estudiantes
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase().trim();
        const isNumeric = /^\d+$/.test(search);

        const matchesSearch = search === "" || (
            isNumeric
                ? student.studentNumber.toString().includes(search)
                : student.name.toLowerCase().includes(search)
        );

        const matchesLevel = filterLevel === "all" || student.level === filterLevel;
        const matchesStatus = filterStatus === "all" || student.status === filterStatus;
        return matchesSearch && matchesLevel && matchesStatus;
    });

    // Paginación
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterLevel, filterStatus]);

    // Handlers
    const handleDeleteStudent = (student: Student) => {
        setStudentToDelete(student);
        setShowDeleteStudentModal(true);
    };

    const confirmDeleteStudent = async () => {
        if (studentToDelete) {
            try {
                await studentsApi.delete(studentToDelete.id);
                setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
            } catch (error) {
                console.error("Error eliminando estudiante:", error);
            } finally {
                setShowDeleteStudentModal(false);
                setStudentToDelete(null);
            }
        }
    };

    const handleEditStudent = (student: Student) => {
        setStudentToEdit(student);
        setEditFormData({
            name: student.name,
            email: student.email,
            emergencyPhone: student.emergencyPhone || "",
            level: student.level as any,
        });
        setEditFormErrors({});
        setShowEditStudentModal(true);
    };

    const validateEditForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!editFormData.name.trim()) errors.name = "Nombre requerido";
        if (!editFormData.email.trim()) errors.email = "Email requerido";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
            errors.email = "Email inválido";
        }
        setEditFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveEditStudent = async () => {
        if (!validateEditForm() || !studentToEdit) return;
        setIsEditing(true);

        try {
            const updatedStudent = await studentsApi.update(studentToEdit.id, {
                name: editFormData.name,
                email: editFormData.email,
                emergencyPhone: editFormData.emergencyPhone || undefined,
                level: editFormData.level,
            });

            setStudents(prev => prev.map(s =>
                s.id === studentToEdit.id
                    ? { ...s, ...updatedStudent, progress: s.progress, lastAccess: s.lastAccess }
                    : s
            ));
            setShowEditStudentModal(false);
            setStudentToEdit(null);
            setSaveMessage({ type: 'success', text: 'Cambios guardados correctamente' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Error actualizando estudiante:", error);
            const message = error instanceof Error ? error.message : "Error al actualizar";

            if (message.toLowerCase().includes('correo') || message.toLowerCase().includes('email')) {
                setEditFormErrors({ email: message });
                setSaveMessage({ type: 'error', text: message });
            } else {
                setEditFormErrors({ email: message });
                setSaveMessage({ type: 'error', text: 'Error al guardar cambios' });
            }
            setTimeout(() => setSaveMessage(null), 4000);
        } finally {
            setIsEditing(false);
        }
    };

    const handleToggleStatusClick = (student: Student) => {
        setStudentToToggle(student);
        setShowStatusModal(true);
    };

    const handleConfirmToggleStatus = async () => {
        if (!studentToToggle) return;
        setIsTogglingStatus(true);

        try {
            const newStatus = studentToToggle.status === "active" ? "inactive" : "active";
            const updatedStudent = await studentsApi.update(studentToToggle.id, {
                status: newStatus,
            });

            setStudents(prev => prev.map(s =>
                s.id === studentToToggle.id
                    ? { ...s, status: updatedStudent.status }
                    : s
            ));

            setShowStatusModal(false);
            setStudentToToggle(null);
            setSaveMessage({
                type: 'success',
                text: newStatus === "active" ? 'Estudiante activado correctamente' : 'Estudiante desactivado correctamente'
            });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Error cambiando estado:", error);
            setSaveMessage({ type: 'error', text: 'Error al cambiar estado del estudiante' });
            setTimeout(() => setSaveMessage(null), 4000);
        } finally {
            setIsTogglingStatus(false);
        }
    };

    return (
        <div className="w-full">
            {/* Toast Notifications */}
            {saveMessage && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${saveMessage.type === 'success'
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                    }`}>
                    {saveMessage.type === 'success' ? (
                        <CheckCircle className="w-5 h-5" strokeWidth={2} />
                    ) : (
                        <AlertTriangle className="w-5 h-5" strokeWidth={2} />
                    )}
                    <span className="font-medium">{saveMessage.text}</span>
                </div>
            )}

            {/* Barra de búsqueda y filtros */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                {/* Búsqueda */}
                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} strokeWidth={2} />
                        <input
                            type="text"
                            placeholder="Buscar por número o nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none transition-all"
                            style={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--input-border)',
                                color: 'var(--text-primary)'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#2596be'}
                            onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
                        />
                    </div>
                </div>

                {/* Filtro por nivel */}
                <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white font-medium cursor-pointer"
                    style={{ background: '#014287', border: 'none' }}
                >
                    <option value="all" className="bg-gray-800 text-white">Todos los niveles</option>
                    <option value="Beginner 1" className="bg-gray-800 text-white">Beginner 1</option>
                    <option value="Beginner 2" className="bg-gray-800 text-white">Beginner 2</option>
                    <option value="Intermediate 1" className="bg-gray-800 text-white">Intermediate 1</option>
                    <option value="Intermediate 2" className="bg-gray-800 text-white">Intermediate 2</option>
                    <option value="Advanced 1" className="bg-gray-800 text-white">Advanced 1</option>
                    <option value="Advanced 2" className="bg-gray-800 text-white">Advanced 2</option>
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-white font-medium cursor-pointer"
                    style={{ background: '#014287', border: 'none' }}
                >
                    <option value="all" className="bg-gray-800 text-white">Todos los estados</option>
                    <option value="active" className="bg-gray-800 text-white">Activos</option>
                    <option value="inactive" className="bg-gray-800 text-white">Inactivos</option>
                </select>
                <button
                    onClick={() => {
                        setSearchTerm("");
                        setFilterLevel("all");
                        setFilterStatus("all");
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#ea242e', color: 'white' }}
                >
                    Limpiar filtros
                </button>
            </div>

            {/* TABLA DE ESTUDIANTES */}
            <div className="data-table rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                <div className="p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Seguimiento de Estudiantes
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    No.
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Estudiante
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Nivel
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Tel. Alumno
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Tel. Emergencia
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Inscripción
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Estado
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedStudents.map((student) => (
                                <tr key={student.id} className="table-row-hover transition-colors" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <span className="text-sm font-mono text-cyan-500">{student.studentNumber}</span>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</p>
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{student.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <span className={`inline-flex items-center justify-center w-24 px-2 py-0.5 rounded-full text-xs font-medium border ${getLevelBadge(student.level)}`}>
                                            {student.level}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        {student.studentPhone || ""}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        {student.emergencyPhone || ""}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        {formatDate(student.enrollmentDate || "")}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleStatusClick(student)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 ${student.status === "active"
                                                ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                                                : "bg-gray-500/20 text-gray-500 hover:bg-gray-500/30"
                                                }`}
                                            title={student.status === "active" ? "Clic para desactivar" : "Clic para activar"}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${student.status === "active" ? "bg-green-500" : "bg-gray-500"}`} />
                                            {student.status === "active" ? "Activo" : "Inactivo"}
                                        </button>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditStudent(student)}
                                                className="p-1.5 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                title="Editar Estudiante"
                                            >
                                                <Pencil className="w-4 h-4" strokeWidth={2} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStudent(student)}
                                                className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                title="Eliminar Estudiante"
                                            >
                                                <Trash2 className="w-4 h-4" strokeWidth={2} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Mostrando <span className="font-medium">{(currentPage - 1) * studentsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * studentsPerPage, filteredStudents.length)}</span> de <span className="font-medium">{filteredStudents.length}</span> estudiantes
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage(curr => Math.max(1, curr - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(curr => Math.min(totalPages, curr + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="p-2 rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modales */}
            {/* Modal de confirmación para borrar estudiante */}
            {showDeleteStudentModal && studentToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Eliminar Estudiante
                            </h3>
                            <button
                                onClick={() => setShowDeleteStudentModal(false)}
                                className="hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>
                        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            ¿Estás seguro de eliminar a{' '}
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {studentToDelete.name}
                            </span>
                            ?
                            <br />
                            <span className="text-red-400 mt-2 block text-xs">Esta acción no se puede deshacer y borrará todos los pagos asociados.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteStudentModal(false)}
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteStudent}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Editar Estudiante */}
            {showEditStudentModal && studentToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-xl w-full shadow-2xl overflow-y-auto max-h-[90vh]" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Pencil className="w-5 h-5 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Editar Estudiante</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Actualizar información general</p>
                                </div>
                            </div>
                            <button onClick={() => setShowEditStudentModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                    />
                                    {editFormErrors.name && <p className="mt-1 text-xs text-red-500">{editFormErrors.name}</p>}
                                </div>

                                {/* Email/Usuario */}
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Usuario (Email)</label>
                                    <input
                                        type="text"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                    />
                                    {editFormErrors.email && <p className="mt-1 text-xs text-red-500">{editFormErrors.email}</p>}
                                </div>

                                {/* Teléfono de Emergencia */}
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tel. Emergencia</label>
                                    <input
                                        type="tel"
                                        value={editFormData.emergencyPhone}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            if (value.length <= 10) {
                                                setEditFormData({ ...editFormData, emergencyPhone: value });
                                            }
                                        }}
                                        placeholder="5512345678"
                                        maxLength={10}
                                        className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* Nivel */}
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nivel</label>
                                    <select
                                        value={editFormData.level}
                                        onChange={(e) => setEditFormData({ ...editFormData, level: e.target.value as EditStudentForm["level"] })}
                                        className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: '#1f2937', border: '1px solid var(--input-border)', color: '#ffffff' }}
                                    >
                                        <option value="Beginner 1" style={{ background: '#1f2937', color: '#ffffff' }}>Beginner 1</option>
                                        <option value="Beginner 2" style={{ background: '#1f2937', color: '#ffffff' }}>Beginner 2</option>
                                        <option value="Intermediate 1" style={{ background: '#1f2937', color: '#ffffff' }}>Intermediate 1</option>
                                        <option value="Intermediate 2" style={{ background: '#1f2937', color: '#ffffff' }}>Intermediate 2</option>
                                        <option value="Advanced 1" style={{ background: '#1f2937', color: '#ffffff' }}>Advanced 1</option>
                                        <option value="Advanced 2" style={{ background: '#1f2937', color: '#ffffff' }}>Advanced 2</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-5">
                                <button
                                    onClick={handleSaveEditStudent}
                                    disabled={isEditing}
                                    className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg transition-all disabled:opacity-50 hover:opacity-90 text-sm"
                                    style={{ background: '#014287' }}
                                >
                                    {isEditing ? "Guardando..." : "Guardar Cambios"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditStudentModal(false);
                                        setStudentToEdit(null);
                                    }}
                                    className="px-4 py-2.5 font-medium rounded-lg transition-colors text-sm"
                                    style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Status toggle */}
            {showStatusModal && studentToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {studentToToggle.status === "active" ? "Desactivar Estudiante" : "Activar Estudiante"}
                            </h3>
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>
                        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            ¿Estás seguro de {studentToToggle.status === "active" ? "desactivar" : "activar"} a{' '}
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {studentToToggle.name}
                            </span>
                            ?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmToggleStatus}
                                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${studentToToggle.status === "active" ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
                            >
                                {studentToToggle.status === "active" ? "Desactivar" : "Activar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

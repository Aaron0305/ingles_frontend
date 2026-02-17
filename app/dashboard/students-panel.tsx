
"use client";

import { useState, useEffect } from "react";
import { Student } from "./credential";
import { studentsApi } from "@/lib/api";
import { Search, X, Trash2, Pencil, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, UserMinus, Eye, RotateCcw, Calendar } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface EditStudentForm {
    name: string;
    email: string;
    studentPhone: string;
    emergencyPhone: string;
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
    classDays: number[];
    paymentScheme: "daily" | "weekly" | "biweekly" | "monthly_28";
    priceOption: string;
    customPrice: string;
}

const PRICE_OPTIONS = [
    { value: "760", label: "$760" },
    { value: "750", label: "$750" },
    { value: "790", label: "$790" },
    { value: "650", label: "$650" },
    { value: "149.50", label: "$149.50" },
    { value: "custom", label: "Otro (personalizado)" },
] as const;

interface StudentsPanelProps {
    students: Student[];
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    userRole?: "admin" | "superadmin";
}

export default function StudentsPanel({ students, setStudents, userRole = "admin" }: StudentsPanelProps) {
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
        studentPhone: "",
        emergencyPhone: "",
        level: "Beginner 1",
        classDays: [],
        paymentScheme: "monthly_28",
        priceOption: "760",
        customPrice: "",
    });
    const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [showStatusModal, setShowStatusModal] = useState(false);
    const [studentToToggle, setStudentToToggle] = useState<Student | null>(null);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);

    // Estados para Baja
    const [showDropoutModal, setShowDropoutModal] = useState(false);
    const [dropoutReasonText, setDropoutReasonText] = useState("");
    const [isProcessingDropout, setIsProcessingDropout] = useState(false);
    const [showReasonModal, setShowReasonModal] = useState(false);

    // Estados para Reactivación
    const [showReactivateModal, setShowReactivateModal] = useState(false);
    const [newEnrollmentDate, setNewEnrollmentDate] = useState("");
    const [isProcessingReactivate, setIsProcessingReactivate] = useState(false);

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
        const feeStr = student.monthlyFee?.toString() || "760";
        const isPreset = PRICE_OPTIONS.some(o => o.value === feeStr && o.value !== "custom");
        setEditFormData({
            name: student.name,
            email: student.email,
            studentPhone: student.studentPhone || "",
            emergencyPhone: student.emergencyPhone || "",
            level: student.level as any,
            classDays: student.classDays || [],
            paymentScheme: student.paymentScheme || "monthly_28",
            priceOption: isPreset ? feeStr : "custom",
            customPrice: isPreset ? "" : feeStr,
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
        if (editFormData.priceOption === "custom") {
            if (!editFormData.customPrice || parseFloat(editFormData.customPrice) <= 0) {
                errors.customPrice = "Ingresa un precio válido mayor a 0";
            }
        }
        setEditFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSaveEditStudent = async () => {
        if (!validateEditForm() || !studentToEdit) return;
        setIsEditing(true);

        const monthlyFee = editFormData.priceOption === "custom"
            ? parseFloat(editFormData.customPrice)
            : parseFloat(editFormData.priceOption);

        try {
            const updatedStudent = await studentsApi.update(studentToEdit.id, {
                name: editFormData.name,
                email: editFormData.email,
                studentPhone: editFormData.studentPhone || undefined,
                emergencyPhone: editFormData.emergencyPhone || undefined,
                level: editFormData.level,
                classDays: editFormData.classDays,
                paymentScheme: editFormData.paymentScheme,
                monthlyFee: monthlyFee,
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
                    ? { ...s, ...updatedStudent }
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

    const handleDropoutClick = (student: Student) => {
        setStudentToToggle(student);
        setDropoutReasonText("");
        setShowDropoutModal(true);
    };

    const handleConfirmDropout = async () => {
        if (!studentToToggle) return;
        if (!dropoutReasonText.trim()) {
            setSaveMessage({ type: 'error', text: 'Debes ingresar un motivo de baja' });
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsProcessingDropout(true);
        try {
            // Actualizar status a 'baja' y guardar motivo
            // Usamos 'as any' para evitar conflictos de tipos temporales si la interfaz Student de api.ts y credential.ts difieren ligeramente
            const updatedStudent = await studentsApi.update(studentToToggle.id, {
                status: "baja" as any,
                dropoutReason: dropoutReasonText,
                dropoutDate: new Date().toISOString().split('T')[0]
            } as any);

            setStudents(prev => prev.map(s =>
                s.id === studentToToggle.id
                    ? { ...s, status: "baja", dropoutReason: dropoutReasonText, dropoutDate: new Date().toISOString().split('T')[0] }
                    : s
            ));

            setShowDropoutModal(false);
            setStudentToToggle(null);
            setSaveMessage({ type: 'success', text: 'Estudiante dado de baja correctamente' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Error dando de baja:", error);
            setSaveMessage({ type: 'error', text: 'Error al dar de baja' });
            setTimeout(() => setSaveMessage(null), 4000);
        } finally {
            setIsProcessingDropout(false);
        }
    };

    const handleViewReason = (student: Student) => {
        setStudentToToggle(student);
        setShowReasonModal(true);
    };

    const handleReactivateClick = (student: Student) => {
        setStudentToToggle(student);
        // Default to today
        setNewEnrollmentDate(new Date().toISOString().split('T')[0]);
        setShowReactivateModal(true);
    };

    const handleConfirmReactivate = async () => {
        if (!studentToToggle || !newEnrollmentDate) return;
        setIsProcessingReactivate(true);

        try {
            const updatedStudent = await studentsApi.update(studentToToggle.id, {
                status: "active" as any,
                enrollmentDate: newEnrollmentDate,
                dropoutReason: null as any,
                dropoutDate: null as any
            } as any);

            setStudents(prev => prev.map(s =>
                s.id === studentToToggle.id
                    ? {
                        ...s,
                        status: "active",
                        enrollmentDate: newEnrollmentDate,
                        dropoutReason: undefined,
                        dropoutDate: undefined
                    }
                    : s
            ));

            setShowReactivateModal(false);
            setStudentToToggle(null);
            setSaveMessage({ type: 'success', text: 'Estudiante reactivado exitosamente con nueva fecha' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error("Error reactivando:", error);
            setSaveMessage({ type: 'error', text: 'Error al reactivar estudiante' });
            setTimeout(() => setSaveMessage(null), 4000);
        } finally {
            setIsProcessingReactivate(false);
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

                <button
                    onClick={() => {
                        setSearchTerm("");
                        setFilterLevel("all");

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
                                    Día de Inicio
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                    Días de Clase
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
                                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                                        {student.classDays && student.classDays.length > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                {student.classDays.map(d => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]).join(", ")}
                                            </span>
                                        ) : (
                                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin asignar</span>
                                        )}
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

                                            {/* Botón de Baja / Ver Motivo / Reactivar */}
                                            {student.status === 'baja' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleViewReason(student)}
                                                        className="p-1.5 text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                                                        title="Ver motivo de baja"
                                                    >
                                                        <Eye className="w-4 h-4" strokeWidth={2} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReactivateClick(student)}
                                                        className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors"
                                                        title="Reactivar Estudiante"
                                                    >
                                                        <RotateCcw className="w-4 h-4" strokeWidth={2} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleDropoutClick(student)}
                                                    className="p-1.5 text-orange-500 hover:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors"
                                                    title="Dar de baja definitiva"
                                                >
                                                    <UserMinus className="w-4 h-4" strokeWidth={2} />
                                                </button>
                                            )}
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

                                {/* Teléfono del Alumno */}
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tel. Alumno</label>
                                    <input
                                        type="tel"
                                        value={editFormData.studentPhone}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, '');
                                            if (value.length <= 10) {
                                                setEditFormData({ ...editFormData, studentPhone: value });
                                            }
                                        }}
                                        placeholder="5512345678"
                                        maxLength={10}
                                        className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                    />
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

                                {/* Esquema de Pago */}
                                <div className="relative">
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Esquema de Pago</label>
                                    <select
                                        value={editFormData.paymentScheme}
                                        onChange={(e) => setEditFormData({ ...editFormData, paymentScheme: e.target.value as EditStudentForm["paymentScheme"] })}
                                        disabled={userRole !== "superadmin"}
                                        className={`w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${userRole !== "superadmin" ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        style={{ background: '#1f2937', border: '1px solid var(--input-border)', color: '#ffffff' }}
                                    >
                                        <option value="monthly_28" style={{ background: '#1f2937', color: '#ffffff' }}>Cada 28 días</option>
                                        <option value="biweekly" style={{ background: '#1f2937', color: '#ffffff' }}>Catorcenal (14 días)</option>
                                        <option value="weekly" style={{ background: '#1f2937', color: '#ffffff' }}>Semanal</option>
                                        <option value="daily" style={{ background: '#1f2937', color: '#ffffff' }}>Diario</option>
                                    </select>
                                    {userRole !== "superadmin" && (
                                        <p className="mt-1 text-xs text-orange-400">Solo el superadmin puede modificar esto</p>
                                    )}
                                </div>

                                {/* Mensualidad */}
                                <div className="relative">
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Mensualidad</label>
                                    <select
                                        value={editFormData.priceOption}
                                        onChange={(e) => setEditFormData({ ...editFormData, priceOption: e.target.value, customPrice: "" })}
                                        disabled={userRole !== "superadmin"}
                                        className={`w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${userRole !== "superadmin" ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                                        style={{ background: '#1f2937', border: '1px solid var(--input-border)', color: '#ffffff' }}
                                    >
                                        {PRICE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value} style={{ background: '#1f2937', color: '#ffffff' }}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    {userRole !== "superadmin" && (
                                        <p className="mt-1 text-xs text-orange-400">Solo el superadmin puede modificar esto</p>
                                    )}
                                </div>

                                {/* Precio personalizado */}
                                {editFormData.priceOption === "custom" && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                            Precio Personalizado <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editFormData.customPrice}
                                                onChange={(e) => setEditFormData({ ...editFormData, customPrice: e.target.value })}
                                                disabled={userRole !== "superadmin"}
                                                placeholder="0.00"
                                                className={`w-full pl-8 pr-4 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${userRole !== "superadmin" ? 'cursor-not-allowed opacity-60' : ''}`}
                                                style={{ background: 'var(--input-bg)', border: `1px solid ${editFormErrors.customPrice ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        {editFormErrors.customPrice && <p className="mt-1 text-xs text-red-500">{editFormErrors.customPrice}</p>}
                                    </div>
                                )}

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

                                {/* Días de Clase */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                        Días de Clase
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 1, label: "Lunes" },
                                            { id: 2, label: "Martes" },
                                            { id: 3, label: "Miércoles" },
                                            { id: 4, label: "Jueves" },
                                            { id: 5, label: "Viernes" },
                                            { id: 6, label: "Sábado" },
                                        ].map((day) => {
                                            const currentDays = editFormData.classDays || [];
                                            const isSelected = currentDays.includes(day.id);
                                            const isMaxReached = currentDays.length >= 6 && !isSelected;
                                            return (
                                            <button
                                                key={day.id}
                                                type="button"
                                                disabled={isMaxReached}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setEditFormData({ ...editFormData, classDays: currentDays.filter(d => d !== day.id) });
                                                    } else if (currentDays.length < 6) {
                                                        setEditFormData({ ...editFormData, classDays: [...currentDays, day.id] });
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                                    : isMaxReached
                                                        ? "bg-gray-800/30 text-gray-600 cursor-not-allowed"
                                                        : "bg-gray-700/50 text-gray-400 hover:bg-gray-600/50"
                                                    }`}
                                            >
                                                {day.label}
                                            </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                        Selecciona de 1 a 6 días de clase (Lunes a Sábado)
                                    </p>
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


            {/* Modal: Ver Motivo de Baja */}
            {showReasonModal && studentToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Motivo de Baja
                            </h3>
                            <button onClick={() => setShowReasonModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mb-6">
                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Estudiante:</p>
                            <p className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{studentToToggle.name}</p>

                            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Fecha de baja:</p>
                            <p className="text-sm mb-4 font-mono" style={{ color: '#ea242e' }}>{formatDate(studentToToggle.dropoutDate || "")}</p>

                            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Motivo registrado:</p>
                            <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-sm italic" style={{ color: 'var(--text-primary)' }}>
                                "{studentToToggle.dropoutReason || "Sin motivo especificado"}"
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowReasonModal(false)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmar Baja */}
            {showDropoutModal && studentToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-red-400">
                                Dar de Baja Estudiante
                            </h3>
                            <button onClick={() => setShowDropoutModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                Estás a punto de dar de baja a: <span className="font-bold text-white">{studentToToggle.name}</span>.
                                <br />Esta acción ocultará al estudiante del panel de pagos y lo marcará como "Baja".
                            </p>

                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                Motivo de la baja <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={dropoutReasonText}
                                onChange={(e) => setDropoutReasonText(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                placeholder="Escribe la razón detallada de la baja..."
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowDropoutModal(false)}
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmDropout}
                                disabled={isProcessingDropout || !dropoutReasonText.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isProcessingDropout ? "Procesando..." : "Confirmar Baja"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Reactivar Estudiante */}
            {showReactivateModal && studentToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-emerald-400">
                                Reactivar Estudiante
                            </h3>
                            <button onClick={() => setShowReactivateModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                                Estás a punto de reactivar a: <span className="font-bold text-white">{studentToToggle.name}</span>.
                            </p>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
                                <p className="text-xs text-blue-200 flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span>
                                        Se asignará una <strong>nueva fecha de inscripción</strong>.
                                        El sistema calculará los pagos pendientes a partir de esta nueva fecha.
                                        Los pagos históricos anteriores se conservarán en los reportes pero no afectarán el saldo actual.
                                    </span>
                                </p>
                            </div>

                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                Nueva Fecha de Inscripción
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={newEnrollmentDate}
                                    onChange={(e) => setNewEnrollmentDate(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowReactivateModal(false)}
                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmReactivate}
                                disabled={isProcessingReactivate || !newEnrollmentDate}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isProcessingReactivate ? "Procesando..." : "Confirmar Reactivación"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

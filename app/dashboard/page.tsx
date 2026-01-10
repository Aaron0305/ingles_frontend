"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import CredentialModal, { Student } from "./credential";
import PaymentsPanel, { PaymentRecord } from "./payments";
import { studentsApi, paymentsApi, authApi } from "@/lib/api";
import { 
    Users, DollarSign, Plus, Search, X, 
    Loader2, Pencil, UserX, UserCheck
} from "lucide-react";
import Image from "next/image";

// ============================================
// TIPOS
// ============================================

interface NewStudentForm {
    name: string;
    email: string;
    emergencyPhone: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    priceOption: string;
    customPrice: string;
}

interface EditStudentForm {
    name: string;
    email: string;
    emergencyPhone: string;
    level: "Beginner" | "Intermediate" | "Advanced";
}

// ============================================
// CONSTANTES
// ============================================

const PRICE_OPTIONS = [
    { value: "149.50", label: "$149.50" },
    { value: "650", label: "$650" },
    { value: "750", label: "$750" },
    { value: "760", label: "$760" },
    { value: "790", label: "$790" },
    { value: "custom", label: "Otro (personalizado)" },
] as const;

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function DashboardPage() {
    const router = useRouter();

    // Estados
    const [activeTab, setActiveTab] = useState<"students" | "credentials" | "payments">("students");
    const [students, setStudents] = useState<Student[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCredentialModal, setShowCredentialModal] = useState(false);
    const [showEditStudentModal, setShowEditStudentModal] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 10;
    const [formData, setFormData] = useState<NewStudentForm>({
        name: "",
        email: "",
        emergencyPhone: "",
        level: "Beginner",
        priceOption: "149.50",
        customPrice: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [editFormData, setEditFormData] = useState<EditStudentForm>({
        name: "",
        email: "",
        emergencyPhone: "",
        level: "Beginner",
    });
    const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // Estado para modal de confirmación de activar/desactivar estudiante
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [studentToToggle, setStudentToToggle] = useState<Student | null>(null);
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    
    // Socket para comunicación en tiempo real
    const [socket, setSocket] = useState<Socket | null>(null);
    
    // Estados para notificación de pago desde escaneo QR
    const [pendingPaymentRequest, setPendingPaymentRequest] = useState<{
        studentId: string;
        studentName: string;
        studentNumber: string;
        pendingMonth: number;
        pendingYear: number;
        monthlyFee: number;
    } | null>(null);

    // ============================================
    // EFECTOS
    // ============================================
    
    // Inicializar Socket.io con autenticación y reconexión
    useEffect(() => {
        const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? 'https://ingles-backend-bk4n.onrender.com'
            : 'http://localhost:3001';
            
        const newSocket = io(SOCKET_URL, {
            path: "/api/socket",
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        // Función para autenticar y registrar
        const authenticateAndRegister = () => {
            const token = localStorage.getItem("token");
            if (token) {
                console.log("🔄 Enviando autenticación...");
                newSocket.emit("authenticate", { token });
            } else {
                console.error("❌ No hay token para autenticar socket");
            }
        };

        newSocket.on("connect", () => {
            console.log("✅ Socket conectado - ID:", newSocket.id);
            authenticateAndRegister();
        });

        // Cuando se reconecta, volver a autenticar
        newSocket.on("reconnect", () => {
            console.log("🔄 Socket reconectado - re-autenticando...");
            authenticateAndRegister();
        });

        // Cuando la autenticación es exitosa, registrarse como admin
        newSocket.on("auth-success", (data) => {
            console.log("🔐 Socket autenticado:", data.user?.name);
            newSocket.emit("register-admin");
            console.log("📝 Solicitando registro como admin...");
        });

        newSocket.on("registered", (data) => {
            console.log("✅ Registrado como admin correctamente:", data);
        });

        newSocket.on("auth-failed", (data) => {
            console.error("❌ Autenticación de socket fallida:", data.message);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("❌ Socket desconectado. Razón:", reason);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Error de conexión socket:", error.message);
        });

        // 🔔 Escuchar solicitudes de pago desde escaneo QR
        newSocket.on("payment-request", (data) => {
            console.log("📱 Solicitud de pago recibida:", data);
            setPendingPaymentRequest(data);
            
            // Cambiar a la pestaña de pagos automáticamente
            setActiveTab("payments");
            
            // Reproducir sonido de notificación
            try {
                const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleAEUA6KW+vB6JQ0AzePU/DjM+f/t7OT0VO8/9fnn8u8r9Fz35e/w7wrxMfXt6/LrIu8R8wHu7+v16CLuFPIC7u/s8eot7xHxB+3x7fXnL+4S8Anx8O336S3vDvD/7/Ht9+kx7g/v/+/x7ffqL+4O8P/w8e746i/tDfD+8fHu+Oov7Qzw/vHx7vjrL+wM8P7x8e746y/sDPD+8fHu+Osv7Azw/vHx7vjrL+wM8P7x");
                audio.volume = 0.5;
                audio.play().catch(() => {});
            } catch {
                // Ignorar errores de audio
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);
    
    useEffect(() => {
        // Verificar autenticación
        const userType = localStorage.getItem("userType");
        if (!userType || (userType !== "admin" && userType !== "superadmin")) {
            router.push("/login");
            return;
        }

        // Cargar datos del backend
        loadData();
    }, [router]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [studentsData, paymentsData] = await Promise.all([
                studentsApi.getAll(),
                paymentsApi.getAll(),
            ]);
            
            // Transformar datos para compatibilidad con el componente
            const transformedStudents: Student[] = studentsData.map(s => ({
                ...s,
                progress: 0, // Campo requerido por el tipo Student
                lastAccess: s.lastAccess || new Date().toISOString().split('T')[0],
            }));
            
            setStudents(transformedStudents);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // HANDLERS
    // ============================================

    const handleLogout = () => {
        authApi.logout();
        router.push("/login");
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.name.trim()) {
            errors.name = "El nombre es requerido";
        }

        if (!formData.email.trim()) {
            errors.email = "El email es requerido";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = "Email inválido";
        }

        // Validar precio personalizado
        if (formData.priceOption === "custom") {
            const price = parseFloat(formData.customPrice);
            if (!formData.customPrice.trim()) {
                errors.customPrice = "El precio es requerido";
            } else if (isNaN(price) || price <= 0) {
                errors.customPrice = "Ingresa un precio válido mayor a 0";
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateStudent = async () => {
        if (!validateForm()) return;

        setIsCreating(true);

        // Calcular el precio final
        const finalPrice = formData.priceOption === "custom" 
            ? parseFloat(formData.customPrice) 
            : parseFloat(formData.priceOption);

        try {
            // Llamada real al backend
            const newStudent = await studentsApi.create({
                name: formData.name,
                email: formData.email,
                level: formData.level,
                monthlyFee: finalPrice,
                emergencyPhone: formData.emergencyPhone || undefined,
            });

            // Agregar campos requeridos por el tipo Student
            const studentWithProgress: Student = {
                ...newStudent,
                progress: 0,
                lastAccess: new Date().toISOString().split("T")[0],
            };

            setStudents((prev) => [studentWithProgress, ...prev]);
            setSelectedStudent(studentWithProgress);
            setShowCreateModal(false);
            setShowCredentialModal(true);
            setFormData({ name: "", email: "", emergencyPhone: "", level: "Beginner", priceOption: "149.50", customPrice: "" });
        } catch (error) {
            console.error("Error creando estudiante:", error);
            const message = error instanceof Error ? error.message : "Error al crear estudiante";
            setFormErrors({ email: message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditStudent = (student: Student) => {
        setStudentToEdit(student);
        setEditFormData({
            name: student.name,
            email: student.email,
            emergencyPhone: student.emergencyPhone || "",
            level: student.level,
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
            
            // Si el error es de email duplicado, mostrar en el campo de email
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

    // Función para abrir modal de confirmación de cambio de estado
    const handleToggleStatusClick = (student: Student) => {
        setStudentToToggle(student);
        setShowStatusModal(true);
    };

    // Función para confirmar cambio de estado
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

    const handlePaymentConfirm = async (studentId: string, month: number, year: number) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        try {
            // Llamada real al backend
            const newPayment = await paymentsApi.create({
                studentId,
                month,
                year,
                amount: student.monthlyFee,
            });

            setPayments(prev => [...prev, newPayment]);
        } catch (error) {
            console.error("Error registrando pago:", error);
        }
    };

    const handlePaymentRevoke = async (studentId: string, month: number, year: number) => {
        try {
            await paymentsApi.revoke(studentId, month, year);
            setPayments(prev => prev.filter(p => 
                !(p.studentId === studentId && p.month === month && p.year === year)
            ));
        } catch (error) {
            console.error("Error revocando pago:", error);
        }
    };

    // Filtrar estudiantes (búsqueda por número, nombre o email)
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = search === "" ||
                            student.studentNumber.toLowerCase().includes(search) ||
                            student.name.toLowerCase().includes(search) ||
                            student.email.toLowerCase().includes(search);
        const matchesLevel = filterLevel === "all" || student.level === filterLevel;
        const matchesStatus = filterStatus === "all" || student.status === filterStatus;
        return matchesSearch && matchesLevel && matchesStatus;
    });

    const getLevelBadge = (level: Student["level"]): string => {
        const colors = {
            Beginner: "bg-blue-500/20 text-blue-400 border-blue-500/30",
            Intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
            Advanced: "bg-green-500/20 text-green-400 border-green-500/30",
        };
        return colors[level];
    };

    // Formatear fecha
    const formatDate = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch {
            return dateString;
        }
    };

    // Paginación
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    // Resetear página cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterLevel, filterStatus]);

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="dashboard-container min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Toast de notificación */}
            {saveMessage && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
                    saveMessage.type === 'success' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                }`}>
                    {saveMessage.type === 'success' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )}
                    <span className="font-medium">{saveMessage.text}</span>
                </div>
            )}

            {/* Header */}
            <header className="dashboard-header sticky top-0 z-40" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center p-1.5 flex-shrink-0">
                                <Image 
                                    src="/image/logo_mensaje.png" 
                                    alt="Logo" 
                                    width={28} 
                                    height={28} 
                                    className="object-contain"
                                />
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>Cargando datos...</span>
                    </div>
                ) : (
                <>
                {/* Header Stats - Diseño moderno */}
                <div className="mb-8">
                    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)', border: '1px solid var(--border-color)' }}>
                        {/* Decoración de fondo - Gradiente radial rojo institucional */}
                        <div className="absolute top-0 left-0 w-96 h-96 rounded-full blur-2xl -translate-y-1/3 -translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(193, 18, 31, 0.35) 0%, rgba(193, 18, 31, 0.15) 40%, rgba(193, 18, 31, 0) 70%)' }} />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/15 to-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            {/* Estudiantes - Principal */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                    <Users className="w-8 h-8 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total de Estudiantes</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>{students.length}</p>
                                        <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                                            {students.filter(s => s.status === "active").length} activos
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Separador visual */}
                            <div className="hidden md:block w-px h-16 bg-gradient-to-b from-transparent via-gray-500/30 to-transparent" />

                            {/* Distribución por nivel */}
                            <div className="flex gap-3">
                                <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                    <p className="text-2xl font-bold text-blue-500">{students.filter(s => s.level === "Beginner").length}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Beginner</p>
                                </div>
                                <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                    <p className="text-2xl font-bold text-amber-500">{students.filter(s => s.level === "Intermediate").length}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Intermediate</p>
                                </div>
                                <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                    <p className="text-2xl font-bold text-emerald-500">{students.filter(s => s.level === "Advanced").length}</p>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Advanced</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setActiveTab("students")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "students"
                                    ? "text-white"
                                    : ""
                                }`}
                            style={activeTab === "students" ? { background: '#014287' } : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                        >
                            Estudiantes
                        </button>
                        <button
                            onClick={() => setActiveTab("payments")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "payments"
                                    ? "text-white"
                                    : ""
                                }`}
                            style={activeTab === "payments" ? { background: '#014287' } : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                        >
                            <DollarSign className="w-4 h-4" strokeWidth={2} />
                            Pagos
                        </button>
                    </div>

                    {activeTab !== "payments" && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-all"
                            style={{ background: '#014287' }}
                        >
                            <Plus className="w-5 h-5" strokeWidth={2} />
                            Nuevo Estudiante
                        </button>
                    )}
                </div>

                {/* Barra de búsqueda y filtros - Solo para estudiantes y credenciales */}
                {activeTab !== "payments" && (
                    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        {/* Búsqueda */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} strokeWidth={2} />
                                <input
                                    type="text"
                                    placeholder="Buscar por número, nombre o email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
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
                            <option value="Beginner" className="bg-gray-800 text-white">Beginner</option>
                            <option value="Intermediate" className="bg-gray-800 text-white">Intermediate</option>
                            <option value="Advanced" className="bg-gray-800 text-white">Advanced</option>
                        </select>
                        
                        {/* Filtro por estado */}
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

                        {/* Limpiar filtros */}
                        {(searchTerm || filterLevel !== "all" || filterStatus !== "all") && (
                            <button
                                onClick={() => {
                                    setSearchTerm("");
                                    setFilterLevel("all");
                                    setFilterStatus("all");
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}

                {/* Content - Payments Tab */}
                {activeTab === "payments" ? (
                    <PaymentsPanel
                        students={students}
                        payments={payments}
                        onPaymentConfirm={handlePaymentConfirm}
                        onPaymentRevoke={handlePaymentRevoke}
                        socket={socket}
                        pendingPaymentRequest={pendingPaymentRequest}
                        onPaymentRequestHandled={() => setPendingPaymentRequest(null)}
                    />
                ) : (
                    /* Content - Students/Credentials Tab */
                    <div className="data-table rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        <div className="p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {activeTab === "students" ? "Seguimiento de Estudiantes" : "Credenciales Generadas"}
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
                                            {student.emergencyPhone || ""}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {formatDate(student.createdAt)}
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
                                                    className="p-1.5 text-purple-500 hover:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                                                    title="Editar Estudiante"
                                                >
                                                    <Pencil className="w-4 h-4" strokeWidth={2} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Mostrando {((currentPage - 1) * studentsPerPage) + 1} - {Math.min(currentPage * studentsPerPage, filteredStudents.length)} de {filteredStudents.length} estudiantes
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: '#014287', color: 'white' }}
                                >
                                    Anterior
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? 'text-white' : ''}`}
                                                style={currentPage === pageNum 
                                                    ? { background: '#014287' } 
                                                    : { background: 'var(--surface)', color: 'var(--text-secondary)' }
                                                }
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: '#014287', color: 'white' }}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                )}
                </>
                )}
            </main>

            {/* Modal: Crear Estudiante */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-5 max-w-sm w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Estudiante</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Juan Pérez García"
                                    className={`w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.name ? "border-red-500" : ""}`}
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="estudiante@email.com"
                                    className={`w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.email ? "border-red-500" : ""}`}
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.email && <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>}
                            </div>

                            {/* Teléfono de Emergencia */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Tel. Emergencia (Tutor)
                                </label>
                                <input
                                    type="tel"
                                    value={formData.emergencyPhone}
                                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                                    placeholder="55 1234 5678"
                                    className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Nivel */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Nivel
                                </label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value as NewStudentForm["level"] })}
                                    className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: '#1f2937', border: '1px solid var(--input-border)', color: '#ffffff' }}
                                >
                                    <option value="Beginner" style={{ background: '#1f2937', color: '#ffffff' }}>Beginner</option>
                                    <option value="Intermediate" style={{ background: '#1f2937', color: '#ffffff' }}>Intermediate</option>
                                    <option value="Advanced" style={{ background: '#1f2937', color: '#ffffff' }}>Advanced</option>
                                </select>
                            </div>

                            {/* Precio/Mensualidad */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Mensualidad
                                </label>
                                <select
                                    value={formData.priceOption}
                                    onChange={(e) => setFormData({ ...formData, priceOption: e.target.value, customPrice: "" })}
                                    className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: '#1f2937', border: '1px solid var(--input-border)', color: '#ffffff' }}
                                >
                                    {PRICE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value} style={{ background: '#1f2937', color: '#ffffff' }}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Campo de precio personalizado */}
                            {formData.priceOption === "custom" && (
                                <div>
                                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                        Precio Personalizado
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.customPrice}
                                            onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
                                            placeholder="0.00"
                                            className={`w-full pl-7 pr-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.customPrice ? "border-red-500" : ""}`}
                                            style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.customPrice ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                    {formErrors.customPrice && <p className="mt-1 text-sm text-red-500">{formErrors.customPrice}</p>}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={handleCreateStudent}
                                disabled={isCreating}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
                            >
                                {isCreating ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-4 w-4" strokeWidth={2} />
                                        Creando...
                                    </span>
                                ) : (
                                    "Crear y Generar Credencial"
                                )}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2.5 font-medium rounded-lg transition-colors text-sm"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Ver Credencial - Componente separado */}
            {selectedStudent && (
                <CredentialModal
                    student={selectedStudent}
                    isOpen={showCredentialModal}
                    onClose={() => setShowCredentialModal(false)}
                />
            )}

            {/* Modal: Editar Estudiante */}
            {showEditStudentModal && studentToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-5 max-w-sm w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Pencil className="w-4 h-4 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Editar Estudiante</h3>
                                    <p className="text-xs font-mono text-cyan-500">#{studentToEdit.studentNumber}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowEditStudentModal(false);
                                    setStudentToEdit(null);
                                }} 
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre Completo</label>
                                <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    placeholder="Nombre del estudiante"
                                    className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${editFormErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {editFormErrors.name && <p className="mt-1 text-xs text-red-500">{editFormErrors.name}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                                <input
                                    type="email"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${editFormErrors.email ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {editFormErrors.email && <p className="mt-1 text-xs text-red-500">{editFormErrors.email}</p>}
                            </div>

                            {/* Teléfono de Emergencia */}
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tel. Emergencia (Tutor)</label>
                                <input
                                    type="tel"
                                    value={editFormData.emergencyPhone}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setEditFormData({ ...editFormData, emergencyPhone: value });
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
                                    <option value="Beginner" style={{ background: '#1f2937', color: '#ffffff' }}>Beginner</option>
                                    <option value="Intermediate" style={{ background: '#1f2937', color: '#ffffff' }}>Intermediate</option>
                                    <option value="Advanced" style={{ background: '#1f2937', color: '#ffffff' }}>Advanced</option>
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
                                {isEditing ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-4 w-4" strokeWidth={2} />
                                        Guardando...
                                    </span>
                                ) : (
                                    "Guardar Cambios"
                                )}
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
            )}

            {/* Modal de confirmación para activar/desactivar estudiante */}
            {showStatusModal && studentToToggle && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
                    <div className="rounded-xl shadow-2xl max-w-sm w-full p-5" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${studentToToggle.status === "active" ? "bg-red-500/20" : "bg-green-500/20"}`}>
                                {studentToToggle.status === "active" ? (
                                    <UserX className="w-5 h-5 text-red-500" strokeWidth={2} />
                                ) : (
                                    <UserCheck className="w-5 h-5 text-green-500" strokeWidth={2} />
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                                    {studentToToggle.status === "active" ? "Desactivar Estudiante" : "Activar Estudiante"}
                                </h3>
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>#{studentToToggle.studentNumber}</p>
                            </div>
                        </div>

                        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                            {studentToToggle.status === "active" 
                                ? `¿Estás seguro de que deseas desactivar a "${studentToToggle.name}"?`
                                : `¿Estás seguro de que deseas activar a "${studentToToggle.name}"?`
                            }
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmToggleStatus}
                                disabled={isTogglingStatus}
                                className={`flex-1 px-4 py-2.5 text-white font-medium rounded-lg transition-all disabled:opacity-50 hover:opacity-90 text-sm ${studentToToggle.status === "active" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
                            >
                                {isTogglingStatus ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin h-4 w-4" strokeWidth={2} />
                                        Procesando...
                                    </span>
                                ) : (
                                    studentToToggle.status === "active" ? "Sí, Desactivar" : "Sí, Activar"
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setStudentToToggle(null);
                                }}
                                className="px-4 py-2.5 font-medium rounded-lg transition-colors text-sm"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

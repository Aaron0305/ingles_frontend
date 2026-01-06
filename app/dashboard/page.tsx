"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import CredentialModal, { Student } from "./credential";
import PaymentsPanel, { PaymentRecord } from "./payments";
import { studentsApi, paymentsApi, authApi } from "@/lib/api";

// ============================================
// TIPOS
// ============================================

interface NewStudentForm {
    name: string;
    email: string;
    level: "Beginner" | "Intermediate" | "Advanced";
}

// ============================================
// CONSTANTES
// ============================================

const PRICE_BY_LEVEL = {
    Beginner: 500,
    Intermediate: 600,
    Advanced: 700,
} as const;

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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [formData, setFormData] = useState<NewStudentForm>({
        name: "",
        email: "",
        level: "Beginner",
    });
    const [formErrors, setFormErrors] = useState<Partial<NewStudentForm>>({});
    
    // Socket para comunicación en tiempo real
    const [socket, setSocket] = useState<Socket | null>(null);

    // ============================================
    // EFECTOS
    // ============================================
    
    // Inicializar Socket.io
    useEffect(() => {
        const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? 'https://ingles-backend.vercel.app'
            : 'http://localhost:3001';
            
        const newSocket = io(SOCKET_URL, {
            path: "/api/socket",
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("✅ Socket conectado - Admin registrado");
            // Registrar como admin
            newSocket.emit("register-admin");
        });

        newSocket.on("disconnect", () => {
            console.log("❌ Socket desconectado");
        });

        newSocket.on("connect_error", (error) => {
            console.error("Error de conexión socket:", error);
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
        const errors: Partial<NewStudentForm> = {};

        if (!formData.name.trim()) {
            errors.name = "El nombre es requerido";
        }

        if (!formData.email.trim()) {
            errors.email = "El email es requerido";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = "Email inválido";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateStudent = async () => {
        if (!validateForm()) return;

        setIsCreating(true);

        try {
            // Llamada real al backend
            const newStudent = await studentsApi.create({
                name: formData.name,
                email: formData.email,
                level: formData.level,
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
            setFormData({ name: "", email: "", level: "Beginner" });
        } catch (error) {
            console.error("Error creando estudiante:", error);
            const message = error instanceof Error ? error.message : "Error al crear estudiante";
            setFormErrors({ email: message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleViewCredential = (student: Student) => {
        setSelectedStudent(student);
        setShowCredentialModal(true);
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

    const handleToggleStudentStatus = async (studentId: string) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        try {
            const updatedStudent = await studentsApi.toggleStatus(studentId, student.status);
            setStudents(prev => prev.map(s => 
                s.id === studentId ? { ...s, status: updatedStudent.status } : s
            ));
        } catch (error) {
            console.error("Error actualizando estado:", error);
        }
    };

    const handleDeleteStudent = (student: Student) => {
        setStudentToDelete(student);
        setShowDeleteModal(true);
    };

    const confirmDeleteStudent = async () => {
        if (studentToDelete) {
            try {
                await studentsApi.delete(studentToDelete.id);
                setStudents(prev => prev.filter(student => student.id !== studentToDelete.id));
                setPayments(prev => prev.filter(payment => payment.studentId !== studentToDelete.id));
            } catch (error) {
                console.error("Error eliminando estudiante:", error);
            } finally {
                setShowDeleteModal(false);
                setStudentToDelete(null);
            }
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

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="dashboard-container min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Header */}
            <header className="dashboard-header sticky top-0 z-40" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
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
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Estudiantes</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{students.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Activos</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{students.filter((s) => s.status === "active").length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Credenciales</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{students.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ingresos Mes</p>
                                <p className="text-2xl font-bold text-green-500">
                                    ${students.reduce((acc, s) => acc + (s.status === "active" ? s.monthlyFee : 0), 0).toLocaleString()}
                                </p>
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
                                    ? "bg-blue-600 text-white"
                                    : ""
                                }`}
                            style={activeTab !== "students" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            Estudiantes
                        </button>
                        <button
                            onClick={() => setActiveTab("payments")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "payments"
                                    ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                                    : ""
                                }`}
                            style={activeTab !== "payments" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pagos
                        </button>
                    </div>

                    {activeTab !== "payments" && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium hover:from-blue-700 hover:to-cyan-700 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
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
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
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
                            className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        >
                            <option value="all">Todos los niveles</option>
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                        </select>
                        
                        {/* Filtro por estado */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="active">Activos</option>
                            <option value="inactive">Inactivos</option>
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
                                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                            No. Estudiante
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                            Estudiante
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                            Nivel
                                        </th>
                                        {activeTab === "students" ? (
                                            <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                                Fecha Inscripción
                                            </th>
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                                    Mensualidad
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                                    Vence
                                                </th>
                                            </>
                                        )}
                                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                            Estado
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                            Acciones
                                        </th>
                                    </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className="table-row-hover transition-colors" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-mono text-cyan-500">{student.studentNumber}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{student.name}</p>
                                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{student.email}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getLevelBadge(student.level)}`}>
                                                {student.level}
                                            </span>
                                        </td>
                                        {activeTab === "students" ? (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                {student.createdAt}
                                            </td>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-semibold text-green-500">${student.monthlyFee}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                    {student.expiresAt}
                                                </td>
                                            </>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${student.status === "active"
                                                    ? "bg-green-500/20 text-green-500"
                                                    : "bg-gray-500/20 text-gray-500"
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${student.status === "active" ? "bg-green-500" : "bg-gray-500"}`} />
                                                {student.status === "active" ? "Activo" : "Inactivo"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewCredential(student)}
                                                    className="p-2 text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                                    title="Ver Credencial"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStudentStatus(student.id)}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        student.status === "active" 
                                                            ? "text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" 
                                                            : "text-green-500 hover:text-green-400 bg-green-500/10 hover:bg-green-500/20"
                                                    }`}
                                                    title={student.status === "active" ? "Desactivar" : "Activar"}
                                                >
                                                    {student.status === "active" ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteStudent(student)}
                                                    className="p-2 text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}
                </>
                )}
            </main>

            {/* Modal: Crear Estudiante */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Estudiante</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Nombre Completo
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Juan Pérez García"
                                    className={`w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.name ? "border-red-500" : ""}`}
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="estudiante@email.com"
                                    className={`w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.email ? "border-red-500" : ""}`}
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.email && <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>}
                            </div>

                            {/* Nivel */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                    Nivel
                                </label>
                                <select
                                    value={formData.level}
                                    onChange={(e) => setFormData({ ...formData, level: e.target.value as NewStudentForm["level"] })}
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                >
                                    <option value="Beginner">Beginner - $500/mes</option>
                                    <option value="Intermediate">Intermediate - $600/mes</option>
                                    <option value="Advanced">Advanced - $700/mes</option>
                                </select>
                            </div>

                            {/* Info de precio */}
                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <p className="text-sm text-blue-500">
                                    <span className="font-medium">Mensualidad:</span> ${PRICE_BY_LEVEL[formData.level]}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                    El precio se determina por el nivel seleccionado
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateStudent}
                                disabled={isCreating}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                            >
                                {isCreating ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Creando...
                                    </span>
                                ) : (
                                    "Crear y Generar Credencial"
                                )}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-3 font-medium rounded-lg transition-colors"
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

            {/* Modal: Confirmar Eliminación */}
            {showDeleteModal && studentToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        {/* Header con icono de advertencia */}
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                                Eliminar Estudiante
                            </h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                ¿Estás seguro de eliminar a <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{studentToDelete.name}</span>?
                            </p>
                            <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                Esta acción eliminará todos los datos del estudiante incluyendo su historial de pagos. No se puede deshacer.
                            </p>
                        </div>

                        {/* Info del estudiante a eliminar */}
                        <div className="p-4 rounded-lg mb-6" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                                    {studentToDelete.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{studentToDelete.name}</p>
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{studentToDelete.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setStudentToDelete(null);
                                }}
                                className="flex-1 px-4 py-3 font-medium rounded-lg transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteStudent}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition-all"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

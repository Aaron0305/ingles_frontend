"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CredentialModal, { Student } from "../dashboard/credential";
import PaymentsPanel, { PaymentRecord } from "../dashboard/payments";
import { studentsApi, adminsApi, paymentsApi, authApi } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";

// ============================================
// TIPOS
// ============================================

interface Admin {
    id: string;
    name: string;
    email: string;
    role: "admin" | "superadmin";
    createdAt: string;
    status: "active" | "inactive";
    lastLogin?: string;
}

interface NewAdminForm {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
}

interface NewStudentForm {
    name: string;
    email: string;
    level: "Beginner" | "Intermediate" | "Advanced";
}

type TabType = "students" | "credentials" | "payments" | "admins" | "reports";

// ============================================
// CONSTANTES
// ============================================

const PRICE_BY_LEVEL = {
    Beginner: 500,
    Intermediate: 600,
    Advanced: 700,
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SuperAdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("students");
    const [students, setStudents] = useState<Student[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modales
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCredentialModal, setShowCredentialModal] = useState(false);
    const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeleteAdminModal, setShowDeleteAdminModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
    const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    
    // Filtros y búsqueda
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    
    // Formularios
    const [formData, setFormData] = useState<NewStudentForm>({
        name: "",
        email: "",
        level: "Beginner",
    });
    const [adminFormData, setAdminFormData] = useState<NewAdminForm>({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [formErrors, setFormErrors] = useState<Partial<NewStudentForm>>({});
    const [adminFormErrors, setAdminFormErrors] = useState<Partial<NewAdminForm & { confirmPassword?: string }>>({});
    const [isCreating, setIsCreating] = useState(false);

    // ============================================
    // EFECTOS
    // ============================================

    useEffect(() => {
        // Verificar autenticación de super admin
        const userType = localStorage.getItem("userType");
        if (userType !== "superadmin") {
            router.push("/login");
            return;
        }

        // Cargar datos del backend
        loadData();
    }, [router]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [studentsData, adminsData, paymentsData] = await Promise.all([
                studentsApi.getAll(),
                adminsApi.getAll(),
                paymentsApi.getAll(),
            ]);
            
            // Transformar datos para compatibilidad con el componente
            const transformedStudents: Student[] = studentsData.map(s => ({
                ...s,
                progress: 0,
                lastAccess: s.lastAccess || "Nunca",
            }));

            const transformedAdmins: Admin[] = adminsData.map(a => ({
                ...a,
                lastLogin: undefined,
            }));
            
            setStudents(transformedStudents);
            setAdmins(transformedAdmins);
            setPayments(paymentsData);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // HANDLERS - ESTUDIANTES
    // ============================================

    const handleLogout = () => {
        authApi.logout();
        router.push("/login");
    };

    const validateStudentForm = (): boolean => {
        const errors: Partial<NewStudentForm> = {};
        if (!formData.name.trim()) errors.name = "Nombre requerido";
        if (!formData.email.trim()) errors.email = "Email requerido";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = "Email inválido";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateStudent = async () => {
        if (!validateStudentForm()) return;
        setIsCreating(true);

        try {
            const newStudent = await studentsApi.create({
                name: formData.name,
                email: formData.email,
                level: formData.level,
            });

            const studentWithProgress: Student = {
                ...newStudent,
                progress: 0,
                lastAccess: "Nunca",
            };

            setStudents((prev) => [...prev, studentWithProgress]);
            setSelectedStudent(studentWithProgress);
            setShowCreateModal(false);
            setShowCredentialModal(true);
            setFormData({ name: "", email: "", level: "Beginner" });
        } catch (error) {
            console.error("Error creando estudiante:", error);
            const message = error instanceof Error ? error.message : "Error al crear";
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
            const newPayment = await paymentsApi.create({
                studentId,
                month,
                year,
                amount: student.monthlyFee,
            });

            // Actualizar o agregar el pago
            setPayments(prev => {
                const existingIndex = prev.findIndex(p => p.studentId === studentId && p.month === month && p.year === year);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = newPayment;
                    return updated;
                }
                return [...prev, newPayment];
            });
        } catch (error) {
            console.error("Error registrando pago:", error);
        }
    };

    const handlePaymentRevoke = async (studentId: string, month: number, year: number) => {
        try {
            await paymentsApi.revoke(studentId, month, year);
            
            // Actualizar estado local - cambiar a pending
            setPayments(prev => prev.map(p => 
                p.studentId === studentId && p.month === month && p.year === year
                    ? { ...p, status: "pending" as const, paidAt: undefined }
                    : p
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

    // ============================================
    // HANDLERS - ADMINISTRADORES
    // ============================================

    const validateAdminForm = (): boolean => {
        const errors: Partial<NewAdminForm & { confirmPassword?: string }> = {};
        
        if (!adminFormData.name.trim()) errors.name = "Nombre requerido";
        if (!adminFormData.email.trim()) errors.email = "Email requerido";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminFormData.email)) {
            errors.email = "Email inválido";
        }
        if (!adminFormData.password) errors.password = "Contraseña requerida";
        else if (adminFormData.password.length < 6) {
            errors.password = "Mínimo 6 caracteres";
        }
        if (adminFormData.password !== adminFormData.confirmPassword) {
            errors.confirmPassword = "Las contraseñas no coinciden";
        }
        
        setAdminFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateAdmin = async () => {
        if (!validateAdminForm()) return;
        setIsCreating(true);

        try {
            const newAdmin = await adminsApi.create({
                name: adminFormData.name,
                email: adminFormData.email,
                password: adminFormData.password,
                role: "admin",
            });

            const adminWithLastLogin: Admin = {
                ...newAdmin,
                lastLogin: undefined,
            };

            setAdmins((prev) => [...prev, adminWithLastLogin]);
            setShowCreateAdminModal(false);
            setAdminFormData({ name: "", email: "", password: "", confirmPassword: "" });
        } catch (error) {
            console.error("Error creando admin:", error);
            const message = error instanceof Error ? error.message : "Error al crear";
            setAdminFormErrors({ email: message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleAdminStatus = (adminId: string) => {
        setAdmins(prev => prev.map(admin => 
            admin.id === adminId 
                ? { ...admin, status: admin.status === "active" ? "inactive" : "active" }
                : admin
        ));
    };

    const handleDeleteAdmin = (admin: Admin) => {
        setAdminToDelete(admin);
        setShowDeleteAdminModal(true);
    };

    const confirmDeleteAdmin = async () => {
        if (adminToDelete) {
            try {
                await adminsApi.delete(adminToDelete.id);
                setAdmins(prev => prev.filter(admin => admin.id !== adminToDelete.id));
            } catch (error) {
                console.error("Error eliminando admin:", error);
            } finally {
                setShowDeleteAdminModal(false);
                setAdminToDelete(null);
            }
        }
    };

    // ============================================
    // FILTROS Y ESTADÍSTICAS
    // ============================================

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

    // Estadísticas para reportes
    const getMonthlyIncome = () => {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        return payments
            .filter(p => p.status === "paid" && p.month === currentMonth && p.year === currentYear)
            .reduce((acc, p) => acc + p.amount, 0);
    };

    const getStudentsByLevel = () => ({
        Beginner: students.filter(s => s.level === "Beginner").length,
        Intermediate: students.filter(s => s.level === "Intermediate").length,
        Advanced: students.filter(s => s.level === "Advanced").length,
    });

    const getDropoutRate = () => {
        const inactive = students.filter(s => s.status === "inactive").length;
        return students.length > 0 ? ((inactive / students.length) * 100).toFixed(1) : "0";
    };

    // ============================================
    // HELPERS
    // ============================================

    const getLevelBadge = (level: string) => {
        switch (level) {
            case "Beginner":
                return "bg-blue-500/20 text-blue-500 border-blue-500/30";
            case "Intermediate":
                return "bg-amber-500/20 text-amber-500 border-amber-500/30";
            case "Advanced":
                return "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
            default:
                return "bg-gray-500/20 text-gray-500 border-gray-500/30";
        }
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
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Super Admin</h1>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Panel de Control Principal</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-500">
                                Super Administrador
                            </span>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                        <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>Cargando datos...</span>
                    </div>
                ) : (
                <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Estudiantes</p>
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Admins</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{admins.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="stats-card">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ingresos</p>
                                <p className="text-2xl font-bold text-green-500">
                                    ${payments.filter(p => p.status === "paid").reduce((acc, p) => acc + p.amount, 0).toLocaleString()}
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
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "students" ? "bg-blue-600 text-white" : ""}`}
                            style={activeTab !== "students" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            Estudiantes
                        </button>
                        <button
                            onClick={() => setActiveTab("payments")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "payments" ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white" : ""}`}
                            style={activeTab !== "payments" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pagos
                        </button>
                        <button
                            onClick={() => setActiveTab("admins")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "admins" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : ""}`}
                            style={activeTab !== "admins" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Administradores
                        </button>
                        <button
                            onClick={() => setActiveTab("reports")}
                            className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "reports" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : ""}`}
                            style={activeTab !== "reports" ? { background: 'var(--surface)', color: 'var(--text-secondary)' } : {}}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Reportes
                        </button>
                    </div>

                    {activeTab !== "payments" && activeTab !== "admins" && activeTab !== "reports" && (
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

                    {activeTab === "admins" && (
                        <button
                            onClick={() => setShowCreateAdminModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            Nuevo Administrador
                        </button>
                    )}
                </div>

                {/* Barra de búsqueda y filtros - Solo para estudiantes y credenciales */}
                {(activeTab === "students" || activeTab === "credentials") && (
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

                {/* Content - Reports Tab */}
                {activeTab === "reports" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Reporte de Ingresos Mensuales */}
                        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Ingresos del Mes</h3>
                            </div>
                            <p className="text-4xl font-bold text-green-500 mb-2">${getMonthlyIncome().toLocaleString()}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                            </p>
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    Total acumulado: <span className="font-semibold text-green-500">${payments.filter(p => p.status === "paid").reduce((acc, p) => acc + p.amount, 0).toLocaleString()}</span>
                                </p>
                            </div>
                        </div>

                        {/* Estudiantes por Nivel */}
                        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Estudiantes por Nivel</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium text-blue-500">Beginner</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getStudentsByLevel().Beginner}</span>
                                    </div>
                                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${students.length > 0 ? (getStudentsByLevel().Beginner / students.length) * 100 : 0}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium text-yellow-500">Intermediate</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getStudentsByLevel().Intermediate}</span>
                                    </div>
                                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                                        <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${students.length > 0 ? (getStudentsByLevel().Intermediate / students.length) * 100 : 0}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-medium text-green-500">Advanced</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getStudentsByLevel().Advanced}</span>
                                    </div>
                                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${students.length > 0 ? (getStudentsByLevel().Advanced / students.length) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tasa de Deserción */}
                        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tasa de Deserción</h3>
                            </div>
                            <p className="text-4xl font-bold mb-2" style={{ color: Number(getDropoutRate()) > 20 ? '#ef4444' : Number(getDropoutRate()) > 10 ? '#f59e0b' : '#22c55e' }}>
                                {getDropoutRate()}%
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {students.filter(s => s.status === "inactive").length} de {students.length} estudiantes inactivos
                            </p>
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    {Number(getDropoutRate()) <= 10 ? "✅ Excelente retención" : Number(getDropoutRate()) <= 20 ? "⚠️ Atención moderada" : "🚨 Requiere acción"}
                                </p>
                            </div>
                        </div>

                        {/* Resumen General */}
                        <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Resumen General</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-alt)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Total Estudiantes</span>
                                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{students.length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-alt)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Estudiantes Activos</span>
                                    <span className="font-bold text-green-500">{students.filter(s => s.status === "active").length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-alt)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Administradores</span>
                                    <span className="font-bold text-purple-500">{admins.length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-alt)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Pagos Registrados</span>
                                    <span className="font-bold text-blue-500">{payments.filter(p => p.status === "paid").length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === "payments" ? (
                    <PaymentsPanel
                        students={students}
                        payments={payments}
                        onPaymentConfirm={handlePaymentConfirm}
                        onPaymentRevoke={handlePaymentRevoke}
                    />
                ) : activeTab === "admins" ? (
                    /* Content - Admins Tab */
                    <div className="data-table rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        <div className="p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Gestión de Administradores
                            </h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                Los administradores pueden gestionar estudiantes, credenciales y pagos
                            </p>
                        </div>
                        
                        <div className="grid gap-4 p-6">
                            {admins.map((admin) => (
                                <div 
                                    key={admin.id} 
                                    className="flex items-center justify-between p-4 rounded-xl transition-colors"
                                    style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                            {admin.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{admin.name}</h3>
                                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{admin.email}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                    Creado: {new Date(admin.createdAt).toLocaleDateString()}
                                                </span>
                                                {admin.lastLogin && (
                                                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                        • Último acceso: {admin.lastLogin}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            admin.status === "active" 
                                                ? "bg-green-500/20 text-green-500" 
                                                : "bg-gray-500/20 text-gray-500"
                                        }`}>
                                            {admin.status === "active" ? "Activo" : "Inactivo"}
                                        </span>
                                        
                                        <button
                                            onClick={() => handleToggleAdminStatus(admin.id)}
                                            className="p-2 rounded-lg transition-colors hover:bg-amber-500/20"
                                            title={admin.status === "active" ? "Desactivar" : "Activar"}
                                        >
                                            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={admin.status === "active" 
                                                    ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                                    : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                } />
                                            </svg>
                                        </button>
                                        
                                        <button
                                            onClick={() => handleDeleteAdmin(admin)}
                                            className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                                            title="Eliminar"
                                        >
                                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            
                            {admins.length === 0 && (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p style={{ color: 'var(--text-secondary)' }}>No hay administradores registrados</p>
                                    <button
                                        onClick={() => setShowCreateAdminModal(true)}
                                        className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors"
                                    >
                                        Crear primer administrador
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
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
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setShowQRModal(true);
                                                        }}
                                                        className="p-2 text-purple-500 hover:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                                                        title="Ver QR de Pago"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
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
                            <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Nombre Completo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Juan Pérez García"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="estudiante@email.com"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {formErrors.email && <p className="mt-1 text-sm text-red-500">{formErrors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Nivel</label>
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

                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <p className="text-sm text-blue-500">
                                    <span className="font-medium">Mensualidad:</span> ${PRICE_BY_LEVEL[formData.level]}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateStudent}
                                disabled={isCreating}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                            >
                                {isCreating ? "Creando..." : "Crear y Generar Credencial"}
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

            {/* Modal: Crear Admin */}
            {showCreateAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Administrador</h3>
                            </div>
                            <button onClick={() => setShowCreateAdminModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Nombre Completo</label>
                                <input
                                    type="text"
                                    value={adminFormData.name}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                                    placeholder="Carlos Administrador"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${adminFormErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {adminFormErrors.name && <p className="mt-1 text-sm text-red-500">{adminFormErrors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
                                <input
                                    type="email"
                                    value={adminFormData.email}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                                    placeholder="admin@academia.com"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${adminFormErrors.email ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {adminFormErrors.email && <p className="mt-1 text-sm text-red-500">{adminFormErrors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
                                <input
                                    type="password"
                                    value={adminFormData.password}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${adminFormErrors.password ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {adminFormErrors.password && <p className="mt-1 text-sm text-red-500">{adminFormErrors.password}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    value={adminFormData.confirmPassword}
                                    onChange={(e) => setAdminFormData({ ...adminFormData, confirmPassword: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${adminFormErrors.confirmPassword ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {adminFormErrors.confirmPassword && <p className="mt-1 text-sm text-red-500">{adminFormErrors.confirmPassword}</p>}
                            </div>

                            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                                <p className="text-sm text-purple-500">
                                    <span className="font-medium">Permisos:</span> Este administrador podrá gestionar estudiantes, credenciales y pagos.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateAdmin}
                                disabled={isCreating}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
                            >
                                {isCreating ? "Creando..." : "Crear Administrador"}
                            </button>
                            <button
                                onClick={() => setShowCreateAdminModal(false)}
                                className="px-4 py-3 font-medium rounded-lg transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Ver Credencial */}
            {selectedStudent && (
                <CredentialModal
                    student={selectedStudent}
                    isOpen={showCredentialModal}
                    onClose={() => setShowCredentialModal(false)}
                />
            )}

            {/* Modal: Confirmar Eliminación de Estudiante */}
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

            {/* Modal: Confirmar Eliminación de Administrador */}
            {showDeleteAdminModal && adminToDelete && (
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
                                Eliminar Administrador
                            </h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                ¿Estás seguro de eliminar a <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{adminToDelete.name}</span>?
                            </p>
                            <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                Este administrador perderá acceso al sistema. Esta acción no se puede deshacer.
                            </p>
                        </div>

                        {/* Info del administrador a eliminar */}
                        <div className="p-4 rounded-lg mb-6" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                    {adminToDelete.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{adminToDelete.name}</p>
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{adminToDelete.email}</p>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-500 mt-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        {adminToDelete.role === "admin" ? "Administrador" : "Super Admin"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteAdminModal(false);
                                    setAdminToDelete(null);
                                }}
                                className="flex-1 px-4 py-3 font-medium rounded-lg transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteAdmin}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition-all"
                            >
                                Sí, Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: QR de Pago */}
            {showQRModal && selectedStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                QR de Pago
                            </h3>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Info del estudiante */}
                        <div className="p-4 rounded-lg mb-6" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                    {selectedStudent.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedStudent.name}</p>
                                    <p className="text-sm font-mono text-cyan-500">#{selectedStudent.studentNumber}</p>
                                </div>
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center p-6 bg-white rounded-xl mb-6">
                            <QRCodeSVG
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/scan/${selectedStudent.id}`}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                            <p className="text-xs text-gray-500 mt-3 text-center">
                                Escanea este código para registrar el pago
                            </p>
                        </div>

                        {/* URL de pago */}
                        <div className="p-3 rounded-lg mb-6 overflow-hidden" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}>
                            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>URL de pago:</p>
                            <p className="text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
                                {typeof window !== 'undefined' ? `${window.location.origin}/pay/scan/${selectedStudent.id}` : ''}
                            </p>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/pay/scan/${selectedStudent.id}`;
                                    navigator.clipboard.writeText(url);
                                    alert('URL copiada al portapapeles');
                                }}
                                className="flex-1 px-4 py-3 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copiar URL
                            </button>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

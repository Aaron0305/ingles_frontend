"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import CredentialModal, { Student } from "../dashboard/credential";
import PaymentsPanel, { PaymentRecord } from "../dashboard/payments";
import CredentialsPanel from "../dashboard/credentials-panel";
import ReportsPanel from "../dashboard/reports-panel";
import StudentsPanel from "../dashboard/students-panel"; // Importado
import CalendarPanel from "../dashboard/calendar";
import { studentsApi, adminsApi, paymentsApi, authApi } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import {
    ShieldCheck, Users, CheckCircle, CircleDollarSign,
    BarChart3, Plus, UserPlus, X, Trash2, Ban,
    Copy, AlertTriangle, Shield, LogOut, User, Phone,
    GraduationCap, CreditCard, CalendarDays, Banknote, ArrowRightLeft
} from "lucide-react";
import Image from "next/image";

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
    studentPhone: string;
    emergencyPhone: string;
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
    priceOption: string;
    customPrice: string;
    paymentScheme: "daily" | "weekly" | "biweekly" | "monthly_28";
    classDays: number[];
    enrollmentDate: string;
    enrollmentFee: string;
    enrollmentPaymentMethod: "efectivo" | "transferencia";
}

interface EditStudentForm {
    name: string;
    email: string;
    emergencyPhone: string;
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
}

type TabType = "students" | "credentials" | "payments" | "admins" | "reports" | "calendar";

// ============================================
// CONSTANTES
// ============================================

const PRICE_OPTIONS = [
    { value: "760", label: "$760" },
    { value: "750", label: "$750" },
    { value: "790", label: "$790" },
    { value: "650", label: "$650" },
    { value: "149.50", label: "$149.50" },
    { value: "custom", label: "Otro (personalizado)" },
] as const;

const EMAIL_DOMAINS = [
    { value: "gmail.com", label: "@gmail.com" },
    { value: "hotmail.com", label: "@hotmail.com" },
    { value: "outlook.com", label: "@outlook.com" },
    { value: "yahoo.com", label: "@yahoo.com" },
] as const;


// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function SuperAdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("students");
    const [students, setStudents] = useState<Student[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]); // Pagos consolidados por período
    const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]); // Pagos individuales para reportes (historial completo)
    const [isLoading, setIsLoading] = useState(true);

    // Modales
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCredentialModal, setShowCredentialModal] = useState(false);
    const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
    const [showDeleteAdminModal, setShowDeleteAdminModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);

    const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);



    // Estado del rol del usuario
    const [userRole, setUserRole] = useState<"admin" | "superadmin">("admin");

    // Estado para solicitud de pago pendiente (QR)
    const [pendingPaymentRequest, setPendingPaymentRequest] = useState<{
        studentId: string;
        studentName: string;
        studentNumber: string;
        pendingMonth: number;
        pendingYear: number;
        monthlyFee: number;
    } | null>(null);




    // Formularios
    const [formData, setFormData] = useState<NewStudentForm>({
        name: "",
        email: "",
        studentPhone: "",
        emergencyPhone: "",
        level: "Beginner 1",
        priceOption: "760",
        customPrice: "",
        paymentScheme: "monthly_28",
        classDays: [],
        enrollmentDate: new Date().toLocaleDateString('en-CA'),
        enrollmentFee: "0",
        enrollmentPaymentMethod: "efectivo",
    });
    const [adminFormData, setAdminFormData] = useState<NewAdminForm>({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [emailDomain, setEmailDomain] = useState("gmail.com");
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [adminFormErrors, setAdminFormErrors] = useState<Partial<NewAdminForm & { confirmPassword?: string }>>({});
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Auto-dismiss del toast de notificación
    useEffect(() => {
        if (saveMessage) {
            const timer = setTimeout(() => setSaveMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveMessage]);

    // Socket para comunicación en tiempo real
    const [socket, setSocket] = useState<Socket | null>(null);



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
                console.log(" Enviando autenticación (Super Admin)...");
                newSocket.emit("authenticate", { token });
            } else {
                console.error("❌ No hay token para autenticar socket");
            }
        };

        newSocket.on("connect", () => {
            console.log(" Socket conectado (Super Admin) - ID:", newSocket.id);
            authenticateAndRegister();
        });

        // Cuando se reconecta, volver a autenticar
        newSocket.on("reconnect", () => {
            console.log(" Socket reconectado - re-autenticando...");
            authenticateAndRegister();
        });

        // Cuando la autenticación es exitosa, registrarse como admin
        newSocket.on("auth-success", (data) => {
            console.log(" Socket autenticado:", data.user?.name);
            newSocket.emit("register-admin");
            console.log(" Solicitando registro como admin...");
        });

        newSocket.on("registered", (data) => {
            console.log(" Registrado como admin correctamente:", data);
        });

        newSocket.on("auth-failed", (data) => {
            console.error(" Autenticación de socket fallida:", data.message);
        });

        // Escuchar solicitudes de pago (QR)
        newSocket.on("payment-request", (data: any) => {
            console.log(" Solicitud de pago recibida (Super Admin):", data);
            setPendingPaymentRequest(data);
            setActiveTab("payments");

            // Reproducir sonido de notificación
            try {
                const audio = new Audio("/sounds/notification.mp3");
                audio.play().catch(() => { });
            } catch (error) {
                console.error("Error reproduciendo audio", error);
            }
        });

        newSocket.on("disconnect", (reason) => {
            console.log(" Socket desconectado. Razón:", reason);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Error de conexión socket:", error.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        // Verificar autenticación
        const userTypeString = localStorage.getItem("userType");
        const userType = userTypeString as "admin" | "superadmin" | null;

        if (userType !== "superadmin" && userType !== "admin") {
            router.push("/login");
            return;
        }

        if (userType) {
            setUserRole(userType);
        }

        // Cargar datos del backend
        loadData();
    }, [router]);

    const loadData = async () => {
        setIsLoading(true);
        const userType = localStorage.getItem("userType");

        try {
            const promises: Promise<any>[] = [
                studentsApi.getAll(),
                paymentsApi.getAll(),      // Pagos consolidados (para UI de pagos)
                paymentsApi.getAllRaw(),   // Pagos individuales (historial completo para reportes)
            ];

            // Solo cargar admins si es superadmin
            if (userType === 'superadmin') {
                promises.push(adminsApi.getAll());
            }

            const results = await Promise.all(promises);
            const studentsData = results[0];
            const paymentsData = results[1];
            const rawPaymentsData = results[2];
            const adminsData = userType === 'superadmin' ? results[3] : [];

            // Transformar datos para compatibilidad con el componente
            const transformedStudents: Student[] = studentsData.map((s: any) => ({
                ...s,
                progress: 0,
                lastAccess: s.lastAccess || "Nunca",
                level: s.level
            }));

            const transformedAdmins: Admin[] = adminsData.map((a: any) => ({
                ...a,
                lastLogin: undefined,
            }));

            setStudents(transformedStudents);
            setAdmins(transformedAdmins);
            setPayments(paymentsData);
            setRawPayments(rawPaymentsData);  // Pagos individuales para reportes
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
        const errors: Record<string, string> = {};

        // Nombre completo
        if (!formData.name.trim()) {
            errors.name = "El nombre completo es obligatorio";
        } else if (formData.name.trim().length < 3) {
            errors.name = "El nombre debe tener al menos 3 caracteres";
        }

        // Email
        if (!formData.email.trim()) {
            errors.email = "El correo electrónico es obligatorio";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = "Formato de correo electrónico inválido";
        }

        // Teléfono del estudiante (obligatorio, 10 dígitos)
        if (!formData.studentPhone.trim()) {
            errors.studentPhone = "El teléfono del alumno es obligatorio";
        } else if (formData.studentPhone.length !== 10) {
            errors.studentPhone = "El teléfono debe tener exactamente 10 dígitos";
        }

        // Teléfono de emergencia (obligatorio, 10 dígitos)
        if (!formData.emergencyPhone.trim()) {
            errors.emergencyPhone = "El teléfono de emergencia es obligatorio";
        } else if (formData.emergencyPhone.length !== 10) {
            errors.emergencyPhone = "El teléfono debe tener exactamente 10 dígitos";
        }

        // Días de clase (al menos uno)
        if (!formData.classDays || formData.classDays.length === 0) {
            errors.classDays = "Selecciona al menos un día de clase";
        }

        // Fecha de inicio
        if (!formData.enrollmentDate) {
            errors.enrollmentDate = "La fecha de inicio es obligatoria";
        }

        // Pago de inscripción (debe ser un número válido >= 0)
        const enrollmentFeeVal = parseFloat(formData.enrollmentFee);
        if (formData.enrollmentFee === "" || isNaN(enrollmentFeeVal) || enrollmentFeeVal < 0) {
            errors.enrollmentFee = "Ingresa un monto de inscripción válido (mínimo $0)";
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
        if (!validateStudentForm()) return;
        setIsCreating(true);

        // Calcular el precio final
        const finalPrice = formData.priceOption === "custom"
            ? parseFloat(formData.customPrice)
            : parseFloat(formData.priceOption);

        try {
            const newStudent = await studentsApi.create({
                name: formData.name.trim(),
                email: formData.email.trim(),
                level: formData.level,
                monthlyFee: finalPrice,
                studentPhone: formData.studentPhone,
                emergencyPhone: formData.emergencyPhone,
                paymentScheme: formData.paymentScheme,
                classDays: formData.classDays,
                enrollmentDate: formData.enrollmentDate,
            });

            // Registrar pago de inscripción (incluso si es $0, para tener el registro)
            const enrollmentFeeAmount = parseFloat(formData.enrollmentFee) || 0;
            try {
                await paymentsApi.createEnrollment({
                    studentId: newStudent.id,
                    amount: enrollmentFeeAmount,
                    paymentMethod: formData.enrollmentPaymentMethod,
                });
                console.log(`✅ Pago de inscripción registrado: $${enrollmentFeeAmount} (${formData.enrollmentPaymentMethod})`);
            } catch (err) {
                console.error("Error registrando pago de inscripción:", err);
            }

            const studentWithProgress: Student = {
                ...newStudent,
                progress: 0,
                lastAccess: "Nunca",
            };

            setStudents((prev) => [...prev, studentWithProgress]);
            setSelectedStudent(studentWithProgress);
            setShowCreateModal(false);
            setShowCredentialModal(true);
            setFormData({ name: "", email: "", studentPhone: "", emergencyPhone: "", level: "Beginner 1", priceOption: "149.50", customPrice: "", paymentScheme: "monthly_28", classDays: [], enrollmentDate: new Date().toLocaleDateString('en-CA'), enrollmentFee: "0", enrollmentPaymentMethod: "efectivo" });
            setEmailDomain("gmail.com");
        } catch (error) {
            console.error("Error creando estudiante:", error);
            const message = error instanceof Error ? error.message : "Error al crear";
            setFormErrors({ email: message });
        } finally {
            setIsCreating(false);
        }
    };



    const handlePaymentConfirm = async (studentId: string, month: number, year: number, amountPaid?: number, amountExpected?: number, paymentMethod?: "efectivo" | "transferencia") => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        // Si viene un monto pagado del modal, usarlo. Si no, usar la colegiatura completa (por defecto)
        const paymentAmount = amountPaid !== undefined ? amountPaid : student.monthlyFee;

        // Definir monto esperado
        const finalExpected = amountExpected !== undefined ? amountExpected : student.monthlyFee;

        try {
            const newPayment = await paymentsApi.create({
                studentId,
                month,
                year,
                amount: paymentAmount,
                amountExpected: finalExpected,
                paymentMethod: paymentMethod || "efectivo"
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

            // Eliminar el pago de la lista local (ya se borró de la BD)
            setPayments(prev => prev.filter(p =>
                !(p.studentId === studentId && p.month === month && p.year === year)
            ));

            console.log('✅ Pago eliminado correctamente de la base de datos y del estado local');
        } catch (error) {
            console.error("Error eliminando pago:", error);
            throw error; // Re-lanzar para que el componente hijo pueda manejar el error
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
            setFormData({ name: "", email: "", studentPhone: "", emergencyPhone: "", level: "Beginner 1", paymentScheme: "monthly_28", priceOption: "149.50", customPrice: "", classDays: [], enrollmentDate: new Date().toLocaleDateString('en-CA'), enrollmentFee: "0", enrollmentPaymentMethod: "efectivo" });
        } catch (error) {
            console.error("Error creando admin:", error);
            const message = error instanceof Error ? error.message : "Error al crear";
            setAdminFormErrors({ email: message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleAdminStatus = async (adminId: string) => {
        const admin = admins.find(a => a.id === adminId);
        if (!admin) return;

        const newStatus = admin.status === "active" ? "inactive" : "active";

        // Actualizar optimistamente en el frontend
        setAdmins(prev => prev.map(a =>
            a.id === adminId ? { ...a, status: newStatus } : a
        ));

        try {
            await adminsApi.update(adminId, { status: newStatus });
            setSaveMessage({
                type: "success",
                text: `Administrador ${newStatus === "active" ? "activado" : "desactivado"} correctamente`
            });
        } catch (error) {
            console.error("Error actualizando estado del admin:", error);
            // Revertir el cambio si falla
            setAdmins(prev => prev.map(a =>
                a.id === adminId ? { ...a, status: admin.status } : a
            ));
            setSaveMessage({
                type: "error",
                text: "Error al cambiar el estado del administrador"
            });
        }
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



    // ============================================
    // RENDER
    // ============================================

    return (
        <div className="dashboard-container min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Toast de notificación */}
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

            {/* Header */}
            <header className="dashboard-header sticky top-0 z-40" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center p-1.5">
                                <Image
                                    src="/image/logo_mensaje.png"
                                    alt="Logo"
                                    width={28}
                                    height={28}
                                    className="object-contain"
                                />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                                    Sistema Administrativo
                                </h1>
                                <span className="text-xs font-semibold tracking-wider text-blue-500 uppercase">
                                    Panel de Control
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleLogout}
                                className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium text-sm border border-gray-200 dark:border-slate-700 hover:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                                <span className="group-hover:text-red-600 transition-colors">Cerrar Sesión</span>
                                <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                            </button>
                        </div>
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
                        {/* Header Stats - Diseño moderno Super Admin */}
                        <div className="mb-8">
                            <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)', border: '1px solid var(--border-color)' }}>
                                {/* Decoración de fondo - Gradiente radial rojo institucional */}
                                <div className="absolute top-0 left-0 w-96 h-96 rounded-full blur-2xl -translate-y-1/3 -translate-x-1/4" style={{ background: 'radial-gradient(circle, rgba(193, 18, 31, 0.35) 0%, rgba(193, 18, 31, 0.15) 40%, rgba(193, 18, 31, 0) 70%)' }} />
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/15 to-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
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

                                    {/* Separador visual - Solo si se muestran administradores */}
                                    {userRole === "superadmin" && (
                                        <div className="hidden lg:block w-px h-16 bg-gradient-to-b from-transparent via-gray-500/30 to-transparent" />
                                    )}

                                    {/* Administradores */}
                                    {userRole === "superadmin" && (
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                                <ShieldCheck className="w-7 h-7 text-white" strokeWidth={2} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Administradores</p>
                                                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{admins.length}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Separador visual */}
                                    <div className="hidden lg:block w-px h-16 bg-gradient-to-b from-transparent via-gray-500/30 to-transparent" />

                                    {/* Distribución por nivel */}
                                    <div className="flex gap-3">
                                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                            <p className="text-2xl font-bold text-blue-500">{students.filter(s => s.level.startsWith("Beginner")).length}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Beginner</p>
                                        </div>
                                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                            <p className="text-2xl font-bold text-amber-500">{students.filter(s => s.level.startsWith("Intermediate")).length}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Intermediate</p>
                                        </div>
                                        <div className="text-center px-4 py-2 rounded-xl" style={{ background: 'var(--surface)' }}>
                                            <p className="text-2xl font-bold text-emerald-500">{students.filter(s => s.level.startsWith("Advanced")).length}</p>
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
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "students" ? "text-white" : ""}`}
                                    style={activeTab === "students"
                                        ? { background: '#014287', color: 'white' }
                                        : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                >
                                    Estudiantes
                                </button>
                                <button
                                    onClick={() => setActiveTab("payments")}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "payments" ? "text-white" : ""}`}
                                    style={activeTab === "payments"
                                        ? { background: '#014287', color: 'white' }
                                        : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                >
                                    <CircleDollarSign className="w-4 h-4" strokeWidth={2} />
                                    Pagos
                                </button>
                                <button
                                    onClick={() => setActiveTab("credentials")}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "credentials" ? "text-white" : ""}`}
                                    style={activeTab === "credentials"
                                        ? { background: '#014287', color: 'white' }
                                        : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                >
                                    <Shield className="w-4 h-4" strokeWidth={2} />
                                    Credenciales
                                </button>
                                {userRole === "superadmin" && (
                                    <button
                                        onClick={() => setActiveTab("admins")}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "admins" ? "text-white" : ""}`}
                                        style={activeTab === "admins"
                                            ? { background: '#014287', color: 'white' }
                                            : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                    >
                                        <Users className="w-4 h-4" strokeWidth={2} />
                                        Administradores
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTab("reports")}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "reports" ? "text-white" : ""}`}
                                    style={activeTab === "reports"
                                        ? { background: '#014287', color: 'white' }
                                        : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                >
                                    <BarChart3 className="w-4 h-4" strokeWidth={2} />
                                    Reportes
                                </button>
                                <button
                                    onClick={() => setActiveTab("calendar")}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all inline-flex items-center gap-2 ${activeTab === "calendar" ? "text-white" : ""}`}
                                    style={activeTab === "calendar"
                                        ? { background: '#014287', color: 'white' }
                                        : { background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                >
                                    <CalendarDays className="w-4 h-4" strokeWidth={2} />
                                    Calendario
                                </button>
                            </div>

                            {activeTab !== "payments" && activeTab !== "admins" && activeTab !== "reports" && activeTab !== "calendar" && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                                    style={{ background: '#014287' }}
                                >
                                    <Plus className="w-5 h-5" strokeWidth={2} />
                                    Nuevo Estudiante
                                </button>
                            )}

                            {activeTab === "admins" && userRole === "superadmin" && (
                                <button
                                    onClick={() => setShowCreateAdminModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:opacity-90"
                                    style={{ background: '#014287' }}
                                >
                                    <UserPlus className="w-5 h-5" strokeWidth={2} />
                                    Nuevo Administrador
                                </button>
                            )}
                        </div>

                        {/* Barra de búsqueda y filtros - Solo para estudiantes */}


                        {/* Content - Reports Tab */}
                        {activeTab === "calendar" ? (
                            <CalendarPanel />
                        ) : activeTab === "reports" ? (
                            <ReportsPanel
                                students={students}
                                payments={rawPayments}
                                userRole={userRole}
                            />
                        ) : activeTab === "payments" ? (
                            <PaymentsPanel
                                students={students}
                                payments={payments}
                                onPaymentConfirm={handlePaymentConfirm}
                                onPaymentRevoke={handlePaymentRevoke}
                                userRole={userRole}
                                socket={socket}
                                pendingPaymentRequest={pendingPaymentRequest}
                                onPaymentRequestHandled={() => setPendingPaymentRequest(null)}
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
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
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
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${admin.status === "active"
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
                                                    {admin.status === "active" ? (
                                                        <Ban className="w-5 h-5 text-amber-500" strokeWidth={2} />
                                                    ) : (
                                                        <CheckCircle className="w-5 h-5 text-amber-500" strokeWidth={2} />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteAdmin(admin)}
                                                    className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-5 h-5 text-red-500" strokeWidth={2} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {admins.length === 0 && (
                                        <div className="text-center py-12">
                                            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
                                            <p style={{ color: 'var(--text-secondary)' }}>No hay administradores registrados</p>
                                            <button
                                                onClick={() => setShowCreateAdminModal(true)}
                                                className="mt-4 px-4 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-colors"
                                                style={{ background: '#014287' }}
                                            >
                                                Crear primer administrador
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : activeTab === "credentials" ? (
                            <CredentialsPanel students={students} />
                        ) : (
                            <StudentsPanel students={students} setStudents={setStudents} userRole={userRole} />
                        )}
                    </>
                )}
            </main>

            {/* Modal: Crear Estudiante - Diseño Mejorado */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div
                        className="modal-content rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                        style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}
                    >
                        {/* Header del Modal */}
                        <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b" style={{ background: 'var(--modal-bg)', borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Estudiante</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Completa la información del alumno</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="p-5 space-y-6">
                            {/* Sección: Información Personal */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                    <User className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Información Personal</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Nombre Completo */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Nombre Completo <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Juan Pérez García"
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.name ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                        />
                                        {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
                                    </div>

                                    {/* Email */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Correo Electrónico <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex items-center">
                                            <input
                                                type="text"
                                                value={formData.email.replace(/@.*$/, '')}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/@.*/, '') + '@' + emailDomain })}
                                                placeholder="usuario"
                                                className="w-full px-4 py-2.5 rounded-l-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                style={{
                                                    background: 'var(--input-bg)',
                                                    border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--input-border)'}`,
                                                    color: 'var(--text-primary)',
                                                    borderRight: 'none'
                                                }}
                                            />
                                            <select
                                                value={emailDomain}
                                                onChange={(e) => {
                                                    const newDomain = e.target.value;
                                                    setEmailDomain(newDomain);
                                                    const username = formData.email.replace(/@.*$/, '');
                                                    if (username) {
                                                        setFormData({ ...formData, email: username + '@' + newDomain });
                                                    }
                                                }}
                                                className="px-3 py-2.5 rounded-r-xl text-sm font-medium whitespace-nowrap cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                style={{
                                                    background: 'var(--surface)',
                                                    border: `1px solid ${formErrors.email ? '#ef4444' : 'var(--input-border)'}`,
                                                    color: 'var(--text-tertiary)',
                                                    borderLeft: 'none',
                                                    minWidth: '140px'
                                                }}
                                            >
                                                {EMAIL_DOMAINS.map((domain) => (
                                                    <option key={domain.value} value={domain.value}>
                                                        {domain.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Sección: Información de Contacto */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                    <Phone className="w-4 h-4 text-green-500" />
                                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Información de Contacto</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Teléfono del Estudiante */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Teléfono del Alumno <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.studentPhone}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                if (value.length <= 10) {
                                                    setFormData({ ...formData, studentPhone: value });
                                                }
                                            }}
                                            placeholder="5512345678"
                                            maxLength={10}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.studentPhone ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                        />
                                        {formErrors.studentPhone ? (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.studentPhone}</p>
                                        ) : (
                                            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>10 dígitos — número personal del estudiante</p>
                                        )}
                                    </div>

                                    {/* Teléfono de Emergencia */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Tel. Emergencia (Tutor) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.emergencyPhone}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/\D/g, '');
                                                if (value.length <= 10) {
                                                    setFormData({ ...formData, emergencyPhone: value });
                                                }
                                            }}
                                            placeholder="5587654321"
                                            maxLength={10}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.emergencyPhone ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                        />
                                        {formErrors.emergencyPhone ? (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.emergencyPhone}</p>
                                        ) : (
                                            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>10 dígitos — número del padre, madre o tutor</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sección: Configuración Académica */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                    <GraduationCap className="w-4 h-4 text-purple-500" />
                                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Configuración Académica</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Nivel */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Nivel <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: e.target.value as NewStudentForm["level"] })}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                        >
                                            <optgroup label="Beginner">
                                                <option value="Beginner 1">Beginner 1</option>
                                                <option value="Beginner 2">Beginner 2</option>
                                            </optgroup>
                                            <optgroup label="Intermediate">
                                                <option value="Intermediate 1">Intermediate 1</option>
                                                <option value="Intermediate 2">Intermediate 2</option>
                                            </optgroup>
                                            <optgroup label="Advanced">
                                                <option value="Advanced 1">Advanced 1</option>
                                                <option value="Advanced 2">Advanced 2</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    {/* Fecha de Inscripción */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Día de Inicio <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.enrollmentDate}
                                            onChange={(e) => setFormData({ ...formData, enrollmentDate: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.enrollmentDate ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)', colorScheme: 'dark' }}
                                        />
                                        {formErrors.enrollmentDate && <p className="mt-1 text-xs text-red-500">{formErrors.enrollmentDate}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Sección: Configuración de Pago */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                    <CreditCard className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Configuración de Pago</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Esquema de Pago */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Esquema de Pago
                                        </label>
                                        <select
                                            value={formData.paymentScheme}
                                            onChange={(e) => setFormData({ ...formData, paymentScheme: e.target.value as any })}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="monthly_28">Cada 28 días</option>
                                            <option value="biweekly">Catorcenal (14 días)</option>
                                            <option value="weekly">Semanal</option>
                                            <option value="daily">Diario</option>
                                        </select>
                                    </div>

                                    {/* Mensualidad */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Mensualidad
                                        </label>
                                        <select
                                            value={formData.priceOption}
                                            onChange={(e) => setFormData({ ...formData, priceOption: e.target.value, customPrice: "" })}
                                            className="w-full px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                                        >
                                            {PRICE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Campo de precio personalizado */}
                                    {formData.priceOption === "custom" && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                                Precio Personalizado <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.customPrice}
                                                    onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
                                                    placeholder="0.00"
                                                    className="w-full pl-8 pr-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                    style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.customPrice ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                            {formErrors.customPrice && <p className="mt-1 text-xs text-red-500">{formErrors.customPrice}</p>}
                                        </div>
                                    )}

                                    {/* Días de Clase */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                            Días de Clase <span className="text-red-500">*</span>
                                        </label>
                                        <div className={`flex flex-wrap gap-2 p-2 rounded-xl ${formErrors.classDays ? 'ring-1 ring-red-500' : ''}`}>
                                            {[
                                                { id: 1, label: "Lunes" },
                                                { id: 2, label: "Martes" },
                                                { id: 3, label: "Miércoles" },
                                                { id: 4, label: "Jueves" },
                                                { id: 5, label: "Viernes" },
                                                { id: 6, label: "Sábado" },
                                            ].map((day) => {
                                                const currentDays = formData.classDays || [];
                                                const isSelected = currentDays.includes(day.id);
                                                const isMaxReached = currentDays.length >= 6 && !isSelected;
                                                return (
                                                    <button
                                                        key={day.id}
                                                        type="button"
                                                        disabled={isMaxReached}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setFormData({ ...formData, classDays: currentDays.filter(d => d !== day.id) });
                                                            } else if (currentDays.length < 6) {
                                                                setFormData({ ...formData, classDays: [...currentDays, day.id] });
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${isSelected
                                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                                            : ""
                                                            }`}
                                                        style={!isSelected ? {
                                                            background: isMaxReached ? 'var(--surface-alt)' : 'var(--input-bg)',
                                                            color: isMaxReached ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                                            border: '1px solid var(--border-color)',
                                                            cursor: isMaxReached ? 'not-allowed' : 'pointer',
                                                            opacity: isMaxReached ? 0.5 : 1,
                                                        } : undefined}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {formErrors.classDays ? (
                                            <p className="mt-1.5 text-xs text-red-500">{formErrors.classDays}</p>
                                        ) : (
                                            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                Selecciona de 1 a 6 días de clase (Lunes a Sábado)
                                            </p>
                                        )}
                                    </div>

                                    {/* Pago de Inscripción */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Pago de Inscripción <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={formData.enrollmentFee}
                                                onChange={(e) => setFormData({ ...formData, enrollmentFee: e.target.value })}
                                                placeholder="0"
                                                className="w-full pl-8 pr-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                style={{ background: 'var(--input-bg)', border: `1px solid ${formErrors.enrollmentFee ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        {formErrors.enrollmentFee ? (
                                            <p className="mt-1 text-xs text-red-500">{formErrors.enrollmentFee}</p>
                                        ) : (
                                            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                Cobro por inscripción. Puede ser $0 si no se cobra.
                                            </p>
                                        )}
                                    </div>

                                    {/* Método de Pago de Inscripción */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                            Método de Pago (Inscripción)
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, enrollmentPaymentMethod: "efectivo" })}
                                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${formData.enrollmentPaymentMethod === "efectivo"
                                                    ? "bg-green-500/15 border-green-500 text-green-600 dark:text-green-400 shadow-sm shadow-green-500/10"
                                                    : "bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                                                    }`}
                                            >
                                                <Banknote className={`w-4 h-4 ${formData.enrollmentPaymentMethod === "efectivo" ? "text-green-500" : "text-gray-400"}`} strokeWidth={2} />
                                                Efectivo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, enrollmentPaymentMethod: "transferencia" })}
                                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${formData.enrollmentPaymentMethod === "transferencia"
                                                    ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                                                    : "bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                                                    }`}
                                            >
                                                <ArrowRightLeft className={`w-4 h-4 ${formData.enrollmentPaymentMethod === "transferencia" ? "text-blue-500" : "text-gray-400"}`} strokeWidth={2} />
                                                Transferencia
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resumen de errores */}
                        {Object.keys(formErrors).length > 0 && (
                            <div className="mx-5 mb-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <p className="text-sm font-semibold text-red-400">Corrige los siguientes campos:</p>
                                </div>
                                <ul className="list-disc list-inside text-xs text-red-400/80 space-y-0.5">
                                    {Object.values(formErrors).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Footer del Modal */}
                        <div className="sticky bottom-0 flex gap-3 p-5 border-t" style={{ background: 'var(--modal-bg)', borderColor: 'var(--border-color)' }}>
                            <button
                                onClick={handleCreateStudent}
                                disabled={isCreating}
                                className="flex-1 px-6 py-3 text-white font-semibold rounded-xl transition-all disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #014287 0%, #0369a1 100%)' }}
                            >
                                {isCreating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5" />
                                        Crear y Generar Credencial
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-6 py-3 font-semibold rounded-xl transition-colors hover:opacity-80"
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
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-white" strokeWidth={2} />
                                </div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Administrador</h3>
                            </div>
                            <button onClick={() => setShowCreateAdminModal(false)} style={{ color: 'var(--text-secondary)' }}>
                                <X className="w-5 h-5" strokeWidth={2} />
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
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                    className="w-full px-4 py-3 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ background: 'var(--input-bg)', border: `1px solid ${adminFormErrors.confirmPassword ? '#ef4444' : 'var(--input-border)'}`, color: 'var(--text-primary)' }}
                                />
                                {adminFormErrors.confirmPassword && <p className="mt-1 text-sm text-red-500">{adminFormErrors.confirmPassword}</p>}
                            </div>

                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <p className="text-sm text-blue-500">
                                    <span className="font-medium">Permisos:</span> Este administrador podrá gestionar estudiantes, credenciales y pagos.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateAdmin}
                                disabled={isCreating}
                                className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-all disabled:opacity-50 hover:opacity-90"
                                style={{ background: '#014287' }}
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
            )
            }

            {/* Modal: Confirmar Eliminación de Administrador */}
            {showDeleteAdminModal && adminToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="modal-content rounded-xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-color)' }}>
                        {/* Header con icono de advertencia */}
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={2} />
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
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                    {adminToDelete.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{adminToDelete.name}</p>
                                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{adminToDelete.email}</p>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-500 mt-1">
                                        <ShieldCheck className="w-3 h-3" strokeWidth={2} />
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
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        {/* Info del estudiante */}
                        <div className="p-4 rounded-lg mb-6" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
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
                                <Copy className="w-4 h-4" strokeWidth={2} />
                                Copiar URL
                            </button>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="flex-1 px-4 py-3 text-white font-medium rounded-lg transition-all hover:opacity-90"
                                style={{ background: '#014287' }}
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

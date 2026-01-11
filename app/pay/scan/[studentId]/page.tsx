"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Check, X, AlertTriangle, Lock, LogIn, Eye, EyeOff, Loader2, Monitor, Smartphone } from "lucide-react";
import { authApi } from "@/lib/api";
import Image from "next/image";

interface StudentInfo {
    id: string;
    name: string;
    studentNumber: string;
    email: string;
    level: string;
    monthlyFee: number;
}

interface PaymentResult {
    studentId: string;
    success: boolean;
    message: string;
    month?: number;
    year?: number;
}

type ScanStatus = "auth-required" | "authenticating" | "connecting" | "loading" | "processing" | "confirmed" | "rejected" | "error";

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// URLs dinámicas para producción y desarrollo
// IMPORTANTE: Usar Render para WebSockets (Vercel no soporta WebSockets persistentes)
const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return 'https://ingles-backend-bk4n.onrender.com';
        }
    }
    return 'http://127.0.0.1:3001';
};

export default function PayScanPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.studentId as string;

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [status, setStatus] = useState<ScanStatus>("auth-required");
    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [pendingMonth, setPendingMonth] = useState<number>(0);
    const [pendingYear, setPendingYear] = useState<number>(0);
    const [message, setMessage] = useState<string>("");
    const [socket, setSocket] = useState<Socket | null>(null);
    const [progress, setProgress] = useState<number>(0);

    // Verificar autenticación al cargar
    useEffect(() => {
        const token = localStorage.getItem("token");
        const userType = localStorage.getItem("userType");

        if (token && (userType === "admin" || userType === "superadmin")) {
            setIsAuthenticated(true);
            setStatus("connecting");
        } else {
            setIsAuthenticated(false);
            setStatus("auth-required");
        }
    }, []);

    // Handler para login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");
        setIsLoggingIn(true);
        setStatus("authenticating");

        try {
            const response = await authApi.login(loginEmail, loginPassword);

            if (response.success) {
                localStorage.setItem("token", response.token);
                localStorage.setItem("userType", response.user.role);
                localStorage.setItem("userName", response.user.name);

                setIsAuthenticated(true);
                setStatus("connecting");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al iniciar sesión";
            setLoginError(message);
            setStatus("auth-required");
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Formatear moneda
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    };

    // Obtener información del estudiante y mes pendiente
    const fetchStudentAndPending = useCallback(async () => {
        const API_URL = getApiUrl();
        try {
            setProgress(30);

            // Obtener info del estudiante
            const studentRes = await fetch(`${API_URL}/api/students/${studentId}`);
            if (!studentRes.ok) throw new Error("Estudiante no encontrado");
            const studentData = await studentRes.json();
            setStudent(studentData);
            setProgress(50);

            // Obtener pagos del estudiante
            const paymentsRes = await fetch(`${API_URL}/api/payments?studentId=${studentId}`);
            const paymentsData = await paymentsRes.json();
            const payments = Array.isArray(paymentsData) ? paymentsData : [];
            setProgress(70);

            // Encontrar el primer mes pendiente (buscando desde el año actual hacia adelante)
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            // Buscar el primer mes no pagado, empezando desde el año actual
            let foundPending = false;

            // Revisar hasta 3 años adelante para encontrar el mes pendiente
            for (let year = currentYear; year <= currentYear + 2 && !foundPending; year++) {
                // Para el año actual, empezar desde el mes actual. Para años futuros, empezar desde enero.
                const startMonth = (year === currentYear) ? 1 : 1;

                for (let month = startMonth; month <= 12; month++) {
                    const isPaid = payments.some(
                        (p: { month: number; year: number; status: string }) =>
                            p.month === month && p.year === year && p.status === "paid"
                    );
                    if (!isPaid) {
                        setPendingMonth(month);
                        setPendingYear(year);
                        foundPending = true;
                        break;
                    }
                }
            }

            // Si no encontró ninguno pendiente (muy raro), mostrar el siguiente mes disponible
            if (!foundPending) {
                setPendingMonth(1);
                setPendingYear(currentYear + 3);
            }

            return studentData;
        } catch (error) {
            console.error("Error fetching student:", error);
            setStatus("error");
            setMessage("No se pudo encontrar el estudiante");
            return null;
        }
    }, [studentId]);

    // Conectar al socket SOLO si está autenticado
    useEffect(() => {
        if (!isAuthenticated) return;

        const SOCKET_URL = getApiUrl();
        setProgress(10);

        const newSocket = io(SOCKET_URL, {
            path: "/api/socket",
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("✅ Conectado al servidor");
            setProgress(15);

            // Enviar token para autenticación del socket
            const token = localStorage.getItem("token");
            if (token) {
                newSocket.emit("authenticate", { token });
            }
        });

        // Cuando la autenticación es exitosa, continuar
        newSocket.on("auth-success", () => {
            console.log("🔐 Socket autenticado correctamente");
            setProgress(20);
            setStatus("loading");
        });

        newSocket.on("auth-failed", (data) => {
            console.error("❌ Autenticación de socket fallida:", data.message);
            setStatus("error");
            setMessage("Error de autenticación. Tu sesión puede haber expirado.");
        });

        newSocket.on("connect_error", (error) => {
            console.error("❌ Error de conexión:", error);
            setStatus("error");
            setMessage("Error de conexión con el servidor");
        });

        newSocket.on("scan-received", () => {
            setStatus("processing");
            setMessage("Esperando confirmación del administrador...");
            setProgress(85);
        });

        newSocket.on("payment-result", (result: PaymentResult) => {
            setProgress(100);
            // Pequeña pausa para mostrar el progreso completo
            setTimeout(() => {
                if (result.success) {
                    setStatus("confirmed");
                    setMessage(result.message || "¡Pago confirmado exitosamente!");
                } else {
                    setStatus("rejected");
                    setMessage(result.message || "El pago fue rechazado");
                }
            }, 800);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated]);

    // Obtener datos del estudiante cuando el socket conecta
    useEffect(() => {
        if (socket && status === "loading") {
            fetchStudentAndPending();
        }
    }, [socket, status, fetchStudentAndPending]);

    // Enviar escaneo UNA SOLA VEZ cuando tenemos todos los datos
    const [scanSent, setScanSent] = useState(false);

    useEffect(() => {
        if (socket && student && pendingMonth > 0 && status === "loading" && !scanSent) {
            setScanSent(true);
            setProgress(80);
            socket.emit("student-scan", {
                studentId: student.id,
                studentName: student.name,
                studentNumber: student.studentNumber,
                pendingMonth,
                pendingYear,
                monthlyFee: student.monthlyFee,
            });
        }
    }, [socket, student, pendingMonth, pendingYear, status, scanSent]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 50%, #779bbf 100%)' }}>
            {/* Patrones decorativos de fondo */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-500 relative z-10">

                {/* Header con logo institucional */}
                <div className="relative bg-gradient-to-br from-[#014287] via-[#2596be] to-[#779bbf] p-8 text-white text-center overflow-hidden">
                    {/* Patrón de fondo decorativo */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        {/* Logo mejorado - tamaño más pequeño */}
                        <div className="flex justify-center mb-3">
                            <div className="relative">
                                {/* Contenedor del logo más compacto */}
                                <div className="relative bg-white rounded-xl p-2 shadow-lg border border-white/30">
                                    <Image
                                        src="/image/logo_mensaje.png"
                                        alt="What Time Is It? Idiomas"
                                        width={100}
                                        height={45}
                                        className="object-contain"
                                        priority
                                    />
                                </div>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight mb-1">Sistema de Pagos</h1>
                        <p className="text-white/90 text-sm font-medium">What Time Is It? Idiomas</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">

                    {/* Status: Auth Required - LOGIN FORM */}
                    {(status === "auth-required" || status === "authenticating") && (
                        <div className="py-4">
                            {/* Security Icon */}
                            <div className="text-center mb-6">
                                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)' }}>
                                    <Lock className="w-10 h-10 text-white" strokeWidth={2} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso de Personal</h2>
                                <p className="text-gray-600 text-sm font-medium">
                                    Inicia sesión para registrar el pago de este estudiante
                                </p>
                            </div>

                            {/* Info Badge */}
                            <div className="rounded-xl p-4 mb-6 border-2 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.1) 0%, rgba(1, 66, 135, 0.1) 100%)', borderColor: '#2596be' }}>
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        <div className="flex items-center gap-1">
                                            <Smartphone className="w-4 h-4" style={{ color: '#014287' }} />
                                            <span style={{ color: '#2596be' }}>→</span>
                                            <Monitor className="w-4 h-4" style={{ color: '#014287' }} />
                                        </div>
                                    </div>
                                    <p className="text-sm" style={{ color: '#014287' }}>
                                        <span className="font-bold">¿Cómo funciona?</span><br />
                                        <span className="text-xs font-medium" style={{ color: '#2596be' }}>
                                            Escanea aquí y confirma el pago desde tu panel de administración (computadora u otro dispositivo).
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Login Form */}
                            <form onSubmit={handleLogin} className="space-y-4">
                                {loginError && (
                                    <div className="text-white px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg" style={{ background: 'linear-gradient(135deg, #ea242e 0%, #d46f75 100%)', border: '2px solid #c95e62' }}>
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                                        <span className="font-semibold">{loginError}</span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Correo electrónico
                                    </label>
                                    <input
                                        type="email"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:outline-none transition-all duration-300 text-gray-800 font-medium"

                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#2596be';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(37, 150, 190, 0.2)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#e5e7eb';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        placeholder="admin@ejemplo.com"
                                        required
                                        disabled={isLoggingIn}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-gray-300 focus:outline-none transition-all duration-300 text-gray-800 font-medium"

                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#2596be';
                                                e.target.style.boxShadow = '0 0 0 4px rgba(37, 150, 190, 0.2)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#e5e7eb';
                                                e.target.style.boxShadow = 'none';
                                            }}
                                            placeholder="••••••••"
                                            required
                                            disabled={isLoggingIn}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="w-full px-6 py-4 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-60 disabled:transform-none flex items-center justify-center gap-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)',
                                    }}
                                >
                                    {isLoggingIn ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Verificando...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-5 h-5" strokeWidth={2.5} />
                                            Iniciar Sesión
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Status: Connecting */}
                    {status === "connecting" && (
                        <div className="text-center py-12">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: 'rgba(37, 150, 190, 0.2)' }}></div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: '#2596be' }}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl">🔌</span>
                                </div>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 mb-2">Conectando...</h2>
                            <p className="text-gray-600 text-sm font-medium">Estableciendo conexión segura</p>

                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-3 overflow-hidden max-w-xs mx-auto shadow-inner">
                                <div
                                    className="h-full transition-all duration-700 ease-out rounded-full"
                                    style={{
                                        width: `${progress}%`,
                                        background: 'linear-gradient(90deg, #014287 0%, #2596be 100%)'
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Loading */}
                    {status === "loading" && (
                        <div className="text-center py-12">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: 'rgba(37, 150, 190, 0.2)' }}></div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: '#2596be' }}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl">📋</span>
                                </div>
                            </div>
                            <h2 className="text-lg font-bold text-gray-800 mb-2">Cargando información</h2>
                            <p className="text-gray-600 text-sm font-medium">Obteniendo datos del estudiante...</p>

                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-3 overflow-hidden max-w-xs mx-auto shadow-inner">
                                <div
                                    className="h-full transition-all duration-500 ease-out rounded-full"
                                    style={{
                                        width: `${progress}%`,
                                        background: 'linear-gradient(90deg, #014287 0%, #2596be 100%)'
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Processing - Esperando confirmación de otro dispositivo */}
                    {status === "processing" && student && (
                        <div className="text-center">
                            {/* Student Card */}
                            <div className="rounded-2xl p-6 mb-6 border-2 shadow-lg" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.1) 0%, rgba(1, 66, 135, 0.1) 100%)', borderColor: '#2596be' }}>
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)' }}>
                                    {student.name.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="font-bold text-xl text-gray-800">{student.name}</h2>
                                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold mt-2 text-white shadow-md" style={{ background: '#014287' }}>
                                    <span>👤</span>
                                    <span>#{student.studentNumber}</span>
                                </div>
                            </div>

                            {/* Payment Info Card */}
                            <div className="rounded-2xl p-6 mb-6 border-2 shadow-lg" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.15) 0%, rgba(1, 66, 135, 0.15) 100%)', borderColor: '#2596be' }}>
                                <div className="flex items-center justify-center gap-2 mb-3" style={{ color: '#014287' }}>
                                    <span className="text-xl">📅</span>
                                    <span className="font-bold">Pago Pendiente</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-800 mb-2">
                                    {MONTHS[pendingMonth - 1]} {pendingYear}
                                </p>
                                <p className="text-4xl font-black" style={{ color: '#2596be' }}>
                                    {formatCurrency(student.monthlyFee)}
                                </p>
                            </div>

                            {/* Mensaje de espera - Dispositivos */}
                            <div className="rounded-2xl p-4 mb-6 border-2 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.1) 0%, rgba(1, 66, 135, 0.1) 100%)', borderColor: '#2596be' }}>
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <div className="flex items-center gap-1">
                                        <Smartphone className="w-5 h-5" style={{ color: '#014287' }} />
                                        <span className="text-xs font-semibold" style={{ color: '#014287' }}>Este dispositivo</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#2596be', animationDelay: "0ms" }}></div>
                                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#2596be', animationDelay: "150ms" }}></div>
                                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#2596be', animationDelay: "300ms" }}></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Monitor className="w-5 h-5" style={{ color: '#014287' }} />
                                        <span className="text-xs font-semibold" style={{ color: '#014287' }}>Panel Admin</span>
                                    </div>
                                </div>
                                <p className="text-sm font-bold" style={{ color: '#014287' }}>
                                    Solicitud enviada al panel de administración
                                </p>
                                <p className="text-xs font-medium mt-1" style={{ color: '#2596be' }}>
                                    Confirma el pago desde tu computadora o cualquier dispositivo con sesión activa
                                </p>
                            </div>

                            {/* Processing Animation */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full animate-bounce" style={{ background: '#014287', animationDelay: "0ms" }}></div>
                                    <div className="w-3 h-3 rounded-full animate-bounce" style={{ background: '#2596be', animationDelay: "150ms" }}></div>
                                    <div className="w-3 h-3 rounded-full animate-bounce" style={{ background: '#779bbf', animationDelay: "300ms" }}></div>
                                </div>
                                <p className="text-sm font-bold text-gray-700">{message}</p>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className="h-full transition-all duration-500 ease-out rounded-full"
                                    style={{
                                        width: `${progress}%`,
                                        background: 'linear-gradient(90deg, #014287 0%, #2596be 50%, #779bbf 100%)'
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Confirmed */}
                    {status === "confirmed" && (
                        <div className="text-center py-6">
                            {/* Success Animation */}
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: '#2596be' }}></div>
                                <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #2596be 0%, #014287 100%)' }}>
                                    <Check className="w-12 h-12 text-white" strokeWidth={3} />
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold mb-2" style={{ color: '#014287' }}>¡Pago Exitoso!</h2>
                            <p className="text-gray-700 mb-6 font-medium">{message}</p>

                            {student && (
                                <div className="rounded-2xl p-5 text-left space-y-3 border-2 shadow-lg mb-6" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.1) 0%, rgba(1, 66, 135, 0.1) 100%)', borderColor: '#2596be' }}>
                                    <div className="flex justify-between items-center pb-3 border-b-2" style={{ borderColor: '#2596be' }}>
                                        <span className="text-gray-600 text-sm font-semibold">Estudiante</span>
                                        <span className="font-bold text-gray-800">{student.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b-2" style={{ borderColor: '#2596be' }}>
                                        <span className="text-gray-600 text-sm font-semibold">Mes</span>
                                        <span className="font-bold text-gray-800">{MONTHS[pendingMonth - 1]} {pendingYear}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 text-sm font-semibold">Monto</span>
                                        <span className="font-black text-xl" style={{ color: '#014287' }}>{formatCurrency(student.monthlyFee)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 p-4 rounded-xl border-2 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(37, 150, 190, 0.1) 0%, rgba(1, 66, 135, 0.1) 100%)', borderColor: '#2596be' }}>
                                <p className="text-sm font-semibold" style={{ color: '#014287' }}>
                                    <span className="font-bold">📧 Comprobante enviado</span><br />
                                    <span className="font-medium" style={{ color: '#2596be' }}>Revisa tu correo electrónico</span>
                                </p>
                            </div>

                            <button
                                onClick={() => router.push("/pay/scan")}
                                className="mt-6 w-full px-6 py-4 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)' }}
                            >
                                Procesar otro pago
                            </button>
                        </div>
                    )}

                    {/* Status: Rejected */}
                    {status === "rejected" && (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #ea242e 0%, #d46f75 100%)' }}>
                                <X className="w-12 h-12 text-white" strokeWidth={3} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2" style={{ color: '#ea242e' }}>Pago No Procesado</h2>
                            <p className="text-gray-700 mb-6 font-medium">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-6 py-4 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)' }}
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {/* Status: Error */}
                    {status === "error" && (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #ea242e 0%, #d46f75 100%)' }}>
                                <AlertTriangle className="w-12 h-12 text-white" strokeWidth={2.5} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2" style={{ color: '#ea242e' }}>Error de Conexión</h2>
                            <p className="text-gray-700 mb-6 font-medium">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-6 py-4 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)' }}
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer con mascota */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 text-center border-t border-gray-200 relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 opacity-10">
                        <Image
                            src="/image/mascota.png"
                            alt="Mascota"
                            width={80}
                            height={80}
                            className="object-contain"
                        />
                    </div>
                    <p className="text-xs text-gray-500 font-medium relative z-10">
                        What Time Is It? Idiomas © {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}

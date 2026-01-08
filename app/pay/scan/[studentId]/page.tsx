"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

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

type ScanStatus = "connecting" | "loading" | "processing" | "confirmed" | "rejected" | "error";

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// URLs dinámicas para producción y desarrollo
const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return 'https://ingles-backend.vercel.app';
        }
    }
    return 'http://127.0.0.1:3001';
};

export default function PayScanPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.studentId as string;

    const [status, setStatus] = useState<ScanStatus>("connecting");
    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [pendingMonth, setPendingMonth] = useState<number>(0);
    const [pendingYear, setPendingYear] = useState<number>(0);
    const [message, setMessage] = useState<string>("");
    const [socket, setSocket] = useState<Socket | null>(null);
    const [progress, setProgress] = useState<number>(0);

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

            // Encontrar el primer mes pendiente del año actual
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            // Buscar primer mes no pagado (desde enero hasta diciembre)
            let foundPending = false;
            for (let month = 1; month <= 12; month++) {
                const isPaid = payments.some(
                    (p: { month: number; year: number; status: string }) => 
                    p.month === month && p.year === currentYear && p.status === "paid"
                );
                if (!isPaid) {
                    setPendingMonth(month);
                    setPendingYear(currentYear);
                    foundPending = true;
                    break;
                }
            }

            // Si todos los meses del año actual están pagados, mostrar enero del siguiente año
            if (!foundPending) {
                setPendingMonth(1);
                setPendingYear(currentYear + 1);
            }

            return studentData;
        } catch (error) {
            console.error("Error fetching student:", error);
            setStatus("error");
            setMessage("No se pudo encontrar el estudiante");
            return null;
        }
    }, [studentId]);

    // Conectar al socket
    useEffect(() => {
        const SOCKET_URL = getApiUrl();
        setProgress(10);
        
        const newSocket = io(SOCKET_URL, {
            path: "/api/socket",
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("✅ Conectado al servidor");
            setProgress(20);
            setStatus("loading");
        });

        newSocket.on("connect_error", (error) => {
            console.error("❌ Error de conexión:", error);
            setStatus("error");
            setMessage("Error de conexión con el servidor");
        });

        newSocket.on("scan-received", () => {
            setStatus("processing");
            setMessage("Registrando pago...");
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
    }, []);

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
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-500">
                
                {/* Header con logo */}
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-8 text-white text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <span className="text-4xl">🎓</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">What Time Is It?</h1>
                        <p className="text-white/80 text-sm mt-1 font-medium">Sistema de Pagos</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    
                    {/* Status: Connecting */}
                    {status === "connecting" && (
                        <div className="text-center py-12">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl">🔌</span>
                                </div>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">Conectando...</h2>
                            <p className="text-gray-500 text-sm">Estableciendo conexión segura</p>
                            
                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-2 overflow-hidden max-w-xs mx-auto">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Loading */}
                    {status === "loading" && (
                        <div className="text-center py-12">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-purple-100"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl">📋</span>
                                </div>
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 mb-2">Cargando información</h2>
                            <p className="text-gray-500 text-sm">Obteniendo datos del estudiante...</p>
                            
                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-2 overflow-hidden max-w-xs mx-auto">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Processing */}
                    {status === "processing" && student && (
                        <div className="text-center">
                            {/* Student Card */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-6 border border-gray-200">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">
                                    {student.name.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="font-bold text-xl text-gray-800">{student.name}</h2>
                                <div className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mt-2">
                                    <span>👤</span>
                                    <span>#{student.studentNumber}</span>
                                </div>
                            </div>

                            {/* Payment Info Card */}
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 mb-6">
                                <div className="flex items-center justify-center gap-2 text-amber-600 mb-3">
                                    <span className="text-xl">📅</span>
                                    <span className="font-semibold">Pago Pendiente</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-800 mb-2">
                                    {MONTHS[pendingMonth - 1]} {pendingYear}
                                </p>
                                <p className="text-4xl font-black text-emerald-600">
                                    {formatCurrency(student.monthlyFee)}
                                </p>
                            </div>

                            {/* Processing Animation */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                                </div>
                                <p className="text-sm font-medium text-gray-600">{message}</p>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-6 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status: Confirmed */}
                    {status === "confirmed" && (
                        <div className="text-center py-6">
                            {/* Success Animation */}
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25"></div>
                                <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                            
                            <h2 className="text-2xl font-bold text-emerald-600 mb-2">¡Pago Exitoso!</h2>
                            <p className="text-gray-600 mb-6">{message}</p>
                            
                            {student && (
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl p-5 text-left space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-emerald-200">
                                        <span className="text-gray-600 text-sm">Estudiante</span>
                                        <span className="font-semibold text-gray-800">{student.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-emerald-200">
                                        <span className="text-gray-600 text-sm">Mes</span>
                                        <span className="font-semibold text-gray-800">{MONTHS[pendingMonth - 1]} {pendingYear}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 text-sm">Monto</span>
                                        <span className="font-bold text-xl text-emerald-600">{formatCurrency(student.monthlyFee)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <p className="text-sm text-blue-700">
                                    <span className="font-semibold">📧 Comprobante enviado</span><br/>
                                    <span className="text-blue-600">Revisa tu correo electrónico</span>
                                </p>
                            </div>
                            
                            <button
                                onClick={() => router.push("/pay/scan")}
                                className="mt-6 w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300"
                            >
                                Procesar otro pago
                            </button>
                        </div>
                    )}

                    {/* Status: Rejected */}
                    {status === "rejected" && (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-red-600 mb-2">Pago No Procesado</h2>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {/* Status: Error */}
                    {status === "error" && (
                        <div className="text-center py-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200">
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-red-600 mb-2">Error de Conexión</h2>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 text-center border-t">
                    <p className="text-xs text-gray-400">
                        What Time Is It? Idiomas © {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}

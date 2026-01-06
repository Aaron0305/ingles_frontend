"use client";

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

type ScanStatus = "connecting" | "loading" | "waiting" | "confirmed" | "rejected" | "error";

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// URLs dinámicas para producción y desarrollo
const getApiUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return 'https://ingles-backend.vercel.app';
    }
    return 'http://localhost:3001';
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

    // Obtener información del estudiante y mes pendiente
    const fetchStudentAndPending = useCallback(async () => {
        const API_URL = getApiUrl();
        try {
            // Obtener info del estudiante
            const studentRes = await fetch(`${API_URL}/api/students/${studentId}`);
            if (!studentRes.ok) throw new Error("Estudiante no encontrado");
            const studentData = await studentRes.json();
            setStudent(studentData);

            // Obtener pagos del estudiante
            const paymentsRes = await fetch(`${API_URL}/api/payments?studentId=${studentId}`);
            const paymentsData = await paymentsRes.json();
            const payments = paymentsData.payments || [];

            // Encontrar el primer mes pendiente del año actual
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            // Buscar primer mes no pagado
            let foundPending = false;
            for (let month = 1; month <= currentMonth; month++) {
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

            // Si todos los meses están pagados hasta el actual
            if (!foundPending) {
                setPendingMonth(currentMonth);
                setPendingYear(currentYear);
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
        const newSocket = io(SOCKET_URL, {
            path: "/api/socket",
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => {
            console.log("✅ Conectado al servidor");
            setStatus("loading");
        });

        newSocket.on("connect_error", (error) => {
            console.error("❌ Error de conexión:", error);
            setStatus("error");
            setMessage("Error de conexión con el servidor");
        });

        newSocket.on("scan-received", () => {
            setStatus("waiting");
            setMessage("Esperando confirmación del administrador...");
        });

        newSocket.on("payment-result", (result: PaymentResult) => {
            if (result.success) {
                setStatus("confirmed");
                setMessage(result.message || "¡Pago confirmado exitosamente!");
            } else {
                setStatus("rejected");
                setMessage(result.message || "El pago fue rechazado");
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Obtener datos y enviar escaneo
    useEffect(() => {
        if (socket && status === "loading") {
            fetchStudentAndPending().then((studentData) => {
                if (studentData && pendingMonth > 0) {
                    // Enviar evento de escaneo
                    socket.emit("student-scan", {
                        studentId: studentData.id,
                        studentName: studentData.name,
                        studentNumber: studentData.studentNumber,
                        pendingMonth,
                        pendingYear,
                        monthlyFee: studentData.monthlyFee,
                    });
                }
            });
        }
    }, [socket, status, fetchStudentAndPending, pendingMonth, pendingYear]);

    // Reenviar escaneo cuando se obtiene el mes pendiente
    useEffect(() => {
        if (socket && student && pendingMonth > 0 && status === "loading") {
            socket.emit("student-scan", {
                studentId: student.id,
                studentName: student.name,
                studentNumber: student.studentNumber,
                pendingMonth,
                pendingYear,
                monthlyFee: student.monthlyFee,
            });
        }
    }, [socket, student, pendingMonth, pendingYear, status]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold">Pago de Mensualidad</h1>
                    <p className="text-blue-100 text-sm mt-1">English Learning Academy</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Status: Connecting */}
                    {status === "connecting" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Conectando con el servidor...</p>
                        </div>
                    )}

                    {/* Status: Loading */}
                    {status === "loading" && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Cargando información...</p>
                        </div>
                    )}

                    {/* Status: Waiting */}
                    {status === "waiting" && student && (
                        <div className="text-center">
                            {/* Student info */}
                            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                                    {student.name.charAt(0).toUpperCase()}
                                </div>
                                <h2 className="font-bold text-gray-800">{student.name}</h2>
                                <p className="text-gray-500 text-sm">#{student.studentNumber}</p>
                            </div>

                            {/* Payment info */}
                            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
                                <div className="flex items-center justify-center gap-2 text-orange-600 mb-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-semibold">Pago Pendiente</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {MONTHS[pendingMonth - 1]} {pendingYear}
                                </p>
                                <p className="text-3xl font-bold text-green-600 mt-2">
                                    ${student.monthlyFee}
                                </p>
                            </div>

                            {/* Waiting animation */}
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                                <span className="text-sm font-medium">{message}</span>
                            </div>
                        </div>
                    )}

                    {/* Status: Confirmed */}
                    {status === "confirmed" && (
                        <div className="text-center py-4">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-green-600 mb-2">¡Pago Confirmado!</h2>
                            <p className="text-gray-600 mb-4">{message}</p>
                            {student && (
                                <div className="bg-green-50 rounded-xl p-4 text-left">
                                    <p className="text-sm text-gray-600">Estudiante: <span className="font-semibold text-gray-800">{student.name}</span></p>
                                    <p className="text-sm text-gray-600">Mes: <span className="font-semibold text-gray-800">{MONTHS[pendingMonth - 1]} {pendingYear}</span></p>
                                    <p className="text-sm text-gray-600">Monto: <span className="font-semibold text-green-600">${student.monthlyFee}</span></p>
                                </div>
                            )}
                            <button
                                onClick={() => router.push("/")}
                                className="mt-6 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}

                    {/* Status: Rejected */}
                    {status === "rejected" && (
                        <div className="text-center py-4">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-red-600 mb-2">Pago Rechazado</h2>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {/* Status: Error */}
                    {status === "error" && (
                        <div className="text-center py-4">
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 text-center">
                    <p className="text-xs text-gray-400">
                        Sistema de Pagos • English Learning Academy
                    </p>
                </div>
            </div>
        </div>
    );
}

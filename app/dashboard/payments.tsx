"use client";

import { useState, useEffect, useRef } from "react";
import { Student } from "./credential";
import { Socket } from "socket.io-client";
import {
    Calendar, Users, CheckCircle, XCircle, Search, Clock, DollarSign, AlertTriangle, Filter, Sparkles, IdCard,
    CircleDollarSign, Check, QrCode, X, Loader2, ChevronDown
} from "lucide-react";
import { useRouter } from "next/navigation";

// ============================================
// TIPOS
// ============================================

export interface PaymentRecord {
    id: string;
    studentId: string;
    month: number; // Esto ahora representará el "index" del periodo (1-12, 1-48, etc)
    year: number;
    amount: number;
    status: "paid" | "pending" | "overdue";
    paidAt?: string;
    confirmedBy?: string;
}

interface PaymentScanRequest {
    studentId: string;
    studentName: string;
    studentNumber: string;
    pendingMonth: number;
    pendingYear: number;
    monthlyFee: number;
}

interface PaymentConfirmModalProps {
    isOpen: boolean;
    student: Student | null;
    periodIndex: number; // Antes month
    year: number;
    onConfirm: () => void;
    onCancel: () => void;
    onReject?: () => void;
    isFromScan?: boolean;
}

interface PaymentsPanelProps {
    students: Student[];
    payments: PaymentRecord[];
    onPaymentConfirm: (studentId: string, month: number, year: number) => void;
    onPaymentRevoke?: (studentId: string, month: number, year: number) => void;
    socket?: Socket | null;
    pendingPaymentRequest?: {
        studentId: string;
        studentName: string;
        studentNumber: string;
        pendingMonth: number;
        pendingYear: number;
        monthlyFee: number;
    } | null;
    onPaymentRequestHandled?: () => void;
}

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStudentDetected: (student: Student) => void;
    students: Student[];
}

// ============================================
// CONSTANTES Y UTILIDADES DE ESQUEMAS
// ============================================

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Helper to get day of year 1-366
const getDayOfYear = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

const MONTHS_SHORT = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

// Días festivos oficiales y comunes de México (YYYY-MM-DD)
// Se deben actualizar anualmente o mover a backend
const MEXICAN_HOLIDAYS = [
    "2025-01-01", "2025-02-03", "2025-03-17", "2025-04-17", "2025-04-18", "2025-05-01", "2025-09-16", "2025-11-17", "2025-12-25",
    "2026-01-01", "2026-02-02", "2026-03-16", "2026-04-02", "2026-04-03", "2026-05-01", "2026-09-16", "2026-11-16", "2026-12-25",
];

const isHoliday = (date: Date): boolean => {
    const dateString = date.toISOString().split('T')[0];
    return MEXICAN_HOLIDAYS.includes(dateString);
};

const getNextClassDay = (date: Date, classDays: number[]): Date => {
    let nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    // Buscar el siguiente día que sea día de clase Y que no sea festivo (opcional, si se recorre indefinidamente)
    // Aquí asumimos recorrido simple al siguiente día de clase válido
    while (!classDays.includes(nextDate.getDay())) {
        nextDate.setDate(nextDate.getDate() + 1);
    }

    // Si el nuevo día TAMBIÉN es festivo, ¿se vuelve a recorrer?
    // Generalmente sí. Recursivo o loop.
    if (isHoliday(nextDate)) {
        return getNextClassDay(nextDate, classDays);
    }

    return nextDate;
};

type PaymentScheme = "daily" | "weekly" | "biweekly" | "monthly_28";

interface SchemeConfig {
    periods: number;
    label: string;
    shortLabel: string;
    getPeriodLabel: (index: number) => string;
    getPeriodFullName: (index: number) => string;
    cols: string; // Tailwind grid cols class
}

const SCHEME_CONFIGS: Record<PaymentScheme, SchemeConfig> = {
    monthly_28: {
        periods: 12,
        label: "Mes",
        shortLabel: "Mes",
        getPeriodLabel: (i) => MONTHS_SHORT[i - 1] || `${i}`,
        getPeriodFullName: (i) => MONTHS[i - 1] || `Mes ${i}`,
        cols: "grid-cols-6 sm:grid-cols-12"
    },
    biweekly: {
        periods: 24, // 2 quincenas por mes aprox
        label: "Catorcenal",
        shortLabel: "Q",
        getPeriodLabel: (i) => `Q${i}`,
        getPeriodFullName: (i) => `Quincena ${i}`,
        cols: "grid-cols-8 sm:grid-cols-12"
    },
    weekly: {
        periods: 48, // 4 semanas por mes aprox
        label: "Semana",
        shortLabel: "S",
        getPeriodLabel: (i) => `S${i}`,
        getPeriodFullName: (i) => `Semana ${i}`,
        cols: "grid-cols-8 sm:grid-cols-12 md:grid-cols-16" // Custom grid needed or simple wrap
    },
    daily: {
        periods: 30, // Mostramos un "ciclo" de 30 días para visualización
        label: "Día",
        shortLabel: "D",
        getPeriodLabel: (i) => `D${i}`,
        getPeriodFullName: (i) => `Día ${i}`,
        cols: "grid-cols-7 sm:grid-cols-10"
    }
};

const getStudentScheme = (student: Student): PaymentScheme => {
    return student.paymentScheme || "monthly_28";
};

// ============================================
// MODAL DE CONFIRMACIÓN DE PAGO
// ============================================

function PaymentConfirmModal({ isOpen, student, periodIndex, year, onConfirm, onCancel, onReject, isFromScan }: PaymentConfirmModalProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen || !student) return null;

    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];

    const handleConfirm = async () => {
        setIsConfirming(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        onConfirm();
        setIsConfirming(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--modal-bg)' }}>
                {/* Icono de éxito */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <CircleDollarSign className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                </div>

                {/* Título */}
                <h3 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
                    Confirmar Pago
                </h3>

                {/* Info del estudiante */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface-alt)' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                            {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{student.name}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>#{student.studentNumber}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg p-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{config.label}</p>
                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{config.getPeriodFullName(periodIndex)}</p>
                        </div>
                        <div className="rounded-lg p-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Año</p>
                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{year}</p>
                        </div>
                    </div>
                </div>

                {/* Monto */}
                <div className="text-center mb-5">
                    <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Monto a pagar</p>
                    <p className="text-3xl font-bold text-green-500">${student.monthlyFee}</p>
                    <p className="text-xs text-gray-500 mt-1">Esquema: {config.label}</p>
                </div>

                {/* Indicador de escaneo QR */}
                {isFromScan && (
                    <div className="mb-4 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-2 justify-center">
                        <QrCode className="w-4 h-4 text-blue-500 animate-pulse" strokeWidth={2} />
                        <span className="text-xs font-medium text-blue-500">Solicitud desde QR escaneado</span>
                    </div>
                )}

                {/* Botones */}
                <div className="flex gap-3">
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isConfirming ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5" />
                                Confirmando...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" strokeWidth={2} />
                                Confirmar Pago
                            </>
                        )}
                    </button>
                    {isFromScan && onReject ? (
                        <button
                            onClick={onReject}
                            disabled={isConfirming}
                            className="px-5 py-3 font-semibold rounded-xl transition-colors bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30"
                        >
                            Rechazar
                        </button>
                    ) : (
                        <button
                            onClick={onCancel}
                            disabled={isConfirming}
                            className="px-5 py-3 font-semibold rounded-xl transition-colors"
                            style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                        >
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================
// MODAL DE ÉXITO
// ============================================

function PaymentSuccessModal({ isOpen, student, periodIndex, onClose }: { isOpen: boolean; student: Student | null; periodIndex: number; onClose: () => void }) {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(onClose, 1500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen || !student) return null;

    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl p-6 max-w-xs w-full shadow-2xl animate-in fade-in zoom-in duration-150 text-center" style={{ background: 'var(--modal-bg)' }}>
                {/* Animación de éxito */}
                <div className="relative flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                        <Check className="w-8 h-8 text-white" strokeWidth={3} />
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    ¡Pago Registrado!
                </h3>

                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-semibold text-blue-500">{student.name}</span> - {config.getPeriodFullName(periodIndex)}
                </p>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 rounded-full text-green-500 text-xs font-medium">
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    Guardado correctamente
                </div>
            </div>
        </div>
    );
}

// ============================================
// ESCÁNER QR SIMULADO
// ============================================

function QRScannerModal({ isOpen, onClose, onStudentDetected, students }: QRScannerModalProps) {
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState("");

    if (!isOpen) return null;

    const handleManualSearch = () => {
        const student = students.find(s =>
            s.studentNumber === manualCode ||
            s.id === manualCode ||
            s.name.toLowerCase().includes(manualCode.toLowerCase())
        );
        if (student) {
            onStudentDetected(student);
            setManualCode("");
        }
    };

    const simulateScan = (student: Student) => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            onStudentDetected(student);
        }, 1000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ background: 'var(--modal-bg)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        Escanear Credencial
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                        style={{ background: 'var(--surface-alt)' }}
                    >
                        <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} strokeWidth={2} />
                    </button>
                </div>

                {/* Área de escaneo simulada */}
                <div className="relative bg-gray-900 rounded-xl aspect-square mb-4 overflow-hidden">
                    {scanning ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-4 border-green-500 rounded-lg animate-pulse" />
                            <div className="absolute w-full h-1 bg-green-500 animate-scan" />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <QrCode className="w-16 h-16 mb-2 opacity-50" strokeWidth={1.5} />
                            <p className="text-sm">Cámara no disponible</p>
                            <p className="text-xs mt-1">Usa la búsqueda manual</p>
                        </div>
                    )}
                </div>

                {/* Búsqueda manual */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Buscar por número o nombre
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Ej: 2024001 o Juan"
                            className="flex-1 px-4 py-2.5 rounded-xl border-0 focus:ring-2 focus:ring-blue-500"
                            style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
                            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                        />
                        <button
                            onClick={handleManualSearch}
                            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
                        >
                            Buscar
                        </button>
                    </div>
                </div>

                {/* Lista rápida de estudiantes */}
                <div>
                    <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                        Selección rápida
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {students.map((student) => (
                            <button
                                key={student.id}
                                onClick={() => simulateScan(student)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left"
                                style={{ background: 'var(--surface-alt)' }}
                            >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                    {student.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {student.name}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        #{student.studentNumber}
                                    </p>
                                </div>
                                <ChevronDown className="w-5 h-5 -rotate-90" style={{ color: 'var(--text-tertiary)' }} strokeWidth={2} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================
// COMPONENTE DE CELDA DE PERIODO (MES/QUINCENA/SEMANA)
// ============================================

function PeriodCell({
    periodIndex,
    payment,
    onClick,
    onRevoke,
    isCurrentPeriod,
    selectedYear,
    config,
    isOverdue,
    customLabel
}: {
    periodIndex: number;
    payment?: PaymentRecord;
    onClick: () => void;
    onRevoke?: () => void;
    isCurrentPeriod: boolean;

    selectedYear: number;
    config: SchemeConfig;
    isOverdue?: boolean; // Nuevo prop para indicar si está vencido
    customLabel?: string; // Nuevo prop para label personalizado
}) {
    const isPaid = payment?.status === "paid";

    // Status visual
    let statusColor = "bg-gray-500/10 hover:bg-blue-500/15 border-gray-500/20 hover:border-blue-500/30";

    if (isPaid) {
        statusColor = "bg-green-500/15 hover:bg-red-500/15 border-green-500/40 hover:border-red-500/40";
    } else if (isOverdue) {
        // Estilo para pagos vencidos/pendientes
        statusColor = "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50 animate-pulse-slow";
    }

    const handleClick = () => {
        if (isPaid && onRevoke) {
            onRevoke();
        } else if (!isPaid) {
            onClick();
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`
                relative p-1.5 sm:p-2 rounded-lg transition-all duration-200 group flex flex-col items-center justify-center min-h-[50px]
                border ${statusColor}
                ${isCurrentPeriod ? "ring-2 ring-blue-500 ring-offset-1" : ""}
            `}
        >
            <span className={`text-[10px] sm:text-xs font-medium mb-0.5 ${isOverdue && !isPaid ? 'text-red-400' : ''}`} style={{ color: isOverdue && !isPaid ? undefined : 'var(--text-tertiary)' }}>
                {customLabel || config.getPeriodLabel(periodIndex)}
            </span>

            {isPaid ? (
                <div className="relative">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 group-hover:hidden" strokeWidth={2.5} />
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 hidden group-hover:block" strokeWidth={2.5} />
                </div>
            ) : isOverdue ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500/70 group-hover:text-red-500" strokeWidth={1.5} />
            ) : (
                <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-400" strokeWidth={1.5} />
            )}

            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {isPaid ? "Revocar" : `Pagar ${config.getPeriodFullName(periodIndex)}`}
            </div>
        </button>
    );
}

// ============================================
// CARD DE ESTUDIANTE CON PAGOS Y CARRUSEL DE AÑOS
// ============================================

function StudentPaymentCard({
    student,
    payments,
    onPeriodClick,
    onPeriodRevoke
}: {
    student: Student;
    payments: PaymentRecord[];
    onPeriodClick: (periodIndex: number, year: number) => void;
    onPeriodRevoke?: (periodIndex: number, year: number) => void;
}) {
    const currentYear = new Date().getFullYear();
    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];

    // Calcular el año de inscripción del estudiante (usamos createdAt)
    const enrollmentYear = student.createdAt
        ? new Date(student.createdAt).getFullYear()
        : currentYear;

    // Función para verificar si un año tiene todos los periodos pagados
    const isYearFullyPaid = (year: number) => {
        const yearPayments = payments.filter(p => p.year === year && p.status === "paid");
        return yearPayments.length >= config.periods;
    };

    // Calcular el último año disponible
    let maxYear = currentYear;
    while (isYearFullyPaid(maxYear)) {
        maxYear++;
    }

    // Generar array de años disponibles
    const availableYears = Array.from(
        { length: maxYear - enrollmentYear + 1 },
        (_, i) => enrollmentYear + i
    );

    const [selectedYear, setSelectedYear] = useState(() => {
        if (isYearFullyPaid(currentYear)) {
            return currentYear + 1;
        }
        return currentYear;
    });

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    // Pagos del año seleccionado
    const yearPayments = payments.filter(p => p.year === selectedYear);
    const paidPeriodsCount = yearPayments.filter(p => p.status === "paid").length;

    // Progreso
    const progress = (paidPeriodsCount / config.periods) * 100;

    // Navegación del carrusel
    const canGoPrev = selectedYear > enrollmentYear;
    const canGoNext = selectedYear < maxYear;

    return (
        <div className="rounded-2xl overflow-hidden transition-shadow hover:shadow-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
            {/* Header compacto del estudiante */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                        {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                                {student.name}
                            </h3>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${student.level === 'Beginner' ? 'bg-blue-500/20 text-blue-500' :
                                student.level === 'Intermediate' ? 'bg-amber-500/20 text-amber-500' :
                                    'bg-emerald-500/20 text-emerald-500'
                                }`}>
                                {student.level === 'Beginner' ? 'B' : student.level === 'Intermediate' ? 'I' : 'A'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                #{student.studentNumber}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>•</span>
                            <span className="text-[11px] font-medium text-green-500">${student.monthlyFee}/{config.shortLabel}</span>
                        </div>
                    </div>

                    {/* Mini indicador de progreso circular */}
                    <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90">
                            <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                className="text-gray-200 dark:text-gray-700"
                            />
                            <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${progress * 1.256} 125.6`}
                                className="text-green-500 transition-all duration-500"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[8px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                {paidPeriodsCount}/{config.periods}
                            </span>
                        </div>
                    </div>
                </div>
            </div>


            {/* Selector de Mes (Solo para Daily) */}
            {
                scheme === 'daily' && (
                    <div className="px-4 py-2 flex items-center justify-center gap-2 border-b border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setSelectedMonth(prev => prev === 0 ? 11 : prev - 1)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        <span className="text-sm font-semibold w-24 text-center">{MONTHS[selectedMonth]}</span>
                        <button
                            onClick={() => setSelectedMonth(prev => prev === 11 ? 0 : prev + 1)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <ChevronDown className="w-4 h-4 -rotate-90" />
                        </button>
                    </div>
                )
            }

            {/* Selector de año minimalista */}
            {
                availableYears.length > 1 && (
                    <div className="px-4 py-2 flex items-center justify-center gap-1" style={{ background: 'var(--surface-alt)' }}>
                        <button
                            onClick={() => canGoPrev && setSelectedYear(selectedYear - 1)}
                            disabled={!canGoPrev}
                            className={`p-1 rounded transition-all ${canGoPrev ? 'hover:bg-blue-500/20 text-blue-500' : 'opacity-30'}`}
                        >
                            <ChevronDown className="w-4 h-4 rotate-90" strokeWidth={2} />
                        </button>

                        <div className="flex items-center gap-1">
                            {availableYears.map((year) => {
                                const yearFullyPaid = isYearFullyPaid(year);
                                const isFutureYear = year > currentYear;

                                return (
                                    <button
                                        key={year}
                                        onClick={() => setSelectedYear(year)}
                                        className={`
                                        px-2.5 py-1 rounded-md text-xs font-semibold transition-all relative
                                        ${year === selectedYear
                                                ? 'bg-blue-500 text-white shadow-sm'
                                                : yearFullyPaid
                                                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                                                    : 'hover:bg-blue-500/10'
                                            }
                                    `}
                                        style={year !== selectedYear && !yearFullyPaid ? { color: 'var(--text-tertiary)' } : {}}
                                    >
                                        {year}
                                        {yearFullyPaid && year !== selectedYear && (
                                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                                                <Check className="w-2 h-2 text-white" strokeWidth={3} />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => canGoNext && setSelectedYear(selectedYear + 1)}
                            disabled={!canGoNext}
                            className={`p-1 rounded transition-all ${canGoNext ? 'hover:bg-blue-500/20 text-blue-500' : 'opacity-30'}`}
                        >
                            <ChevronDown className="w-4 h-4 -rotate-90" strokeWidth={2} />
                        </button>
                    </div>
                )
            }

            {/* Grid de periodos */}
            <div className="p-3">
                {/* 
                    Usamos style para grid-template-columns en casos complejos 
                    o las clases de tailwind predefinidas
                */}
                <div className={`grid gap-1.5 ${scheme === 'weekly' ? 'grid-cols-6 sm:grid-cols-8 md:grid-cols-12' : config.cols}`}>
                    {(() => {
                        // Lógica especial para Daily
                        if (scheme === 'daily') {
                            const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                            const today = new Date();
                            const enrollmentDate = student.enrollmentDate
                                ? new Date(student.enrollmentDate)
                                : (student.createdAt ? new Date(student.createdAt) : new Date(selectedYear, 0, 1));
                            // Normalizar enrollmentDate para ignorar horas
                            enrollmentDate.setHours(0, 0, 0, 0);

                            // Generar obligaciones de pago
                            const obligations: { originalDate: Date; effectiveDate: Date; isShifted: boolean }[] = [];

                            for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(selectedYear, selectedMonth, day);

                                // Ocultar días anteriores a la inscripción
                                if (date < enrollmentDate) continue;

                                const dayOfWeek = date.getDay();

                                // Si NO es día de clase, ignorar (a menos que sea un día destino de un recorrido, pero eso se maneja en el push)
                                if (student.classDays && student.classDays.length > 0 && !student.classDays.includes(dayOfWeek)) {
                                    continue;
                                }

                                // Es un día de clase
                                if (isHoliday(date)) {
                                    // Si es festivo, encontrar el siguiente día de clase válido
                                    const nextDate = getNextClassDay(date, student.classDays || []);
                                    // Verificar que el siguiente día esté dentro del mismo año (opcional, pero dashboard es por año)
                                    // Agregamos la obligación con fecha efectiva modificada
                                    obligations.push({
                                        originalDate: date,
                                        effectiveDate: nextDate,
                                        isShifted: true
                                    });
                                } else {
                                    // Día normal
                                    obligations.push({
                                        originalDate: date,
                                        effectiveDate: date,
                                        isShifted: false
                                    });
                                }
                            }

                            // Ordenar obligaciones por fecha efectiva para mostrar en orden cronológico real de pago
                            obligations.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());

                            return obligations.map((ob) => {
                                const { originalDate, effectiveDate, isShifted } = ob;
                                const originalDayOfYear = getDayOfYear(originalDate);

                                const payment = yearPayments.find(p => p.month === originalDayOfYear); // Usamos ID original para trackear el pago

                                // Calcular Overdue basado en la fecha EFECTIVA (cuando realmente debía pagar)
                                const isPastOrToday = effectiveDate <= today;
                                const isOverdue = isPastOrToday && !payment;

                                // Formatear label
                                const dayNum = originalDate.getDate();
                                let label = `${dayNum}`;
                                if (isShifted) {
                                    // Mostrar fecha original flecha nueva? o solo nueva?
                                    // El usuario dijo "solo deben ver los dias que hace el pago"
                                    // Pero es confuso si desaparece el 10 y aparece doble el 12.
                                    // Mostremos: "10 ➔ 12" o similar si hay espacio, o simplemente la fecha de cobro actual con un indicador
                                    const effectiveDay = effectiveDate.getDate();
                                    const effectiveMonth = MONTHS_SHORT[effectiveDate.getMonth()];
                                    // label = `${dayNum}→${effectiveDay}`; // Muy largo?
                                    // Mejor: Mostrar el día EFECTIVO de pago, quizás con tooltip del original
                                    label = `${effectiveDay} ${effectiveMonth}`;
                                }

                                return (
                                    <PeriodCell
                                        key={`${originalDayOfYear}-${isShifted ? 'S' : 'R'}`} // Key única compuesta
                                        periodIndex={originalDayOfYear}
                                        payment={payment}
                                        onClick={() => onPeriodClick(originalDayOfYear, selectedYear)}
                                        onRevoke={onPeriodRevoke ? () => onPeriodRevoke(originalDayOfYear, selectedYear) : undefined}
                                        isCurrentPeriod={effectiveDate.toDateString() === today.toDateString()}
                                        selectedYear={selectedYear}
                                        config={config}
                                        isOverdue={isOverdue}
                                        customLabel={label}
                                    />
                                );
                            });
                        }

                        // Lógica estándar para otros esquemas
                        return Array.from({ length: config.periods }, (_, i) => i + 1).map((periodIndex) => {
                            const payment = yearPayments.find(p => p.month === periodIndex);
                            const isCurrent = false;

                            return (
                                <PeriodCell
                                    key={periodIndex}
                                    periodIndex={periodIndex}
                                    payment={payment}
                                    onClick={() => onPeriodClick(periodIndex, selectedYear)}
                                    onRevoke={onPeriodRevoke ? () => onPeriodRevoke(periodIndex, selectedYear) : undefined}
                                    isCurrentPeriod={isCurrent}
                                    selectedYear={selectedYear}
                                    config={config}
                                />
                            );
                        });
                    })()}
                </div>
            </div>
        </div >
    );
}

// ============================================
// PANEL PRINCIPAL DE PAGOS
// ============================================

export default function PaymentsPanel({
    students,
    payments,
    onPaymentConfirm,
    onPaymentRevoke,
    socket,
    pendingPaymentRequest,
    onPaymentRequestHandled
}: PaymentsPanelProps) {
    const currentYear = new Date().getFullYear();
    const [showScanner, setShowScanner] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<number>(0);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showRevokeModal, setShowRevokeModal] = useState(false);

    // Router for QR navigation
    const router = useRouter();

    // Filtros de búsqueda (igual que en StudentList, pero interno)
    const [searchTerm, setSearchTerm] = useState("");
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Estado para el escaneo QR en tiempo real
    const [scanRequest, setScanRequest] = useState<PaymentScanRequest | null>(null);
    const [showScanNotification, setShowScanNotification] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);



    // Procesar solicitud de pago pendiente del componente padre
    useEffect(() => {
        if (pendingPaymentRequest) {
            console.log("📱 Procesando solicitud de pago pendiente:", pendingPaymentRequest);
            setScanRequest(pendingPaymentRequest);

            const student = students.find(s => s.id === pendingPaymentRequest.studentId);
            if (student) {
                setSelectedStudent(student);
                setSelectedPeriod(pendingPaymentRequest.pendingMonth);
                setSelectedYear(pendingPaymentRequest.pendingYear);
                setShowConfirmModal(true);
            }
        }
    }, [pendingPaymentRequest, students]);

    // Escuchar eventos de escaneo QR
    useEffect(() => {
        if (!socket) return;

        const handlePaymentRequest = (data: PaymentScanRequest) => {
            console.log("📱 Solicitud de pago recibida:", data);
            setScanRequest(data);
            setShowScanNotification(true);

            // Reproducir sonido de notificación
            if (audioRef.current) {
                audioRef.current.play().catch(() => { });
            }

            // Buscar el estudiante y abrir modal
            const student = students.find(s => s.id === data.studentId);
            if (student) {
                setSelectedStudent(student);
                setSelectedPeriod(data.pendingMonth);
                setSelectedYear(data.pendingYear);

                // Pequeño delay para que se vea la notificación
                setTimeout(() => {
                    setShowConfirmModal(true);
                    setShowScanNotification(false);
                }, 500);
            }
        };

        socket.on("payment-request", handlePaymentRequest);

        return () => {
            socket.off("payment-request", handlePaymentRequest);
        };
    }, [socket, students]);

    const handleStudentDetected = (student: Student) => {
        setSelectedStudent(student);
        setShowScanner(false);
        // No auto-opening modal anymore, user needs to click the specific period
    };

    const handleConfirmRevoke = () => {
        if (selectedStudent && selectedPeriod && onPaymentRevoke) {
            onPaymentRevoke(selectedStudent.id, selectedPeriod, selectedYear);
        }
        setShowRevokeModal(false);
    };

    const handleConfirmPayment = () => {
        if (selectedStudent && selectedPeriod) {
            onPaymentConfirm(selectedStudent.id, selectedPeriod, selectedYear);
            setShowConfirmModal(false);
            setShowSuccessModal(true);

            // Notificar al estudiante a través del socket
            if (socket && scanRequest) {
                socket.emit("payment-confirmed", {
                    studentId: selectedStudent.id,
                    month: selectedPeriod,
                    year: selectedYear,
                    success: true,
                    message: `Pago confirmado exitosamente`
                });
                setScanRequest(null);
            }

            // Limpiar la solicitud pendiente del componente padre
            if (onPaymentRequestHandled) {
                onPaymentRequestHandled();
            }
        }
    };

    // Función para rechazar el pago desde el escaneo QR
    const handleRejectScanPayment = () => {
        if (socket && scanRequest && selectedStudent) {
            socket.emit("payment-rejected", {
                studentId: selectedStudent.id,
                reason: "El pago fue rechazado por el administrador"
            });
            setScanRequest(null);
        }
        setShowConfirmModal(false);

        // Limpiar la solicitud pendiente del componente padre
        if (onPaymentRequestHandled) {
            onPaymentRequestHandled();
        }
    };

    // Filtrar estudiantes por búsqueda
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase().trim();
        const isNumeric = /^\d+$/.test(search);

        const matchesSearch = search === "" || (
            isNumeric
                ? student.studentNumber.toString().includes(search)
                : (
                    student.name.toLowerCase().includes(search) ||
                    student.studentNumber.toLowerCase().includes(search)
                )
        );

        const matchesLevel = filterLevel === "all" || student.level === filterLevel;
        const matchesStatus = filterStatus === "all" || student.status === filterStatus;

        return matchesSearch && matchesLevel && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <audio ref={audioRef} src="/sounds/notification.mp3" className="hidden" />

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
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <Filter className="h-3 w-3 text-gray-400" />
                            </div>
                        </div>

                        <button
                            onClick={() => router.push('/pay/scan')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 whitespace-nowrap transform hover:-translate-y-0.5"
                        >
                            <QrCode className="w-5 h-5" />
                            <span className="hidden sm:inline">Escanear QR</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notificación de escaneo */}
            {showScanNotification && (
                <div className="fixed top-20 right-4 z-50 bg-blue-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-full animate-pulse">
                        <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-bold">¡Nueva solicitud de pago!</p>
                        <p className="text-sm opacity-90">{scanRequest?.studentName}</p>
                    </div>
                </div>
            )}

            {/* Lista de Cards */}
            <div className="grid grid-cols-1 gap-6">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No se encontraron estudiantes</p>
                    </div>
                ) : (
                    filteredStudents.map(student => (
                        <StudentPaymentCard
                            key={student.id}
                            student={student}
                            payments={payments.filter(p => p.studentId === student.id)}
                            onPeriodClick={(periodIndex, year) => {
                                setSelectedStudent(student);
                                setSelectedPeriod(periodIndex);
                                setSelectedYear(year);
                                setShowConfirmModal(true);
                            }}
                            onPeriodRevoke={(periodIndex, year) => {
                                setSelectedStudent(student);
                                setSelectedPeriod(periodIndex);
                                setSelectedYear(year);
                                setShowRevokeModal(true);
                            }}
                        />
                    ))
                )}
            </div>

            {/* Modales */}
            <PaymentConfirmModal
                isOpen={showConfirmModal}
                student={selectedStudent}
                periodIndex={selectedPeriod}
                year={selectedYear}
                onConfirm={handleConfirmPayment}
                onCancel={() => setShowConfirmModal(false)}
                onReject={scanRequest ? handleRejectScanPayment : undefined}
                isFromScan={!!scanRequest}
            />

            <PaymentSuccessModal
                isOpen={showSuccessModal}
                student={selectedStudent}
                periodIndex={selectedPeriod}
                onClose={() => setShowSuccessModal(false)}
            />



            {/* Modal de confirmación de revocación */}
            {showRevokeModal && selectedStudent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={2} />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-center mb-2 dark:text-white">
                            ¿Revocar pago?
                        </h3>

                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-6">
                            Esta acción marcará el pago de <span className="font-bold text-gray-700 dark:text-gray-300">{selectedStudent.name}</span> como pendiente nuevamente.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRevokeModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmRevoke}
                                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-500/20"
                            >
                                Revocar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

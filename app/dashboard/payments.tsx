"use client";

import { useState, useEffect, useRef } from "react";
import { Student } from "./credential";
import { Socket } from "socket.io-client";
import { 
    CircleDollarSign, Check, QrCode, X, Loader2, ChevronDown, 
    Calendar, Users, CheckCircle, XCircle, Search, Clock, DollarSign, AlertTriangle
} from "lucide-react";

// ============================================
// TIPOS
// ============================================

export interface PaymentRecord {
    id: string;
    studentId: string;
    month: number; // 1-12
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
    month: number;
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
// CONSTANTES
// ============================================

const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTHS_SHORT = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

// ============================================
// MODAL DE CONFIRMACIÓN DE PAGO
// ============================================

function PaymentConfirmModal({ isOpen, student, month, year, onConfirm, onCancel, onReject, isFromScan }: PaymentConfirmModalProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen || !student) return null;

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
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Mes</p>
                            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{MONTHS[month - 1]}</p>
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

function PaymentSuccessModal({ isOpen, student, month, onClose }: { isOpen: boolean; student: Student | null; month: number; onClose: () => void }) {
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(onClose, 1500);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    if (!isOpen || !student) return null;

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
                    <span className="font-semibold text-blue-500">{student.name}</span> - {MONTHS[month - 1]}
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
// COMPONENTE DE CELDA DE MES
// ============================================

function MonthCell({ 
    month, 
    payment, 
    onClick,
    onRevoke,
    isCurrentMonth,
    selectedYear
}: { 
    month: number; 
    payment?: PaymentRecord; 
    onClick: () => void;
    onRevoke?: () => void;
    isCurrentMonth: boolean;
    selectedYear: number;
}) {
    const isPaid = payment?.status === "paid";
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Determinar si es mes pasado en el año actual (vencido si no está pagado)
    const isPastMonth = selectedYear < currentYear || (selectedYear === currentYear && month < currentMonth);
    
    // Solo mostrar como pendiente (naranja) el mes actual no pagado
    const isPending = isCurrentMonth && !isPaid;
    // Mostrar como vencido (rojo) los meses pasados no pagados
    const isOverdue = isPastMonth && !isPaid;

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
                relative p-1.5 sm:p-2 rounded-lg transition-all duration-200 group flex flex-col items-center
                ${isPaid 
                    ? "bg-green-500/15 hover:bg-red-500/15 border border-green-500/40 hover:border-red-500/40" 
                    : isOverdue
                    ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/40"
                    : isPending
                    ? "bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40"
                    : "bg-gray-500/10 hover:bg-blue-500/15 border border-gray-500/20 hover:border-blue-500/30"
                }
                ${isCurrentMonth ? "ring-2 ring-blue-500 ring-offset-1" : ""}
            `}
        >
            <span className="text-[10px] sm:text-xs font-medium mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {MONTHS_SHORT[month - 1]}
            </span>
            
            {isPaid ? (
                <div className="relative">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 group-hover:hidden" strokeWidth={2.5} />
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 hidden group-hover:block" strokeWidth={2.5} />
                </div>
            ) : isOverdue ? (
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" strokeWidth={2} />
            ) : isPending ? (
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" strokeWidth={2} />
            ) : (
                <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-400" strokeWidth={1.5} />
            )}

            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {isPaid ? "Revocar" : isOverdue ? "Vencido" : isPending ? "Pendiente" : "Registrar"}
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
    onMonthClick,
    onMonthRevoke 
}: { 
    student: Student; 
    payments: PaymentRecord[];
    onMonthClick: (month: number, year: number) => void;
    onMonthRevoke?: (month: number, year: number) => void;
}) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Calcular el año de inscripción del estudiante (usamos createdAt)
    const enrollmentYear = student.createdAt 
        ? new Date(student.createdAt).getFullYear() 
        : currentYear;
    
    // Función para verificar si un año tiene los 12 meses pagados
    const isYearFullyPaid = (year: number) => {
        const yearPayments = payments.filter(p => p.year === year && p.status === "paid");
        return yearPayments.length >= 12;
    };
    
    // Calcular el último año disponible
    // Si el año actual tiene 12 meses pagados, habilitar el siguiente año
    let maxYear = currentYear;
    while (isYearFullyPaid(maxYear)) {
        maxYear++;
    }
    
    // Generar array de años disponibles (desde inscripción hasta maxYear)
    const availableYears = Array.from(
        { length: maxYear - enrollmentYear + 1 }, 
        (_, i) => enrollmentYear + i
    );
    
    // Estado para el año seleccionado en el carrusel
    // Si el año actual está completamente pagado, seleccionar el siguiente por defecto
    const [selectedYear, setSelectedYear] = useState(() => {
        if (isYearFullyPaid(currentYear)) {
            return currentYear + 1;
        }
        return currentYear;
    });
    
    // Pagos del año seleccionado
    const yearPayments = payments.filter(p => p.year === selectedYear);
    const paidMonths = yearPayments.filter(p => p.status === "paid").length;
    
    // Progreso siempre sobre 12 meses
    const progress = (paidMonths / 12) * 100;

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
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                student.level === 'Beginner' ? 'bg-blue-500/20 text-blue-500' :
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
                            <span className="text-[11px] font-medium text-green-500">${student.monthlyFee}/mes</span>
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
                            <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                {paidMonths}/12
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selector de año minimalista */}
            {availableYears.length > 1 && (
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
            )}

            {/* Grid de meses compacto */}
            <div className="p-3">
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const payment = yearPayments.find(p => p.month === month);
                        const isCurrentMonthYear = month === currentMonth && selectedYear === currentYear;
                        
                        return (
                            <MonthCell
                                key={month}
                                month={month}
                                payment={payment}
                                onClick={() => onMonthClick(month, selectedYear)}
                                onRevoke={onMonthRevoke ? () => onMonthRevoke(month, selectedYear) : undefined}
                                isCurrentMonth={isCurrentMonthYear}
                                selectedYear={selectedYear}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
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
    const currentMonth = new Date().getMonth() + 1;
    const [showScanner, setShowScanner] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
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
                setSelectedMonth(pendingPaymentRequest.pendingMonth);
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
                audioRef.current.play().catch(() => {});
            }
            
            // Buscar el estudiante y abrir modal
            const student = students.find(s => s.id === data.studentId);
            if (student) {
                setSelectedStudent(student);
                setSelectedMonth(data.pendingMonth);
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
        setSelectedMonth(currentMonth);
        setSelectedYear(currentYear);
        setShowScanner(false);
        setShowConfirmModal(true);
    };

    const handleMonthClick = (student: Student, month: number, year: number) => {
        const payment = payments.find(
            p => p.studentId === student.id && p.month === month && p.year === year
        );
        
        if (payment?.status !== "paid") {
            setSelectedStudent(student);
            setSelectedMonth(month);
            setSelectedYear(year);
            setShowConfirmModal(true);
        }
    };

    const handleMonthRevoke = (student: Student, month: number, year: number) => {
        setSelectedStudent(student);
        setSelectedMonth(month);
        setSelectedYear(year);
        setShowRevokeModal(true);
    };

    const handleConfirmRevoke = () => {
        if (selectedStudent && selectedMonth && onPaymentRevoke) {
            onPaymentRevoke(selectedStudent.id, selectedMonth, selectedYear);
        }
        setShowRevokeModal(false);
    };

    const handleConfirmPayment = () => {
        if (selectedStudent && selectedMonth) {
            onPaymentConfirm(selectedStudent.id, selectedMonth, selectedYear);
            setShowConfirmModal(false);
            setShowSuccessModal(true);
            
            // Notificar al estudiante a través del socket
            if (socket && scanRequest) {
                socket.emit("payment-confirmed", {
                    studentId: selectedStudent.id,
                    month: selectedMonth,
                    year: selectedYear,
                    success: true,
                    message: `Pago de ${MONTHS[selectedMonth - 1]} ${selectedYear} confirmado exitosamente`
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
    const filteredStudents = students.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Estadísticas (solo del año actual y mes actual)
    const totalPendingCurrentMonth = students.filter(student => {
        const payment = payments.find(
            p => p.studentId === student.id && p.month === currentMonth && p.year === currentYear && p.status === "paid"
        );
        return !payment;
    }).length;
    
    const totalPaidCurrentMonth = payments.filter(
        p => p.status === "paid" && p.year === currentYear && p.month === currentMonth
    ).length;
    
    const totalRevenue = payments
        .filter(p => p.status === "paid" && p.year === currentYear)
        .reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="space-y-6">
            {/* Audio para notificación */}
            <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQkAHIlZ" preload="auto" />
            
            {/* Notificación flotante de escaneo QR */}
            {showScanNotification && scanRequest && (
                <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-right fade-in duration-300">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl shadow-2xl p-4 max-w-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                                <QrCode className="w-6 h-6" strokeWidth={2} />
                            </div>
                            <div>
                                <p className="font-bold text-sm">¡QR Escaneado!</p>
                                <p className="text-blue-100 text-xs">{scanRequest.studentName}</p>
                                <p className="text-blue-100 text-xs">#{scanRequest.studentNumber}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Header con estadísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-500" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pagados (Mes)</p>
                            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalPaidCurrentMonth}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-500" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pendientes (Mes)</p>
                            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalPendingCurrentMonth}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-blue-500" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Recaudado {currentYear}</p>
                            <p className="text-xl font-bold text-green-500">${totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-500" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Estudiantes</p>
                            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{students.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controles - Búsqueda y Escanear */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Buscador de estudiantes */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} strokeWidth={2} />
                    <input
                        type="text"
                        placeholder="Buscar alumno por nombre, número o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 transition-all"
                        style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-500/20"
                        >
                            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} strokeWidth={2} />
                        </button>
                    )}
                </div>

                {/* Botón para ir a escanear QR o ingresar ID */}
                <a
                    href="/pay/scan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 font-semibold rounded-2xl transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#014287]"
                    style={{
                        background: 'linear-gradient(100deg, #014287 0%, #2176c1 50%, #c1121f 100%)',
                        color: '#fff',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 16px 0 rgba(1,66,135,0.10), 0 2px 8px 0 rgba(193,18,31,0.10)',
                        letterSpacing: '0.5px',
                        fontSize: '1.08rem',
                        minWidth: '320px',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        zIndex: 1
                    }}
                >
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 600,
                        textShadow: '0 1px 8px rgba(1,66,135,0.10), 0 1px 8px rgba(193,18,31,0.10)'
                    }}>
                        <QrCode className="w-5 h-5" strokeWidth={2} />
                        Escanear QR / Ingresar ID
                    </span>
                </a>
            </div>

            {/* Leyenda compacta */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50" />
                    <span style={{ color: 'var(--text-tertiary)' }}>Pagado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/50" />
                    <span style={{ color: 'var(--text-tertiary)' }}>Pendiente</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
                    <span style={{ color: 'var(--text-tertiary)' }}>Vencido</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded ring-1 ring-blue-500" style={{ background: 'var(--surface)' }} />
                    <span style={{ color: 'var(--text-tertiary)' }}>Mes actual</span>
                </div>
            </div>

            {/* Lista de estudiantes con pagos */}
            <div className="space-y-4">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-12 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        <Search className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
                        <p style={{ color: 'var(--text-secondary)' }}>No se encontraron estudiantes con &quot;{searchTerm}&quot;</p>
                    </div>
                ) : (
                    filteredStudents.map((student) => {
                        const studentPayments = payments.filter(p => p.studentId === student.id);
                        
                        return (
                            <StudentPaymentCard
                                key={student.id}
                                student={student}
                                payments={studentPayments}
                                onMonthClick={(month, year) => handleMonthClick(student, month, year)}
                                onMonthRevoke={onPaymentRevoke ? (month, year) => handleMonthRevoke(student, month, year) : undefined}
                            />
                        );
                    })
                )}
            </div>

            {/* Modales */}
            <QRScannerModal
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onStudentDetected={handleStudentDetected}
                students={students}
            />

            <PaymentConfirmModal
                isOpen={showConfirmModal}
                student={selectedStudent}
                month={selectedMonth}
                year={selectedYear}
                onConfirm={handleConfirmPayment}
                onCancel={() => {
                    if (scanRequest) {
                        handleRejectScanPayment();
                    } else {
                        setShowConfirmModal(false);
                    }
                }}
                onReject={scanRequest ? handleRejectScanPayment : undefined}
                isFromScan={!!scanRequest}
            />

            <PaymentSuccessModal
                isOpen={showSuccessModal}
                student={selectedStudent}
                month={selectedMonth}
                onClose={() => setShowSuccessModal(false)}
            />

            {/* Modal de Revocar Pago */}
            {showRevokeModal && selectedStudent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-150" style={{ background: 'var(--modal-bg)' }}>
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                                <AlertTriangle className="w-8 h-8 text-white" strokeWidth={2} />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
                            Revocar Pago
                        </h3>

                        <p className="text-center text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                            ¿Estás seguro de revocar el pago de <span className="font-semibold text-blue-500">{selectedStudent.name}</span> del mes de <span className="font-semibold text-red-500">{MONTHS[selectedMonth - 1]} {selectedYear}</span>?
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmRevoke}
                                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/25"
                            >
                                Sí, Revocar
                            </button>
                            <button
                                onClick={() => setShowRevokeModal(false)}
                                className="px-5 py-3 font-semibold rounded-xl transition-colors"
                                style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
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

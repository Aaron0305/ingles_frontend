"use client";

import { useState, useEffect, useRef } from "react";
import { Student } from "./credential";
import { Socket } from "socket.io-client";
import { holidaysApi, CustomHoliday } from "@/lib/api";
import {
    Calendar, Users, CheckCircle, XCircle, Search, Clock, DollarSign, AlertTriangle, Filter, Sparkles, IdCard,
    CircleDollarSign, Check, QrCode, X, Loader2, ChevronDown, ShieldX, Banknote, ArrowRightLeft
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
    amount: number;  // Monto que pagó
    amountExpected?: number;  // Monto que debía pagar
    amountPending?: number;   // Monto que le falta
    paymentPercentage?: number; // Porcentaje pagado (0-100)
    status: "paid" | "pending" | "overdue";
    paidAt?: string;
    confirmedBy?: string;
    paymentMethod?: "efectivo" | "transferencia"; // Método de pago
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
    onConfirm: (amountPaid: number, paymentMethod: "efectivo" | "transferencia") => void;  // Ahora recibe monto y método
    onCancel: () => void;
    onReject?: () => void;
    isFromScan?: boolean;
    existingPayment?: PaymentRecord | null;  // Pago existente si hay uno
}

interface PaymentsPanelProps {
    students: Student[];
    payments: PaymentRecord[];
    onPaymentConfirm: (studentId: string, month: number, year: number, amountPaid?: number, amountExpected?: number, paymentMethod?: "efectivo" | "transferencia") => void;
    onPaymentRevoke?: (studentId: string, month: number, year: number) => Promise<void>;
    userRole?: "admin" | "superadmin";
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

// ============================================
// CÁLCULO DINÁMICO DE DÍAS FESTIVOS MEXICANOS
// ============================================

// Obtener el N-ésimo día de la semana de un mes (ej: primer lunes, tercer lunes)
const getNthDayOfWeekInMonth = (year: number, month: number, dayOfWeek: number, n: number): Date => {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();

    // Calcular cuántos días hay que avanzar para llegar al primer día de la semana deseado
    let daysToAdd = dayOfWeek - firstDayOfWeek;
    if (daysToAdd < 0) daysToAdd += 7;

    // Avanzar (n-1) semanas más
    daysToAdd += (n - 1) * 7;

    return new Date(year, month, 1 + daysToAdd);
};

// Algoritmo de Computus para calcular la fecha de Pascua 
const getEasterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
};

// Obtener Jueves y Viernes Santo basados en Pascua
// Obtener Jueves, Viernes y Sábado Santo basados en Pascua
const getHolyWeekDays = (year: number): Date[] => {
    const easter = getEasterSunday(year);
    const dates: Date[] = [];

    // Jueves Santo (3 días antes de Pascua)
    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    dates.push(holyThursday);

    // Viernes Santo (2 días antes de Pascua)
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    dates.push(goodFriday);

    // Sábado Santo (1 día antes de Pascua)
    const holySaturday = new Date(easter);
    holySaturday.setDate(easter.getDate() - 1);
    dates.push(holySaturday);

    return dates;
};

// Formato de fecha YYYY-MM-DD
const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Generar todos los feriados de un año (FECHAS REALES, no lunes cívicos)
const getHolidaysForYear = (year: number): Set<string> => {
    const holidays = new Set<string>();

    // Días fijos que NO se mueven
    holidays.add(`${year}-05-01`); // Día del Trabajo
    holidays.add(`${year}-09-16`); // Independencia

    // Días oficiales recorridos al lunes (Ley Federal del Trabajo - Puentes)
    // 5 de Febrero (Constitución) -> Primer lunes de febrero
    const constitutionDay = getNthDayOfWeekInMonth(year, 1, 1, 1);
    holidays.add(formatDateStr(constitutionDay));

    // 21 de Marzo (Juárez) -> Tercer lunes de marzo
    const juarezDay = getNthDayOfWeekInMonth(year, 2, 1, 3);
    holidays.add(formatDateStr(juarezDay));

    // 20 de Noviembre (Revolución) -> Tercer lunes de noviembre
    const revolutionDay = getNthDayOfWeekInMonth(year, 10, 1, 3);
    holidays.add(formatDateStr(revolutionDay));

    // Jueves, Viernes y Sábado Santo (calculados dinámicamente)
    const holyWeek = getHolyWeekDays(year);
    holyWeek.forEach(d => holidays.add(formatDateStr(d)));

    return holidays;
};

// Cache de feriados por año para mayor eficiencia
const holidaysCache: Map<number, Set<string>> = new Map();

const getHolidaysSet = (year: number): Set<string> => {
    if (!holidaysCache.has(year)) {
        holidaysCache.set(year, getHolidaysForYear(year));
    }
    return holidaysCache.get(year)!;
};

// Custom holidays cargados desde la base de datos (variable de módulo)
let _customHolidaysSet: Set<string> = new Set();
// Días festivos predefinidos desactivados por el admin
let _disabledHolidaysSet: Set<string> = new Set();

// Función para actualizar los custom holidays desde fuera
function setCustomHolidaysData(holidays: CustomHoliday[]): void {
    // Separar: custom activos vs días predefinidos desactivados
    const activeDates: string[] = [];
    const disabledDates: string[] = [];

    holidays.forEach(h => {
        if (h.isDisabled) {
            disabledDates.push(h.date);
        } else {
            activeDates.push(h.date);
        }
    });

    _customHolidaysSet = new Set(activeDates);
    _disabledHolidaysSet = new Set(disabledDates);
    // Limpiar cache de feriados para que se recalcule todo
    holidaysCache.clear();
}

const isHoliday = (date: Date): boolean => {
    // Forzamos mediodía en una copia para evitar desfases de zona horaria
    const dCopy = new Date(date);
    dCopy.setHours(12, 0, 0, 0);

    const year = dCopy.getFullYear();
    const dateStr = formatDateStr(dCopy);

    // Si este día fue DESACTIVADO por el admin, NO es festivo
    if (_disabledHolidaysSet.has(dateStr)) return false;

    // Verificar si es un feriado calculado (predefinido)
    if (getHolidaysSet(year).has(dateStr)) return true;

    // Verificar si es un custom holiday (personalizado por el admin)
    if (_customHolidaysSet.has(dateStr)) return true;

    // Vacaciones invierno: 23-31 dic, 1-12 ene (segunda semana)
    const mIdx = dCopy.getMonth();
    const dIdx = dCopy.getDate();

    // Verificar vacaciones de invierno específicas
    // Ciclo 2025-2026: 19 de Dic 2025 al 7 de Ene 2026
    if (year === 2025 && mIdx === 11 && dIdx >= 19) return true;
    if (year === 2026 && mIdx === 0 && dIdx <= 7) return true;

    // Ciclo 2026-2027: 19 de Dic 2026 al 7 de Ene 2027
    if (year === 2026 && mIdx === 11 && dIdx >= 19) return true;
    if (year === 2027 && mIdx === 0 && dIdx <= 7) return true;

    // Ciclo 2027-2028: 18 de Dic 2027 al 6 de Ene 2028
    if (year === 2027 && mIdx === 11 && dIdx >= 18) return true;
    if (year === 2028 && mIdx === 0 && dIdx <= 6) return true;

    // Fallback genérico
    if (year > 2028) {
        if (mIdx === 11 && dIdx >= 20) return true;
        if (mIdx === 0 && dIdx <= 6) return true;
    }

    return false;
};

const getNextClassDay = (date: Date, classDays: number[]): Date => {
    const nextDate = new Date(date);
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

// ============================================
// FUNCIÓN UNIFICADA: Calcular siguiente fecha de pago con compensación de festivos
// ============================================
// Los festivos que caen en días de clase DENTRO del ciclo de 28 días extienden
// el ciclo por N días de clase hábiles. Los festivos encontrados FUERA del ciclo
// (durante la búsqueda de compensación) se SALTAN — se compensarán en el siguiente ciclo.
//
// Ejemplo: Alumno Lun+Jue, inscrito Feb 16. Base = Mar 16.
//   Mar 12 (Jue, personalizado) + Mar 16 (Lun, Natalicio) = 2 días perdidos.
//   Caminando: Mar 19 (Jue, hábil) = reposición 1, cuenta 2→1.
//   Mar 23 (Lun, hábil) = reposición 2, cuenta 1→0 → PAGO = Mar 23. ✅
const calculateNextCycleDate = (pDate: Date, cycleDays: number, studentClassDays: number[]): Date => {
    const baseDate = new Date(pDate);
    baseDate.setDate(pDate.getDate() + cycleDays);

    // Contar festivos en días de clase dentro del período original
    let holidaysInClassDays = 0;
    const checkDate = new Date(pDate);

    for (let d = 0; d < cycleDays; d++) {
        checkDate.setDate(checkDate.getDate() + 1);
        if (isHoliday(checkDate)) {
            const dow = checkDate.getDay();
            if (studentClassDays.length === 0 || studentClassDays.includes(dow)) {
                holidaysInClassDays++;
            }
        }
    }

    let effectiveDate = new Date(baseDate);

    if (holidaysInClassDays > 0) {
        let compensationCount = holidaysInClassDays;
        const cursor = new Date(baseDate);

        // Caminar día a día buscando días de clase hábiles para compensar:
        //   - Si es festivo → saltar (no se compensa aquí, se hará en el siguiente ciclo)
        //   - Si es hábil y compensationCount > 0 → compensationCount--
        //   - Cuando compensationCount llega a 0 → ESE DÍA es la fecha de pago
        while (true) {
            cursor.setDate(cursor.getDate() + 1);
            const dow = cursor.getDay();
            const isClassDay = studentClassDays.length === 0 || studentClassDays.includes(dow);

            if (!isClassDay) continue;

            // Saltar días festivos (no cuentan como compensación ni agregan más)
            if (isHoliday(cursor)) continue;

            // Día de clase hábil: cuenta como compensación
            if (compensationCount > 0) {
                compensationCount--;
                if (compensationCount === 0) {
                    // La compensación se completó: ESTE día es la nueva fecha de pago
                    effectiveDate = new Date(cursor);
                    break;
                }
            } else {
                effectiveDate = new Date(cursor);
                break;
            }
        }
    }

    // Para el caso sin festivos: mover al siguiente día de clase hábil si es necesario
    while (isHoliday(effectiveDate) || (studentClassDays.length > 0 && !studentClassDays.includes(effectiveDate.getDay()))) {
        effectiveDate.setDate(effectiveDate.getDate() + 1);
    }

    return effectiveDate;
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
        periods: 26, // 26 catorcenas por año (365/14 ≈ 26)
        label: "Catorcena",
        shortLabel: "C",
        getPeriodLabel: (i) => `C${i}`,
        getPeriodFullName: (i) => `Catorcena ${i}`,
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

const isStudentOverdue = (student: Student, allPayments: PaymentRecord[]): boolean => {
    // Si el estudiante está inactivo, no considerarlo
    if (student.status === "inactive") return false;

    const studentPayments = allPayments.filter(p => p.studentId === student.id && p.status === 'paid');
    const scheme = getStudentScheme(student);

    const enrollmentDate = student.enrollmentDate
        ? new Date(student.enrollmentDate.replace(/-/g, "/"))
        : new Date(new Date().getFullYear(), 0, 1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (scheme === 'daily') {
        // Para diario: usar lógica existente
        let current = new Date(enrollmentDate);
        current.setHours(0, 0, 0, 0);
        const year = today.getFullYear();

        if (current.getFullYear() < year) {
            current = new Date(year, 0, 1);
        }

        while (current < today) {
            if (isHoliday(current)) {
                current.setDate(current.getDate() + 1);
                continue;
            }
            const dayOfWeek = current.getDay();
            const classDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];

            if (classDays.length === 0 || classDays.includes(dayOfWeek)) {
                const dayOfYear = getDayOfYear(current);
                const hasPayment = studentPayments.some(p => p.year === current.getFullYear() && p.month === dayOfYear);
                if (!hasPayment) return true;
            }
            current.setDate(current.getDate() + 1);
        }
        return false;
    }

    // Para esquemas continuos (weekly, biweekly, monthly_28)
    // Usar la MISMA lógica que el grid visual
    const enrollment = new Date(enrollmentDate);
    enrollment.setHours(12, 0, 0, 0);

    const cycleDays = scheme === 'weekly' ? 7 : (scheme === 'biweekly' ? 14 : 28);
    const pPerYear = scheme === 'weekly' ? 52 : (scheme === 'biweekly' ? 26 : 13);

    // Generar schedule igual que el grid
    const schedule: { date: Date; cycleMonth: number; cycleYear: number }[] = [];
    let pDate = new Date(enrollment);

    // El primer pago es el día de inscripción (ciclo 1)
    schedule.push({
        date: new Date(enrollment),
        cycleMonth: 1,
        cycleYear: enrollment.getFullYear()
    });

    // Generar suficientes ciclos
    const studentClassDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];
    for (let i = 0; i < pPerYear * 3; i++) {
        const next = calculateNextCycleDate(pDate, cycleDays, studentClassDays);

        const cMonth = i + 2;
        const cYear = next.getFullYear();

        schedule.push({ date: next, cycleMonth: cMonth, cycleYear: cYear });

        // Salir si ya pasamos mucho del día actual
        if (cYear > today.getFullYear() + 1) break;
        pDate = next;
    }

    // Verificar si algún período pasado no está pagado
    for (const s of schedule) {
        if (s.date < today) {
            const hasPayment = studentPayments.some(p => p.year === s.cycleYear && p.month === s.cycleMonth);
            if (!hasPayment) return true;
        }
    }

    return false;
};

// Helper para descripción de pagos
const getPaymentDescription = (student: Student, scheme: PaymentScheme, periodIndex: number, year: number) => {
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    // Esquemas continuos: calcular fechas reales desde inscripción
    if (["monthly_28", "weekly", "biweekly"].includes(scheme)) {
        const enrollment = student.enrollmentDate
            ? new Date(student.enrollmentDate.replace(/-/g, "/"))
            : new Date(year, 0, 1);

        // Normalizar inscripción a mediodía para evitar problemas de TZ
        const startPoint = new Date(enrollment);
        startPoint.setHours(12, 0, 0, 0);

        const cycleDays = scheme === 'weekly' ? 7 : (scheme === 'biweekly' ? 14 : 28);
        const typeLabel = scheme === 'weekly' ? 'Semanal' : (scheme === 'biweekly' ? 'Catorcenal' : 'Mensual');

        // Obtener días de clase del estudiante para filtrar festivos (igual que el grid)
        const studentClassDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];

        // Función auxiliar para calcular siguiente fecha (usa función unificada)
        const calculateNext = (pDate: Date) => calculateNextCycleDate(pDate, cycleDays, studentClassDays);

        // Iterar desde inscripción hasta llegar al periodo deseado
        // periodIndex 1 = inscripción.
        let startDate = new Date(startPoint);

        // Si periodIndex > 1, calculamos los pasos intermedios
        for (let i = 1; i < periodIndex; i++) {
            startDate = calculateNext(startDate);
        }

        const nextDate = calculateNext(startDate);

        const d1 = startDate.getDate();
        const m1 = months[startDate.getMonth()];
        const d2 = nextDate.getDate();
        const m2 = months[nextDate.getMonth()];

        return `Pago ${typeLabel} del ${d1} de ${m1} al ${d2} de ${m2}. Próximo pago el ${d2} de ${m2}.`;
    }

    if (scheme === "daily") {
        // periodIndex representa el Día del Año (1-366)
        const date = new Date(year, 0, periodIndex);

        const dayName = days[date.getDay()];
        const dayNum = date.getDate();
        const monthName = months[date.getMonth()];

        return `Pago del día ${dayName} ${dayNum} de ${monthName}`;
    }

    return `Pago #${periodIndex} - ${year}`;
};

// ============================================
// MODAL DE CONFIRMACIÓN DE PAGO
// ============================================

function PaymentConfirmModal({ isOpen, student, periodIndex, year, onConfirm, onCancel, onReject, isFromScan, existingPayment }: PaymentConfirmModalProps) {
    const [isConfirming, setIsConfirming] = useState(false);
    const [amountPaid, setAmountPaid] = useState<string>("");
    const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");

    // Reset amount and payment method when modal opens
    useEffect(() => {
        if (isOpen && student) {
            setPaymentMethod("efectivo"); // Reset al abrir
            // Si hay un pago parcial existente, mostrar solo lo que falta
            setTimeout(() => {
                if (existingPayment && existingPayment.amountPending && existingPayment.amountPending > 0) {
                    setAmountPaid(existingPayment.amountPending.toString());
                } else {
                    setAmountPaid(student.monthlyFee.toString());
                }
            }, 0);
        }
    }, [isOpen, student, existingPayment]);

    if (!isOpen || !student) return null;

    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];
    const description = getPaymentDescription(student, scheme, periodIndex, year);

    // Usar el pago existente si hay uno, sino usar el fee completo
    const expectedAmount = existingPayment?.amountExpected || student.monthlyFee;
    const currentPaidAmount = existingPayment?.amount || 0;
    const currentPendingAmount = existingPayment?.amountPending || expectedAmount;

    const newPaidAmount = amountPaid === "" ? 0 : (parseFloat(amountPaid) || 0);
    const totalPaidAmount = currentPaidAmount + newPaidAmount;
    const finalPendingAmount = Math.max(expectedAmount - totalPaidAmount, 0);
    const percentage = Math.min(Math.round((totalPaidAmount / expectedAmount) * 100), 100);
    const isPartialPayment = totalPaidAmount > 0 && totalPaidAmount < expectedAmount;
    const hasExistingPartial = existingPayment && existingPayment.paymentPercentage !== undefined && existingPayment.paymentPercentage < 100;

    const handleConfirm = async () => {
        if (newPaidAmount <= 0) return;
        setIsConfirming(true);
        await new Promise(resolve => setTimeout(resolve, 800));
        onConfirm(newPaidAmount, paymentMethod);
        setIsConfirming(false);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200" style={{ background: 'var(--modal-bg)' }}>

                {/* Título */}
                <h3 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
                    {isPartialPayment ? 'Pago Parcial' : 'Confirmar Pago'}
                </h3>

                {/* Card de Información */}
                <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                            {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-sm text-gray-800 dark:text-white">{student.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">#{student.studentNumber}</p>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Concepto</p>
                        <p className="text-base font-bold text-blue-600 dark:text-blue-400 px-2 leading-tight">
                            {description}
                        </p>
                    </div>
                </div>

                {/* Sección de Monto */}
                <div className="mt-6 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Monto esperado</p>
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-300">${expectedAmount}</p>
                    </div>

                    {/* Información de pago parcial existente */}
                    {hasExistingPartial && existingPayment && (
                        <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                            <p className="text-xs text-green-600 dark:text-green-400 text-center">
                                ✓ Ya pagaste <strong>${currentPaidAmount.toFixed(0)}</strong>, faltan <strong>${currentPendingAmount.toFixed(0)}</strong>
                            </p>
                        </div>
                    )}

                    {/* Input de monto pagado */}
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                        <input
                            type="number"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-2xl font-bold text-center rounded-xl border-2 transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            style={{
                                background: 'var(--input-bg)',
                                color: 'var(--text-primary)',
                                borderColor: isPartialPayment ? '#f59e0b' : totalPaidAmount >= expectedAmount ? '#22c55e' : '#e5e7eb'
                            }}
                            min="0"
                            max={currentPendingAmount}
                            step="50"
                        />
                    </div>

                    {/* Barra de progreso */}
                    <div className="mt-3 mb-2">
                        <div className="h-3 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 rounded-full ${percentage === 0 ? 'bg-transparent' : // Fix para 0%
                                    percentage >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                        percentage >= 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                            'bg-gradient-to-r from-red-400 to-red-500'
                                    }`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-500">{percentage}% del pago</span>
                            {isPartialPayment && (
                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                    Resta: ${finalPendingAmount.toFixed(0)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Mensaje de pago parcial */}
                    {isPartialPayment && (
                        <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                                ⚠️ El estudiante deberá pagar <strong>${finalPendingAmount.toFixed(0)}</strong> en su próxima clase
                            </p>
                        </div>
                    )}

                    <p className="text-xs text-gray-400 mt-2 text-center capitalize">
                        Esquema: {config.label}
                    </p>
                </div>

                {/* Selector de Método de Pago */}
                <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center uppercase tracking-wider">
                        Método de Pago
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod("efectivo")}
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${paymentMethod === "efectivo"
                                ? "bg-green-500/15 border-green-500 text-green-600 dark:text-green-400 shadow-sm shadow-green-500/10"
                                : "bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                                }`}
                        >
                            <Banknote className={`w-4 h-4 ${paymentMethod === "efectivo" ? "text-green-500" : "text-gray-400"}`} strokeWidth={2} />
                            Efectivo
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentMethod("transferencia")}
                            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${paymentMethod === "transferencia"
                                ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10"
                                : "bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                                }`}
                        >
                            <ArrowRightLeft className={`w-4 h-4 ${paymentMethod === "transferencia" ? "text-blue-500" : "text-gray-400"}`} strokeWidth={2} />
                            Transferencia
                        </button>
                    </div>
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
                        disabled={isConfirming || newPaidAmount <= 0}
                        className={`flex-1 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${isPartialPayment
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-green-500/25'
                            }`}
                    >
                        {isConfirming ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5" />
                                Confirmando...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" strokeWidth={2} />
                                {isPartialPayment ? `Confirmar $${newPaidAmount}` : 'Confirmar Pago'}
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
// MODAL DE CANCELACIÓN DE PAGO
// ============================================

function PaymentCancelModal({
    isOpen,
    student,
    periodIndex,
    year,
    payment,
    onConfirm,
    onCancel,
    isProcessing
}: {
    isOpen: boolean;
    student: Student | null;
    periodIndex: number;
    year: number;
    payment?: PaymentRecord | null;
    onConfirm: () => void;
    onCancel: () => void;
    isProcessing: boolean;
}) {
    if (!isOpen || !student) return null;

    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-150" style={{ background: 'var(--modal-bg)' }}>
                {/* Icono de advertencia */}
                <div className="relative flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                        <AlertTriangle className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                    ¿Cancelar este pago?
                </h3>

                <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                    Estás a punto de eliminar el pago de <span className="font-semibold text-blue-500">{student.name}</span> correspondiente a <span className="font-semibold">{config.getPeriodFullName(periodIndex)}</span> del {year}.
                </p>

                {payment && (
                    <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                        <div className="flex justify-between items-center">
                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Monto pagado:</span>
                            <span className="font-bold text-red-500">${payment.amount}</span>
                        </div>
                        {payment.paidAt && (
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Fecha de pago:</span>
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                    {new Date(payment.paidAt).toLocaleDateString('es-MX')}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <p className="text-xs text-center mb-4 text-amber-500">
                    ⚠️ Esta acción eliminará el registro de pago de la base de datos y no se puede deshacer.
                </p>

                {/* Botones */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 py-3 font-semibold rounded-xl transition-colors"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                    >
                        No, mantener
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-1 py-3 text-white font-semibold rounded-xl transition-all shadow-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5" />
                                Cancelando...
                            </>
                        ) : (
                            <>
                                <X className="w-5 h-5" strokeWidth={2} />
                                Sí, cancelar pago
                            </>
                        )}
                    </button>
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
    customLabel,
    customTooltip
}: {
    periodIndex: number;
    payment?: PaymentRecord;
    onClick: () => void;
    onRevoke: () => void;
    isCurrentPeriod: boolean;
    selectedYear: number;
    config: SchemeConfig;
    isOverdue?: boolean;
    customLabel?: string;
    customTooltip?: string;
}) {
    const isPaid = payment?.status === "paid";

    // Detectar pago parcial
    const isPartialPayment = isPaid && payment?.paymentPercentage !== undefined && payment.paymentPercentage < 100;
    const paymentPercentage = payment?.paymentPercentage ?? 100;

    // Status visual
    let statusColor = "bg-gray-500/10 hover:bg-blue-500/15 border-gray-500/20 hover:border-blue-500/30";

    if (isPartialPayment) {
        // Estilo para pagos parciales (naranja)
        statusColor = "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 hover:border-amber-500/60";
    } else if (isPaid) {
        statusColor = "bg-green-500/15 hover:bg-red-500/15 border-green-500/40 hover:border-red-500/40";
    } else if (isOverdue) {
        // Estilo para pagos vencidos (Rojo)
        statusColor = "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50 animate-pulse-slow";
    } else if (isCurrentPeriod) {
        // Estilo para el día de hoy pendiente (Naranja/Ámbar)
        statusColor = "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/50";
    }

    const handleClick = () => {
        // Si es pago parcial, permitir agregar el pago restante
        if (isPartialPayment) {
            onClick();
        } else if (isPaid) {
            // Si ya está pagado completamente, abrir modal de cancelación
            onRevoke();
        } else {
            // Pago pendiente o vencido, abrir modal de pago
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

            {isPartialPayment ? (
                // Mostrar ícono con mitad verde/mitad naranja para pagos parciales usando SVG
                <div className="relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    <svg
                        className="w-full h-full transform -rotate-90"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        {/* Círculo de fondo (naranja) */}
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="#f59e0b"
                            strokeWidth="2"
                            fill="none"
                        />
                        {/* Arco verde (porcentaje pagado) usando stroke-dasharray */}
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="#22c55e"
                            strokeWidth="2"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 10 * (paymentPercentage / 100)} ${2 * Math.PI * 10}`}
                            className="transition-all duration-300"
                        />
                    </svg>
                    {/* Símbolo de dólar en el centro */}
                    <DollarSign className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 text-white z-10" strokeWidth={3} />
                </div>
            ) : isPaid ? (
                <div className="relative">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 group-hover:hidden" strokeWidth={2.5} />
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 hidden group-hover:block" strokeWidth={2.5} />
                </div>
            ) : isOverdue ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500/70 group-hover:text-red-500" strokeWidth={1.5} />
            ) : isCurrentPeriod ? (
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500/70 group-hover:text-amber-500" strokeWidth={1.5} />
            ) : (
                <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-400" strokeWidth={1.5} />
            )}

            {/* Tooltip */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {isPartialPayment
                    ? `Agregar pago restante: $${payment?.amountPending} (Ya pagado: $${payment?.amount})`
                    : isPaid ? "Click para cancelar pago" :
                        isOverdue ? `¡Vencido! Pagar ${customTooltip || config.getPeriodFullName(periodIndex)}` :
                            isCurrentPeriod ? `Pendiente hoy - Pagar ${customTooltip || config.getPeriodFullName(periodIndex)}` :
                                `Pagar ${customTooltip || config.getPeriodFullName(periodIndex)}`}
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
    onPeriodRevoke: (periodIndex: number, year: number) => void;
}) {
    const currentYear = new Date().getFullYear();
    const scheme = getStudentScheme(student);
    const config = SCHEME_CONFIGS[scheme];

    // Calcular el año de inscripción del estudiante
    const enrollmentYear = student.enrollmentDate
        ? new Date(student.enrollmentDate.replace(/-/g, "/")).getFullYear()
        : currentYear;

    // Función para verificar si un año tiene todos los periodos pagados
    // Ajuste: solo contar meses desde el mes de inscripción en el año de inscripción
    const isYearFullyPaid = (year: number) => {
        // Generar schedule para ese año para saber EXACTAMENTE cuántos pagos tocan
        const enrollment = student.enrollmentDate
            ? new Date(student.enrollmentDate.replace(/-/g, "/"))
            : new Date(year, 0, 1);
        enrollment.setHours(12, 0, 0, 0);

        // Si es daily, lógica simple (no aplica carrusel complejo igual)
        if (scheme === 'daily') return false;

        // Simular schedule para contar períodos en ESE año
        let count = 0;
        const cycleDays = scheme === 'weekly' ? 7 : (scheme === 'biweekly' ? 14 : 28);
        let pDate = new Date(enrollment);

        // Si el año a evaluar es anterior al de inscripción, está "pagado" (vacío)
        if (year < enrollment.getFullYear()) return true;

        // Avanzar el puntero hasta el año deseado si es necesario
        // Pero para simplificar, generamos desde inscripción y filtramos

        // Primer pago
        if (enrollment.getFullYear() === year) count++;

        // Generar ciclos suficientes (ej. 5 años hacia adelante máx)
        const yearCheckClassDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];
        for (let i = 0; i < 200; i++) {
            const next = calculateNextCycleDate(pDate, cycleDays, yearCheckClassDays);

            if (next.getFullYear() === year) count++;
            if (next.getFullYear() > year) break;

            pDate = next;
        }

        // Contar pagos REALES registrados en base de datos para ese año
        // IMPORTANTE: Solo contar pagos que correspondan al schedule actual (posteriores a la fecha de inscripción)
        const paymentsInYear = payments.filter(p => p.year === year && p.status === 'paid');

        // Si no hay obligación de pagos ese año (ej. futuro lejano o año pasado sin inscripción), no bloquear
        if (count === 0) return false;

        return paymentsInYear.length >= count;
    };

    // Calcular el último año disponible:
    // Si el año actual está pagado al 100%, permitir ver el año siguiente.
    // Iterar para encontrar hasta qué año futuro permitir (si pagaron por adelantado 2 años, permitir ver hasta el 3ro)
    let maxYear = currentYear;
    while (isYearFullyPaid(maxYear)) {
        maxYear++;
    }
    // Siempre permitir al menos ver el año siguiente si estamos al final del año actual (mes > 10)
    if (new Date().getMonth() >= 10 && maxYear === currentYear) {
        maxYear++;
    }

    // Generar array de años disponibles
    const availableYears = Array.from(
        { length: maxYear - enrollmentYear + 1 },
        (_, i) => enrollmentYear + i
    );

    // Año inicial: si la inscripción es futura, mostrar directamente ese año.
    const initialYear = currentYear < enrollmentYear
        ? enrollmentYear
        : (isYearFullyPaid(currentYear) ? currentYear + 1 : currentYear);
    const clampedInitialYear = Math.min(Math.max(initialYear, enrollmentYear), maxYear);

    const [selectedYear, setSelectedYear] = useState(() => clampedInitialYear);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    // Calcular periodos totales y el índice de inicio para este estudiante en este año
    // IMPORTANTE: Definir enrollmentDateObj ANTES de usarlo
    const enrollmentDateObj = student.enrollmentDate
        ? new Date(student.enrollmentDate.replace(/-/g, "/"))
        : new Date(selectedYear, 0, 1);
    const isEnrollmentYearActual = enrollmentDateObj.getFullYear() === selectedYear;

    // Pagos del año seleccionado
    // IMPORTANTE: Filtrar pagos que correspondan al schedule actual (posteriores a la fecha de inscripción)
    const yearPayments = payments.filter(p => p.year === selectedYear);

    const paidPeriodsCount = yearPayments.filter(p => p.status === "paid").length;



    // GENERACIÓN DE SCHEDULE (Movido aquí para calcular totales dinámicos)
    // Esto asegura que indicadores como "0/13" o "0/26" sean exactos según el año.
    const dynamicSchedule: { date: Date; cycleMonth: number; cycleYear: number }[] = [];

    if (scheme !== 'daily') {
        const enrollment = new Date(enrollmentDateObj);
        enrollment.setHours(12, 0, 0, 0);

        let pDate = new Date(enrollment);
        const cycleDays = scheme === 'weekly' ? 7 : (scheme === 'biweekly' ? 14 : 28);
        const pPerYear = scheme === 'weekly' ? 52 : (scheme === 'biweekly' ? 26 : 13);

        dynamicSchedule.push({
            date: new Date(enrollment),
            cycleMonth: 1,
            cycleYear: enrollment.getFullYear()
        });

        // Generar ciclos suficientes hasta cubrir el año seleccionado (y el siguiente para referencias)
        // Se evita el límite fijo de 5 años para que siga funcionando en 2028, 2030, etc.
        let safeCounter = 0;
        let cycleIndex = 1; // Ya se agregó el ciclo 1 (inscripción)
        const maxCycles = pPerYear * 30; // ~30 años como tope de seguridad

        // Obtener días de clase del estudiante para filtrar festivos
        const studentClassDaysGrid = student.classDays && student.classDays.length > 0 ? student.classDays : [];
        while (safeCounter < maxCycles) {
            const next = calculateNextCycleDate(pDate, cycleDays, studentClassDaysGrid);

            cycleIndex += 1;
            const cMonth = cycleIndex;
            const cYear = next.getFullYear();

            dynamicSchedule.push({ date: next, cycleMonth: cMonth, cycleYear: cYear });
            if (cYear > selectedYear + 1) break;
            pDate = next;

            safeCounter++;
        }
    }

    const periodsInSelectedYear = scheme === 'daily'
        ? []
        : dynamicSchedule.filter(s => s.cycleYear === selectedYear);

    const totalPeriodsInYear = scheme === 'daily' ? 30 : periodsInSelectedYear.length;

    // Progreso
    const progress = (paidPeriodsCount / totalPeriodsInYear) * 100;

    // Navegación del carrusel
    const canGoPrev = selectedYear > enrollmentYear;
    const canGoNext = selectedYear < maxYear;

    // Para daily: identificar el primer día pendiente futuro/no vencido
    let firstFuturePendingDayOfYear: number | null = null;
    if (scheme === 'daily') {
        const daysInMonth = 31; // Máximo posible, solo para iterar
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const enrollmentDate = student.enrollmentDate
            ? new Date(student.enrollmentDate.replace(/-/g, "/"))
            : new Date(currentYear, 0, 1);
        enrollmentDate.setHours(0, 0, 0, 0);
        let found = false;
        for (let m = 0; m < 12 && !found; m++) {
            const dim = new Date(selectedYear, m + 1, 0).getDate();
            for (let d = 1; d <= dim && !found; d++) {
                const date = new Date(selectedYear, m, d);
                if (date < enrollmentDate) continue;
                if (isHoliday(date)) continue;
                const dayOfWeek = date.getDay();
                if (student.classDays && student.classDays.length > 0 && !student.classDays.includes(dayOfWeek)) continue;
                const dayOfYear = getDayOfYear(date);
                const payment = payments.find(p => p.studentId === student.id && p.year === selectedYear && p.month === dayOfYear);
                if (!payment) {
                    if (date >= today) {
                        firstFuturePendingDayOfYear = dayOfYear;
                        found = true;
                    }
                }
            }
        }
    }

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
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${student.level.startsWith('Beginner') ? 'bg-blue-500/20 text-blue-500' :
                                student.level.startsWith('Intermediate') ? 'bg-amber-500/20 text-amber-500' :
                                    'bg-emerald-500/20 text-emerald-500'
                                }`}>
                                {student.level.startsWith('Beginner') ? 'B' : student.level.startsWith('Intermediate') ? 'I' : 'A'}{student.level.includes('1') ? '1' : '2'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                #{student.studentNumber}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>•</span>
                            <span className="text-[11px] font-medium text-green-500">${student.monthlyFee}/{config.shortLabel}</span>
                            {/* Mostrar días de clase */}
                            {student.classDays && student.classDays.length > 0 && (
                                <>
                                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>•</span>
                                    <span className="text-[11px] font-medium text-blue-500 capitalize">
                                        {student.classDays.map(d => ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d]).join(", ")}
                                    </span>
                                </>
                            )}
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
                                {paidPeriodsCount}/{totalPeriodsInYear}
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
                                ? new Date(student.enrollmentDate.replace(/-/g, "/"))
                                : new Date(selectedYear, 0, 1);
                            // Normalizar enrollmentDate para ignorar horas
                            enrollmentDate.setHours(0, 0, 0, 0);

                            // Generar obligaciones de pago
                            const obligations: { originalDate: Date; effectiveDate: Date; isShifted: boolean }[] = [];

                            for (let day = 1; day <= daysInMonth; day++) {
                                // Crear fecha al mediodía local para evitar que desfases de zona horaria cambien el GETDAY o DATE
                                const date = new Date(selectedYear, selectedMonth, day, 12, 0, 0);

                                // Ocultar días anteriores a la inscripción
                                if (date < enrollmentDate) continue;

                                const dayOfWeek = date.getDay();

                                // Si NO es día de clase, ignorar
                                if (student.classDays && student.classDays.length > 0 && !student.classDays.includes(dayOfWeek)) {
                                    continue;
                                }

                                // Es un día de clase
                                if (isHoliday(date)) {
                                    // Si es festivo, NO se genera cobro
                                    continue;
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

                                // IMPORTANTE: Verificar que el pago corresponda realmente a este schedule
                                // filtrando pagos que fueron creados antes de la fecha de inscripción actual
                                const payment = yearPayments.find(p => {
                                    // Debe coincidir el día del año y año
                                    if (p.month !== originalDayOfYear) return false;

                                    // Solo considerar pagos confirmados
                                    if (p.status !== 'paid') return false;

                                    return true;
                                });

                                const todayNormalized = new Date(today);
                                todayNormalized.setHours(0, 0, 0, 0);
                                const isPast = effectiveDate < todayNormalized;
                                const isOverdue = isPast && !payment;

                                // Nuevo: marcar el siguiente día pendiente como "pendiente" (ámbar)
                                let isCurrentPeriod = false;
                                if (!payment && !isOverdue && firstFuturePendingDayOfYear === originalDayOfYear) {
                                    isCurrentPeriod = true;
                                } else if (effectiveDate.toDateString() === today.toDateString() && !payment && !isOverdue) {
                                    // fallback para el día de hoy si no hay pagos
                                    isCurrentPeriod = true;
                                }

                                // Formatear label
                                const dayNum = originalDate.getDate();
                                let label = `${dayNum}`;
                                if (isShifted) {
                                    const effectiveDay = effectiveDate.getDate();
                                    const effectiveMonth = MONTHS_SHORT[effectiveDate.getMonth()];
                                    label = `${effectiveDay} ${effectiveMonth}`;
                                }

                                return (
                                    <PeriodCell
                                        key={`${originalDayOfYear}-${isShifted ? 'S' : 'R'}`}
                                        periodIndex={originalDayOfYear}
                                        payment={payment}
                                        onClick={() => onPeriodClick(originalDayOfYear, selectedYear)}
                                        onRevoke={() => onPeriodRevoke(originalDayOfYear, selectedYear)}
                                        isCurrentPeriod={isCurrentPeriod}
                                        selectedYear={selectedYear}
                                        config={config}
                                        isOverdue={isOverdue}
                                        customLabel={label}
                                    />
                                );
                            });
                        }

                        // Para esquemas no-daily (weekly, biweekly, monthly_28)
                        // Usar el schedule generado dinámicamente arriba
                        const schedule = dynamicSchedule;

                        const todayNormalized = new Date();
                        todayNormalized.setHours(0, 0, 0, 0);


                        // Encontrar el primer periodo no pagado que sea futuro (pendiente)
                        let firstUnpFromNow = -1;
                        const enrollmentDateForFilter = new Date(enrollmentDateObj);
                        enrollmentDateForFilter.setHours(0, 0, 0, 0);

                        for (const s of schedule) {
                            // Verificar que el pago corresponda realmente a este schedule
                            const hasPayment = payments.some(p => {
                                if (p.year !== s.cycleYear || p.month !== s.cycleMonth || p.status !== 'paid') return false;
                                return true;
                            });

                            if (!hasPayment && s.date >= todayNormalized) {
                                if (s.cycleYear === selectedYear) firstUnpFromNow = s.cycleMonth;
                                break;
                            }
                        }

                        return periodsInSelectedYear.map((s) => {
                            // Buscar pagos que correspondan a este período
                            // IMPORTANTE: Verificar que el pago corresponda realmente a este schedule
                            // filtrando pagos que fueron creados antes de la fecha de inscripción actual
                            const payment = yearPayments.find(p => {
                                // Debe coincidir el mes (cycleMonth) y año
                                if (p.month !== s.cycleMonth) return false;

                                // Solo considerar pagos confirmados
                                if (p.status !== 'paid') return false;

                                return true;
                            });

                            let isOverdue = false;
                            let isCurrent = false;

                            if (!payment) {
                                if (s.date < todayNormalized) isOverdue = true;
                                else if (s.cycleMonth === firstUnpFromNow) isCurrent = true;
                            }

                            // Todas las etiquetas muestran la fecha específica: "12 Feb"
                            const label = `${s.date.getDate()} ${MONTHS_SHORT[s.date.getMonth()]}`;
                            const tooltipLabel = scheme === 'monthly_28'
                                ? `Pago de ${MONTHS[s.date.getMonth()]}`
                                : config.getPeriodFullName(s.cycleMonth);

                            return (
                                <PeriodCell
                                    key={`${s.cycleYear}-${s.cycleMonth}`}
                                    periodIndex={s.cycleMonth}
                                    payment={payment}
                                    onClick={() => onPeriodClick(s.cycleMonth, selectedYear)}
                                    onRevoke={() => onPeriodRevoke(s.cycleMonth, selectedYear)}
                                    isCurrentPeriod={isCurrent}
                                    selectedYear={selectedYear}
                                    config={config}
                                    isOverdue={isOverdue}
                                    customLabel={label}
                                    customTooltip={tooltipLabel}
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
    userRole = "admin",
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

    // Versión de custom holidays para forzar re-render cuando se cargan
    const [customHolidaysVersion, setCustomHolidaysVersion] = useState(0);

    // Estado para el modal de cancelación de pago
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isProcessingCancel, setIsProcessingCancel] = useState(false);

    // Estado para modal de permiso denegado (solo superadmin puede cancelar)
    const [showNoPermissionModal, setShowNoPermissionModal] = useState(false);

    // Router for QR navigation
    const router = useRouter();

    // Filtros de búsqueda (igual que en StudentList, pero interno)
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'overdue' | 'pending' | 'partial'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    // Estado para el escaneo QR en tiempo real
    const [scanRequest, setScanRequest] = useState<PaymentScanRequest | null>(null);
    const [showScanNotification, setShowScanNotification] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Cargar custom holidays al montar el componente
    useEffect(() => {
        holidaysApi.getAll().then(holidays => {
            setCustomHolidaysData(holidays);
            // Forzar re-render para que se recalculen las fechas de pago
            setCustomHolidaysVersion(v => v + 1);
        }).catch(err => {
            console.error('Error cargando custom holidays:', err);
        });
    }, []);

    // Resetear paginación cuando cambia el filtro o la búsqueda
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterPaymentStatus, students.length]);



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

    // Filtrar estudiantes

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

    const handleConfirmPayment = (amountPaid: number, paymentMethod: "efectivo" | "transferencia") => {
        console.log("💰 PaymentsPanel handleConfirmPayment", amountPaid, "método:", paymentMethod);
        if (selectedStudent && selectedPeriod) {
            onPaymentConfirm(selectedStudent.id, selectedPeriod, selectedYear, Number(amountPaid), selectedStudent.monthlyFee, paymentMethod);
            setShowConfirmModal(false);
            setShowSuccessModal(true);
            setScanRequest(null); // Clear scan request
            onPaymentRequestHandled?.(); // Clear pending request from parent

            // Notificar al estudiante a través del socket (SOLO notificación, el pago ya se procesó via API)
            if (socket && scanRequest) {
                socket.emit("notify-payment-success", {
                    studentId: selectedStudent.id
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

    // Función para cancelar/revocar un pago
    const handleRevokePayment = async () => {
        if (!selectedStudent || !selectedPeriod || !selectedYear) return;

        if (!onPaymentRevoke) {
            console.error('❌ onPaymentRevoke no está definido');
            alert('Error: La función de cancelación no está disponible');
            return;
        }

        setIsProcessingCancel(true);
        try {
            await onPaymentRevoke(selectedStudent.id, selectedPeriod, selectedYear);
            console.log('✅ Pago cancelado exitosamente');
            setShowCancelModal(false);
        } catch (error) {
            console.error('❌ Error al cancelar pago:', error);
            alert('Error al cancelar el pago');
        } finally {
            setIsProcessingCancel(false);
        }
    };

    const hasPendingPayments = (student: Student, allPayments: PaymentRecord[]) => {
        // Si el estudiante está inactivo, no mostrar como pendiente
        if (student.status === "inactive") return false;

        const scheme = getStudentScheme(student);
        const studentPayments = allPayments.filter(p => p.studentId === student.id && p.status === 'paid');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Si tiene vencidos, también tiene "pendientes"
        if (isStudentOverdue(student, allPayments)) return true;

        const enrollmentDate = student.enrollmentDate
            ? new Date(student.enrollmentDate.replace(/-/g, "/"))
            : new Date(new Date().getFullYear(), 0, 1);

        if (scheme === 'daily') {
            enrollmentDate.setHours(0, 0, 0, 0);
            const classDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];

            // Verificar los próximos 7 días (incluyendo hoy)
            // Si hay algún día de clase sin pagar, es pendiente
            for (let i = 0; i < 7; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + i);

                if (isHoliday(checkDate)) continue;
                if (checkDate < enrollmentDate) continue;

                const dayOfWeek = checkDate.getDay();
                if (classDays.length === 0 || classDays.includes(dayOfWeek)) {
                    const dayOfYear = getDayOfYear(checkDate);
                    const hasPayment = studentPayments.some(p => p.year === checkDate.getFullYear() && p.month === dayOfYear);
                    if (!hasPayment) return true;
                }
            }
            return false;
        }

        // Para esquemas continuos: verificar el próximo período
        const enrollment = new Date(enrollmentDate);
        enrollment.setHours(12, 0, 0, 0);

        const cycleDays = scheme === 'weekly' ? 7 : (scheme === 'biweekly' ? 14 : 28);
        const pPerYear = scheme === 'weekly' ? 52 : (scheme === 'biweekly' ? 26 : 13);

        let pDate = new Date(enrollment);

        // Verificar inscripción
        if (enrollment >= today) {
            const hasPayment = studentPayments.some(p => p.year === enrollment.getFullYear() && p.month === 1);
            return !hasPayment;
        }

        // Generar schedule y encontrar el próximo período pendiente
        const pendingClassDays = student.classDays && student.classDays.length > 0 ? student.classDays : [];
        for (let i = 0; i < pPerYear * 3; i++) {
            const next = calculateNextCycleDate(pDate, cycleDays, pendingClassDays);

            const cMonth = i + 2;
            const cYear = next.getFullYear();

            // Si es el próximo período (futuro cercano)
            if (next >= today) {
                const hasPayment = studentPayments.some(p => p.year === cYear && p.month === cMonth);
                return !hasPayment;
            }

            pDate = next;
        }

        return false;
    };

    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            search === "" || !isNaN(Number(search))
                ? student.studentNumber.toString().includes(search)
                : (
                    student.name.toLowerCase().includes(search) ||
                    student.studentNumber.toLowerCase().includes(search)
                )
        );

        const matchesPaymentStatus = (() => {
            if (filterPaymentStatus === 'all') return true;

            const hasOverdue = isStudentOverdue(student, payments);
            const hasPending = hasPendingPayments(student, payments);
            const hasPartial = payments.some(p => p.studentId === student.id && p.year === selectedYear && p.status === 'paid' && p.paymentPercentage !== undefined && p.paymentPercentage < 100);

            if (filterPaymentStatus === 'overdue') return hasOverdue;
            if (filterPaymentStatus === 'pending') return hasPending;
            if (filterPaymentStatus === 'partial') return hasPartial;

            return true;
        })();

        return matchesSearch && matchesPaymentStatus && student.status !== 'baja';
    });

    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const paginatedStudents = filteredStudents.slice(startIndex, startIndex + PAGE_SIZE);

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

                    {/* Filtros de Estado de Pago */}
                    <div className="flex bg-gray-100 dark:bg-slate-700/50 p-1 rounded-xl">
                        <button
                            onClick={() => setFilterPaymentStatus('all')}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${filterPaymentStatus === 'all'
                                ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterPaymentStatus('pending')}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${filterPaymentStatus === 'pending'
                                ? 'bg-white dark:bg-slate-600 text-amber-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setFilterPaymentStatus('partial')}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${filterPaymentStatus === 'partial'
                                ? 'bg-white dark:bg-slate-600 text-amber-500 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            Parciales
                        </button>
                        <button
                            onClick={() => setFilterPaymentStatus('overdue')}
                            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${filterPaymentStatus === 'overdue'
                                ? 'bg-white dark:bg-slate-600 text-red-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            Vencidos
                        </button>
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

            {/* Notificación de escaneo */}
            {
                showScanNotification && (
                    <div className="fixed top-20 right-4 z-50 bg-blue-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full animate-pulse">
                            <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold">¡Nueva solicitud de pago!</p>
                            <p className="text-sm opacity-90">{scanRequest?.studentName}</p>
                        </div>
                    </div>
                )
            }

            {/* Lista de Cards */}
            <div className="grid grid-cols-1 gap-6">
                {filteredStudents.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No se encontraron estudiantes</p>
                    </div>
                ) : (
                    paginatedStudents.map(student => (
                        <StudentPaymentCard
                            key={`${student.id}-${customHolidaysVersion}`}
                            student={student}
                            payments={payments.filter(p => p.studentId === student.id)}
                            onPeriodClick={(periodIndex, year) => {
                                setSelectedStudent(student);
                                setSelectedPeriod(periodIndex);
                                setSelectedYear(year);
                                setShowConfirmModal(true);
                            }}
                            onPeriodRevoke={(periodIndex, year) => {
                                if (userRole !== "superadmin") {
                                    setShowNoPermissionModal(true);
                                    return;
                                }
                                setSelectedStudent(student);
                                setSelectedPeriod(periodIndex);
                                setSelectedYear(year);
                                setShowCancelModal(true);
                            }}
                        />
                    ))
                )}
            </div>

            {/* Controles de paginación */}
            {filteredStudents.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200/60 dark:border-gray-700/50 bg-white/70 dark:bg-slate-800/60 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    <span>
                        Mostrando {startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filteredStudents.length)} de {filteredStudents.length} estudiantes
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className={`px-3 py-1.5 rounded-lg border transition ${safePage === 1
                                ? 'border-gray-200 text-gray-400 cursor-not-allowed dark:border-gray-700'
                                : 'border-gray-300 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600'}
                            `}
                        >
                            Anterior
                        </button>
                        <span className="px-3 py-1 text-gray-600 dark:text-gray-300">
                            Página {safePage} de {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={safePage === totalPages}
                            className={`px-3 py-1.5 rounded-lg border transition ${safePage === totalPages
                                ? 'border-gray-200 text-gray-400 cursor-not-allowed dark:border-gray-700'
                                : 'border-gray-300 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600'}
                            `}
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}

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
                existingPayment={selectedStudent && selectedPeriod && selectedYear
                    ? payments.find(p => p.studentId === selectedStudent.id && p.month === selectedPeriod && p.year === selectedYear)
                    : null}
            />

            <PaymentSuccessModal
                isOpen={showSuccessModal}
                student={selectedStudent}
                periodIndex={selectedPeriod}
                onClose={() => setShowSuccessModal(false)}
            />



            {/* Modal de permiso denegado */}
            {showNoPermissionModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-150" style={{ background: 'var(--modal-bg)' }}>
                        <div className="relative flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                                <ShieldX className="w-8 h-8 text-white" strokeWidth={2} />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
                            Acceso restringido
                        </h3>
                        <p className="text-sm mb-5 text-center" style={{ color: 'var(--text-secondary)' }}>
                            Solo un <span className="font-semibold text-orange-500">superadministrador</span> puede cancelar pagos registrados. Contacta al superadmin si necesitas realizar esta acción.
                        </p>
                        <button
                            onClick={() => setShowNoPermissionModal(false)}
                            className="w-full py-3 text-white font-semibold rounded-xl transition-all shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/25"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de confirmación de cancelación */}
            <PaymentCancelModal
                isOpen={showCancelModal}
                student={selectedStudent}
                periodIndex={selectedPeriod}
                year={selectedYear}
                payment={selectedStudent && selectedPeriod && selectedYear
                    ? payments.find(p => p.studentId === selectedStudent.id && p.month === selectedPeriod && p.year === selectedYear)
                    : null}
                onConfirm={handleRevokePayment}
                onCancel={() => setShowCancelModal(false)}
                isProcessing={isProcessingCancel}
            />
        </div >
    );
}

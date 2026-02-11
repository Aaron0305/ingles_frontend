"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sun, Palmtree,
    PartyPopper, Plus, X, Loader2, ToggleRight
} from "lucide-react";
import { holidaysApi, CustomHoliday } from "@/lib/api";

// ============================================
// CÁLCULO DE DÍAS FESTIVOS MEXICANOS
// (Replica la lógica del backend paymentDates.ts)
// ============================================

function getNthDayOfWeekInMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    let daysToAdd = dayOfWeek - firstDayOfWeek;
    if (daysToAdd < 0) daysToAdd += 7;
    daysToAdd += (n - 1) * 7;
    return new Date(year, month, 1 + daysToAdd);
}

function getEasterSunday(year: number): Date {
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
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

function getHolyWeekDays(year: number): { date: Date; name: string }[] {
    const easter = getEasterSunday(year);
    const days: { date: Date; name: string }[] = [];

    const holyThursday = new Date(easter);
    holyThursday.setDate(easter.getDate() - 3);
    days.push({ date: holyThursday, name: "Jueves Santo" });

    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    days.push({ date: goodFriday, name: "Viernes Santo" });

    const holySaturday = new Date(easter);
    holySaturday.setDate(easter.getDate() - 1);
    days.push({ date: holySaturday, name: "Sábado Santo" });

    return days;
}

interface HolidayInfo {
    date: Date;
    name: string;
    type: "holiday" | "vacation" | "custom";
    isCustom?: boolean;
    isPredefined?: boolean;  // true si es un día festivo/vacación predefinido
    predefinedName?: string; // nombre original del día predefinido (para restaurar)
}

function generateHolidaysForYear(year: number): HolidayInfo[] {
    const holidays: HolidayInfo[] = [];

    holidays.push({ date: new Date(year, 4, 1), name: "Día del Trabajo", type: "holiday" });
    holidays.push({ date: new Date(year, 8, 16), name: "Día de la Independencia", type: "holiday" });

    const constitutionDay = getNthDayOfWeekInMonth(year, 1, 1, 1);
    holidays.push({ date: constitutionDay, name: "Día de la Constitución", type: "holiday" });

    const juarezDay = getNthDayOfWeekInMonth(year, 2, 1, 3);
    holidays.push({ date: juarezDay, name: "Natalicio de Benito Juárez", type: "holiday" });

    const revolutionDay = getNthDayOfWeekInMonth(year, 10, 1, 3);
    holidays.push({ date: revolutionDay, name: "Día de la Revolución", type: "holiday" });

    const holyWeek = getHolyWeekDays(year);
    holyWeek.forEach(d => holidays.push({ date: d.date, name: d.name, type: "holiday" }));

    return holidays;
}

function generateVacationDaysForYear(year: number): HolidayInfo[] {
    const vacations: HolidayInfo[] = [];

    let vacStartDay = 20;
    if (year === 2025) { vacStartDay = 19; }
    if (year === 2026) { vacStartDay = 19; }
    if (year === 2027) { vacStartDay = 18; }

    for (let d = vacStartDay; d <= 31; d++) {
        vacations.push({ date: new Date(year, 11, d), name: "Vacaciones de Invierno", type: "vacation" });
    }

    let janEndDay = 6;
    if (year === 2026) janEndDay = 7;
    if (year === 2027) janEndDay = 7;
    if (year === 2028) janEndDay = 6;

    for (let d = 1; d <= janEndDay; d++) {
        vacations.push({ date: new Date(year, 0, d), name: "Vacaciones de Invierno", type: "vacation" });
    }

    return vacations;
}

// ============================================
// HELPERS
// ============================================

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CalendarPanel() {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Custom holidays desde la base de datos
    const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);
    const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [toggleMessage, setToggleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Cargar custom holidays al montar
    const loadCustomHolidays = useCallback(async () => {
        try {
            const data = await holidaysApi.getAll();
            setCustomHolidays(data);
        } catch (error) {
            console.error("Error cargando días festivos personalizados:", error);
        } finally {
            setIsLoadingHolidays(false);
        }
    }, []);

    useEffect(() => {
        loadCustomHolidays();
    }, [loadCustomHolidays]);

    // Auto-dismiss del mensaje
    useEffect(() => {
        if (toggleMessage) {
            const timer = setTimeout(() => setToggleMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toggleMessage]);

    // Set de fechas custom activos (isDisabled = false) para búsqueda rápida
    const activeCustomHolidaysSet = useMemo(() => {
        return new Set(customHolidays.filter(h => !h.isDisabled).map(h => h.date));
    }, [customHolidays]);

    // Set de fechas de días predefinidos desactivados (isDisabled = true)
    const disabledHolidaysSet = useMemo(() => {
        return new Set(customHolidays.filter(h => h.isDisabled).map(h => h.date));
    }, [customHolidays]);

    // Set general de todas las fechas en custom_holidays (para saber si existe un registro)
    const customHolidaysSet = useMemo(() => {
        return new Set(customHolidays.map(h => h.date));
    }, [customHolidays]);

    // Mapa de todos los días predefinidos (para saber si una fecha es predefinida originalmente)
    const predefinedDaysMap = useMemo(() => {
        const map = new Map<string, HolidayInfo>();
        const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];

        yearsToCheck.forEach(year => {
            const holidays = generateHolidaysForYear(year);
            const vacations = generateVacationDaysForYear(year);

            [...holidays, ...vacations].forEach(info => {
                const key = dateKey(info.date);
                if (!map.has(key)) {
                    map.set(key, { ...info, isPredefined: true });
                }
            });
        });

        return map;
    }, [currentYear]);

    // Generar mapa de días especiales (predefinidos activos + custom activos)
    const specialDaysMap = useMemo(() => {
        const map = new Map<string, HolidayInfo>();
        const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];

        yearsToCheck.forEach(year => {
            const holidays = generateHolidaysForYear(year);
            const vacations = generateVacationDaysForYear(year);

            [...holidays, ...vacations].forEach(info => {
                const key = dateKey(info.date);
                // Solo agregar si NO está desactivado
                if (!disabledHolidaysSet.has(key) && !map.has(key)) {
                    map.set(key, { ...info, isPredefined: true });
                }
            });
        });

        // Agregar custom holidays activos (no disabled)
        customHolidays.filter(ch => !ch.isDisabled).forEach(ch => {
            const parts = ch.date.split('-');
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const key = ch.date;
            // Si no es un día ya definido (predefinido activo), agregarlo como custom
            if (!map.has(key)) {
                map.set(key, {
                    date,
                    name: ch.name,
                    type: "custom",
                    isCustom: true,
                });
            } else {
                // Si ya existe como predefinido, marcar que también tiene custom
                const existing = map.get(key)!;
                existing.isCustom = true;
            }
        });

        return map;
    }, [currentYear, customHolidays, disabledHolidaysSet]);

    // Días del calendario
    const calendarDays = useMemo(() => {
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startDayOfWeek = firstDay.getDay();

        const days: { date: Date; isCurrentMonth: boolean }[] = [];

        const prevMonthLast = new Date(currentYear, currentMonth, 0);
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            days.push({
                date: new Date(currentYear, currentMonth - 1, prevMonthLast.getDate() - i),
                isCurrentMonth: false,
            });
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push({
                date: new Date(currentYear, currentMonth, d),
                isCurrentMonth: true,
            });
        }

        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                days.push({
                    date: new Date(currentYear, currentMonth + 1, i),
                    isCurrentMonth: false,
                });
            }
        }

        return days;
    }, [currentMonth, currentYear]);

    // Estadísticas del mes
    const monthStats = useMemo(() => {
        let holidays = 0;
        let vacationDays = 0;
        let customDays = 0;
        let normalDays = 0;

        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(currentYear, currentMonth, d);
            const key = dateKey(date);
            const info = specialDaysMap.get(key);
            if (info?.type === "custom") customDays++;
            else if (info?.type === "holiday") holidays++;
            else if (info?.type === "vacation") vacationDays++;
            else normalDays++;
        }

        return { holidays, vacationDays, customDays, normalDays, total: lastDay };
    }, [currentMonth, currentYear, specialDaysMap]);

    // Lista de días especiales
    const specialDaysList = useMemo(() => {
        const list: HolidayInfo[] = [];
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
            const date = new Date(currentYear, currentMonth, d);
            const key = dateKey(date);
            const info = specialDaysMap.get(key);
            if (info) list.push(info);
        }
        return list;
    }, [currentMonth, currentYear, specialDaysMap]);

    // Navegación
    const goToPrevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
        else { setCurrentMonth(m => m - 1); }
        setSelectedDate(null);
    };

    const goToNextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
        else { setCurrentMonth(m => m + 1); }
        setSelectedDate(null);
    };

    const goToToday = () => {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
        setSelectedDate(null);
    };

    // Toggle festivo (funciona tanto para personalizados como predefinidos)
    const handleToggleCustomHoliday = async (date: Date) => {
        const key = dateKey(date);
        const predefinedInfo = predefinedDaysMap.get(key);
        const isPredefined = !!predefinedInfo;
        const isDisabled = disabledHolidaysSet.has(key);
        const isActiveCustom = activeCustomHolidaysSet.has(key);

        setIsToggling(true);
        try {
            if (isPredefined) {
                // --- Día predefinido ---
                if (isDisabled) {
                    // Está desactivado → RE-ACTIVAR (eliminar el registro disabled)
                    await holidaysApi.remove(key);
                    setCustomHolidays(prev => prev.filter(h => h.date !== key));
                    setToggleMessage({ type: 'success', text: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} restaurado como festivo` });
                } else {
                    // Está activo → DESACTIVAR (crear registro con isDisabled=true)
                    const name = predefinedInfo.name;
                    const created = await holidaysApi.create(key, name, true);
                    setCustomHolidays(prev => [...prev, created]);
                    setToggleMessage({ type: 'success', text: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} desactivado como festivo` });
                }
            } else {
                // --- Día normal o custom ---
                if (isActiveCustom) {
                    // Es custom activo → QUITAR
                    await holidaysApi.remove(key);
                    setCustomHolidays(prev => prev.filter(h => h.date !== key));
                    setToggleMessage({ type: 'success', text: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} removido como festivo` });
                } else {
                    // Es día normal → MARCAR como festivo custom
                    const name = `Festivo personalizado`;
                    const created = await holidaysApi.create(key, name, false);
                    setCustomHolidays(prev => [...prev, created]);
                    setToggleMessage({ type: 'success', text: `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} marcado como festivo` });
                }
            }
        } catch (error) {
            console.error("Error toggling custom holiday:", error);
            setToggleMessage({ type: 'error', text: 'Error al actualizar el día festivo' });
        } finally {
            setIsToggling(false);
        }
    };

    // Info del día seleccionado
    const selectedDayInfo = selectedDate ? specialDaysMap.get(dateKey(selectedDate)) : null;
    const selectedPredefinedInfo = selectedDate ? predefinedDaysMap.get(dateKey(selectedDate)) : null;
    const isSelectedActiveCustom = selectedDate ? activeCustomHolidaysSet.has(dateKey(selectedDate)) : false;
    const isSelectedDisabledPredefined = selectedDate ? disabledHolidaysSet.has(dateKey(selectedDate)) : false;
    const isSelectedPredefined = !!selectedPredefinedInfo;
    const isSelectedPredefinedAndActive = isSelectedPredefined && !isSelectedDisabledPredefined;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <CalendarIcon className="w-6 h-6" style={{ color: '#014287' }} strokeWidth={2} />
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                Calendario Escolar
                            </h2>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Visualiza y administra los días festivos. Haz clic en un día y usa el botón para activar/desactivar festivos personalizados.
                        </p>
                    </div>
                    {isLoadingHolidays && (
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                </div>
            </div>

            {/* Toast de mensaje */}
            {toggleMessage && (
                <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in"
                    style={{
                        background: toggleMessage.type === 'success'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(220, 38, 38, 0.15)',
                        color: toggleMessage.type === 'success' ? '#22c55e' : '#dc2626',
                        border: `1px solid ${toggleMessage.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
                    }}
                >
                    {toggleMessage.type === 'success' ? '✓' : '✕'} {toggleMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendario principal */}
                <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                    {/* Navegación del mes */}
                    <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <button
                            onClick={goToPrevMonth}
                            className="p-2 rounded-lg hover:opacity-80 transition-colors"
                            style={{ background: 'var(--surface-alt)' }}
                        >
                            <ChevronLeft className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                        </button>

                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                {MONTH_NAMES[currentMonth]} {currentYear}
                            </h3>
                            <button
                                onClick={goToToday}
                                className="text-xs px-3 py-1 rounded-full font-medium hover:opacity-80 transition-colors"
                                style={{ background: '#014287', color: 'white' }}
                            >
                                Hoy
                            </button>
                        </div>

                        <button
                            onClick={goToNextMonth}
                            className="p-2 rounded-lg hover:opacity-80 transition-colors"
                            style={{ background: 'var(--surface-alt)' }}
                        >
                            <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                        </button>
                    </div>

                    {/* Encabezado de días */}
                    <div className="grid grid-cols-7 gap-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {DAY_NAMES.map((day) => (
                            <div
                                key={day}
                                className="text-center py-3 text-xs font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Grilla de días */}
                    <div className="grid grid-cols-7 gap-0">
                        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                            const key = dateKey(date);
                            const info = specialDaysMap.get(key);
                            const isToday = isSameDay(date, today);
                            const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                            const isCustom = info?.type === "custom";
                            const isHoliday = info?.type === "holiday";
                            const isVacation = info?.type === "vacation";
                            const isSpecial = isHoliday || isVacation || isCustom;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(date)}
                                    className="relative aspect-square flex flex-col items-center justify-center transition-all hover:opacity-80"
                                    style={{
                                        background: isSelected
                                            ? '#014287'
                                            : isSpecial && isCurrentMonth
                                                ? isCustom
                                                    ? 'rgba(168, 85, 247, 0.12)'
                                                    : isHoliday
                                                        ? 'rgba(220, 38, 38, 0.12)'
                                                        : 'rgba(249, 115, 22, 0.10)'
                                                : 'transparent',
                                        borderBottom: '1px solid var(--border-color)',
                                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-color)' : 'none',
                                        opacity: isCurrentMonth ? 1 : 0.35,
                                    }}
                                >
                                    {/* Indicador de hoy */}
                                    {isToday && !isSelected && (
                                        <div
                                            className="absolute top-1 right-1 w-2 h-2 rounded-full"
                                            style={{ background: '#014287' }}
                                        />
                                    )}

                                    {/* Indicador de custom (estrella pequeña) */}
                                    {isCustom && isCurrentMonth && !isSelected && (
                                        <div
                                            className="absolute top-1 left-1 w-2 h-2 rounded-full"
                                            style={{ background: '#a855f7' }}
                                        />
                                    )}

                                    <span
                                        className={`text-sm font-semibold ${isToday && !isSelected ? 'underline' : ''}`}
                                        style={{
                                            color: isSelected
                                                ? 'white'
                                                : isSpecial && isCurrentMonth
                                                    ? isCustom ? '#a855f7' : isHoliday ? '#dc2626' : '#ea580c'
                                                    : 'var(--text-primary)',
                                        }}
                                    >
                                        {date.getDate()}
                                    </span>

                                    {/* Punto indicador */}
                                    {isSpecial && isCurrentMonth && !isSelected && (
                                        <div
                                            className="w-1.5 h-1.5 rounded-full mt-0.5"
                                            style={{
                                                background: isCustom ? '#a855f7' : isHoliday ? '#dc2626' : '#ea580c',
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Leyenda */}
                    <div className="flex items-center gap-4 flex-wrap p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: '#dc2626' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Festivo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: '#ea580c' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Vacaciones</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: '#a855f7' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Personalizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: '#014287' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hoy</span>
                        </div>
                    </div>
                </div>

                {/* Panel lateral */}
                <div className="space-y-4">
                    {/* Resumen del mes */}
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            Resumen del mes
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sun className="w-4 h-4" style={{ color: '#22c55e' }} />
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Días normales</span>
                                </div>
                                <span className="text-sm font-bold" style={{ color: '#22c55e' }}>{monthStats.normalDays}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PartyPopper className="w-4 h-4" style={{ color: '#dc2626' }} />
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Días festivos</span>
                                </div>
                                <span className="text-sm font-bold" style={{ color: '#dc2626' }}>{monthStats.holidays}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Palmtree className="w-4 h-4" style={{ color: '#ea580c' }} />
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Vacaciones</span>
                                </div>
                                <span className="text-sm font-bold" style={{ color: '#ea580c' }}>{monthStats.vacationDays}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ToggleRight className="w-4 h-4" style={{ color: '#a855f7' }} />
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Personalizados</span>
                                </div>
                                <span className="text-sm font-bold" style={{ color: '#a855f7' }}>{monthStats.customDays}</span>
                            </div>
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Total días</span>
                                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{monthStats.total}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalle del día seleccionado + toggle */}
                    {selectedDate && (
                        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                                Detalle del día
                            </h3>
                            <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                            </p>

                            {/* Caso 1: Día predefinido desactivado */}
                            {isSelectedDisabledPredefined && selectedPredefinedInfo ? (
                                <div className="mt-2">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                                        style={{ background: 'rgba(107, 114, 128, 0.15)', color: '#6b7280' }}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        {selectedPredefinedInfo.name} (Desactivado)
                                    </span>
                                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                        Este día festivo predefinido fue desactivado. Se trata como día normal de clases.
                                    </p>
                                </div>
                            ) : selectedDayInfo ? (
                                <div className="mt-2">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                                        style={{
                                            background: selectedDayInfo.type === "custom"
                                                ? 'rgba(168, 85, 247, 0.15)'
                                                : selectedDayInfo.type === "holiday" ? 'rgba(220, 38, 38, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                                            color: selectedDayInfo.type === "custom"
                                                ? '#a855f7'
                                                : selectedDayInfo.type === "holiday" ? '#dc2626' : '#ea580c',
                                        }}
                                    >
                                        {selectedDayInfo.type === "custom" ? (
                                            <ToggleRight className="w-3.5 h-3.5" />
                                        ) : selectedDayInfo.type === "holiday" ? (
                                            <PartyPopper className="w-3.5 h-3.5" />
                                        ) : (
                                            <Palmtree className="w-3.5 h-3.5" />
                                        )}
                                        {selectedDayInfo.name}
                                    </span>
                                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                        {selectedDayInfo.type === "custom"
                                            ? "Día festivo personalizado — afecta el cálculo de pagos de los alumnos."
                                            : selectedDayInfo.type === "holiday"
                                                ? "No hay clases este día por ser día festivo oficial."
                                                : "No hay clases este día por período de vacaciones."}
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-2">
                                    <span
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                                        style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                                    >
                                        <Sun className="w-3.5 h-3.5" />
                                        Día normal de clases
                                    </span>
                                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                                        Día hábil — clases programadas normalmente.
                                    </p>
                                </div>
                            )}

                            {/* Botón Toggle — disponible para TODOS los días */}
                            <button
                                onClick={() => handleToggleCustomHoliday(selectedDate)}
                                disabled={isToggling}
                                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                style={{
                                    background: isSelectedPredefinedAndActive
                                        ? 'rgba(220, 38, 38, 0.12)'
                                        : isSelectedDisabledPredefined
                                            ? 'rgba(34, 197, 94, 0.12)'
                                            : isSelectedActiveCustom
                                                ? 'rgba(220, 38, 38, 0.12)'
                                                : 'rgba(168, 85, 247, 0.12)',
                                    color: isSelectedPredefinedAndActive
                                        ? '#dc2626'
                                        : isSelectedDisabledPredefined
                                            ? '#22c55e'
                                            : isSelectedActiveCustom
                                                ? '#dc2626'
                                                : '#a855f7',
                                    border: `1px solid ${isSelectedPredefinedAndActive
                                        ? 'rgba(220, 38, 38, 0.3)'
                                        : isSelectedDisabledPredefined
                                            ? 'rgba(34, 197, 94, 0.3)'
                                            : isSelectedActiveCustom
                                                ? 'rgba(220, 38, 38, 0.3)'
                                                : 'rgba(168, 85, 247, 0.3)'
                                        }`,
                                }}
                            >
                                {isToggling ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : isSelectedPredefinedAndActive ? (
                                    <>
                                        <X className="w-4 h-4" />
                                        Desactivar día festivo
                                    </>
                                ) : isSelectedDisabledPredefined ? (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Restaurar día festivo
                                    </>
                                ) : isSelectedActiveCustom ? (
                                    <>
                                        <X className="w-4 h-4" />
                                        Quitar día festivo
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Marcar como festivo
                                    </>
                                )}
                            </button>

                            {isSelectedPredefined && (
                                <p className="mt-3 text-[11px] italic" style={{ color: 'var(--text-tertiary)' }}>
                                    {isSelectedDisabledPredefined
                                        ? "Este día festivo predefinido fue desactivado. Puedes restaurarlo."
                                        : "Este es un día festivo predefinido. Puedes desactivarlo si hay clases este día."}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Lista de días especiales del mes */}
                    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
                        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            Días especiales este mes
                        </h3>
                        {specialDaysList.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {specialDaysList.map((info, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-colors"
                                        style={{ background: 'var(--surface-alt)' }}
                                        onClick={() => setSelectedDate(info.date)}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                            style={{
                                                background: info.type === "custom"
                                                    ? '#a855f7'
                                                    : info.type === "holiday" ? '#dc2626' : '#ea580c',
                                            }}
                                        >
                                            {info.date.getDate()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                {info.name}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{
                                                color: info.type === "custom"
                                                    ? '#a855f7'
                                                    : info.type === "holiday" ? '#dc2626' : '#ea580c',
                                            }}>
                                                {info.type === "custom" ? "Personalizado" : info.type === "holiday" ? "Festivo" : "Vacaciones"}
                                            </p>
                                        </div>
                                        {info.type === "custom" && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleCustomHoliday(info.date);
                                                }}
                                                className="p-1 rounded-md hover:bg-red-500/20 transition-colors flex-shrink-0"
                                                title="Quitar festivo"
                                            >
                                                <X className="w-3.5 h-3.5 text-red-500" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <Sun className="w-10 h-10 mx-auto mb-2 opacity-40" style={{ color: 'var(--text-tertiary)' }} />
                                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    No hay días especiales este mes
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                    Todos los días son hábiles
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

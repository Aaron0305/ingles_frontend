"use client";

import { useState } from "react";
import { Download, ChevronLeft, ChevronRight, TrendingUp, BarChart3, CircleDollarSign, Users, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Student } from "./credential";
import {
    LabelList,
    RadialBar,
    RadialBarChart,
    Area,
    AreaChart,
    CartesianGrid,
    XAxis
} from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";

export interface PaymentRecord {
    id: string;
    studentId: string;
    month: number;
    year: number;
    amount: number;
    status: "paid" | "pending" | "overdue";
    paidAt?: string;
    confirmedBy?: string;
    createdAt?: string;
}

interface ReportsPanelProps {
    students: Student[];
    payments: PaymentRecord[];
    userRole?: "admin" | "superadmin";
}

export default function ReportsPanel({ students, payments, userRole = "superadmin" }: ReportsPanelProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [chartMonth, setChartMonth] = useState<Date>(new Date()); // Mes para la gráfica de ingresos
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Navegación de meses para la gráfica
    const handlePrevMonth = () => {
        const newDate = new Date(chartMonth);
        newDate.setMonth(chartMonth.getMonth() - 1);
        setChartMonth(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(chartMonth);
        newDate.setMonth(chartMonth.getMonth() + 1);
        setChartMonth(newDate);
    };

    // --- LÓGICA DE FILTRADO DIARIO ---
    const getFilteredPayments = () => {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const selectedDateStr = `${year}-${month}-${day}`;

        return payments.filter(p => {
            if (p.status !== "paid" || !p.paidAt) return false;
            return p.paidAt.startsWith(selectedDateStr);
        });
    };

    const handlePrevDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() - 1);
        setSelectedDate(newDate);
    };

    const handleNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + 1);
        setSelectedDate(newDate);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const [year, month, day] = e.target.value.split('-').map(Number);
            setSelectedDate(new Date(year, month - 1, day));
        }
    };

    const exportDailyPaymentsToExcel = () => {
        const dailyPayments = getFilteredPayments();
        const dateStr = selectedDate.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

        if (dailyPayments.length === 0) {
            setSaveMessage({ type: 'error', text: `No hay pagos registrados el ${dateStr} para exportar` });
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        const excelData = dailyPayments.map(payment => {
            const student = students.find(s => s.id === payment.studentId);
            const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
            return {
                "No. Estudiante": student?.studentNumber || "N/A",
                "Nombre": student?.name || "Desconocido",
                "Nivel": student?.level || "N/A",
                "Concepto": payment.month === 0 ? "Inscripción" : "Mensualidad",
                "Monto": `$${payment.amount.toFixed(2)}`,
                "Hora de Pago": (payment.createdAt ? new Date(payment.createdAt) : (paidAt || null))?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || "N/A",
                "Confirmado Por": payment.confirmedBy || "Sistema",
                "Email": student?.email || "N/A",
            };
        });

        const totalAmount = dailyPayments.reduce((acc, p) => acc + p.amount, 0);
        excelData.push({
            "No. Estudiante": "", "Nombre": "TOTAL", "Nivel": "", "Concepto": "",
            "Monto": `$${totalAmount.toFixed(2)}`, "Hora de Pago": "",
            "Confirmado Por": "", "Email": ""
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pagos");
        XLSX.writeFile(wb, `Reporte_Pagos_${dateStr}.xlsx`);

        setSaveMessage({ type: 'success', text: 'Reporte exportado correctamente' });
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const dailyPayments = getFilteredPayments();
    const totalAmount = dailyPayments.reduce((acc, p) => acc + p.amount, 0);
    const averageAmount = dailyPayments.length > 0 ? totalAmount / dailyPayments.length : 0;

    // --- DATOS PARA GRÁFICAS ---

    // 1. Datos para GRÁFICA RADIAL (Estudiantes por Nivel)
    const studentsByLevel = students.reduce((acc, student) => {
        if (student.status !== 'inactive') { // Solo contar activos
            acc[student.level] = (acc[student.level] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const radialChartData = [
        { level: "beginner1", students: studentsByLevel['Beginner 1'] || 0, fill: "var(--color-beginner1)" },
        { level: "beginner2", students: studentsByLevel['Beginner 2'] || 0, fill: "var(--color-beginner2)" },
        { level: "intermediate1", students: studentsByLevel['Intermediate 1'] || 0, fill: "var(--color-intermediate1)" },
        { level: "intermediate2", students: studentsByLevel['Intermediate 2'] || 0, fill: "var(--color-intermediate2)" },
        { level: "advanced1", students: studentsByLevel['Advanced 1'] || 0, fill: "var(--color-advanced1)" },
        { level: "advanced2", students: studentsByLevel['Advanced 2'] || 0, fill: "var(--color-advanced2)" },
    ];

    const radialChartConfig = {
        students: { label: "Estudiantes" },
        beginner1: { label: "Beginner 1", color: "#3b82f6" }, // Blue-500
        beginner2: { label: "Beginner 2", color: "#60a5fa" }, // Blue-400
        intermediate1: { label: "Intermediate 1", color: "#f59e0b" }, // Amber-500
        intermediate2: { label: "Intermediate 2", color: "#fbbf24" }, // Amber-400
        advanced1: { label: "Advanced 1", color: "#10b981" }, // Emerald-500
        advanced2: { label: "Advanced 2", color: "#34d399" }, // Emerald-400
    } satisfies ChartConfig;

    // 2. Datos para GRÁFICA DE ÁREA (Ingresos diarios del mes seleccionado)
    const getChartData = () => {
        const year = chartMonth.getFullYear();
        const month = chartMonth.getMonth(); // 0-11
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const data = [];

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Sumar pagos de este día específico
            const total = payments
                .filter(p => p.status === 'paid' && p.paidAt && p.paidAt.startsWith(dateStr))
                .reduce((acc, p) => acc + p.amount, 0);

            data.push({
                day: day.toString(),
                total: total,
                fullDate: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
            });
        }
        return data;
    };

    const chartData = getChartData();

    // Calcular total del mes para mostrar en la gráfica
    const monthlyTotal = chartData.reduce((acc, d) => acc + d.total, 0);

    const chartConfig = {
        total: { label: "Ingresos", color: "#3b82f6" }, // Blue-500
    } satisfies ChartConfig;


    return (
        <div className="space-y-6 animate-fade-in">
            {/* --- SECCIÓN DE GRÁFICAS SUPERIOR (Solo superadmin) --- */}
            {userRole === "superadmin" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* 1. GRÁFICA RADIAL: Estudiantes por Nivel (1/4 del espacio) */}
                <Card className="flex flex-col bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 lg:col-span-1">
                    <CardHeader className="items-center pb-2">
                        <CardTitle className="text-sm font-semibold">Estudiantes por Nivel</CardTitle>
                        <CardDescription className="text-xs">Alumnos activos</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex items-center justify-center py-2">
                        <ChartContainer
                            config={radialChartConfig}
                            className="mx-auto w-full max-w-[200px] aspect-square"
                        >
                            <RadialBarChart
                                data={radialChartData}
                                startAngle={-90}
                                endAngle={380}
                                innerRadius={25}
                                outerRadius={80}
                            >
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel nameKey="level" />}
                                />
                                <RadialBar dataKey="students" background>
                                    <LabelList
                                        position="insideStart"
                                        dataKey="level"
                                        className="fill-white capitalize mix-blend-luminosity"
                                        fontSize={9}
                                    />
                                </RadialBar>
                            </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="pt-0 pb-3">
                        <div className="w-full flex flex-col gap-1 text-xs">
                            {radialChartData.map((item) => (
                                <div key={item.level} className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                        <span className="capitalize text-gray-600 dark:text-gray-400">{item.level}</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{item.students}</span>
                                </div>
                            ))}
                        </div>
                    </CardFooter>
                </Card>

                {/* 2. GRÁFICA DE ÁREA: Ingresos Diarios del Mes (3/4 del espacio) */}
                <Card className="flex flex-col bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 lg:col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Ingresos del mes</CardTitle>
                                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                                    {chartMonth.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium text-sm min-w-[120px] text-center">
                                    {chartMonth.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).toUpperCase()}
                                </span>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                        <ChartContainer config={chartConfig} className="h-[200px] w-full">
                            <AreaChart
                                accessibilityLayer
                                data={chartData}
                                margin={{
                                    left: 0,
                                    right: 0,
                                    top: 10,
                                    bottom: 0,
                                }}
                            >
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="day"
                                    tickLine={false}
                                    tickMargin={4}
                                    axisLine={false}
                                    interval={0}
                                    fontSize={9}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <defs>
                                    <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                            offset="5%"
                                            stopColor="var(--color-total)"
                                            stopOpacity={0.8}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="var(--color-total)"
                                            stopOpacity={0.1}
                                        />
                                    </linearGradient>
                                </defs>
                                <Area
                                    dataKey="total"
                                    type="natural"
                                    fill="url(#fillIncome)"
                                    fillOpacity={0.4}
                                    stroke="var(--color-total)"
                                    stackId="a"
                                />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm text-center">
                        <div className="flex items-center gap-2 font-medium leading-none">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                                ${monthlyTotal.toLocaleString()}
                            </span>
                            <span className="text-gray-500">total del mes</span>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                    </CardFooter>
                </Card>
            </div>
            )}




            {/* --- SECCIÓN DE FILTRO DE PAGOS DIARIOS (Copiada y adaptada de admin/page.tsx) --- */}
            <div className="p-6 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/50 bg-white dark:bg-slate-800/50 backdrop-blur-sm">

                {/* Header: Selectores y Botón Exportar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Reporte de Pagos Diarios</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Consulta y exporta los movimientos detallados por fecha
                        </p>
                    </div>

                    {userRole === "superadmin" ? (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700/50 rounded-xl p-1">
                            <button onClick={handlePrevDay} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-gray-500 dark:text-gray-400">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={selectedDate.toLocaleDateString('sv')} // YYYY-MM-DD
                                    onChange={handleDateChange}
                                    className="bg-transparent border-none text-center font-medium focus:ring-0 cursor-pointer text-sm w-36 text-gray-700 dark:text-gray-200"
                                />
                            </div>
                            <button onClick={handleNextDay} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-gray-500 dark:text-gray-400">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700/50 rounded-xl px-4 py-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                Hoy: {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                        </div>
                    )}

                    <button
                        onClick={exportDailyPaymentsToExcel}
                        disabled={dailyPayments.length === 0}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-all shadow-lg ${dailyPayments.length > 0
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                            : 'bg-gray-500/50 cursor-not-allowed text-gray-400 shadow-none'
                            }`}
                    >
                        <Download className="w-4 h-4" strokeWidth={2} />
                        Exportar Excel
                    </button>
                </div>

                {/* Métricas Resumen del Día */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
                        <div className="flex items-center gap-2 mb-2">
                            <CircleDollarSign className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Recaudado</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            ${totalAmount.toLocaleString()}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-500" strokeWidth={2} />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Pagos Registrados</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {dailyPayments.length}
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="w-4 h-4 text-amber-500" strokeWidth={2} />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Promedio</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            ${averageAmount.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Mensaje de Toast */}
                {saveMessage && (
                    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium animate-fade-in ${saveMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {saveMessage.text}
                    </div>
                )}

                {/* Tabla de Pagos */}
                {dailyPayments.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hora</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Estudiante</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Concepto</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monto</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Confirmado por</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {dailyPayments
                                    .sort((a, b) => {
                                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                        return dateB - dateA;
                                    })
                                    .map((payment) => {
                                        const student = students.find(s => s.id === payment.studentId);
                                        const isEnrollment = payment.month === 0;
                                        return (
                                            <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-200">
                                                    {(payment.createdAt ? new Date(payment.createdAt) : (payment.paidAt ? new Date(payment.paidAt) : null))?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                            {student?.name.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{student?.name || 'Desconocido'}</p>
                                                            <p className="text-xs text-gray-500">{student?.studentNumber} • {student?.level}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEnrollment ? (
                                                        <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-100 dark:border-purple-800 font-medium">
                                                            Inscripción
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-800 font-medium">
                                                            Mensualidad
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                    ${payment.amount.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                        {payment.confirmedBy || 'Sistema'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 flex flex-col items-center justify-center text-center opacity-60">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-200">Sin movimientos</h4>
                        <p className="text-sm text-gray-500">No hay pagos registrados para esta fecha.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

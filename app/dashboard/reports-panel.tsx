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
}

export default function ReportsPanel({ students, payments }: ReportsPanelProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [timeRange, setTimeRange] = useState<"6m" | "1y" | "2y" | "5y">("6m");
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
                "Monto": `$${payment.amount.toFixed(2)}`,
                "Hora de Pago": (payment.createdAt ? new Date(payment.createdAt) : (paidAt || null))?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || "N/A",
                "Confirmado Por": payment.confirmedBy || "Sistema",
                "Email": student?.email || "N/A",
            };
        });

        const totalAmount = dailyPayments.reduce((acc, p) => acc + p.amount, 0);
        excelData.push({
            "No. Estudiante": "", "Nombre": "TOTAL", "Nivel": "",
            "Monto": `$${totalAmount.toFixed(2)}`, "Hora de Pago": "",
            "Confirmado Por": "", "Email": ""
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }];
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
        { level: "beginner", students: studentsByLevel['Beginner'] || 0, fill: "var(--color-beginner)" },
        { level: "intermediate", students: studentsByLevel['Intermediate'] || 0, fill: "var(--color-intermediate)" },
        { level: "advanced", students: studentsByLevel['Advanced'] || 0, fill: "var(--color-advanced)" },
    ];

    const radialChartConfig = {
        students: { label: "Estudiantes" },
        beginner: { label: "Beginner", color: "#3b82f6" }, // Blue-500
        intermediate: { label: "Intermediate", color: "#f59e0b" }, // Amber-500
        advanced: { label: "Advanced", color: "#10b981" }, // Emerald-500
    } satisfies ChartConfig;

    // 2. Datos para GRÁFICA DE ÁREA (Ingresos dinámicos)
    const getChartData = () => {
        const today = new Date();
        const monthsMap = {
            "6m": 6,
            "1y": 12,
            "2y": 24,
            "5y": 60,
        };
        const totalMonths = monthsMap[timeRange];
        const data = [];

        for (let i = totalMonths - 1; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthIndex = d.getMonth() + 1; // 1-12
            const year = d.getFullYear();

            // Nombre corto del mes para el eje X
            // Si es un rango muy largo (5y), mostramos solo la inicial o año en tooltip
            const monthName = d.toLocaleDateString('es-MX', { month: 'short' });
            const yearShort = d.getFullYear().toString().slice(2);

            // Label combina Mes y Año si es rango largo para evitar confusión
            const label = totalMonths > 12 ? `${monthName} ${yearShort}` : monthName;

            // Sumar pagos de este mes/año
            const total = payments
                .filter(p => p.status === 'paid' && p.month === monthIndex && p.year === year)
                .reduce((acc, p) => acc + p.amount, 0);

            data.push({ month: label, total: total, fullDate: `${monthName} ${year}` });
        }
        return data;
    };

    const chartData = getChartData();

    const chartConfig = {
        total: { label: "Ingresos", color: "#3b82f6" }, // Blue-500
    } satisfies ChartConfig;


    return (
        <div className="space-y-6 animate-fade-in">
            {/* --- SECCIÓN DE GRÁFICAS SUPERIOR --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. GRÁFICA RADIAL: Estudiantes por Nivel */}
                <Card className="flex flex-col bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700">
                    <CardHeader className="items-center pb-0">
                        <CardTitle>Estudiantes por Nivel</CardTitle>
                        <CardDescription>Distribución de alumnos activos</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                        <ChartContainer
                            config={radialChartConfig}
                            className="mx-auto aspect-square max-h-[250px]"
                        >
                            <RadialBarChart
                                data={radialChartData}
                                startAngle={-90}
                                endAngle={380}
                                innerRadius={30}
                                outerRadius={110}
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
                                        fontSize={11}
                                    />
                                </RadialBar>
                            </RadialBarChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col gap-2 text-sm text-center">
                        <div className="leading-none text-muted-foreground">
                            Mostrando total de alumnos activos por nivel educativo
                        </div>
                    </CardFooter>
                </Card>

                {/* 2. GRÁFICA DE ÁREA: Historial de Ingresos (Gradient) */}
                <Card className="flex flex-col bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <CardTitle>Historial de Ingresos</CardTitle>
                                <CardDescription>
                                    {timeRange === '6m' ? 'Últimos 6 meses' :
                                        timeRange === '1y' ? 'Último año' :
                                            timeRange === '2y' ? 'Últimos 2 años' : 'Últimos 5 años'}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                {(['6m', '1y', '2y', '5y'] as const).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            timeRange === range
                                                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                        )}
                                    >
                                        {range.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig}>
                            <AreaChart
                                accessibilityLayer
                                data={chartData}
                                margin={{
                                    left: 12,
                                    right: 12,
                                }}
                            >
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    tickMargin={8}
                                    axisLine={false}
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
                            Tendencia de ingresos <TrendingUp className="h-4 w-4" />
                        </div>
                    </CardFooter>
                </Card>
            </div>




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

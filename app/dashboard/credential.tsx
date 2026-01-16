"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, FileDown, Printer, Lock } from "lucide-react";
import Image from "next/image";

// ============================================
// TIPOS
// ============================================

export interface Student {
    id: string;
    studentNumber: string;
    name: string;
    email: string;
    emergencyPhone?: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    monthlyFee: number;
    progress: number;
    lastAccess: string;
    status: "active" | "inactive";
    createdAt?: string;
    paymentScheme?: "daily" | "weekly" | "biweekly" | "monthly_28";
    classDays?: number[]; // Días de clase: 0=Dom, 1=Lun, ... 6=Sab
    enrollmentDate?: string;
}

interface CredentialModalProps {
    student: Student;
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// UTILIDADES
// ============================================

function generateQRData(student: Student): string {
    // Generar URL para el escaneo de pago
    // Esta URL abrirá la página de pago del estudiante
    const baseUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://ingles-frontend.vercel.app'
        : 'http://localhost:3000';
    return `${baseUrl}/pay/scan/${student.id}`;
}

function formatDate(dateString: string): string {
    if (!dateString) return "";
    // Reemplazar guiones por slashes para forzar interpretación como fecha local y evitar desfase de un día
    const date = new Date(dateString.replace(/-/g, "/"));
    return date.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function getLevelColor(level: Student["level"]) {
    const colors = {
        Beginner: { bg: "#3b82f6", light: "#dbeafe", text: "#1d4ed8" },
        Intermediate: { bg: "#f59e0b", light: "#fef3c7", text: "#b45309" },
        Advanced: { bg: "#10b981", light: "#d1fae5", text: "#047857" },
    };
    return colors[level];
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CredentialModal({ student, isOpen, onClose }: CredentialModalProps) {
    const credentialRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const levelColor = getLevelColor(student.level);

    const handleDownloadPDF = async () => {
        if (!credentialRef.current) return;

        try {
            // Importar dinámicamente las librerías
            const html2canvas = (await import("html2canvas")).default;
            const jsPDF = (await import("jspdf")).default;

            const element = credentialRef.current;

            // Crear canvas con alta resolución
            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#ffffff",
                logging: false,
            });

            // Crear PDF tamaño credencial (85.6mm x 54mm - tamaño tarjeta de crédito)
            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [85.6, 54],
            });

            const imgData = canvas.toDataURL("image/png", 1.0);
            pdf.addImage(imgData, "PNG", 0, 0, 85.6, 54);

            pdf.save(`Credencial - ${student.name}.pdf`);
        } catch (error) {
            console.error("Error generando PDF:", error);
            // Fallback: usar impresión del navegador
            handlePrint();
        }
    };

    const handlePrint = () => {
        const printWindow = window.open("", "", "width=400,height=300");
        if (printWindow && credentialRef.current) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Credencial - ${student.name}</title>
                    <style>
                        @page { size: 85.6mm 54mm; margin: 0; }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background: white;
                        }
                    </style>
                </head>
                <body>
                    ${credentialRef.current.outerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 250);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header del modal */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Credencial de Estudiante
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={2} />
                    </button>
                </div>

                {/* ========== CREDENCIAL PREMIUM ========== */}
                <div
                    ref={credentialRef}
                    style={{
                        width: "320px",
                        height: "210px",
                        margin: "0 auto",
                        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        position: "relative",
                    }}
                >
                    {/* Header con gradiente y logo */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #014287 0%, #2596be 100%)",
                            padding: "10px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {/* Logo de la academia */}
                            <div
                                style={{
                                    width: "100px",
                                    height: "32px",
                                    background: "white",
                                    borderRadius: "6px",
                                    padding: "4px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <img
                                    src="/image/logo.png"
                                    alt="What Time Is It? Idiomas"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain"
                                    }}
                                />
                            </div>
                        </div>
                        <div
                            style={{
                                color: "white",
                                fontSize: "9px",
                                fontWeight: "600",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                background: "rgba(255,255,255,0.2)",
                                padding: "4px 10px",
                                borderRadius: "10px",
                            }}
                        >
                            Credencial Estudiantil
                        </div>
                    </div>

                    {/* Contenido principal */}
                    <div style={{ flex: 1, display: "flex", padding: "12px 16px", gap: "14px", position: "relative" }}>
                        {/* QR Code */}
                        <div
                            style={{
                                width: "90px",
                                height: "90px",
                                background: "white",
                                borderRadius: "8px",
                                padding: "6px",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <QRCodeSVG
                                value={generateQRData(student)}
                                size={78}
                                level="M"
                                includeMargin={false}
                            />
                        </div>

                        {/* Información */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            {/* Nombre */}
                            <div>
                                <div style={{ fontSize: "8px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
                                    Estudiante
                                </div>
                                <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", lineHeight: "1.2" }}>
                                    {student.name}
                                </div>
                            </div>

                            {/* Grid de datos */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "7px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        No. Estudiante
                                    </div>
                                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#014287", fontFamily: "monospace" }}>
                                        {student.studentNumber}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "7px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        Fecha de Inscripción
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#014287" }}>
                                        {formatDate(student.enrollmentDate || student.createdAt || "")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mascota como marca de agua */}
                        <div
                            style={{
                                position: "absolute",
                                bottom: "-10px",
                                right: "-15px",
                                width: "130px",
                                height: "130px",
                                opacity: 0.12,
                                filter: "grayscale(20%)",
                                pointerEvents: "none",
                            }}
                        >
                            <img
                                src="/image/mascota.png"
                                alt="Mascota"
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain"
                                }}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            background: "linear-gradient(90deg, #014287 0%, #2596be 100%)",
                            padding: "6px 16px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ fontSize: "8px", color: "white", fontWeight: "500", letterSpacing: "0.5px" }}>
                            What Time Is It? Idiomas® - Academia de Inglés
                        </div>
                    </div>
                </div>
                {/* ========== FIN CREDENCIAL ========== */}

                {/* Botones de acción */}
                <div className="flex gap-3 mt-5">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-500/25"
                    >
                        <FileDown className="w-4 h-4" strokeWidth={2} />
                        Descargar PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
                    >
                        <Printer className="w-4 h-4" strokeWidth={2} />
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>

                {/* Nota de seguridad */}
                <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <p className="text-xs text-amber-700 dark:text-amber-400 text-center flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" strokeWidth={2} />
                        QR seguro - Los datos son verificados en el servidor
                    </p>
                </div>
            </div>
        </div>
    );
}

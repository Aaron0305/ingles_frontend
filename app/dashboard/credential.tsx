"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

// ============================================
// TIPOS
// ============================================

export interface Student {
    id: string;
    studentNumber: string;
    name: string;
    email: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    monthlyFee: number;
    progress: number;
    lastAccess: string;
    status: "active" | "inactive";
    createdAt: string;
    expiresAt: string;
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
    return new Date(dateString).toLocaleDateString("es-MX", {
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
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ========== CREDENCIAL PREMIUM ========== */}
                <div 
                    ref={credentialRef}
                    style={{
                        width: "320px",
                        height: "202px",
                        margin: "0 auto",
                        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                        borderRadius: "12px",
                        overflow: "hidden",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                >
                    {/* Header con gradiente */}
                    <div
                        style={{
                            background: "linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)",
                            padding: "10px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                                style={{
                                    width: "28px",
                                    height: "28px",
                                    background: "rgba(255,255,255,0.2)",
                                    borderRadius: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ color: "white", fontSize: "12px", fontWeight: "700", letterSpacing: "0.5px" }}>
                                    WHAT TIME IS IT?
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
                                    Academia de Inglés
                                </div>
                            </div>
                        </div>
                        <div
                            style={{
                                background: levelColor.light,
                                color: levelColor.text,
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontSize: "9px",
                                fontWeight: "600",
                                textTransform: "uppercase",
                            }}
                        >
                            {student.level}
                        </div>
                    </div>

                    {/* Contenido principal */}
                    <div style={{ flex: 1, display: "flex", padding: "12px 16px", gap: "14px" }}>
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
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                                <div>
                                    <div style={{ fontSize: "7px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        No. Estudiante
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#334155", fontFamily: "monospace" }}>
                                        {student.studentNumber}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "7px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        Mensualidad
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#10b981" }}>
                                        ${student.monthlyFee}
                                    </div>
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div style={{ fontSize: "7px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        Vigencia
                                    </div>
                                    <div style={{ fontSize: "10px", fontWeight: "500", color: "#334155" }}>
                                        {formatDate(student.expiresAt)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            background: "#f1f5f9",
                            padding: "6px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderTop: "1px solid #e2e8f0",
                        }}
                    >
                        <div style={{ fontSize: "8px", color: "#64748b", fontFamily: "monospace" }}>
                            ID: {student.id}
                        </div>
                        <div style={{ fontSize: "7px", color: "#94a3b8" }}>
                            Válida únicamente con QR verificado
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Descargar PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        QR seguro - Los datos son verificados en el servidor
                    </p>
                </div>
            </div>
        </div>
    );
}

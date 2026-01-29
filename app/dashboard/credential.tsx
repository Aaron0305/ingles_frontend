"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, FileDown, Lock, Send, Phone, Loader2 } from "lucide-react";
import Image from "next/image";

export interface Student {
    id: string;
    studentNumber: string;
    name: string;
    email: string;
    studentPhone?: string;      // Teléfono del alumno
    emergencyPhone?: string;    // Teléfono de emergencia
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
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
        "Beginner 1": { bg: "#3b82f6", light: "#dbeafe", text: "#1d4ed8" },
        "Beginner 2": { bg: "#60a5fa", light: "#dbeafe", text: "#1d4ed8" },
        "Intermediate 1": { bg: "#f59e0b", light: "#fef3c7", text: "#b45309" },
        "Intermediate 2": { bg: "#fbbf24", light: "#fef3c7", text: "#b45309" },
        "Advanced 1": { bg: "#10b981", light: "#d1fae5", text: "#047857" },
        "Advanced 2": { bg: "#34d399", light: "#d1fae5", text: "#047857" },
    };
    return colors[level];
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CredentialModal({ student, isOpen, onClose }: CredentialModalProps) {
    const credentialRef = useRef<HTMLDivElement>(null);
    const [showPhoneInput, setShowPhoneInput] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState("");
    const [isSharing, setIsSharing] = useState(false);

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
            alert("Hubo un error al generar el PDF. Por favor intenta de nuevo.");
        }
    };

    const handleShareWhatsApp = async () => {
        if (!credentialRef.current) return;

        // Mostrar el input para el número de teléfono
        setShowPhoneInput(true);
    };

    const handleSendWhatsApp = async () => {
        if (!credentialRef.current) return;
        if (!whatsappPhone.trim()) {
            alert("Por favor ingresa un número de WhatsApp");
            return;
        }

        setIsSharing(true);

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

            // Descargar el PDF primero
            pdf.save(`Credencial - ${student.name}.pdf`);

            // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
            const phoneNumber = whatsappPhone.replace(/[\s\-\(\)]/g, "");

            // Crear mensaje para WhatsApp
            const message = encodeURIComponent(
                `🎓 *What Time Is It? Idiomas®*\n\n` +
                `Hola! Te comparto tu credencial de estudiante.\n\n` +
                `📋 *Estudiante:* ${student.name}\n` +
                `🔢 *No. Estudiante:* ${student.studentNumber}\n\n` +
                `Por favor revisa el PDF adjunto con tu credencial.`
            );

            // Abrir WhatsApp con el número y mensaje
            window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");

            // Limpiar y cerrar
            setShowPhoneInput(false);
            setWhatsappPhone("");
        } catch (error) {
            console.error("Error al compartir:", error);
            alert("Hubo un error al generar la credencial. Por favor intenta de nuevo.");
        } finally {
            setIsSharing(false);
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

                {/* Sección de WhatsApp - Input para número */}
                {showPhoneInput && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <h4 className="font-semibold text-green-800 dark:text-green-200">
                                Compartir por WhatsApp
                            </h4>
                        </div>
                        <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                            Ingresa el número de WhatsApp al que deseas enviar la credencial:
                        </p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                                <input
                                    type="tel"
                                    value={whatsappPhone}
                                    onChange={(e) => setWhatsappPhone(e.target.value)}
                                    placeholder="Ej: 5212345678901"
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-green-300 dark:border-green-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleSendWhatsApp}
                                disabled={isSharing}
                                className="px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-green-400 disabled:to-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSharing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <button
                            onClick={() => { setShowPhoneInput(false); setWhatsappPhone(""); }}
                            className="mt-3 text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Botones de acción */}
                {!showPhoneInput && (
                    <div className="flex flex-col gap-3 mt-5">
                        {/* Botones principales */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleDownloadPDF}
                                className="flex-1 group relative inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white text-sm font-semibold rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <FileDown className="w-5 h-5 relative z-10" strokeWidth={2.5} />
                                <span className="relative z-10">Descargar PDF</span>
                            </button>
                            <button
                                onClick={handleShareWhatsApp}
                                className="flex-1 group relative inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-green-500 via-green-600 to-emerald-500 text-white text-sm font-semibold rounded-2xl transition-all duration-300 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                <span className="relative z-10">WhatsApp</span>
                            </button>
                        </div>
                        {/* Botón cerrar */}
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-100 dark:bg-slate-700/50 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl transition-all duration-200 border border-gray-200 dark:border-slate-600"
                        >
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// PRINTER SERVICE - Conexión con impresora térmica via QZ Tray
// ============================================
// QZ Tray debe estar instalado en la PC de caja (https://qz.io)
// La impresora térmica debe estar conectada por USB y configurada en Windows

import qz from "qz-tray";
import { generateFullTicketPage, generateSummaryHTML } from "./ticket-template";

// ============================================
// CONEXIÓN
// ============================================

export async function connectPrinter(): Promise<boolean> {
    if (qz.websocket.isActive()) {
        return true;
    }

    try {
        const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";

        // QZ Tray internamente espera callbacks tipo resolver/reject, no Promise directo.
        (qz.security.setCertificatePromise as unknown as (
            callback: (resolve: (value: string) => void, reject: (error: unknown) => void) => void
        ) => void)((resolve) => resolve(""));

        qz.security.setSignatureAlgorithm("SHA512");

        (qz.security.setSignaturePromise as unknown as (
            callback: (toSign: string) => (resolve: (value: string) => void, reject: (error: unknown) => void) => void
        ) => void)((toSign) => {
            void toSign;
            return (resolve) => resolve("");
        });

                const attempts: Array<{ host?: string; usingSecure?: boolean; label: string }> = isHttpsPage
            ? [
                                { label: "default" },
                                { host: "localhost", usingSecure: true, label: "localhost secure" },
                                { host: "127.0.0.1", usingSecure: true, label: "127.0.0.1 secure" },
              ]
            : [
                                { label: "default" },
                                { host: "localhost", usingSecure: false, label: "localhost insecure" },
                                { host: "127.0.0.1", usingSecure: false, label: "127.0.0.1 insecure" },
                                { host: "localhost", usingSecure: true, label: "localhost secure" },
                                { host: "127.0.0.1", usingSecure: true, label: "127.0.0.1 secure" },
              ];

        console.log(
            `🧭 Intentando conectar QZ desde ${isHttpsPage ? "HTTPS (solo secure)" : "HTTP (secure + insecure)"}`
        );

        for (const attempt of attempts) {
            try {
                const connectFn = qz.websocket.connect as unknown as (opts?: {
                    host?: string;
                    usingSecure?: boolean;
                    retries?: number;
                    delay?: number;
                }) => Promise<void>;

                if (!attempt.host) {
                    await connectFn();
                } else {
                    await connectFn({
                        host: attempt.host,
                        usingSecure: attempt.usingSecure,
                        retries: 1,
                        delay: 0.5,
                    });
                }

                if (!qz.websocket.isActive()) {
                    throw new Error("QZ devolvió éxito pero websocket no quedó activo");
                }

                console.log(`🖨️ Conectado a QZ Tray (${attempt.label})`);
                return true;
            } catch (attemptErr) {
                console.warn(`⚠️ Falló intento QZ (${attempt.label}):`, attemptErr);
                // Seguir con el siguiente intento.
            }
        }

        console.warn("⚠️ No se pudo conectar a QZ Tray en localhost/127.0.0.1");
        return false;
    } catch (err) {
        console.warn("⚠️ No se pudo conectar a QZ Tray:", err);
        return false;
    }
}

export async function disconnectPrinter(): Promise<void> {
    if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
    }
}

// ============================================
// OBTENER IMPRESORA
// ============================================

export async function getDefaultPrinter(): Promise<string | null> {
    try {
        const printer = await qz.printers.getDefault();
        console.log("🖨️ Impresora predeterminada en QZ:", printer);
        return printer;
    } catch {
        console.warn("⚠️ No se encontró impresora predeterminada");
        return null;
    }
}

export async function findThermalPrinter(): Promise<string | null> {
    try {
        const printers: string[] = await qz.printers.find();
        console.log("🖨️ Impresoras detectadas por QZ:", printers);
        // Buscar impresoras térmicas comunes
        const thermalKeywords = ["thermal", "receipt", "pos", "xprinter", "epson tm", "star tsp", "58mm", "80mm"];
        const thermal = printers.find((p: string) =>
            thermalKeywords.some(kw => p.toLowerCase().includes(kw))
        );
        if (thermal) {
            console.log("✅ Impresora térmica seleccionada:", thermal);
            return thermal;
        }

        const defaultPrinter = await getDefaultPrinter();
        console.log("ℹ️ Se usará impresora predeterminada:", defaultPrinter);
        return defaultPrinter;
    } catch {
        return await getDefaultPrinter();
    }
}

// ============================================
// IMPRIMIR TICKET
// ============================================

export interface TicketData {
    folio: number;
    date: string; // ISO date string
    studentName: string;
    studentNumber: string;
    studentLevel: string;
    concept: string; // "Inscripción" | "Mensualidad Mar 2026"
    amountPaid: number;       // Monto de ESTE pago individual
    amountExpected: number;   // Monto total esperado del período
    amountPending: number;    // Lo que falta DESPUÉS de este pago
    previousBalance: number;  // Lo que ya se había pagado antes
    paymentMethod: "efectivo" | "transferencia";
    confirmedBy: string;
    nextPaymentText?: string;
    nextPaymentAmount?: number;
    copies?: 1 | 2;
}

export interface DailySummaryData {
    date: string;
    cashierName: string;
    folioStart: number;
    folioEnd: number;
    totalOperations: number;
    cashTotal: number;
    cashCount: number;
    transferTotal: number;
    transferCount: number;
    enrollmentTotal: number;
    enrollmentCount: number;
    tuitionTotal: number;
    tuitionCount: number;
    grandTotal: number;
}

export async function printTicket(data: TicketData): Promise<boolean> {
    try {
        printViaWindow(data);
        console.log("🖨️ Ticket enviado a impresión por navegador (Folio #" + data.folio + ")");
        return true;
    } catch (err) {
        console.error("❌ Error al imprimir ticket:", err);
        return false;
    }
}

export async function printDailySummary(data: DailySummaryData): Promise<boolean> {
    try {
        const connected = await connectPrinter();
        if (!connected) {
            printSummaryViaWindow(data);
            return true;
        }

        const printer = await findThermalPrinter();
        if (!printer) {
            printSummaryViaWindow(data);
            return true;
        }

        const config = qz.configs.create(printer, {
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        const summaryTicket = generateEscPosSummary(data);
        await qz.print(config, summaryTicket);

        console.log("🖨️ Corte de caja impreso");
        return true;
    } catch (err) {
        console.error("❌ Error al imprimir corte de caja:", err);
        printSummaryViaWindow(data);
        return false;
    }
}

// ============================================
// GENERADOR ESC/POS (comandos para impresora térmica)
// ============================================

function generateEscPosSummary(data: DailySummaryData): object[] {
    const folioStart = String(data.folioStart).padStart(3, "0");
    const folioEnd = String(data.folioEnd).padStart(3, "0");

    return [
        { type: "raw", format: "plain", data: "\x1B\x40" },
        { type: "raw", format: "plain", data: "\x1B\x61\x01" }, // Center
        { type: "raw", format: "plain", data: "\x1B\x45\x01" }, // Bold
        { type: "raw", format: "plain", data: "CORTE DE CAJA\n" },
        { type: "raw", format: "plain", data: "\x1B\x45\x00" },
        { type: "raw", format: "plain", data: "================================\n" },
        { type: "raw", format: "plain", data: "\x1B\x61\x00" }, // Left
        { type: "raw", format: "plain", data: `Fecha: ${data.date}\n` },
        { type: "raw", format: "plain", data: `Cajero: ${data.cashierName}\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n" },
        { type: "raw", format: "plain", data: `Folios: #${folioStart} - #${folioEnd}\n` },
        { type: "raw", format: "plain", data: `Total operaciones: ${data.totalOperations}\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n" },
        { type: "raw", format: "plain", data: `Efectivo:      $${data.cashTotal.toFixed(2)} (${data.cashCount})\n` },
        { type: "raw", format: "plain", data: `Transferencia: $${data.transferTotal.toFixed(2)} (${data.transferCount})\n` },
        { type: "raw", format: "plain", data: "================================\n" },
        { type: "raw", format: "plain", data: "\x1B\x45\x01" }, // Bold
        { type: "raw", format: "plain", data: `TOTAL:         $${data.grandTotal.toFixed(2)}\n` },
        { type: "raw", format: "plain", data: "\x1B\x45\x00" },
        { type: "raw", format: "plain", data: "================================\n" },
        { type: "raw", format: "plain", data: `Inscripciones: $${data.enrollmentTotal.toFixed(2)} (${data.enrollmentCount})\n` },
        { type: "raw", format: "plain", data: `Colegiaturas:  $${data.tuitionTotal.toFixed(2)} (${data.tuitionCount})\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n\n" },
        { type: "raw", format: "plain", data: "Firma cajero:\n\n" },
        { type: "raw", format: "plain", data: "___________________________\n\n" },
        { type: "raw", format: "plain", data: "Firma supervisor:\n\n" },
        { type: "raw", format: "plain", data: "___________________________\n" },
        { type: "raw", format: "plain", data: "\n\n\n" },
        { type: "raw", format: "plain", data: "\x1D\x56\x00" }, // Full cut
    ];
}

// ============================================
// FALLBACK: Impresión por navegador (window.print)
// ============================================

function printViaWindow(data: TicketData): void {
    const html = generateFullTicketPage(data);
    openPrintWindow(html);
}

function printSummaryViaWindow(data: DailySummaryData): void {
    const html = generateSummaryHTML(data);
    openPrintWindow(html);
}

function openPrintWindow(html: string): void {
    // Usar iframe oculto para evitar bloqueo de popups
    const existingFrame = document.getElementById("ticket-print-frame") as HTMLIFrameElement;
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "ticket-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
        console.error("❌ No se pudo acceder al iframe de impresión.");
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
        console.error("❌ No se pudo acceder a la ventana de impresión.");
        return;
    }

    let printed = false;
    const safePrint = () => {
        if (printed) return;
        printed = true;
        frameWindow.focus();
        frameWindow.print();
    };

    const frameImages = Array.from(doc.images || []);

    if (frameImages.length === 0) {
        setTimeout(safePrint, 250);
        return;
    }

    let pending = frameImages.length;
    const onImageDone = () => {
        pending -= 1;
        if (pending <= 0) {
            setTimeout(safePrint, 120);
        }
    };

    frameImages.forEach((img) => {
        if (img.complete) {
            onImageDone();
        } else {
            img.addEventListener("load", onImageDone, { once: true });
            img.addEventListener("error", onImageDone, { once: true });
        }
    });

    // Fallback para evitar bloquear impresión si alguna imagen no dispara eventos.
    setTimeout(safePrint, 2000);
}

// ============================================
// PRINTER SERVICE - Conexión con impresora térmica via QZ Tray
// ============================================
// QZ Tray debe estar instalado en la PC de caja (https://qz.io)
// La impresora térmica debe estar conectada por USB y configurada en Windows

import qz from "qz-tray";
import { generateFullTicketPage, generateSummaryHTML } from "./ticket-template";

let isConnected = false;

// ============================================
// CONEXIÓN
// ============================================

export async function connectPrinter(): Promise<boolean> {
    if (isConnected && qz.websocket.isActive()) {
        return true;
    }

    try {
        // QZ Tray firma sus propias conexiones locales
        qz.security.setCertificatePromise(() =>
            Promise.resolve(
                "-----BEGIN CERTIFICATE-----\n" +
                "MIIECzCCAvOgAwIBAgIJANj3kZ/3cRMQMA0GCSqGSIb3DQEBCwUAMIGfMQswCQYD\n" +
                "VQQGEwJVUzELMAkGA1UECAwCTlkxETAPBgNVBAcMCE5ldyBZb3JrMRswGQYDVQQK\n" +
                "DBJURVNUSU5HIFBVUlBPU0VTMR0wGwYDVQQLDBRRWiBJbmR1c3RyaWVzLCBMTEMx\n" +
                "GDAWBgNVBAMMD3F6LXRyYXktdGVzdGluZzEgMB4GCSqGSIb3DQEJARYRc3VwcG9y\n" +
                "dEBxei5pbzAeFw0xNTAzMTkwMjM4NDVaFw0yNTAzMTYwMjM4NDVaMIGfMQswCQYD\n" +
                "VQQGEwJVUzELMAkGA1UECAwCTlkxETAPBgNVBAcMCE5ldyBZb3JrMRswGQYDVQQK\n" +
                "DBJURVNUSU5HIFBVUlBPU0VTMR0wGwYDVQQLDBRRWiBJbmR1c3RyaWVzLCBMTEMx\n" +
                "GDAWBgNVBAMMD3F6LXRyYXktdGVzdGluZzEgMB4GCSqGSIb3DQEJARYRc3VwcG9y\n" +
                "dEBxei5pbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALYxMmjbbfGM\n" +
                "pw2eCwvyFiMRR5fGOsaI+5JvC6ByOhmGGDTWl9jCBOGQ0ed29MqrJ2gVOAWVOFDb\n" +
                "q5H/LFWM4W/wWBSGSBKt69AcsVSNPYQW0PDDM+/CVxYRRWj6FEN+TGFDMOsmSPV\n" +
                "IA2HLJKH6h//EDYOagcnEGiSQlTjjl76LPM6MBGnIEMa5gfoFcFxJFnwlM/N0tMO\n" +
                "MLSbV0VRS+N0Mm9fYHlGEMmGT72qv0JLVLLZdkZMkk6fYEBVb7gm5KbPZ7HBMUL\n" +
                "Z4GkROy69stvPLvNbXa5gKOGLH1JDM7M/GGMfGOqBKWBRfc4JL5R/HoLdKSPej/n\n" +
                "HPMd1COJUcsCAwEAAaNQME4wHQYDVR0OBBYEFPNG7S+PJWfbRSB7WI5ihSBj1W5Y\n" +
                "MB8GA1UdIwQYMBaAFPNG7S+PJWfbRSB7WI5ihSBj1W5YMAwGA1UdEwQFMAMBAf8w\n" +
                "DQYJKoZIhvcNAQELBQADggEBAKbz+OXWP4LGMax9Kzf6a3R6mSN4LmaY5VB1sJDh\n" +
                "Jape0pEC7gYN0x6sNdYJHMplV/DVlBCFjFrg/B7TKH8+RsIIEYPHFxfFABTBIFmz\n" +
                "2ue/0vA6/eV2MlqAuYIG3fPMPVPC3Nw3RhF1p2bRgaIxrfCvhKiV2E0I6hJZHHdR\n" +
                "K8VDIiV7fBegXgVtCMY9LvTku3YNsGpPOUc0rFTHi7lxP0FRwB4LiAW1YL3WpFMy\n" +
                "KLbVOxBjOcW5t4i2pH7YhuPR1nKT6gRFAGJxeFL5KzhRTPJaIVYfzMgxGRmolRAf\n" +
                "czj7sNpAZhEdGiGJf2Lj1fDAuF7lBP1BzU7bPEe1VIYxzk=\n" +
                "-----END CERTIFICATE-----"
            )
        );

        // Para desarrollo/testing, no validar firma
        qz.security.setSignatureAlgorithm("SHA512");
        qz.security.setSignaturePromise(() => Promise.resolve(""));

        await qz.websocket.connect();
        isConnected = true;
        console.log("🖨️ Conectado a QZ Tray");
        return true;
    } catch (err) {
        console.warn("⚠️ No se pudo conectar a QZ Tray:", err);
        isConnected = false;
        return false;
    }
}

export async function disconnectPrinter(): Promise<void> {
    if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
        isConnected = false;
    }
}

// ============================================
// OBTENER IMPRESORA
// ============================================

export async function getDefaultPrinter(): Promise<string | null> {
    try {
        const printer = await qz.printers.getDefault();
        return printer;
    } catch {
        console.warn("⚠️ No se encontró impresora predeterminada");
        return null;
    }
}

export async function findThermalPrinter(): Promise<string | null> {
    try {
        const printers: string[] = await qz.printers.find();
        // Buscar impresoras térmicas comunes
        const thermalKeywords = ["thermal", "receipt", "pos", "xprinter", "epson tm", "star tsp", "58mm", "80mm"];
        const thermal = printers.find((p: string) =>
            thermalKeywords.some(kw => p.toLowerCase().includes(kw))
        );
        return thermal || await getDefaultPrinter();
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
        const connected = await connectPrinter();
        if (!connected) {
            console.warn("⚠️ QZ Tray no disponible. Usando impresión por navegador.");
            printViaWindow(data);
            return true;
        }

        const printer = await findThermalPrinter();
        if (!printer) {
            console.warn("⚠️ No se encontró impresora. Usando impresión por navegador.");
            printViaWindow(data);
            return true;
        }

        const config = qz.configs.create(printer, {
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        // Imprimir COPIA ESTUDIANTE
        const studentTicket = generateEscPosTicket(data, "COPIA ESTUDIANTE");
        await qz.print(config, studentTicket);

        // Pequeña pausa entre tickets
        await new Promise(resolve => setTimeout(resolve, 500));

        // Imprimir COPIA CAJA
        const cashierTicket = generateEscPosTicket(data, "COPIA CAJA");
        await qz.print(config, cashierTicket);

        console.log("🖨️ 2 tickets impresos correctamente (Folio #" + data.folio + ")");
        return true;
    } catch (err) {
        console.error("❌ Error al imprimir ticket:", err);
        // Fallback a impresión por navegador
        printViaWindow(data);
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

function generateEscPosTicket(data: TicketData, copyLabel: string): object[] {
    const dateObj = new Date(data.date);
    const dateStr = dateObj.toLocaleDateString("es-MX", {
        day: "2-digit", month: "short", year: "numeric",
        timeZone: "America/Mexico_City"
    });
    const timeStr = dateObj.toLocaleTimeString("es-MX", {
        hour: "2-digit", minute: "2-digit",
        timeZone: "America/Mexico_City"
    });

    const folioStr = String(data.folio).padStart(3, "0");

    return [
        { type: "raw", format: "plain", data: "\x1B\x40" },  // Init
        { type: "raw", format: "plain", data: "\x1B\x61\x01" }, // Center
        { type: "raw", format: "plain", data: "\x1B\x45\x01" }, // Bold ON
        { type: "raw", format: "plain", data: "ESCUELA DE INGLES\n" },
        { type: "raw", format: "plain", data: "\x1B\x45\x00" }, // Bold OFF
        { type: "raw", format: "plain", data: "================================\n" },
        { type: "raw", format: "plain", data: "\x1B\x61\x00" }, // Left align
        { type: "raw", format: "plain", data: `Folio: #${folioStr}\n` },
        { type: "raw", format: "plain", data: `Fecha: ${dateStr}  ${timeStr}\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n" },
        { type: "raw", format: "plain", data: `Alumno: ${data.studentName}\n` },
        { type: "raw", format: "plain", data: `No:     #${data.studentNumber}\n` },
        { type: "raw", format: "plain", data: `Nivel:  ${data.studentLevel}\n` },
        { type: "raw", format: "plain", data: `Concepto: ${data.concept}\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n" },
        { type: "raw", format: "plain", data: `Monto esperado:  $${data.amountExpected.toFixed(2)}\n` },
        ...(data.previousBalance > 0
            ? [
                { type: "raw", format: "plain", data: `Abono anterior:  $${data.previousBalance.toFixed(2)}\n` },
                { type: "raw", format: "plain", data: `Pago actual:     $${data.amountPaid.toFixed(2)}\n` },
                { type: "raw", format: "plain", data: `Total pagado:    $${(data.previousBalance + data.amountPaid).toFixed(2)}\n` },
              ]
            : [{ type: "raw", format: "plain", data: `Monto pagado:    $${data.amountPaid.toFixed(2)}\n` }]),
        ...(data.amountPending > 0
            ? [{ type: "raw", format: "plain", data: `Saldo pendiente: $${data.amountPending.toFixed(2)}\n` }]
            : []),
        { type: "raw", format: "plain", data: `Metodo: ${data.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}\n` },
        { type: "raw", format: "plain", data: "--------------------------------\n" },
        { type: "raw", format: "plain", data: `Atendio: ${data.confirmedBy || "Admin"}\n` },
        { type: "raw", format: "plain", data: "================================\n" },
        { type: "raw", format: "plain", data: "\x1B\x61\x01" }, // Center
        { type: "raw", format: "plain", data: "\x1B\x45\x01" }, // Bold ON
        { type: "raw", format: "plain", data: `*** ${copyLabel} ***\n` },
        { type: "raw", format: "plain", data: "\x1B\x45\x00" }, // Bold OFF
        { type: "raw", format: "plain", data: "\n\n\n" },
        { type: "raw", format: "plain", data: "\x1D\x56\x01" }, // Partial cut
    ];
}

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

    setTimeout(() => {
        iframe.contentWindow?.print();
    }, 500);
}

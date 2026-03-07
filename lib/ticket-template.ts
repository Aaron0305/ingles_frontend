// ============================================
// TICKET TEMPLATE - HTML para impresión por navegador (fallback)
// ============================================
// Genera HTML con CSS optimizado para papel térmico de 80mm
// Se usa cuando QZ Tray no está disponible

import type { TicketData, DailySummaryData } from "./printer";

const STYLES = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');

        @page { size: 80mm auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            font-family: 'Space Mono', 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            background: #e8e8e4;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .receipt-wrapper {
            width: 72mm;
            max-width: 300px;
            padding: 4mm 0 14mm 0;
        }

        .center { text-align: center; }
        .bold { font-weight: 700; }

        .separator {
            border: none;
            border-top: 1px dashed #bbb;
            margin: 5px 0;
        }

        .double-separator {
            border: none;
            border-top: 3px double #000;
            margin: 6px 0;
        }

        .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 1.5px 0;
            line-height: 1.6;
        }

        .ticket {
            background: #fff;
            padding: 5mm 5mm 5mm;
            margin-bottom: 0;
            padding-bottom: 6px;
        }

        h2 {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: .04em;
            text-transform: uppercase;
            margin: 2px 0 1px;
        }

        .cut-line {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 7px 0;
            font-size: 10px;
            color: #aaa;
            letter-spacing: .08em;
        }
        .cut-line::before,
        .cut-line::after {
            content: '';
            flex: 1;
            border-top: 1px dashed #bbb;
        }

        .signature-line {
            border-bottom: 1px solid #000;
            width: 80%;
            margin: 20px auto 4px;
        }

        .print-bar {
            width: 100%;
            text-align: center;
            padding: 14px 0;
            background: #1a1a1a;
            border-bottom: none;
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .print-bar button {
            background: #fff;
            color: #000;
            border: none;
            padding: 9px 28px;
            font-size: 12px;
            font-weight: 700;
            font-family: 'Space Mono', monospace;
            letter-spacing: .06em;
            text-transform: uppercase;
            border-radius: 2px;
            cursor: pointer;
            transition: background .15s;
        }
        .print-bar button:hover { background: #e2e2e2; }

        @media print {
            html, body { background: #fff; }
            .receipt-wrapper { width: 72mm; max-width: 72mm; }
            .cut-line { color: #999; }
            .ticket { page-break-inside: avoid; }
            .print-bar { display: none; }
        }
    </style>
`;

export function generateTicketHTML(data: TicketData, copyLabel: string): string {
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

    return `
    <div class="ticket">
        <div class="center bold"><h2>What time is it?</h2></div>
        <div class="double-separator"></div>
        <div>Folio: #${folioStr}</div>
        <div>Fecha: ${dateStr}  ${timeStr}</div>
        <div class="separator"></div>
        <div>Alumno: ${data.studentName}</div>
        <div>No:     #${data.studentNumber}</div>
        <div>Nivel:  ${data.studentLevel}</div>
        <div>Concepto: ${data.concept}</div>
        <div class="separator"></div>
        <div class="row"><span>Monto esperado:</span><span>$${data.amountExpected.toFixed(2)}</span></div>
        ${data.previousBalance > 0 ? `
        <div class="row"><span>Abono anterior:</span><span>$${data.previousBalance.toFixed(2)}</span></div>
        <div class="row"><span>Pago actual:</span><span>$${data.amountPaid.toFixed(2)}</span></div>
        <div class="row bold"><span>Total pagado:</span><span>$${(data.previousBalance + data.amountPaid).toFixed(2)}</span></div>
        ` : `
        <div class="row"><span>Monto pagado:</span><span>$${data.amountPaid.toFixed(2)}</span></div>
        `}
        ${data.amountPending > 0 ? `<div class="row"><span>Saldo pendiente:</span><span>$${data.amountPending.toFixed(2)}</span></div>` : ""}
        <div>Metodo: ${data.paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}</div>
        <div class="separator"></div>
        <div>Atendio: ${data.confirmedBy || "Admin"}</div>
        <div class="double-separator"></div>
        <div class="center bold">*** ${copyLabel} ***</div>
    </div>`;
}

export function generateSummaryHTML(data: DailySummaryData): string {
    const folioStart = String(data.folioStart).padStart(3, "0");
    const folioEnd = String(data.folioEnd).padStart(3, "0");

    return `
    <!DOCTYPE html>
    <html><head><title>Corte de Caja</title>${STYLES}</head><body>
    <div class="receipt-wrapper">
    <div class="ticket">
        <div class="center bold"><h2>CORTE DE CAJA</h2></div>
        <div class="double-separator"></div>
        <div>Fecha: ${data.date}</div>
        <div>Cajero: ${data.cashierName}</div>
        <div class="separator"></div>
        <div>Folios: #${folioStart} - #${folioEnd}</div>
        <div>Total operaciones: ${data.totalOperations}</div>
        <div class="separator"></div>
        <div class="row"><span>Efectivo:</span><span>$${data.cashTotal.toFixed(2)} (${data.cashCount})</span></div>
        <div class="row"><span>Transferencia:</span><span>$${data.transferTotal.toFixed(2)} (${data.transferCount})</span></div>
        <div class="double-separator"></div>
        <div class="row bold"><span>TOTAL:</span><span>$${data.grandTotal.toFixed(2)}</span></div>
        <div class="double-separator"></div>
        <div class="row"><span>Inscripciones:</span><span>$${data.enrollmentTotal.toFixed(2)} (${data.enrollmentCount})</span></div>
        <div class="row"><span>Colegiaturas:</span><span>$${data.tuitionTotal.toFixed(2)} (${data.tuitionCount})</span></div>
        <div class="separator"></div>
        <br>
        <div>Firma cajero:</div>
        <div class="signature-line"></div>
        <br>
        <div>Firma supervisor:</div>
        <div class="signature-line"></div>
    </div>
    </div>
    </body></html>`;
}

export function generateFullTicketPage(data: TicketData): string {
    return `
    <!DOCTYPE html>
    <html><head><title>Ticket #${String(data.folio).padStart(3, "0")}</title>${STYLES}</head><body>
    <div class="print-bar">
        <button onclick="window.print()">✦ Imprimir Tickets</button>
    </div>
    <div class="receipt-wrapper">
    ${generateTicketHTML(data, "COPIA ESTUDIANTE")}
    <div class="cut-line">✂ CORTAR AQUI ✂</div>
    ${generateTicketHTML(data, "COPIA CAJA")}
    </div>
    </body></html>`;
}
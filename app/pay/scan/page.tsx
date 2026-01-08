"use client";

// Evita pre-render estático y cache en build/export
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

// IMPORTANTE: Usar Render para WebSockets (Vercel no soporta WebSockets persistentes)
const getApiUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "https://ingles-backend-bk4n.onrender.com";
    }
  }
  return "http://127.0.0.1:3001";
};

// Componente que maneja la redirección con searchParams
function SearchParamsHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      router.replace(`/pay/scan/${id}`);
    }
  }, [searchParams, router]);

  return null;
}

// Componente principal de la landing
function PayScanContent() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "qr">("manual");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  // Limpiar scanner al desmontar o cambiar de modo
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const scanner = scannerRef.current;
          if (scanner.isScanning) {
            scanner.stop().catch(() => {});
          }
        } catch {
          // Ignorar errores al limpiar
        }
      }
    };
  }, []);

  const goWithId = (id: string) => {
    if (!id) return;
    // Detener escáner antes de navegar (solo si está escaneando)
    if (scannerRef.current && scanning) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      } catch {
        // Ignorar errores
      }
    }
    router.push(`/pay/scan/${id}`);
  };

  const extractStudentId = (qrData: string): string | null => {
    // Si el QR contiene una URL completa, extraer el studentId
    const urlMatch = qrData.match(/\/pay\/scan\/([a-f0-9-]{36})/i);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Si es directamente un UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(qrData.trim())) {
      return qrData.trim();
    }

    // Si es un número de estudiante (para buscar después)
    return qrData.trim();
  };

  const startScanner = async () => {
    setError(null);
    setScanning(true);

    try {
      // Esperar a que el contenedor esté en el DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          console.log("QR escaneado:", decodedText);
          
          try {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
            }
          } catch {
            // Ignorar error al detener
          }
          setScanning(false);
          scannerRef.current = null;

          const studentId = extractStudentId(decodedText);
          if (studentId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(studentId)) {
              router.push(`/pay/scan/${studentId}`);
            } else {
              setInput(studentId);
              setMode("manual");
              searchStudent(studentId);
            }
          }
        },
        () => {
          // Ignorar errores de escaneo
        }
      );
    } catch (err) {
      console.error("Error iniciando escáner:", err);
      setError("No se pudo acceder a la cámara. Verifica los permisos.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignorar errores al detener
      }
    }
    setScanning(false);
  };

  const searchStudent = async (studentNumber: string) => {
    try {
      setLoading(true);
      const API_URL = getApiUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${API_URL}/api/students?studentNumber=${encodeURIComponent(studentNumber)}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const student = await res.json();
      if (!student || student.error) {
        setError("No encontré un estudiante con ese ID o número.");
      } else {
        goWithId(student.id);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setError("Tiempo de espera excedido. Verifica que el backend esté encendido.");
      } else {
        setError("Error consultando estudiantes. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const raw = input.trim();
    if (!raw) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(raw)) {
      return goWithId(raw);
    }

    await searchStudent(raw);
  };

  const switchToQR = () => {
    setMode("qr");
    setError(null);
    setTimeout(() => startScanner(), 100);
  };

  const switchToManual = () => {
    stopScanner();
    setMode("manual");
    setError(null);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white text-center">
        <h1 className="text-xl font-bold">Escaneo de Pago</h1>
        <p className="text-blue-100 text-sm mt-1">What Time Is It? Idiomas</p>
      </div>

      {/* Tabs de modo */}
      <div className="flex border-b">
        <button
          onClick={switchToManual}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mode === "manual"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📝 Número Manual
        </button>
        <button
          onClick={switchToQR}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mode === "qr"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📷 Escanear QR
        </button>
      </div>

      <div className="p-6 space-y-4">
        {mode === "manual" ? (
          <>
            <p className="text-sm text-gray-600">
              Ingresa el <b>Número de Estudiante</b> o <b>Student ID</b> para procesar el pago.
            </p>

            <form onSubmit={onSubmit} className="space-y-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ej: 001 o UUID del estudiante"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? "Buscando…" : "Procesar Pago"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center">
              Apunta la cámara al código QR del estudiante
            </p>

            <div className="relative">
              <div 
                id={scannerContainerId} 
                className="w-full rounded-xl overflow-hidden bg-gray-900"
                style={{ minHeight: "280px" }}
              ></div>
              
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
                  <button
                    onClick={startScanner}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Iniciar Cámara
                  </button>
                </div>
              )}

              {scanning && (
                <button
                  onClick={stopScanner}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Detener Escaneo
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400 text-center">
              El QR debe contener el ID del estudiante o una URL de pago
            </p>
          </>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          onClick={() => window.close()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 font-medium rounded-xl transition-colors border border-gray-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cerrar ventana
        </button>
      </div>

      <div className="bg-gray-50 px-6 py-4 text-center">
        <p className="text-xs text-gray-400">What Time Is It? Idiomas © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

// Loading fallback para Suspense
function LoadingFallback() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white text-center">
        <h1 className="text-xl font-bold">Escaneo de Pago</h1>
        <p className="text-blue-100 text-sm mt-1">What Time Is It? Idiomas</p>
      </div>
      <div className="p-12 text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando...</p>
      </div>
    </div>
  );
}

// Componente exportado con Suspense
export default function PayScanLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <SearchParamsHandler />
        <PayScanContent />
      </Suspense>
    </div>
  );
}

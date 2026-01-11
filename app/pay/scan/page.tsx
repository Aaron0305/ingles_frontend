"use client";

// Evita pre-render estático y cache en build/export
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, FileText, QrCode } from "lucide-react";
import Image from "next/image";

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
            scanner.stop().catch(() => { });
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
          scannerRef.current.stop().catch(() => { });
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
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative">
      {/* Header con gradiente institucional y logo */}
      {/* Header con diseño solicitado: Rojo con Azul y línea diagonal blanca */}
      <div className="relative p-6 text-white text-center overflow-hidden h-32 flex items-center justify-center">
        {/* Fondo con diseño específico */}
        <div className="absolute inset-0 z-0">
          {/* Base Azul Institucional */}
          <div className="absolute inset-0 bg-[#002f5d]"></div>

          {/* Parte Roja Institucional (Diagonal superior izquierda) */}
          <div
            className="absolute top-0 left-0 w-full h-full bg-[#E31837]"
            style={{
              clipPath: 'polygon(0 0, 65% 0, 35% 100%, 0 100%)'
            }}
          ></div>

          {/* Línea Diagonal Blanca con Gradiente */}
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.8) 45%, rgba(255,255,255,0.8) 55%, transparent 60%)',
              mixBlendMode: 'overlay'
            }}
          ></div>

          {/* Efecto de brillo/gradiente general */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/90 p-1.5 rounded-lg shadow-lg backdrop-blur-sm">
                <Image
                  src="/image/logo_mensaje.png"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-black tracking-tight leading-none text-white drop-shadow-md">ESCANEO</h1>
                <p className="text-sm font-medium text-white/90 drop-shadow-sm">DE PAGOS</p>
              </div>
            </div>
            {/* Decoración extra sutil */}
            <QrCode className="w-8 h-8 text-white/20" />
          </div>
        </div>
      </div>

      {/* Tabs de modo con colores institucionales */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={switchToManual}
          className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${mode === "manual"
              ? "text-white border-b-3 relative"
              : "text-gray-600 hover:text-[#014287] hover:bg-gray-50"
            }`}
          style={mode === "manual" ? {
            background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)',
            borderBottom: '3px solid #014287'
          } : {}}
        >
          <FileText className="w-4 h-4" strokeWidth={2.5} />
          Número Manual
        </button>
        <button
          onClick={switchToQR}
          className={`flex-1 py-4 text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${mode === "qr"
              ? "text-white border-b-3 relative"
              : "text-gray-600 hover:text-[#014287] hover:bg-gray-50"
            }`}
          style={mode === "qr" ? {
            background: 'linear-gradient(135deg, #014287 0%, #2596be 100%)',
            borderBottom: '3px solid #014287'
          } : {}}
        >
          <QrCode className="w-4 h-4" strokeWidth={2.5} />
          Escanear QR
        </button>
      </div>

      <div className="p-6 space-y-5">
        {mode === "manual" ? (
          <>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#2596be]/20 to-[#014287]/20 rounded-2xl mb-3">
                <FileText className="w-8 h-8 text-[#014287]" strokeWidth={2} />
              </div>
              <p className="text-sm text-gray-700 font-medium">
                Ingresa el <span className="font-bold text-[#014287]">Número de Estudiante</span> o <span className="font-bold text-[#014287]">Student ID</span> para procesar el pago.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ej: 001 o UUID del estudiante"
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3.5 text-gray-800 placeholder-gray-400 bg-white focus:outline-none transition-all duration-300 focus:border-[#2596be] focus:ring-4 focus:ring-[#2596be]/20 font-medium"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-60 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#E31837] to-[#002f5d]"></div>
                <div className="absolute inset-0 bg-white/20 group-hover:bg-transparent transition-colors"></div>
                {/* Línea diagonal decorativa en el botón */}
                <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]"></div>

                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Buscando...
                    </>
                  ) : (
                    <>
                      Procesar Pago
                      <FileText className="w-5 h-5" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#2596be]/20 to-[#014287]/20 rounded-2xl mb-3">
                <QrCode className="w-8 h-8 text-[#014287]" strokeWidth={2} />
              </div>
              <p className="text-sm text-gray-700 font-medium">
                Apunta la cámara al código QR del estudiante
              </p>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-inner" style={{ minHeight: "300px" }}>
              <div
                id={scannerContainerId}
                className="w-full rounded-xl overflow-hidden bg-[#010101]"
                style={{ minHeight: "300px" }}
              ></div>

              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <div className="mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#014287] to-[#2596be] rounded-2xl flex items-center justify-center shadow-lg mb-3">
                      <Camera className="w-10 h-10 text-white" strokeWidth={2} />
                    </div>
                  </div>
                  <button
                    onClick={startScanner}
                    className="px-6 py-3 text-white font-bold rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#E31837] to-[#002f5d]"></div>
                    <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]"></div>
                    <span className="relative z-10 flex items-center gap-2">
                      <Camera className="w-5 h-5" strokeWidth={2.5} />
                      Iniciar Cámara
                    </span>
                  </button>
                </div>
              )}

              {scanning && (
                <button
                  onClick={stopScanner}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 text-white text-sm font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                  style={{ background: '#ea242e' }}
                >
                  Detener Escaneo
                </button>
              )}
            </div>

            <p className="text-xs text-gray-500 text-center font-medium">
              El QR debe contener el ID del estudiante o una URL de pago
            </p>
          </>
        )}

        {error && (
          <div className="text-sm text-white bg-gradient-to-r from-[#ea242e] to-[#d46f75] border-2 border-[#c95e62] rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2">
              <X className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-white hover:bg-gray-800 font-semibold rounded-xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-800 group"
        >
          <X className="w-4 h-4 group-hover:rotate-90 transition-transform" strokeWidth={2.5} />
          Volver al Dashboard
        </button>
      </div>

      {/* Footer con mascota */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 text-center border-t border-gray-200 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 opacity-10">
          <Image
            src="/image/mascota.png"
            alt="Mascota"
            width={80}
            height={80}
            className="object-contain"
          />
        </div>
        <p className="text-xs text-gray-500 font-medium relative z-10">
          What Time Is It? Idiomas © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// Loading fallback para Suspense
function LoadingFallback() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
      <div className="bg-gradient-to-br from-[#014287] via-[#2596be] to-[#779bbf] p-6 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        </div>
        <div className="relative z-10">
          {/* Logo en loading */}
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="relative bg-white rounded-xl p-2 shadow-lg border border-white/30">
                <Image
                  src="/image/logo_mensaje.png"
                  alt="Logo"
                  width={100}
                  height={45}
                  className="object-contain"
                />
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Escaneo de Pago</h1>
          <p className="text-white/90 text-sm font-medium">Sistema de Pagos</p>
        </div>
      </div>
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#2596be', borderTopColor: 'transparent' }}></div>
        <p className="text-gray-600 font-medium">Cargando...</p>
      </div>
    </div>
  );
}

// Componente exportado con Suspense
export default function PayScanLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #014287 0%, #2596be 50%, #779bbf 100%)' }}>
      {/* Patrones decorativos de fondo */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <Suspense fallback={<LoadingFallback />}>
          <SearchParamsHandler />
          <PayScanContent />
        </Suspense>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const getApiUrl = () => {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "https://ingles-backend.vercel.app";
  }
  return "http://localhost:3001";
};

export default function PayScanLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soporta redirección automática si viene ?id=<studentId>
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      router.replace(`/pay/scan/${id}`);
    }
  }, [searchParams, router]);

  const goWithId = (id: string) => {
    if (!id) return;
    router.push(`/pay/scan/${id}`);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const raw = input.trim();
    if (!raw) return;

    // Si parece un UUID, navega directo
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(raw)) {
      return goWithId(raw);
    }

    // Si es número de estudiante, busca en la API y navega con el id
    try {
      setLoading(true);
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/students`);
      const students = await res.json();
      const found = Array.isArray(students)
        ? students.find((s: any) => String(s.studentNumber) === raw)
        : null;
      if (!found) {
        setError("No encontré un estudiante con ese ID o número.");
      } else {
        goWithId(found.id);
      }
    } catch (err) {
      setError("Error consultando estudiantes. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white text-center">
          <h1 className="text-xl font-bold">Escaneo de Pago</h1>
          <p className="text-blue-100 text-sm mt-1">English Learning Academy</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Esta página requiere un identificador de estudiante. Puedes:
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>Usar una URL con el formato <span className="font-mono">/pay/scan/&lt;studentId&gt;</span>.</li>
            <li>Pegar aquí el <b>Student ID</b> o el <b>Número de Estudiante</b>.</li>
          </ul>

          <form onSubmit={onSubmit} className="space-y-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pega Student ID o Número de estudiante"
              className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? "Buscando…" : "Continuar"}
            </button>
          </form>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-400">Sistema de Pagos • English Learning Academy</p>
        </div>
      </div>
    </div>
  );
}

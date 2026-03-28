// ============================================
// API CLIENT - Conexión con el Backend
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
        ? 'https://ingles-backend-bk4n.onrender.com'
        : 'http://127.0.0.1:3001');

// ============================================
// TIPOS
// ============================================

export interface Student {
    id: string;
    studentNumber: string;
    name: string;
    email: string;
    studentPhone?: string;
    emergencyPhone?: string;
    level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
    monthlyFee: number;
    status: "active" | "inactive" | "baja";
    createdAt?: string;
    lastAccess?: string;
    paymentScheme?: "daily" | "weekly" | "biweekly" | "monthly_28";
    classDays?: number[];
    enrollmentDate?: string;
    dropoutDate?: string;
    dropoutReason?: string;
}

export interface Admin {
    id: string;
    name: string;
    email: string;
    role: "admin" | "superadmin";
    status: "active" | "inactive";
    createdAt: string;
}

export interface Teacher {
    id: string;
    name: string;
    email: string;
    status: "active" | "inactive";
    createdAt: string;
}

export interface Payment {
    id: string;
    studentId: string;
    month: number;
    year: number;
    amount: number;           // Monto que pagó
    amountExpected?: number;  // Monto que debía pagar
    amountPending?: number;   // Monto pendiente
    paymentPercentage?: number; // Porcentaje pagado (0-100)
    status: "paid" | "pending" | "overdue";
    paidAt?: string;
    confirmedBy?: string;
    createdAt?: string;
    paymentMethod?: "efectivo" | "transferencia"; // Método de pago
    ticketFolio?: number; // Folio de ticket para impresión
}

export interface LoginResponse {
    success: boolean;
    user: {
        id: string;
        name: string;
        email: string;
        role: "admin" | "superadmin" | "teacher";
    };
    token: string;
}

export interface ApiError {
    error: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Error en la petición");
    }

    return data as T;
}

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
    };
}

// ============================================
// AUTH API
// ============================================

export const authApi = {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        return handleResponse<LoginResponse>(response);
    },

    logout(): void {
        localStorage.removeItem("token");
        localStorage.removeItem("userType");
        localStorage.removeItem("userName");
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem("token");
    },

    getUserType(): string | null {
        return localStorage.getItem("userType");
    },

    getUserName(): string | null {
        return localStorage.getItem("userName");
    },
};

// ============================================
// STUDENTS API
// ============================================

export const studentsApi = {
    async getAll(): Promise<Student[]> {
        const response = await fetch(`${API_URL}/api/students`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Student[]>(response);
    },

    async getById(id: string): Promise<Student> {
        const response = await fetch(`${API_URL}/api/students/${id}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Student>(response);
    },

    async create(data: {
        name: string;
        email: string;
        level: "Beginner 1" | "Beginner 2" | "Intermediate 1" | "Intermediate 2" | "Advanced 1" | "Advanced 2";
        monthlyFee?: number;
        studentPhone?: string;
        emergencyPhone?: string;
        paymentScheme?: "daily" | "weekly" | "biweekly" | "monthly_28";
        classDays?: number[];
        enrollmentDate?: string;
    }): Promise<Student> {
        const response = await fetch(`${API_URL}/api/students`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Student>(response);
    },

    async update(id: string, data: Partial<Student>): Promise<Student> {
        const response = await fetch(`${API_URL}/api/students/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Student>(response);
    },

    async delete(id: string): Promise<{ success: boolean }> {
        const response = await fetch(`${API_URL}/api/students/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        return handleResponse<{ success: boolean }>(response);
    },

    async toggleStatus(id: string, currentStatus: string): Promise<Student> {
        const newStatus = currentStatus === "active" ? "inactive" : "active";
        return this.update(id, { status: newStatus as "active" | "inactive" });
    },
};

// ============================================
// ADMINS API
// ============================================

export const adminsApi = {
    async getAll(): Promise<Admin[]> {
        const response = await fetch(`${API_URL}/api/admins`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Admin[]>(response);
    },

    async create(data: {
        name: string;
        email: string;
        password: string;
        role?: "admin" | "superadmin";
    }): Promise<Admin> {
        const response = await fetch(`${API_URL}/api/admins`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Admin>(response);
    },

    async update(id: string, data: Partial<Admin>): Promise<Admin> {
        const response = await fetch(`${API_URL}/api/admins/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Admin>(response);
    },

    async delete(id: string): Promise<{ success: boolean }> {
        const response = await fetch(`${API_URL}/api/admins/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        return handleResponse<{ success: boolean }>(response);
    },
};

// ============================================
// TEACHERS API
// ============================================

export const teachersApi = {
    async getAll(): Promise<Teacher[]> {
        const response = await fetch(`${API_URL}/api/teachers`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Teacher[]>(response);
    },

    async create(data: {
        name: string;
        email: string;
        password: string;
    }): Promise<Teacher> {
        const response = await fetch(`${API_URL}/api/teachers`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Teacher>(response);
    },

    async update(id: string, data: Partial<Teacher>): Promise<Teacher> {
        const response = await fetch(`${API_URL}/api/teachers/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Teacher>(response);
    },

    async toggleStatus(id: string, currentStatus: string): Promise<Teacher> {
        const newStatus = currentStatus === "active" ? "inactive" : "active";
        const response = await fetch(`${API_URL}/api/teachers/${id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus }),
        });
        return handleResponse<Teacher>(response);
    },

    async delete(id: string): Promise<{ success: boolean }> {
        const response = await fetch(`${API_URL}/api/teachers/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        return handleResponse<{ success: boolean }>(response);
    },
};

// ============================================
// AI API (Asistente)
// ============================================
export const aiApi = {
    sendMessageStream: async (
        message: string,
        historyContext: { role: "user" | "assistant", content: string }[] = [],
        teacherId?: string,
        onChunk?: (text: string) => void
    ): Promise<string> => {
        const response = await fetch(`${API_URL}/api/ai/chat`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ message, historyContext, teacherId }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Error respondiendo mensaje");
        }

        // Leer el stream SSE
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No se pudo iniciar el stream");

        const decoder = new TextDecoder();
        let fullReply = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            // Cada línea SSE es "data: {...}\n\n"
            const lines = text.split("\n").filter(l => l.startsWith("data: "));

            for (const line of lines) {
                const payload = line.replace("data: ", "");
                if (payload === "[DONE]") break;

                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.text) {
                        fullReply += parsed.text;
                        onChunk?.(parsed.text);
                    }
                    if (parsed.error) {
                        throw new Error(parsed.error);
                    }
                } catch (e) {
                    // Ignorar líneas malformadas
                    if (e instanceof Error && e.message !== "Error durante la generación.") continue;
                    throw e;
                }
            }
        }

        return fullReply;
    },

    getHistory: async (teacherId: string, limit: number = 50) => {
        const response = await fetch(`${API_URL}/api/ai/chat?teacherId=${teacherId}&limit=${limit}`, {
            headers: getAuthHeaders(),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error cargando historial");
        return data as { messages: { role: "user" | "assistant"; content: string; created_at: string }[] };
    }
};

// ============================================
// PAYMENTS API
// ============================================

export const paymentsApi = {
    // Obtener pagos consolidados por período (para UI de pagos)
    async getAll(): Promise<Payment[]> {
        const response = await fetch(`${API_URL}/api/payments`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Payment[]>(response);
    },

    // Obtener pagos individuales sin consolidar (para reportes diarios). Siempre incluye todas las versiones.
    async getAllRaw(): Promise<Payment[]> {
        const response = await fetch(`${API_URL}/api/payments?raw=true&includeAllVersions=true`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Payment[]>(response);
    },

    async getByStudent(studentId: string): Promise<Payment[]> {
        const response = await fetch(`${API_URL}/api/payments?studentId=${studentId}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<Payment[]>(response);
    },

    async create(data: {
        studentId: string;
        month: number;
        year: number;
        amount: number;
        amountExpected?: number;  // Para pagos parciales
        paymentMethod?: "efectivo" | "transferencia"; // Método de pago
    }): Promise<Payment> {
        const response = await fetch(`${API_URL}/api/payments`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Payment>(response);
    },

    async createEnrollment(data: {
        studentId: string;
        amount: number;
        paymentMethod?: "efectivo" | "transferencia";
    }): Promise<Payment> {
        const response = await fetch(`${API_URL}/api/payments`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ...data,
                month: 0,
                year: new Date().getFullYear(),
                payment_type: "enrollment",
            }),
        });

        return handleResponse<Payment>(response);
    },

    async revoke(studentId: string, month: number, year: number): Promise<Payment> {
        console.log('🗑️ [API] Iniciando revoke de pago:', { studentId, month, year });
        console.log('🌐 [API] URL:', `${API_URL}/api/payments`);

        try {
            const response = await fetch(`${API_URL}/api/payments`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ studentId, month, year, action: "revoke" }),
            });

            console.log('📥 [API] Response status:', response.status);

            const data = await response.json();
            console.log('📦 [API] Response data:', data);

            if (!response.ok) {
                throw new Error(data.error || "Error en la petición");
            }

            return data as Payment;
        } catch (error) {
            console.error('❌ [API] Error en revoke:', error);
            throw error;
        }
    },

    async updatePaymentMethod(paymentId: string, paymentMethod: "efectivo" | "transferencia"): Promise<{ success: boolean; id: string; paymentMethod: string }> {
        const response = await fetch(`${API_URL}/api/payments`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ paymentId, paymentMethod }),
        });

        return handleResponse<{ success: boolean; id: string; paymentMethod: string }>(response);
    },
};

// ============================================
// CUSTOM HOLIDAYS API
// ============================================

export interface CustomHoliday {
    id: string;
    date: string;       // "YYYY-MM-DD"
    name: string;
    isDisabled?: boolean;  // true = día predefinido desactivado
    createdBy?: string;
    createdAt?: string;
}

export const holidaysApi = {
    async getAll(): Promise<CustomHoliday[]> {
        const response = await fetch(`${API_URL}/api/holidays`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<CustomHoliday[]>(response);
    },

    async create(date: string, name: string = "Día festivo personalizado", isDisabled: boolean = false): Promise<CustomHoliday> {
        const response = await fetch(`${API_URL}/api/holidays`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ date, name, isDisabled }),
        });

        return handleResponse<CustomHoliday>(response);
    },

    async remove(date: string): Promise<{ success: boolean }> {
        const response = await fetch(`${API_URL}/api/holidays?date=${date}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });

        return handleResponse<{ success: boolean }>(response);
    },
};

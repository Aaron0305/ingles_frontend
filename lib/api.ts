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
    emergencyPhone?: string;
    level: "Beginner" | "Intermediate" | "Advanced";
    monthlyFee: number;
    status: "active" | "inactive";
    createdAt?: string;
    lastAccess?: string;
    paymentScheme?: "daily" | "weekly" | "biweekly" | "monthly_28";
    classDays?: number[];
    enrollmentDate?: string;
}

export interface Admin {
    id: string;
    name: string;
    email: string;
    role: "admin" | "superadmin";
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
}

export interface LoginResponse {
    success: boolean;
    user: {
        id: string;
        name: string;
        email: string;
        role: "admin" | "superadmin";
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
        level: "Beginner" | "Intermediate" | "Advanced";
        monthlyFee?: number;
        emergencyPhone?: string;
        paymentScheme?: "daily" | "weekly" | "biweekly" | "monthly_28";
        classDays?: number[];
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
// PAYMENTS API
// ============================================

export const paymentsApi = {
    async getAll(): Promise<Payment[]> {
        const response = await fetch(`${API_URL}/api/payments`, {
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
    }): Promise<Payment> {
        const response = await fetch(`${API_URL}/api/payments`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<Payment>(response);
    },

    async revoke(studentId: string, month: number, year: number): Promise<Payment> {
        const response = await fetch(`${API_URL}/api/payments`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ studentId, month, year, action: "revoke" }),
        });

        return handleResponse<Payment>(response);
    },
};

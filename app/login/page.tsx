"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

interface LoginFormData {
    email: string;
    password: string;
}

interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
}

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginFormData>({
        email: "",
        password: "",
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isDark, setIsDark] = useState<boolean | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Detectar tema del sistema inmediatamente
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDark(mediaQuery.matches);
        setMounted(true);
        
        const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.email.trim()) {
            newErrors.email = "El email es requerido";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Ingresa un email válido";
        }

        if (!formData.password) {
            newErrors.password = "La contraseña es requerida";
        } else if (formData.password.length < 6) {
            newErrors.password = "La contraseña debe tener al menos 6 caracteres";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            // Llamada real al backend
            const response = await authApi.login(formData.email, formData.password);

            if (response.success) {
                // Guardar token y datos del usuario
                localStorage.setItem("token", response.token);
                localStorage.setItem("userType", response.user.role);
                localStorage.setItem("userName", response.user.name);

                // Redirigir según el rol
                if (response.user.role === "superadmin") {
                    router.push("/admin");
                } else {
                    router.push("/dashboard");
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al conectar con el servidor";
            setErrors({ general: message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field: keyof LoginFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Limpiar error del campo cuando el usuario escribe
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    // Si no está montado, mostrar pantalla de carga con tema oscuro por defecto
    // para evitar el flash de tema claro
    if (!mounted) {
        return (
            <div 
                className="min-h-screen flex items-center justify-center"
                style={{ 
                    background: 'linear-gradient(145deg, #0a1628 0%, #0f172a 50%, #1e1b4b 100%)'
                }}
            />
        );
    }

    // Colores según el tema (ya sabemos el valor real de isDark)
    const darkMode = isDark ?? false;
    const colors = {
        bg: darkMode ? '#0a1628' : '#f0f4f8',
        cardBg: darkMode ? 'rgba(15, 30, 50, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        cardBorder: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(26, 58, 110, 0.1)',
        primary: '#1a56db',
        primaryHover: '#1e40af',
        accent: '#06b6d4',
        textPrimary: darkMode ? '#f1f5f9' : '#1e293b',
        textSecondary: darkMode ? '#94a3b8' : '#64748b',
        inputBg: darkMode ? 'rgba(30, 41, 59, 0.8)' : '#ffffff',
        inputBorder: darkMode ? 'rgba(59, 130, 246, 0.3)' : '#e2e8f0',
        inputFocus: '#1a56db',
        error: '#ef4444',
    };

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-4"
            style={{ 
                background: darkMode 
                    ? 'linear-gradient(145deg, #0a1628 0%, #0f172a 50%, #1e1b4b 100%)' 
                    : 'linear-gradient(145deg, #1a56db 0%, #2563eb 50%, #3b82f6 100%)'
            }}
        >
            {/* Efectos de fondo futuristas */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full blur-[100px] opacity-30" 
                    style={{ background: '#06b6d4' }} />
                <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full blur-[100px] opacity-20" 
                    style={{ background: '#8b5cf6' }} />
                {/* Líneas decorativas */}
                <div className="absolute top-20 left-10 w-32 h-px opacity-20" 
                    style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />
                <div className="absolute bottom-20 right-10 w-32 h-px opacity-20" 
                    style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />
            </div>

            {/* Login Card - Compacto */}
            <div className="relative w-full max-w-sm">
                <div 
                    className="rounded-2xl shadow-2xl p-6"
                    style={{ 
                        background: colors.cardBg,
                        border: `1px solid ${colors.cardBorder}`,
                        backdropFilter: 'blur(20px)'
                    }}
                >
                    {/* Header */}
                    <div className="text-center mb-6">
                        {/* Logo minimalista futurista */}
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3"
                            style={{ 
                                background: 'linear-gradient(135deg, #1a56db 0%, #06b6d4 100%)',
                                boxShadow: '0 4px 20px rgba(26, 86, 219, 0.4)'
                            }}>
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                            What Time Is It?
                        </h1>
                        <p className="text-xs font-medium tracking-widest mt-0.5" style={{ color: colors.accent }}>
                            IDIOMAS
                        </p>
                    </div>

                    {/* Error */}
                    {errors.general && (
                        <div className="mb-4 p-3 rounded-lg text-sm text-center"
                            style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: colors.error 
                            }}>
                            {errors.general}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange("email", e.target.value)}
                                placeholder="correo@ejemplo.com"
                                disabled={isLoading}
                                className="w-full px-3 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 focus:outline-none"
                                style={{ 
                                    background: colors.inputBg,
                                    border: `1.5px solid ${errors.email ? colors.error : colors.inputBorder}`,
                                    color: colors.textPrimary,
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = colors.inputFocus;
                                    e.target.style.boxShadow = `0 0 0 3px rgba(26, 86, 219, 0.1)`;
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = errors.email ? colors.error : colors.inputBorder;
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                            {errors.email && (
                                <p className="mt-1 text-xs" style={{ color: colors.error }}>{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => handleInputChange("password", e.target.value)}
                                    placeholder="••••••••"
                                    disabled={isLoading}
                                    className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm transition-all disabled:opacity-50 focus:outline-none"
                                    style={{ 
                                        background: colors.inputBg,
                                        border: `1.5px solid ${errors.password ? colors.error : colors.inputBorder}`,
                                        color: colors.textPrimary,
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = colors.inputFocus;
                                        e.target.style.boxShadow = `0 0 0 3px rgba(26, 86, 219, 0.1)`;
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = errors.password ? colors.error : colors.inputBorder;
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                                    style={{ color: colors.textSecondary }}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs" style={{ color: colors.error }}>{errors.password}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            style={{ 
                                background: 'linear-gradient(135deg, #1a56db 0%, #06b6d4 100%)',
                                boxShadow: '0 4px 15px rgba(26, 86, 219, 0.35)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(26, 86, 219, 0.45)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(26, 86, 219, 0.35)';
                            }}
                        >
                            {isLoading ? (
                                <span className="inline-flex items-center gap-2 justify-center">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Ingresando...
                                </span>
                            ) : (
                                "Ingresar"
                            )}
                        </button>
                    </form>

                    {/* Credenciales de prueba */}
                    <div className="mt-4 pt-4 text-center text-xs" style={{ borderTop: `1px solid ${colors.inputBorder}` }}>
                        <p className="font-medium mb-1" style={{ color: colors.textSecondary }}>Credenciales de prueba:</p>
                        <p style={{ color: colors.textSecondary }}>Super Admin: superadmin@test.com / super123</p>
                        <p style={{ color: colors.textSecondary }}>Admin: admin@test.com / admin123</p>
                    </div>
                </div>

                {/* Copyright */}
                <p className="text-center mt-4 text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    © 2026 What Time Is It? Idiomas®
                </p>
            </div>
        </div>
    );
}

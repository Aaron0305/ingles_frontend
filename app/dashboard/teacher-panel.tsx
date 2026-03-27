"use client";

import { useState, useEffect } from "react";
import { teachersApi, Teacher } from "@/lib/api";
import {
    Users, UserPlus, X, Trash2, Ban, CheckCircle,
    GraduationCap, Eye, EyeOff, Check, Shield,
    AlertCircle, Mail, Lock, User
} from "lucide-react";

// ── Password strength ────────────────────────────────────────────────────────
interface StrengthCheck { label: string; pass: boolean }
interface PasswordStrength { score: number; label: string; color: string; checks: StrengthCheck[] }

function getPasswordStrength(password: string): PasswordStrength {
    const checks: StrengthCheck[] = [
        { label: "Al menos 8 caracteres", pass: password.length >= 8 },
        { label: "Letra mayúscula", pass: /[A-Z]/.test(password) },
        { label: "Letra minúscula", pass: /[a-z]/.test(password) },
        { label: "Número", pass: /\d/.test(password) },
        { label: "Carácter especial (!@#…)", pass: /[^A-Za-z0-9]/.test(password) },
    ];
    const score = checks.filter((c) => c.pass).length;
    const levels = [
        { label: "", color: "transparent" },
        { label: "Muy débil", color: "#ef4444" },
        { label: "Débil", color: "#f97316" },
        { label: "Regular", color: "#eab308" },
        { label: "Fuerte", color: "#22c55e" },
        { label: "Muy fuerte", color: "#14b8a6" },
    ];
    return { score, checks, ...levels[score] };
}

// ── Props ────────────────────────────────────────────────────────────────────
interface TeacherPanelProps {
    userRole: "admin" | "superadmin";
}

export default function TeacherPanel({ userRole }: TeacherPanelProps) {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [formData, setFormData] = useState({
        name: "", email: "", password: "", confirmPassword: "",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const passwordStrength = getPasswordStrength(formData.password);
    const passwordsMatch = formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

    useEffect(() => { loadTeachers(); }, []);

    useEffect(() => {
        if (saveMessage) {
            const t = setTimeout(() => setSaveMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [saveMessage]);

    const loadTeachers = async () => {
        setIsLoading(true);
        try {
            const data = await teachersApi.getAll();
            setTeachers(data);
        } catch (error) {
            console.error("Error cargando teachers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = "Nombre requerido";
        if (!formData.email.trim()) errors.email = "El usuario es requerido";
        else if (!/^[a-zA-Z0-9._-]+$/.test(formData.email)) errors.email = "Solo letras, números, puntos y guiones";
        if (!formData.password) errors.password = "Contraseña requerida";
        else if (passwordStrength.score < 3) errors.password = "La contraseña debe ser al menos Regular";
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = "Las contraseñas no coinciden";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateTeacher = async () => {
        if (!validateForm()) return;
        setIsCreating(true);
        try {
            const newTeacher = await teachersApi.create({
                name: formData.name,
                email: formData.email + "@whattimeisit.com",
                password: formData.password,
            });
            setTeachers((prev) => [...prev, newTeacher]);
            setShowCreateModal(false);
            setFormData({ name: "", email: "", password: "", confirmPassword: "" });
            setShowPassword(false);
            setShowConfirm(false);
            setSaveMessage({ type: "success", text: "Maestro creado correctamente" });
        } catch (error) {
            console.error("Error creando teacher:", error);
            const message = error instanceof Error ? error.message : "Error al crear maestro";
            setFormErrors({ email: message });
            setSaveMessage({ type: "error", text: "Error al crear maestro" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleStatus = async (teacherId: string, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "inactive" : "active";
        setTeachers((prev) => prev.map((t) => t.id === teacherId ? { ...t, status: newStatus } : t));
        try {
            await teachersApi.toggleStatus(teacherId, currentStatus);
            setSaveMessage({ type: "success", text: `Maestro ${newStatus === "active" ? "activado" : "desactivado"} correctamente` });
        } catch (error) {
            console.error("Error cambiando estado:", error);
            setTeachers((prev) => prev.map((t) => t.id === teacherId ? { ...t, status: currentStatus as "active" | "inactive" } : t));
            setSaveMessage({ type: "error", text: "Error al cambiar estado" });
        }
    };

    const handleDelete = (teacher: Teacher) => {
        setTeacherToDelete(teacher);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!teacherToDelete) return;
        try {
            await teachersApi.delete(teacherToDelete.id);
            setTeachers((prev) => prev.filter((t) => t.id !== teacherToDelete.id));
            setSaveMessage({ type: "success", text: "Maestro eliminado correctamente" });
        } catch (error) {
            console.error("Error eliminando teacher:", error);
            setSaveMessage({ type: "error", text: "Error al eliminar maestro" });
        } finally {
            setShowDeleteModal(false);
            setTeacherToDelete(null);
        }
    };

    // ── Access denied ────────────────────────────────────────────────────────
    if (userRole !== "superadmin") {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <Ban className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Acceso Denegado</h2>
                <p style={{ color: "var(--text-secondary)" }} className="max-w-md">
                    Solo los súper administradores tienen permisos para ver y gestionar las cuentas de maestros.
                </p>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-fade-in relative">

            {/* ── Toast ── */}
            {saveMessage && (
                <div className={`fixed top-20 right-4 z-[100] px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-fade-in ${saveMessage.type === "success" ? "bg-green-500" : "bg-red-500"} text-white`}>
                    {saveMessage.type === "success"
                        ? <CheckCircle className="w-5 h-5 shrink-0" />
                        : <Ban className="w-5 h-5 shrink-0" />}
                    <span className="text-sm font-semibold">{saveMessage.text}</span>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Gestión de Teachers</h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        Cuentas con acceso a la plataforma para el panel de maestros.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 shadow-md shadow-blue-500/20"
                    style={{ background: "linear-gradient(135deg, #014287, #1e5fc2)" }}
                >
                    <UserPlus className="w-4 h-4" strokeWidth={2} />
                    Nuevo Teacher
                </button>
            </div>

            {/* ── Table ── */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border-color)" }}>
                {isLoading ? (
                    <div className="flex justify-center items-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <GraduationCap className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No hay maestros</h3>
                        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
                            Registra tu primer teacher para que pueda acceder a la plataforma.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 p-5">
                        {teachers.map((teacher) => (
                            <div
                                key={teacher.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl transition-all"
                                style={{ background: "var(--surface-alt)", border: "1px solid var(--border-color)" }}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                                        <GraduationCap className="w-5 h-5 text-white" strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{teacher.name}</h3>
                                        <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{teacher.email}</p>
                                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                            Creado: {new Date(teacher.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${teacher.status === "active"
                                        ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30"
                                        : "bg-gray-500/15 text-gray-500 border border-gray-500/25"
                                        }`}>
                                        {teacher.status === "active" ? "Activo" : "Inactivo"}
                                    </span>

                                    <button
                                        onClick={() => handleToggleStatus(teacher.id, teacher.status)}
                                        className="p-2 rounded-lg transition-colors hover:bg-amber-500/15 border border-transparent hover:border-amber-500/25"
                                        title={teacher.status === "active" ? "Desactivar acceso" : "Activar acceso"}
                                    >
                                        {teacher.status === "active"
                                            ? <Ban className="w-4.5 h-4.5 text-amber-500" strokeWidth={2} />
                                            : <CheckCircle className="w-4.5 h-4.5 text-amber-500" strokeWidth={2} />}
                                    </button>

                                    <button
                                        onClick={() => handleDelete(teacher)}
                                        className="p-2 rounded-lg transition-colors hover:bg-red-500/15 border border-transparent hover:border-red-500/25"
                                        title="Eliminar maestro"
                                    >
                                        <Trash2 className="w-4.5 h-4.5 text-red-500" strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* Modal: Crear Teacher                                          */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div
                        className="modal-content rounded-2xl w-full max-w-md shadow-2xl"
                        style={{
                            background: "var(--modal-bg)",
                            border: "1px solid var(--border-color)",
                            animation: "scaleIn .18s ease",
                        }}
                    >
                        {/* Header */}
                        <div className="px-6 pt-6 pb-5 flex items-start justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                                    <UserPlus className="w-5 h-5 text-white" strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold leading-tight" style={{ color: "var(--text-primary)" }}>Nuevo Teacher</h3>
                                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Completa todos los campos para crear la cuenta.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1.5 hover:bg-gray-500/10 rounded-lg transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                <X className="w-4 h-4" strokeWidth={2} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4">

                            {/* Nombre */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                    <User className="w-3.5 h-3.5" strokeWidth={2.5} /> Nombre y Apellido
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Nombre completo del teacher"
                                    className="w-full px-4 py-2.5 rounded-xl text-sm transition-all outline-none"
                                    style={{ background: "var(--input-bg)", border: `1px solid ${formErrors.name ? "#ef4444" : "var(--input-border)"}`, color: "var(--text-primary)" }}
                                />
                                {formErrors.name && (
                                    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                                        <AlertCircle className="w-3 h-3" />{formErrors.name}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                    <Mail className="w-3.5 h-3.5" strokeWidth={2.5} /> Correo Electrónico (Login)
                                </label>
                                <div
                                    className="flex items-center rounded-xl overflow-hidden transition-all"
                                    style={{ background: "var(--input-bg)", border: `1px solid ${formErrors.email ? "#ef4444" : "var(--input-border)"}` }}
                                >
                                    <input
                                        type="text"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value.replace(/@.*/, "") })}
                                        placeholder="nombre.apellido"
                                        className="flex-1 px-4 py-2.5 text-sm outline-none bg-transparent"
                                        style={{ color: "var(--text-primary)" }}
                                    />
                                    <span
                                        className="pr-4 text-sm font-medium select-none shrink-0"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        @whattimeisit.com
                                    </span>
                                </div>
                                {formErrors.email && (
                                    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                                        <AlertCircle className="w-3 h-3" />{formErrors.email}
                                    </p>
                                )}
                            </div>

                            {/* Contraseñas */}
                            <div className="grid grid-cols-2 gap-3">

                                {/* Contraseña */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                        <Lock className="w-3.5 h-3.5" strokeWidth={2.5} /> Contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••••"
                                            className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm transition-all outline-none"
                                            style={{ background: "var(--input-bg)", border: `1px solid ${formErrors.password ? "#ef4444" : "var(--input-border)"}`, color: "var(--text-primary)" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                                            style={{ color: "var(--text-secondary)" }}
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Barra de fuerza */}
                                    {formData.password.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((i) => {
                                                    const barColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6"];
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="h-1 flex-1 rounded-full transition-all duration-300"
                                                            style={{ background: i <= passwordStrength.score ? barColors[passwordStrength.score - 1] : "var(--border-color)" }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            <p className="mt-1 text-xs font-semibold" style={{ color: passwordStrength.color }}>
                                                {passwordStrength.label}
                                            </p>
                                            <ul className="mt-1.5 space-y-1">
                                                {passwordStrength.checks.map((c, i) => (
                                                    <li key={i} className="flex items-center gap-1.5 text-xs">
                                                        <span
                                                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors"
                                                            style={{ background: c.pass ? "#22c55e20" : "var(--border-color)" }}
                                                        >
                                                            <Check
                                                                className="w-2 h-2"
                                                                strokeWidth={3}
                                                                style={{ color: c.pass ? "#22c55e" : "var(--text-secondary)", opacity: c.pass ? 1 : 0.3 }}
                                                            />
                                                        </span>
                                                        <span style={{ color: c.pass ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                                            {c.label}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {formErrors.password && (
                                        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                                            <AlertCircle className="w-3 h-3" />{formErrors.password}
                                        </p>
                                    )}
                                </div>

                                {/* Confirmar contraseña */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                        <Shield className="w-3.5 h-3.5" strokeWidth={2.5} /> Confirmar
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showConfirm ? "text" : "password"}
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            placeholder="••••••••"
                                            className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm transition-all outline-none"
                                            style={{
                                                background: "var(--input-bg)",
                                                border: `1px solid ${formErrors.confirmPassword ? "#ef4444"
                                                    : passwordsMatch ? "#22c55e"
                                                        : "var(--input-border)"
                                                    }`,
                                                color: "var(--text-primary)",
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                                            style={{ color: "var(--text-secondary)" }}
                                        >
                                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {passwordsMatch ? (
                                        <p className="mt-1.5 flex items-center gap-1 text-xs text-green-500">
                                            <Check className="w-3 h-3" strokeWidth={3} /> Coinciden
                                        </p>
                                    ) : formErrors.confirmPassword ? (
                                        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                                            <AlertCircle className="w-3 h-3" />{formErrors.confirmPassword}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-4 flex gap-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                            <button
                                onClick={handleCreateTeacher}
                                disabled={isCreating}
                                className="flex-1 px-4 py-2.5 text-sm text-white font-semibold rounded-xl transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{ background: "linear-gradient(135deg, #014287, #1e5fc2)" }}
                            >
                                {isCreating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4" strokeWidth={2} />
                                        Crear Teacher
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors hover:brightness-95"
                                style={{ background: "var(--surface-alt)", color: "var(--text-primary)" }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* Modal: Confirmar Borrar Teacher                               */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {showDeleteModal && teacherToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div
                        className="modal-content rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        style={{
                            background: "var(--modal-bg)",
                            border: "1px solid var(--border-color)",
                            animation: "scaleIn .18s ease",
                        }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                            <Trash2 className="w-7 h-7 text-red-500" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-bold text-center mb-2" style={{ color: "var(--text-primary)" }}>¿Eliminar Maestro?</h3>
                        <p className="text-center text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                            Estás a punto de eliminar permanentemente a{" "}
                            <strong style={{ color: "var(--text-primary)" }}>{teacherToDelete.name}</strong>.
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors hover:brightness-95"
                                style={{ background: "var(--surface-alt)", color: "var(--text-primary)" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-lg shadow-red-500/20"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(.96) translateY(6px); }
                    to   { opacity: 1; transform: scale(1)   translateY(0); }
                }
            `}</style>
        </div>
    );
}
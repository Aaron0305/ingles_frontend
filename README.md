<p align="center">
  <img src="public/image/logo_mensaje.png" alt="What Time Is It? Idiomas" width="200" />
</p>

<h1 align="center">What Time Is It? — Sistema Administrativo Frontend</h1>

<p align="center">
  <strong>Plataforma integral de gestión académica y administrativa para la escuela de idiomas "What Time Is It?"</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.1-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io" alt="Socket.io" />
</p>

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Características Principales](#características-principales)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Arquitectura del Proyecto](#arquitectura-del-proyecto)
- [Estructura de Archivos](#estructura-de-archivos)
- [Módulos del Sistema](#módulos-del-sistema)
  - [Panel de Estudiantes](#1-panel-de-estudiantes)
  - [Panel de Pagos](#2-panel-de-pagos)
  - [Panel de Credenciales](#3-panel-de-credenciales)
  - [Panel de Reportes](#4-panel-de-reportes)
  - [Panel de Calendario](#5-panel-de-calendario)
  - [Gestión de Administradores](#6-gestión-de-administradores)
  - [Escaneo QR de Pagos](#7-escaneo-qr-de-pagos)
- [Sistema de Autenticación](#sistema-de-autenticación)
- [Comunicación en Tiempo Real](#comunicación-en-tiempo-real-websockets)
- [Sistema de Temas](#sistema-de-temas-clarooscuro)
- [API Client](#api-client)
- [Instalación y Configuración](#instalación-y-configuración)
- [Variables de Entorno](#variables-de-entorno)
- [Scripts Disponibles](#scripts-disponibles)
- [Despliegue](#despliegue)

---

## Descripción General

**What Time Is It?** es una aplicación web completa diseñada para administrar todos los aspectos operativos de una escuela de idiomas. El sistema permite gestionar estudiantes, controlar pagos con múltiples esquemas de cobro, generar credenciales digitales con código QR, visualizar reportes financieros con gráficas interactivas, y administrar un calendario académico con días festivos mexicanos.

La aplicación está diseñada con un enfoque **mobile-first** y cuenta con un sistema de temas automático (claro/oscuro) que se adapta a las preferencias del sistema operativo del usuario.

---

## Características Principales

| Característica | Descripción |
|---|---|
| **Gestión de Estudiantes** | CRUD completo: alta, edición, baja (con motivo), reactivación y seguimiento |
| **Control de Pagos** | Soporte para esquemas diario, semanal, quincenal y mensual (cada 28 días) |
| **Credenciales Digitales** | Tarjetas con QR únicas por alumno, descargables en PDF y compartibles por WhatsApp |
| **Reportes Financieros** | Gráficas de ingresos por día/mes, exportación a Excel, filtros por fecha |
| **Calendario Académico** | Visualización de días festivos mexicanos (oficiales + personalizados) |
| **Escaneo QR** | Landing pública para que alumnos soliciten pagos escaneando su QR |
| **Roles de Usuario** | Sistema con roles `admin` y `superadmin` con permisos diferenciados |
| **Tiempo Real** | Notificaciones push vía WebSockets (Socket.io) para solicitudes de pago |
| **Tema Automático** | Modo claro/oscuro con detección automática del sistema operativo |
| **Días Festivos** | Cálculo dinámico de feriados mexicanos (incluyendo Semana Santa con algoritmo de Computus) |

---

## Tecnologías Utilizadas

### Core
| Tecnología | Versión | Uso |
|---|---|---|
| [Next.js](https://nextjs.org/) | 16.1.1 | Framework React con App Router, SSR y rutas dinámicas |
| [React](https://react.dev/) | 19.2.3 | Biblioteca UI con hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`) |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Tipado estático en todo el proyecto |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Framework de utilidades CSS con PostCSS |

### Bibliotecas de Funcionalidad
| Biblioteca | Uso |
|---|---|
| [`socket.io-client`](https://socket.io/) | Comunicación bidireccional en tiempo real (WebSockets) |
| [`qrcode.react`](https://github.com/zpao/qrcode.react) | Generación de códigos QR en SVG para credenciales |
| [`html5-qrcode`](https://github.com/niconiahi/html5-qrcode) | Escaneo de códigos QR desde la cámara del dispositivo |
| [`recharts`](https://recharts.org/) | Gráficas de área interactivas para reportes financieros |
| [`jspdf`](https://github.com/parallax/jsPDF) | Generación de credenciales en formato PDF para descarga |
| [`html2canvas`](https://html2canvas.hertzen.com/) | Captura de componentes React como imagen para los PDFs |
| [`xlsx`](https://sheetjs.com/) | Exportación de reportes de pagos a archivos Excel (.xlsx) |
| [`lucide-react`](https://lucide.dev/) | Iconografía SVG moderna y consistente en toda la aplicación |
| [`clsx`](https://github.com/lukeed/clsx) / [`tailwind-merge`](https://github.com/dcastil/tailwind-merge) | Utilidades para composición condicional de clases CSS |

---

## Arquitectura del Proyecto

La aplicación utiliza la arquitectura **App Router** de Next.js 16 con la siguiente organización:

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Login   │    │  Admin   │    │ Pay/Scan │   │
│  │  Page    │───▶│Dashboard │    │  (QR)    │   │
│  └──────────┘    └────┬─────┘    └────┬─────┘   │
│                       │               │          │
│            ┌──────────┼───────┐       │          │
│            ▼          ▼       ▼       │          │
│       ┌─────────┐ ┌──────┐ ┌─────┐   │          │
│       │Students │ │Pagos │ │Cred.│   │          │
│       │ Panel   │ │Panel │ │Panel│   │          │
│       └─────────┘ └──────┘ └─────┘   │          │
│       ┌─────────┐ ┌──────┐ ┌─────┐   │          │
│       │Reportes │ │Calen.│ │Admin│   │          │
│       │ Panel   │ │Panel │ │Panel│   │          │
│       └─────────┘ └──────┘ └─────┘   │          │
│                       │               │          │
│                       ▼               ▼          │
│              ┌──────────────────┐                │
│              │   lib/api.ts     │                │
│              │  (API Client)    │                │
│              └────────┬─────────┘                │
│                       │                          │
│              ┌────────┴─────────┐                │
│              │  Socket.io       │                │
│              │  (Tiempo Real)   │                │
│              └──────────────────┘                │
└───────────────────────┬─────────────────────────┘
                        │ HTTP / WebSocket
                        ▽
               ┌──────────────────┐
               │    BACKEND       │
               │   (Next.js API   │
               │   + Socket.io)   │
               └──────────────────┘
```

---

## Estructura de Archivos

```
client/
├── app/                          # App Router de Next.js
│   ├── layout.tsx                # Layout raíz (HTML, meta tags, detección de tema)
│   ├── page.tsx                  # Página raíz (redirige a /login)
│   ├── globals.css               # Estilos globales, variables CSS y sistema de temas
│   ├── favicon.ico               # Ícono de la aplicación
│   │
│   ├── login/                    # Página de inicio de sesión
│   │   └── page.tsx              # Formulario de login con animaciones y temas
│   │
│   ├── admin/                    # Dashboard principal (página protegida)
│   │   └── page.tsx              # Orquestador principal: tabs, modales, estadísticas
│   │
│   ├── dashboard/                # Componentes modulares del dashboard
│   │   ├── page.tsx              # Redirección automática a /admin
│   │   ├── students-panel.tsx    # Gestión completa de estudiantes (1,032 líneas)
│   │   ├── payments.tsx          # Sistema de pagos con esquemas flexibles (2,245 líneas)
│   │   ├── credentials-panel.tsx # Panel de credenciales con tarjetas flip (629 líneas)
│   │   ├── credential.tsx        # Modal de credencial individual con QR (462 líneas)
│   │   ├── reports-panel.tsx     # Reportes financieros con gráficas (574 líneas)
│   │   └── calendar.tsx          # Calendario académico con festivos (825 líneas)
│   │
│   └── pay/                      # Módulo público de escaneo QR
│       └── scan/
│           ├── page.tsx          # Landing de escaneo (cámara QR + búsqueda manual)
│           └── [studentId]/
│               └── page.tsx      # Página de solicitud de pago por estudiante
│
├── components/                   # Componentes reutilizables de UI
│   └── ui/
│       ├── card.tsx              # Componente Card (Header, Content, Footer, Title)
│       └── chart.tsx             # Wrapper de Recharts (ChartContainer, Tooltip)
│
├── lib/                          # Utilidades y servicios compartidos
│   ├── api.ts                    # Cliente API centralizado (auth, students, payments, admins, holidays)
│   └── utils.ts                  # Utilidad cn() para merge de clases CSS
│
├── public/                       # Archivos estáticos
│   └── image/
│       ├── logo.png              # Logo principal de la institución
│       ├── logo_mensaje.png      # Logo con texto "What Time Is It?"
│       ├── mascota.png           # Mascota institucional
│       └── mascota_hde.png       # Mascota versión horizontal
│
├── .env                          # Variables de entorno (API URL)
├── package.json                  # Dependencias y scripts
├── tsconfig.json                 # Configuración de TypeScript
├── next.config.ts                # Configuración de Next.js
├── postcss.config.mjs            # Configuración de PostCSS + Tailwind
└── eslint.config.mjs             # Configuración de ESLint
```

---

## Módulos del Sistema

### 1. Panel de Estudiantes
> **Archivo:** `app/dashboard/students-panel.tsx` (1,032 líneas)

Módulo central para la administración completa de estudiantes.

**Funcionalidades:**

- **Tabla de seguimiento** con columnas: No., nombre, nivel, teléfono del alumno, teléfono de emergencia, fecha de inicio, días de clase y acciones
- **Búsqueda en tiempo real** por nombre o número de estudiante
- **Filtro por nivel** (Todos, Beginner 1-2, Intermediate 1-2, Advanced 1-2)
- **Paginación numerada** con controles previo/siguiente y conteo de resultados
- **Creación de estudiantes** con formulario completo:
  - Nombre completo (formato automático: primera letra mayúscula)
  - Email con selector de dominio (`@gmail.com`, `@hotmail.com`, `@outlook.com`, `@yahoo.com`)
  - Teléfonos (alumno y emergencia) con validación de 10 dígitos
  - Nivel de inglés (6 niveles disponibles)
  - Esquema de pago (diario, semanal, quincenal, mensual cada 28 días)
  - Mensualidad con precios preconfigurados ($760, $750, $790, $650, $149.50) o personalizado
  - Días de clase (Lunes a Sábado, selección múltiple)
  - Fecha de inscripción
  - Pago de inscripción con método (efectivo/transferencia)
- **Edición de estudiantes** con modal de actualización
- **Dar de baja** con registro del motivo de baja y fecha
- **Reactivación** de estudiantes dados de baja (incrementa versión de inscripción)
- **Visualización del motivo de baja** para alumnos inactivos
- **Eliminación permanente** con confirmación
- **Generación automática de credencial QR** al crear un estudiante

**Niveles disponibles con badges de color:**

| Nivel | Color |
|---|---|
| Beginner 1 / Beginner 2 | Azul |
| Intermediate 1 / Intermediate 2 | Ámbar |
| Advanced 1 / Advanced 2 | Verde |

---

### 2. Panel de Pagos
> **Archivo:** `app/dashboard/payments.tsx` (2,245 líneas)

El módulo más complejo del sistema. Gestiona todos los pagos con lógica avanzada de esquemas y días festivos.

**Funcionalidades:**

- **Vista por estudiante** con tabla de períodos de pago
- **Búsqueda rápida** de estudiantes por nombre o número
- **4 esquemas de pago soportados:**

  | Esquema | Períodos/año | Descripción |
  |---|---|---|
  | Mensual (cada 28 días) | 12 | Ciclos de 28 días naturales |
  | Quincenal | 24 | Ciclos de 14 días |
  | Semanal | 48 | Ciclos de 7 días |
  | Diario | 288 | Pago por cada día de clase |

- **Cálculo inteligente de fechas de pago:**
  - Compensación automática de días festivos (si un pago cae en día festivo, se recorre al siguiente día hábil de clase del alumno)
  - Algoritmo de Computus para calcular Semana Santa dinámicamente
  - Soporte para días festivos oficiales mexicanos calculados por año
  - Cache de días festivos para eficiencia
  - Soporte para festivos personalizados (creados por el admin)
- **Confirmación de pagos** con modal que permite:
  - Registrar pago completo o parcial (ingresando monto)
  - Seleccionar método de pago (Efectivo / Transferencia)
  - Ver el monto restante si es pago parcial
  - Registrar pagos múltiples (abonos) para completar un período
- **Revocación de pagos** (solo para superadmins)
- **Estados de pago con indicadores visuales:**
  - **Pagado** (verde) — Pago completado al 100%
  - **Pendiente** (amarillo) — Dentro del período actual sin pagar
  - **Atrasado** (rojo) — Pasó la fecha límite sin pago
  - **Parcial** (azul) — Se registró un abono pero falta completar
- **Escáner QR integrado** para recibir solicitudes de pago desde dispositivos móviles
- **Registro de código manual** para pagos rápidos
- **Código QR por estudiante** visitable desde `/pay/scan/[studentId]`

---

### 3. Panel de Credenciales
> **Archivos:** `app/dashboard/credentials-panel.tsx` (629 líneas) + `app/dashboard/credential.tsx` (462 líneas)

Módulo de credenciales digitales de los estudiantes con diseño visual premium.

**Funcionalidades del Panel:**

- **Tarjetas flip 3D** (frente/reverso) para cada estudiante con animación al hacer hover
- **Frente de la tarjeta:** Nombre, nivel (con badge de color), número de estudiante, efecto túnel/ripple animado con color según nivel
- **Reverso de la tarjeta:** Mini código QR, email, teléfono, estado del estudiante
- **Búsqueda y filtrado** por nombre o número de estudiante
- **Filtro por nivel** (Beginner, Intermediate, Advanced)
- **Paginación** con 10 tarjetas por página

**Funcionalidades del Modal de Credencial:**

- **Credencial premium** con diseño institucional:
  - Header con gradiente de colores de marca
  - Código QR grande generado con datos del estudiante (URL `pay/scan/{id}`)
  - Información completa: nombre, No. estudiante, nivel, cuota mensual, fecha de inscripción
  - Footer con ID único
- **Descargar como PDF** usando `html2canvas` + `jspdf`
- **Compartir por WhatsApp** con enlace directo de pago
- **Enviar por WhatsApp** al número del estudiante (abre chat directamente)
- **Compatibilidad con impresión** (estilos optimizados para print)

---

### 4. Panel de Reportes
> **Archivo:** `app/dashboard/reports-panel.tsx` (574 líneas)

Panel de reportes financieros con visualización de datos y exportación.

**Funcionalidades:**

- **Resumen del día seleccionado:**
  - Total recaudado en el día
  - Cantidad de pagos registrados
  - Promedio por pago
  - Desglose por método (efectivo vs. transferencia)
- **Tabla de pagos del día** con columnas:
  - Estudiante, No., nivel, monto pagado, método de pago
  - Click en el badge del método para cambiarlo directamente (efectivo ↔ transferencia)
- **Navegación por fecha** con controles previo/siguiente y selector de fecha
- **Gráfica de área** (Recharts) mostrando ingresos diarios del mes seleccionado:
  - Eje X: días del mes
  - Eje Y: monto recaudado
  - Tooltip interactivo con detalle del día
  - Navegación por mes con controles previo/siguiente
- **Exportación a Excel** del reporte diario:
  - Genera archivo `.xlsx` con datos formateados
  - Incluye: estudiante, número, nivel, monto, método de pago, fecha/hora

---

### 5. Panel de Calendario
> **Archivo:** `app/dashboard/calendar.tsx` (825 líneas)

Calendario visual que muestra los días festivos oficiales de México y los días no laborables de la escuela.

**Funcionalidades:**

- **Vista mensual** con navegación mes anterior/siguiente y botón "Hoy"
- **Días festivos oficiales mexicanos** calculados dinámicamente por año:
  - 1 de enero — Año Nuevo
  - Primer lunes de febrero — Día de la Constitución
  - Tercer lunes de marzo — Natalicio de Benito Juárez
  - Jueves, Viernes y Sábado Santo — Calculados con algoritmo de Computus (Pascua)
  - 1 de mayo — Día del Trabajo
  - 16 de septiembre — Día de la Independencia
  - Tercer lunes de noviembre — Revolución Mexicana
  - 25 de diciembre — Navidad
- **Vacaciones oficiales SEP** señaladas visualmente
- **Toggle de festivos:** Click para activar o desactivar un día festivo (habilitar como día laborable)
- **Festivos personalizados:** Posibilidad de crear días festivos extra no oficiales
- **Indicadores visuales:**
  - Días festivos oficiales (rojo)
  - Períodos de vacaciones
  - Festivos personalizados
  - Día actual (azul)
- **Sincronización con API** para guardar festivos personalizados en base de datos

---

### 6. Gestión de Administradores
> **Dentro de:** `app/admin/page.tsx` (solo visible para rol `superadmin`)

**Funcionalidades:**

- **Listado de administradores** con nombre, email, rol y estado
- **Crear nuevos administradores** con formulario (nombre, email, contraseña con confirmación)
- **Activar/Desactivar** administradores (toggle de estado)
- **Eliminar** administradores con confirmación
- **Roles diferenciados:**
  - `admin`: Acceso a estudiantes, pagos, credenciales, reportes y calendario
  - `superadmin`: Todo lo anterior + gestión de administradores y permisos avanzados (como revocar pagos)

---

### 7. Escaneo QR de Pagos
> **Archivos:** `app/pay/scan/page.tsx` + `app/pay/scan/[studentId]/page.tsx`

Módulo público (sin autenticación requerida) diseñado para uso desde dispositivos móviles.

**Landing de escaneo** (`/pay/scan`):
- **Modo manual:** Ingreso del número de estudiante o UUID
- **Modo QR:** Escaneo de código QR con la cámara del dispositivo usando `html5-qrcode`
- **Diseño institucional** con colores rojo/azul de la marca y diagonales decorativas
- **Responsive** optimizado para teléfonos móviles

**Página del estudiante** (`/pay/scan/[studentId]`):
- Muestra información del estudiante (nombre, número, nivel, cuota)
- **Solicita el pago** al administrador vía WebSocket en tiempo real
- El administrador recibe una notificación push con sonido en el dashboard
- **Requiere autenticación** para confirmar: login integrado en la misma página
- Indicadores de estado: buscando, conectado, esperando confirmación, aprobado, rechazado

---

## Sistema de Autenticación

La autenticación se maneja a través de JWT (JSON Web Tokens):

1. **Login** (`/login`): Formulario con email y contraseña
2. El backend valida credenciales y retorna un token JWT (expira en 24h)
3. El token se almacena en `localStorage` junto con datos del usuario (`userType`, `userName`)
4. Todas las peticiones API incluyen el token en el header `Authorization: Bearer {token}`
5. El componente `/admin` verifica el rol del usuario al montar
6. **Logout**: Limpia `localStorage` y redirige a `/login`

**Página de login con:**
- Detección automática de tema (claro/oscuro)
- Animaciones de shimmer, pulse-glow y float
- Transiciones suaves entre estados
- Validación de formulario en tiempo real
- Logo institucional y features destacadas

---

## Comunicación en Tiempo Real (WebSockets)

El sistema utiliza **Socket.io** para comunicación bidireccional:

```
 Alumno (Movil)                  Admin (Dashboard)
 ──────────────────              ───────────────────
 1. Escanea QR ──────┐
 2. Solicita pago     │     ┌── 3. Recibe notificación
                      ├────▶│   (con sonido)
                      │     │── 4. Confirma/Rechaza pago
 5. Recibe resultado◀─┘     │
```

**Eventos del socket:**
| Evento | Dirección | Descripción |
|---|---|---|
| `authenticate` | Cliente → Servidor | Envía token JWT para autenticación |
| `auth-success` | Servidor → Cliente | Confirma autenticación exitosa |
| `register-admin` | Cliente → Servidor | Registra al admin para recibir notificaciones |
| `payment-request` | Servidor → Admin | Solicitud de pago desde escaneo QR |
| `payment-result` | Servidor → Alumno | Resultado de la solicitud (aprobado/rechazado) |

---

## Sistema de Temas (Claro/Oscuro)

El sistema de temas se implementa mediante **CSS Custom Properties** (variables CSS) definidas en `globals.css`.

**Detección automática:**
- Script inyectado en `<head>` antes del renderizado (evita flash de tema incorrecto)
- Usa `prefers-color-scheme: dark` para detectar preferencia del SO
- Establece el atributo `data-theme` en el `<html>`

**Variables CSS organizadas por categoría:**
- **Fondos:** `--background`, `--surface`, `--surface-alt`, `--surface-elevated`
- **Textos:** `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`
- **Bordes:** `--border`, `--border-color`, `--border-light`
- **Acentos:** `--accent-primary`, `--accent-secondary`, `--accent-tertiary`
- **Componentes:** `--header-bg`, `--card-bg`, `--modal-bg`, `--input-bg`
- **Marca:** `--brand-blue-dark`, `--brand-red`, `--brand-green`

**Colores de marca:**
| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `--brand-blue-dark` | `#1a3a6e` | `#1a3a6e` | Color principal del logo |
| `--brand-red` | `#e63946` | `#ef5350` | Rojo institucional |
| `--brand-green` | `#22c55e` | `#4ade80` | Indicadores positivos |

---

## API Client

> **Archivo:** `lib/api.ts` (391 líneas)

Cliente HTTP centralizado que abstrae toda la comunicación con el backend.

**Módulos disponibles:**

```typescript
// Autenticación
authApi.login(email, password)     // Iniciar sesión
authApi.logout()                   // Cerrar sesión
authApi.isAuthenticated()          // Verificar si hay token activo
authApi.getUserType()              // Obtener rol del usuario
authApi.getUserName()              // Obtener nombre del usuario

// Estudiantes
studentsApi.getAll()               // Obtener todos los estudiantes
studentsApi.getById(id)            // Obtener estudiante por ID
studentsApi.create(data)           // Crear nuevo estudiante
studentsApi.update(id, data)       // Actualizar estudiante
studentsApi.delete(id)             // Eliminar estudiante
studentsApi.toggleStatus(id, ...)  // Cambiar estado activo/inactivo

// Pagos
paymentsApi.getAll()               // Pagos consolidados por período
paymentsApi.getAllRaw()            // Pagos individuales (para reportes)
paymentsApi.getByStudent(id)       // Pagos de un estudiante
paymentsApi.create(data)           // Registrar pago
paymentsApi.createEnrollment(data) // Registrar pago de inscripción
paymentsApi.revoke(...)            // Revocar/eliminar pago
paymentsApi.updatePaymentMethod()  // Cambiar método (efectivo/transferencia)

// Administradores
adminsApi.getAll()                 // Listar administradores
adminsApi.create(data)             // Crear administrador
adminsApi.update(id, data)         // Actualizar administrador
adminsApi.delete(id)               // Eliminar administrador

// Días Festivos Personalizados
holidaysApi.getAll()               // Obtener festivos personalizados
holidaysApi.create(date, name)     // Crear festivo
holidaysApi.remove(date)           // Eliminar festivo
```

**Detección automática de entorno:**
- Si el hostname es `localhost` o `127.0.0.1` → usa `http://127.0.0.1:3001`
- Si está en producción → usa `https://ingles-backend-bk4n.onrender.com`

---

## Instalación y Configuración

### Requisitos Previos

- **Node.js** >= 18.x
- **pnpm** (gestor de paquetes recomendado)
- **Backend** corriendo en el puerto 3001 (ver repositorio del backend)

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd client

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
# Crear archivo .env en la raíz del directorio client
cp .env.example .env
# Editar .env con la URL de tu backend

# 4. Iniciar el servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## Variables de Entorno

Crear un archivo `.env` en la raíz del directorio `client/`:

```env
# URL del backend API
# Para desarrollo local:
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001

# Para producción (Render):
# NEXT_PUBLIC_API_URL=https://ingles-backend-bk4n.onrender.com
```

---

## Scripts Disponibles

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `pnpm dev` | Inicia el servidor de desarrollo en `localhost:3000` |
| `build` | `pnpm build` | Genera el bundle de producción optimizado |
| `start` | `pnpm start` | Inicia el servidor en modo producción |
| `lint` | `pnpm lint` | Ejecuta ESLint para verificar calidad del código |

---

## Despliegue

### Producción recomendada

La aplicación está configurada para desplegarse en:

- **Frontend:** [Vercel](https://vercel.com/) (integración nativa con Next.js) o DigitalOcean Droplet con [Dokploy](https://dokploy.com/)
- **Backend:** [Render](https://render.com/) para soporte de WebSockets persistentes

> Nota importante: Vercel **no soporta WebSockets persistentes**. El backend debe desplegarse en un servicio que los soporte

### Build de producción

```bash
pnpm build
pnpm start
```

---

<p align="center">
  <strong>What Time Is It? Idiomas</strong> © 2026 — Sistema Administrativo
  <br />
  <sub>Desarrollado con para la gestión eficiente de escuelas de idiomas</sub>
</p>

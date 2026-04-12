# ⚙️ GlamStock · repo-api-service

> **API REST Backend** — Servicio de lógica de negocio, autenticación y acceso a datos para el ecosistema GlamStock.

---

## Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Arquitectura Interna](#arquitectura-interna)
3. [Requisitos Previos](#requisitos-previos)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
6. [Instalación y Arranque](#instalación-y-arranque)
7. [Referencia de la API](#referencia-de-la-api)
   - [Autenticación (`/auth`)](#autenticación-apiv1auth)
   - [Productos (`/productos`)](#productos-apiv1productos)
   - [Variantes (`/variantes`)](#variantes-apiv1variantes)
   - [Sucursales (`/sucursales`)](#sucursales-apiv1sucursales)
   - [Inventario (`/inventario`)](#inventario-apiv1inventario)
   - [Ventas (`/ventas`)](#ventas-apiv1ventas)
   - [Dashboard (`/dashboard`)](#dashboard-apiv1dashboard)
   - [Motivos (`/motivos`)](#motivos-apiv1motivos)
8. [Sistema de Autenticación](#sistema-de-autenticación)
9. [Sistema de Roles y Permisos](#sistema-de-roles-y-permisos)
10. [Manejo de Errores](#manejo-de-errores)
11. [Seguridad](#seguridad)
12. [Scripts Disponibles](#scripts-disponibles)
13. [Relación con otros Repositorios](#relación-con-otros-repositorios)

---

## Descripción General

`repo-api-service` es el backend central de **GlamStock**. Expone una API REST versionada (`/api/v1`) construida con **Express.js** y **TypeScript**, organizada en módulos de dominio. Sus responsabilidades incluyen:

- **Autenticación y autorización** mediante JWT httpOnly cookies con soporte de autenticación de dos factores (TOTP/Google Authenticator).
- **Gestión de productos** en un catálogo maestro con variantes por color y modelo.
- **Control de inventario** multi-sucursal con validaciones de stock transaccionales.
- **Registro de ventas** con rollback atómico a través de stored procedures PostgreSQL.
- **Dashboard analítico** con KPIs de ventas, rankings de productos y métricas de rotación de inventario.
- **Recuperación de contraseña** vía email usando Resend.

---

## Arquitectura Interna

El proyecto sigue una arquitectura en capas dentro de cada módulo de dominio:

```
src/
├── server.ts               # Entry point — configura Express, middleware global y monta routers
├── middleware/
│   └── auth.middleware.ts  # requireAuth (JWT) + requireRole (RBAC)
├── lib/
│   ├── errors/             # Clases de error tipadas (AppError, NotFoundError, etc.)
│   ├── db/                 # Pool de conexiones PostgreSQL (pg)
│   └── validations/        # Esquemas comunes de Zod (idSchema, paginationSchema)
└── modules/
    ├── auth/               # Login, MFA, registro, recuperación de contraseña
    ├── productos/          # CRUD de productos maestros
    ├── variantes/          # CRUD de variantes con gestión de precios
    ├── sucursales/         # CRUD de sucursales + toggle activo/inactivo
    ├── inventario/         # Stock por sucursal, ajustes, bajas
    ├── ventas/             # Registro y reversión de ventas (transaccional)
    ├── dashboard/          # Estadísticas y KPIs del negocio
    └── motivos/            # Catálogo de motivos de transacción

Cada módulo contiene:
    ├── services/           # Lógica de negocio
    ├── repositories/       # Acceso a datos (queries SQL directas)
    └── schemas/            # Validación de entrada con Zod
```

### Stack Tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| Node.js | ≥ 20 | Runtime |
| TypeScript | ^5 | Lenguaje |
| Express.js | ^4.21 | Framework HTTP |
| `pg` (node-postgres) | ^8.18 | Driver PostgreSQL |
| Zod | ^4 | Validación de esquemas |
| `jsonwebtoken` | ^9 | Generación y verificación de JWT |
| `bcryptjs` | ^3 | Hash de contraseñas |
| `speakeasy` | ^2 | Generación/verificación de TOTP (2FA) |
| `qrcode` | ^1.5 | Generación de QR para configuración 2FA |
| Helmet | ^8 | Headers HTTP de seguridad |
| `express-rate-limit` | ^8 | Rate limiting en endpoints de auth |
| Resend | ^6 | Envío de emails transaccionales |
| `tsx` | ^4 | Ejecución TypeScript en desarrollo |

---

## Requisitos Previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 20.x LTS |
| npm | 10.x |
| PostgreSQL | 16 (o vía Docker — ver `repo-infra-db`) |

> ⚠️ La base de datos debe estar corriendo **antes** de iniciar el API. Ver [`repo-infra-db`](../repo-infra-db/) para el setup de Docker.

---

## Estructura del Proyecto

```
repo-api-service/
├── .env                    # Variables de entorno locales (NO commitear)
├── .env.example            # Plantilla de variables de entorno
├── .gitignore
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts
    ├── middleware/
    │   └── auth.middleware.ts
    ├── lib/
    │   ├── db/
    │   │   └── pool.ts
    │   ├── errors/
    │   │   └── app-error.ts
    │   └── validations/
    │       └── common.schemas.ts
    └── modules/
        ├── auth/
        │   ├── repositories/usuarios.repository.ts
        │   ├── schemas/auth.schema.ts
        │   ├── services/
        │   │   ├── auth.service.ts
        │   │   └── password-reset.service.ts
        │   └── types/auth.types.ts
        ├── productos/
        │   ├── repositories/productos.repository.ts
        │   ├── schemas/producto.schema.ts
        │   └── services/productos.service.ts
        ├── variantes/
        ├── sucursales/
        ├── inventario/
        ├── ventas/
        ├── dashboard/
        └── motivos/
```

---

## Configuración de Variables de Entorno

Copia `.env.example` a `.env` y completa los valores:

```env
# Base de datos — apunta siempre al puerto 5433 (puerto expuesto por Docker en repo-infra-db)
DATABASE_URL=postgresql://glamstock_user:TU_PASSWORD@localhost:5433/glamstock_db

# JWT — usar un string largo y aleatorio en producción (mínimo 32 caracteres)
JWT_SECRET=cambia_esto_por_un_string_largo_y_aleatorio

# Servidor
PORT=4000
NODE_ENV=development

# CORS — URL del frontend
FRONTEND_URL=http://localhost:3000

# Email transaccional (Resend — https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Obtener una API Key de Resend

1. Registrarse en [resend.com](https://resend.com).
2. Crear un API Key desde el dashboard.
3. Pegar en `RESEND_API_KEY`.

> Para desarrollo local sin emails reales, puedes dejar `RESEND_API_KEY` vacío; los endpoints de reset de contraseña responderán con error pero el resto del sistema funcionará.

---

## Instalación y Arranque

```bash
# 1. Asegurarse de que la base de datos está corriendo
#    (desde repo-infra-db)
#    docker compose up -d

# 2. Clonar e instalar dependencias
git clone <URL_DEL_REPOSITORIO> repo-api-service
cd repo-api-service
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correctos

# 4. Iniciar en modo desarrollo (hot reload)
npm run dev
```

El servidor estará disponible en `http://localhost:4000`.

### Verificar que el servidor está activo

```bash
curl http://localhost:4000/api/v1/auth/me
# Respuesta esperada: 401 { "error": "No autorizado. Token no encontrado." }
```

### Modo producción

```bash
npm run build   # Compila TypeScript a dist/
npm start       # Ejecuta dist/server.js con Node.js
```

---

## Referencia de la API

**Base URL:** `http://localhost:4000/api/v1`

**Autenticación:** Todas las rutas (excepto `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`) requieren la cookie `auth_token` establecida por el login.

---

### Autenticación `/api/v1/auth`

> ⚡ Rate limit: 20 peticiones cada 15 minutos por IP.

#### `POST /auth/login`
Inicia el flujo de autenticación. Si el usuario tiene 2FA activo, devuelve un `pre_auth_token` en cookie y la respuesta indica que se requiere TOTP.

**Body:**
```json
{
  "email": "tu_email_admin@ejemplo.com",
  "password": "tu_password_admin"
}
```

**Respuesta exitosa (sin 2FA):** `200 OK`
```json
{
  "message": "Login exitoso",
  "user": { "id": 1, "nombre": "Admin", "email": "...", "rol": "ADMIN" }
}
```

**Respuesta con 2FA activo:** `200 OK` + cookie `pre_auth_token`
```json
{
  "requiresMfa": true,
  "message": "Código TOTP requerido"
}
```

---

#### `POST /auth/verify-totp`
Segunda etapa del login cuando 2FA está activo. Lee el `pre_auth_token` de la cookie.

**Body:**
```json
{ "code": "123456" }
```

**Respuesta:** `200 OK` — establece cookie `auth_token` (httpOnly, 24h).

---

#### `POST /auth/logout`
Invalida las cookies de sesión del cliente.

**Respuesta:** `200 OK`
```json
{ "message": "Sesión cerrada" }
```

---

#### `GET /auth/me`
Devuelve el perfil del usuario actualmente autenticado.

**Headers:** Requiere cookie `auth_token`.

**Respuesta:** `200 OK`
```json
{
  "usuario": {
    "id_usuario": 1,
    "nombre": "Nombre del usuario",
    "email": "usuario@ejemplo.com",
    "rol": "ADMIN",
    "activo": true
  }
}
```

---

#### `POST /auth/register`
Crea un nuevo usuario. Solo disponible para flujos de administrador.

**Body:**
```json
{
  "nombre": "Juan López",
  "email": "juan@tienda.com",
  "password": "SecurePass123!"
}
```

**Respuesta:** `201 Created`

---

#### `POST /auth/forgot-password`
Envía email con enlace de recuperación.

**Body:** `{ "email": "usuario@ejemplo.com" }`

**Respuesta:** `200 OK` (siempre, para no revelar si el email existe).

---

#### `POST /auth/reset-password`
Restablece la contraseña usando el token del email.

**Body:**
```json
{
  "token": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "password": "NuevaContraseña123!"
}
```

**Respuesta:** `200 OK`

---

### Productos `/api/v1/productos`

> 🔒 Requiere `auth_token`. Operaciones de escritura requieren rol `ADMIN`.

| Método | Endpoint | Rol requerido | Descripción |
|---|---|---|---|
| `GET` | `/productos` | Cualquiera | Lista todos los productos (paginado). Query: `?page=1&limit=20` |
| `POST` | `/productos` | ADMIN | Crea un producto maestro |
| `GET` | `/productos/:id` | Cualquiera | Obtiene un producto por ID (con sus variantes) |
| `PUT` | `/productos/:id` | ADMIN | Actualiza datos del producto |
| `DELETE` | `/productos/:id` | ADMIN | Elimina un producto (solo si no tiene transacciones asociadas) |

**Ejemplo POST `/productos`:**
```json
{
  "sku": "BOLSA-CUERO-001",
  "nombre": "Bolsa de Cuero Premium",
  "proveedor": "Cueros del Norte SA",
  "variantes": [
    {
      "sku_variante": "BOLSA-CUERO-001-NEG-M",
      "codigo_barras": "7501234567890",
      "modelo": "Classic",
      "color": "Negro",
      "precio_adquisicion": 450.00,
      "precio_venta_etiqueta": 899.00
    }
  ]
}
```

---

### Variantes `/api/v1/variantes`

> 🔒 Requiere `auth_token`. Escritura requiere `ADMIN`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/variantes/:id` | Obtiene una variante por ID |
| `POST` | `/variantes` | Crea una nueva variante para un producto existente |
| `PUT` | `/variantes/:id` | Actualiza datos de la variante (precios, modelo, color) |
| `DELETE` | `/variantes/:id` | Elimina la variante |

---

### Sucursales `/api/v1/sucursales`

> 🔒 Requiere `auth_token`. Escritura requiere `ADMIN`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/sucursales?activas=true` | Lista sucursales. Filtrar solo activas con `?activas=true` |
| `POST` | `/sucursales` | Crea una nueva sucursal |
| `GET` | `/sucursales/:id` | Obtiene una sucursal por ID |
| `PUT` | `/sucursales/:id` | Actualiza datos de la sucursal |
| `DELETE` | `/sucursales/:id` | Elimina una sucursal |
| `PATCH` | `/sucursales/:id/toggle` | Activa o desactiva una sucursal |
| `GET` | `/sucursales/:id/inventario` | Inventario de la sucursal con filtros opcionales |

**Filtros para `/sucursales/:id/inventario`:**
```
?sku=BOLSA&nombre=cuero&min_stock=5&max_stock=100
```

---

### Inventario `/api/v1/inventario`

> 🔒 Requiere `auth_token`.

| Método | Endpoint | Rol | Descripción |
|---|---|---|---|
| `GET` | `/inventario?sucursal_id=1` | Cualquiera | Inventario de una sucursal específica |
| `GET` | `/inventario/sucursales` | Cualquiera | Lista todas las sucursales activas |
| `GET` | `/inventario/variante/:id` | Cualquiera | Stock de una variante en todas las sucursales |
| `GET` | `/inventario/:id` | Cualquiera | Registro de inventario por ID |
| `PUT` | `/inventario/:id` | ADMIN | Actualización directa del stock |
| `POST` | `/inventario/ajuste` | ADMIN | Ajuste de stock con razón y registro en transacciones |
| `POST` | `/inventario/baja` | ADMIN | Registra baja de inventario (pérdida, merma, etc.) |

**Ejemplo POST `/inventario/ajuste`:**
```json
{
  "id_variante": 3,
  "id_sucursal": 1,
  "cantidad": 10,
  "id_motivo": 2
}
```

---

### Ventas `/api/v1/ventas`

> 🔒 Requiere `auth_token` y rol `ADMIN` o `VENDEDOR`.

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/ventas` | Registra una nueva venta (atómica via stored procedure) |
| `GET` | `/ventas/historial` | Historial de ventas con filtros opcionales |
| `DELETE` | `/ventas/:id` | Revierte una venta y restaura el stock |

**Ejemplo POST `/ventas`:**
```json
{
  "id_variante": 5,
  "id_sucursal": 1,
  "id_motivo": 1,
  "cantidad": 2,
  "precio_venta_final": 850.00
}
```

**Respuestas de error del endpoint `POST /ventas`:**

| Código | Mensaje de error | Causa |
|---|---|---|
| `400` | `Stock insuficiente` | La `cantidad` solicitada supera el stock disponible en la sucursal |
| `400` | `El precio de venta no puede ser menor al precio de adquisición` | `precio_venta_final` < `precio_adquisicion` de la variante |
| `404` | `Variante no encontrada` | El `id_variante` no existe en la base de datos |
| `404` | `Sucursal no encontrada o inactiva` | El `id_sucursal` no existe o está desactivada |
| `403` | `No autorizado` | El usuario no tiene rol `ADMIN` o `VENDEDOR` |

**Filtros para `/ventas/historial`:**
```
?sucursal_id=1&fecha_inicio=2026-01-01&fecha_fin=2026-12-31
```

---

### Dashboard `/api/v1/dashboard`

> 🔒 Requiere `auth_token`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/dashboard/stats` | KPIs completos: ventas totales, productos más/menos vendidos, utilidad, inventario crítico |

**Parámetros opcionales:**
```
?fecha_inicio=2026-01-01&fecha_fin=2026-12-31&top_limit=10
```

**Respuesta incluye:**
- Total de ventas y transacciones en el período
- Top N productos más vendidos (global y por sucursal)
- Top N productos menos vendidos (riesgo de stock dormido)
- Resumen de ingresos y utilidad por sucursal
- Alertas de stock crítico (stock bajo umbral)

---

### Motivos `/api/v1/motivos`

> 🔒 Requiere `auth_token`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/motivos` | Lista todos los motivos de transacción disponibles |

**Respuesta:**
```json
{
  "data": [
    { "id_motivo": 1, "descripcion": "Venta" },
    { "id_motivo": 2, "descripcion": "Ajuste Manual" },
    { "id_motivo": 3, "descripcion": "Devolución" }
  ]
}
```

---

## Sistema de Autenticación

GlamStock implementa un flujo de autenticación de **dos etapas** cuando el 2FA está activado:

```
ETAPA 1: Credenciales
  POST /auth/login  ──► Valida email + password
                        Si 2FA activo: emite cookie pre_auth_token (5 min)
                        Si 2FA inactivo: emite cookie auth_token (24h)

ETAPA 2: TOTP (solo si 2FA activo)
  POST /auth/verify-totp ──► Lee pre_auth_token + código TOTP
                              Limpia pre_auth_token
                              Emite cookie auth_token (24h)

SESIÓN ACTIVA:
  Todas las rutas protegidas leen auth_token de la cookie httpOnly.
  requireAuth valida JWT + verifica que el usuario esté activo en DB.
```

### Cookies de Sesión

| Cookie | Duración | Descripción |
|---|---|---|
| `auth_token` | 24 horas | Token JWT de sesión principal |
| `pre_auth_token` | 5 minutos | Token temporal del paso 1 del flujo MFA |

Ambas cookies son `httpOnly`, `SameSite=strict` y `Secure` en producción.

---

## Sistema de Roles y Permisos

| Rol | Acceso |
|---|---|
| `ADMIN` | Acceso total. CRUD en productos, variantes, sucursales, inventario. Gestión de usuarios. |
| `GERENTE` | Lectura de inventario y reportes. Sin acceso a escritura. |
| `VENDEDOR` | Solo registro de ventas e historial. |

El middleware `requireRole('ADMIN', 'VENDEDOR')` valida el rol desde el payload del JWT. Este campo también se persiste en la base de datos, por lo que un cambio de rol requiere que el usuario cierre sesión y vuelva a iniciarla.

---

## Manejo de Errores

Todas las respuestas de error siguen la misma estructura:

```json
{
  "error": "Descripción del error",
  "detalles": [
    { "campo": "email", "mensaje": "El email no tiene un formato válido" }
  ]
}
```

| Código HTTP | Significado |
|---|---|
| `400` | Datos de entrada inválidos (falla de validación Zod) |
| `401` | No autenticado — token faltante o inválido |
| `403` | No autorizado — rol insuficiente |
| `404` | Recurso no encontrado |
| `409` | Conflicto — SKU duplicado, email ya registrado, etc. |
| `500` | Error interno del servidor |

---

## Seguridad

El API implementa las siguientes medidas de seguridad:

- **Helmet.js** — Establece headers HTTP de seguridad (CSP, HSTS, XSS Protection, etc.)
- **Rate Limiting** — Endpoint de autenticación limitado a 20 requests/15min por IP
- **HttpOnly Cookies** — Los tokens JWT nunca son accesibles desde JavaScript del cliente
- **CORS estricto** — Solo acepta peticiones desde `FRONTEND_URL`
- **Bcrypt** — Contraseñas hasheadas con `bcryptjs` (factor de trabajo configurable)
- **Zod** — Toda entrada es validada y sanitizada antes de llegar a la base de datos
- **Parámetros preparados** — Todas las queries usan `$1, $2...` para prevenir SQL Injection
- **TOTP 2FA** — Compatible con Google Authenticator, Authy y cualquier app RFC 6238

---

## Scripts Disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor con hot-reload (tsx watch) |
| `npm run build` | Compila TypeScript + resuelve alias de paths (`tsc-alias`) |
| `npm start` | Ejecuta el bundle compilado de producción |

---

## Relación con otros Repositorios

| Repositorio | Relación |
|---|---|
| [`repo-infra-db`](../repo-infra-db/) | **Dependencia directa** — Debe estar corriendo antes de iniciar el API. Conexión por `DATABASE_URL` en puerto `5433` |
| [`repo-web-client`](../repo-web-client/) | **Consumidor** — El frontend llama a este API via `/api/v1/*`. Debe configurar `API_URL=http://localhost:4000` |
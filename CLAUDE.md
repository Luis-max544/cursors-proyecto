# CLAUDE.md — NutriLearn

Instrucciones para Claude Code al trabajar en este proyecto.

---

## ¿Qué es este proyecto?

**NutriLearn** es una plataforma de video educativo con:
- Contenido en categorías: Programación, Ciencia, Matemáticas, Idiomas.
- Modelo freemium: 5 videos gratis al mes → suscripción mensual única → acceso ilimitado.
- Creadores que suben videos directamente (upload a S3 → procesamiento HLS con FFmpeg).
- Reparto de ganancias entre creadores según visualizaciones del mes (70% a creadores).

Lee los documentos en este orden antes de escribir código:
1. `README.md` — visión general
2. `DATABASE_SCHEMA.md` — esquema Drizzle + PostgreSQL
3. `API_SPEC.md` — endpoints, request/response, lógica de acceso
4. `FRONTEND_ARCHITECTURE.md` — estructura React, rutas, componentes
5. `MONOREPO_SETUP.md` — setup Turborepo, packages internos, variables de entorno

---

## Convenciones de código

### TypeScript
- `strict: true` en todos los tsconfig.
- Sin `any` explícito; usa `unknown` y type guards.
- Exporta tipos desde `@nutrilearn/types`, nunca dupliques definiciones.

### API (Express)
- Todas las rutas en `apps/api/src/routes/`.
- Lógica de negocio en `services/`, nunca en controllers.
- Controllers solo: validar body con Zod → llamar service → formatear respuesta.
- Respuesta estándar: `{ data: T }` o `{ error: { code, message } }`.
- Siempre usa `try/catch` en controllers y delega al error handler global.

### Base de datos
- Usa Drizzle ORM con el cliente de `@nutrilearn/db`.
- Nunca escribas SQL raw salvo en casos de performance justificados.
- Cada migración debe ser reversible.

### Frontend (React)
- Componentes funcionales + hooks.
- Estado del servidor con TanStack Query (sin useEffect para fetching).
- Estado global (auth, player) con Zustand.
- Sin prop drilling > 2 niveles; usa contexto o Zustand.
- Lazy load todas las páginas con `React.lazy`.

### Nombrado
- Archivos: `kebab-case.ts` para utilidades, `PascalCase.tsx` para componentes.
- Variables/funciones: `camelCase`.
- Constantes: `UPPER_SNAKE_CASE`.
- Tablas DB: `snake_case`.

---

## Flujos críticos a implementar primero

### 1. Auth completo
- Register → Login → Refresh → Logout.
- JWT: access token 15min, refresh 30 días (rotación).
- Hash passwords con bcryptjs (salt rounds: 12).

### 2. Acceso a video (lógica de paywall)
```
¿Tiene suscripción Stripe activa?
  → SÍ: permitir siempre
  → NO:
      ¿Es el video premium?
        → SÍ: bloquear (SUBSCRIPTION_REQUIRED)
        → NO: ¿usó < 5 videos este mes?
                → SÍ: permitir + incrementar contador
                → NO: bloquear (FREE_LIMIT_REACHED)
```

### 3. Upload flow
1. `POST /videos` → crear registro DB + generar presigned URL S3.
2. Cliente sube directo a S3 (no pasa por la API).
3. `POST /videos/:id/complete-upload` → disparar job FFmpeg.
4. Job actualiza status + sube HLS a S3.

### 4. Stripe webhooks
- Verificar firma siempre (`stripe.webhooks.constructEvent`).
- Idempotente: si el evento ya fue procesado, responder 200 sin hacer nada.

---

## Seguridad

- Nunca loguees tokens, passwords, o secrets.
- Rate limiting en todas las rutas de auth (5 req/min por IP).
- Sanitizar uploads: verificar MIME type real con `file-type`, no confiar en extensión.
- Presigned URLs de S3 deben expirar en máximo 1 hora.
- HLS URLs firmadas con TTL de 4 horas (CloudFront signed URLs o S3 presigned).
- CORS: solo permitir `CORS_ORIGIN` del env.

---

## Testing

- Unit tests con Vitest.
- Tests de integración para servicios críticos: auth, videoAccess, payout.
- Mocks de S3 y Stripe con sus SDK de testing.

---

## Variables de entorno

Nunca hardcodees valores. Todas las variables están en `packages/config/src/env.ts` validadas con Zod. Importa siempre desde ahí:

```typescript
import { env } from "@nutrilearn/config";
```

---

## Errores comunes a evitar

1. **No uses `req.body` sin validar con Zod primero.**
2. **No expongas stack traces en producción** (`NODE_ENV === 'production'`).
3. **No hagas queries N+1** — usa joins o `inArray` de Drizzle.
4. **No olvides el índice `(user_id, month)` en `free_views_tracker`** para el check de límite gratuito.
5. **El job de FFmpeg debe ejecutarse fuera del request cycle** (usa BullMQ o un worker process separado).
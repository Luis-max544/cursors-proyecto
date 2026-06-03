# API Specification — NutriLearn

Base URL: `https://api.nutrilearn.io/v1`  
Auth: Bearer JWT en header `Authorization`.

---

## Convenciones

- Todas las respuestas siguen `{ data, error, meta }`.
- Paginación: `?page=1&limit=20` → `meta.total, meta.page, meta.pages`.
- Errores: `{ error: { code, message, details? } }`.

---

## Auth

### `POST /auth/register`
Registro de usuario (viewer por defecto).

**Body**
```json
{
  "email": "user@example.com",
  "username": "learner99",
  "password": "min8chars"
}
```

**Response 201**
```json
{
  "data": {
    "user": { "id", "email", "username", "role" },
    "accessToken": "jwt...",
    "refreshToken": "jwt..."
  }
}
```

---

### `POST /auth/login`
**Body**
```json
{ "email": "...", "password": "..." }
```

**Response 200** — igual a register.

---

### `POST /auth/refresh`
**Body** `{ "refreshToken": "..." }`  
**Response 200** `{ "data": { "accessToken": "..." } }`

---

### `POST /auth/logout`
**Auth requerida.** Invalida refresh token.

---

## Users

### `GET /users/me`
Perfil del usuario autenticado.

**Response 200**
```json
{
  "data": {
    "id", "email", "username", "role", "avatarUrl", "bio",
    "subscription": {
      "active": true,
      "currentPeriodEnd": "2025-07-15T00:00:00Z"
    },
    "freeViewsUsed": 3,
    "freeViewsLimit": 5
  }
}
```

---

### `PATCH /users/me`
Actualizar perfil (avatar, bio, username).

**Body** `multipart/form-data` — campos opcionales: `username`, `bio`, `avatar` (file).

---

## Creators

### `POST /creators/apply`
**Auth requerida (role: viewer).**  
Solicitud para convertirse en creador.

**Body**
```json
{
  "channelName": "CodeWithMe",
  "channelSlug": "codewithme",
  "payoutEmail": "creator@paypal.com",
  "bio": "Enseño programación desde cero"
}
```

**Response 201** `{ "data": { "message": "Solicitud enviada, pendiente de aprobación" } }`

---

### `GET /creators/:slug`
Perfil público de un canal.

**Response 200**
```json
{
  "data": {
    "channelName": "CodeWithMe",
    "channelSlug": "codewithme",
    "bannerUrl": "...",
    "bio": "...",
    "subscribersCount": 1240,
    "totalVideos": 32,
    "isSubscribed": false   // si hay auth
  }
}
```

---

### `GET /creators/:slug/videos`
Videos públicos del canal (paginado).

Query: `?page=1&limit=12&category=programming`

---

### `POST /creators/:slug/subscribe`
**Auth requerida.**  
Suscribirse/desuscribirse al canal (toggle).

**Response 200** `{ "data": { "subscribed": true } }`

---

### `GET /creators/me/dashboard`
**Auth requerida (role: creator).**  
Analytics del creador.

**Response 200**
```json
{
  "data": {
    "monthlyViews": 15400,
    "totalViews": 234000,
    "estimatedPayout": 45.20,
    "subscribers": 1240,
    "videos": {
      "total": 32,
      "ready": 30,
      "processing": 1,
      "rejected": 1
    },
    "topVideos": [
      { "id", "title", "viewsCount", "publishedAt" }
    ]
  }
}
```

---

## Videos

### `GET /videos`
Feed principal (videos `ready`). Soporta filtros.

Query params:
- `category`: `programming | science | math | languages`
- `sort`: `recent | popular`
- `page`, `limit`
- `subscribed`: `true` → solo canales a los que está suscrito el usuario

**Response 200**
```json
{
  "data": [
    {
      "id", "title", "description",
      "thumbnailUrl", "durationSeconds",
      "viewsCount", "publishedAt",
      "isPremium",
      "creator": { "id", "channelName", "channelSlug", "avatarUrl" },
      "category": "programming"
    }
  ],
  "meta": { "total": 200, "page": 1, "pages": 10 }
}
```

---

### `GET /videos/:id`
Detalle de un video.

**Lógica de acceso:**
1. Si `status !== ready` → 404.
2. Si `isPremium = true` y usuario **no** tiene suscripción activa → `403` con `{ error: { code: "SUBSCRIPTION_REQUIRED" } }`.
3. Si `isPremium = false` y usuario **no** suscrito y `freeViewsUsed >= 5` → `403` con `{ error: { code: "FREE_LIMIT_REACHED" } }`.
4. Caso contrario → responde con `hlsUrl` (presigned, TTL 4h).

**Response 200**
```json
{
  "data": {
    "id", "title", "description",
    "hlsUrl": "https://cdn.nutrilearn.io/hls/abc123/index.m3u8?token=...",
    "thumbnailUrl", "durationSeconds",
    "viewsCount", "publishedAt", "isPremium",
    "creator": { "channelName", "channelSlug", "avatarUrl" },
    "category": "programming",
    "isSubscribedToCreator": false
  }
}
```

---

### `POST /videos/:id/view`
Registrar reproducción (llamar al inicio del video).

**Auth opcional** — si no hay auth se usa IP.  
**Deduplicación:** misma IP/user + mismo video en < 30 min → no cuenta.

**Response 200** `{ "data": { "counted": true } }`

---

### `POST /videos` *(creator)*
Iniciar proceso de subida. Crea el registro del video y devuelve una presigned URL de S3.

**Auth requerida (role: creator).**

**Body**
```json
{
  "title": "Aprende Python en 1 hora",
  "description": "...",
  "category": "programming",
  "isPremium": false,
  "fileSize": 524288000,
  "mimeType": "video/mp4"
}
```

**Response 201**
```json
{
  "data": {
    "videoId": "uuid",
    "uploadUrl": "https://s3.amazonaws.com/...",
    "uploadId": "s3-multipart-id",   // para multipart > 100MB
    "s3Key": "raw/uuid/video.mp4",
    "expiresAt": "2025-06-02T12:00:00Z"
  }
}
```

---

### `POST /videos/:id/complete-upload`
**Auth requerida (role: creator).**  
Notifica que el upload terminó → dispara job de procesamiento HLS.

**Body** *(solo multipart)*
```json
{ "parts": [{ "PartNumber": 1, "ETag": "..." }] }
```

**Response 200** `{ "data": { "status": "processing" } }`

---

### `PATCH /videos/:id` *(creator)*
Editar metadatos (título, descripción, categoría, isPremium).  
Solo si `status = ready | rejected`.

---

### `DELETE /videos/:id` *(creator/admin)*
Soft delete (cambia status a `deleted`).

---

### `GET /videos/:id/status` *(creator)*
Polling del estado de procesamiento.

**Response 200** `{ "data": { "status": "processing", "progress": 45 } }`

---

## Subscriptions (Stripe)

### `POST /subscriptions/checkout`
**Auth requerida.**  
Crea una Stripe Checkout Session.

**Response 200** `{ "data": { "checkoutUrl": "https://checkout.stripe.com/..." } }`

---

### `POST /subscriptions/portal`
**Auth requerida.**  
Crea una Stripe Billing Portal Session (para cancelar, ver facturas).

**Response 200** `{ "data": { "portalUrl": "https://billing.stripe.com/..." } }`

---

### `POST /subscriptions/webhook`
Webhook de Stripe (sin auth JWT, verificado con `stripe-signature`).

Eventos manejados:
- `checkout.session.completed` → activar suscripción
- `invoice.payment_succeeded` → renovar período
- `invoice.payment_failed` → marcar `past_due`
- `customer.subscription.deleted` → cancelar

---

## Admin

### `GET /admin/creators/pending`
Lista de solicitudes de creadores pendientes de aprobación.

### `POST /admin/creators/:userId/approve`
### `POST /admin/creators/:userId/reject`

### `GET /admin/videos/flagged`
Videos reportados o pendientes de revisión.

### `GET /admin/payouts/preview`
Preview del reparto mensual antes de ejecutarlo.

**Response 200**
```json
{
  "data": {
    "month": "2025-06",
    "totalRevenue": 5000.00,
    "pool": 3500.00,
    "platformCut": 1500.00,
    "totalViews": 850000,
    "creators": [
      {
        "creatorId", "channelName",
        "views": 15400,
        "percentage": 1.81,
        "estimatedPayout": 63.35
      }
    ]
  }
}
```

### `POST /admin/payouts/execute`
Ejecuta el reparto del mes (registra `monthly_payouts`).

---

## Códigos de error principales

| Código | HTTP | Descripción |
|--------|------|-------------|
| `UNAUTHORIZED` | 401 | Token inválido o expirado |
| `FORBIDDEN` | 403 | Sin permisos para este recurso |
| `SUBSCRIPTION_REQUIRED` | 403 | Video premium, usuario sin suscripción |
| `FREE_LIMIT_REACHED` | 403 | 5 videos gratis agotados este mes |
| `NOT_FOUND` | 404 | Recurso no existe |
| `VALIDATION_ERROR` | 422 | Body inválido |
| `CREATOR_NOT_APPROVED` | 403 | Creador pendiente de aprobación |

---

## Middlewares

```
authMiddleware        → verifica JWT, inyecta req.user
requireRole(role)     → verifica rol mínimo
checkVideoAccess      → lógica de acceso (premium / free limit)
rateLimiter           → Redis, 100 req/min por IP
```
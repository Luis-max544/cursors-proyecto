# NutriLearn — MVP

Plataforma de video educativo con modelo de suscripción única y reparto de ganancias para creadores.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Monorepo | Turborepo + pnpm 11 workspaces |
| API | Node.js + Express + TypeScript |
| Frontend | React 19 + Vite + TypeScript |
| Base de datos | PostgreSQL (Neon o Railway) |
| ORM | Drizzle ORM |
| Auth | JWT (access + refresh tokens) |
| Storage | AWS S3 / Cloudflare R2 (videos + thumbnails) |
| Video | HLS via FFmpeg worker + presigned URLs |
| Pagos | Stripe Subscriptions |
| Cache | Redis (views counter, rate limit) |
| Emails | Resend |

---

## Estructura del monorepo

```
nutrilearn/
├── apps/
│   ├── api/                  # Express REST API
│   └── web/                  # React + Vite frontend
├── packages/
│   ├── db/                   # Drizzle schema + migrations
│   ├── types/                # Tipos compartidos (DTOs, enums)
│   └── config/               # Variables de entorno compartidas
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Categorías del MVP

- `programming` — Programación
- `science` — Ciencia
- `math` — Matemáticas
- `languages` — Idiomas

---

## Modelo de negocio

- **Usuarios no suscritos:** 5 videos gratis al mes → luego paywall.
- **Usuarios suscritos (membresía mensual):** acceso ilimitado a todo el contenido.
- **Creadores:** reciben un porcentaje de las ganancias mensuales proporcional a sus visualizaciones totales del mes.

### Fórmula de reparto

```
pago_creador = (views_creador / views_totales_plataforma) * pool_mensual
pool_mensual = ingresos_suscripciones * 0.70   # 70% para creadores, 30% plataforma
```

---

## Roles

| Rol | Descripción |
|-----|-------------|
| `viewer` | Usuario consumidor (gratis o suscrito) |
| `creator` | Puede subir videos, tiene dashboard de analytics |
| `admin` | Gestión de plataforma, aprobación de creadores |

---

## Flujo principal

```
[Registro] → [Explorar (5 videos gratis)] → [Paywall] → [Suscripción Stripe]
                                                  ↕
                                         [Acceso ilimitado]

[Registro creador] → [Aprobación admin] → [Upload video] → [Procesamiento HLS] → [Publicado]
```
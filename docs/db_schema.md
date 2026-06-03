# Esquema de Base de Datos — NutriLearn

ORM: **Drizzle ORM**  
DB: **PostgreSQL**

---

## Diagrama entidad-relación (simplificado)

```
┌─────────────┐       ┌──────────────────┐       ┌───────────────┐
│    users    │──────<│  subscriptions   │       │   categories  │
├─────────────┤       ├──────────────────┤       ├───────────────┤
│ id (PK)     │       │ id (PK)          │       │ id (PK)       │
│ email       │       │ user_id (FK)     │       │ slug          │
│ username    │       │ stripe_sub_id    │       │ name          │
│ password_h  │       │ status           │       │ icon          │
│ role        │       │ current_period_  │       └───────────────┘
│ avatar_url  │       │ cancel_at_period │              ▲
│ bio         │       │ created_at       │              │
│ created_at  │       └──────────────────┘              │
│ stripe_cus  │                                         │
└──────┬──────┘                                  ┌──────┴──────┐
       │                                         │   videos    │
       │ 1:N                                     ├─────────────┤
       ▼                                         │ id (PK)     │
┌─────────────────┐                              │ creator_id  │
│ creator_profiles│                              │ title       │
├─────────────────┤          ┌────────────┐      │ description │
│ user_id (PK,FK) │          │   views    │      │ category_id │
│ channel_name    │          ├────────────┤      │ thumbnail   │
│ channel_slug    │──────────│ id (PK)    │      │ hls_url     │
│ approved        │  1:N     │ video_id   │      │ duration_s  │
│ approved_at     │          │ user_id    │      │ status      │
│ payout_email    │          │ ip_address │      │ is_premium  │
│ total_views_m   │          │ viewed_at  │      │ views_count │
└─────────────────┘          └────────────┘      │ created_at  │
                                                  └──────┬──────┘
                                                         │
                            ┌────────────────────────────┘
                            │ 1:N
                            ▼
                   ┌─────────────────┐      ┌──────────────────┐
                   │  subscriptions  │      │ monthly_payouts  │
                   │  (canal, no     │      ├──────────────────┤
                   │   Stripe)       │      │ id (PK)          │
                   ├─────────────────┤      │ creator_id (FK)  │
                   │ id (PK)         │      │ month (YYYY-MM)  │
                   │ viewer_id (FK)  │      │ views_count      │
                   │ creator_id (FK) │      │ amount_usd       │
                   │ created_at      │      │ paid_at          │
                   └─────────────────┘      └──────────────────┘
```

---

## Tablas en Drizzle ORM (TypeScript)

### `packages/db/src/schema.ts`

```typescript
import {
  pgTable, pgEnum, uuid, text, varchar, boolean,
  timestamp, integer, decimal, unique, index
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["viewer", "creator", "admin"]);

export const videoStatusEnum = pgEnum("video_status", [
  "uploading",   // El archivo se está subiendo a S3
  "processing",  // FFmpeg convirtiendo a HLS
  "ready",       // Disponible para reproducción
  "rejected",    // Rechazado por admin
  "deleted",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export const categoryEnum = pgEnum("category", [
  "programming",
  "science",
  "math",
  "languages",
]);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id:             uuid("id").primaryKey().defaultRandom(),
  email:          varchar("email", { length: 255 }).notNull().unique(),
  username:       varchar("username", { length: 60 }).notNull().unique(),
  passwordHash:   text("password_hash").notNull(),
  role:           roleEnum("role").notNull().default("viewer"),
  avatarUrl:      text("avatar_url"),
  bio:            text("bio"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

// ─── Creator profiles ─────────────────────────────────────────────────────────

export const creatorProfiles = pgTable("creator_profiles", {
  userId:         uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  channelName:    varchar("channel_name", { length: 120 }).notNull(),
  channelSlug:    varchar("channel_slug", { length: 80 }).notNull().unique(),
  bannerUrl:      text("banner_url"),
  approved:       boolean("approved").notNull().default(false),
  approvedAt:     timestamp("approved_at"),
  payoutEmail:    varchar("payout_email", { length: 255 }),  // Para transferencias
  // Views acumuladas del mes en curso (se resetean cada mes)
  monthlyViews:   integer("monthly_views").notNull().default(0),
});

// ─── Stripe subscriptions (plataforma) ───────────────────────────────────────

export const platformSubscriptions = pgTable("platform_subscriptions", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  userId:               uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).notNull().unique(),
  stripePriceId:        varchar("stripe_price_id", { length: 255 }).notNull(),
  status:               subscriptionStatusEnum("status").notNull(),
  currentPeriodEnd:     timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd:    boolean("cancel_at_period_end").notNull().default(false),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

// ─── Canal subscriptions (viewer → creator) ──────────────────────────────────

export const channelSubscriptions = pgTable("channel_subscriptions", {
  id:         uuid("id").primaryKey().defaultRandom(),
  viewerId:   uuid("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  creatorId:  uuid("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.viewerId, t.creatorId),
}));

// ─── Videos ───────────────────────────────────────────────────────────────────

export const videos = pgTable("videos", {
  id:          uuid("id").primaryKey().defaultRandom(),
  creatorId:   uuid("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title:       varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category:    categoryEnum("category").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  // S3 key del archivo .m3u8 (raíz del HLS)
  hlsKey:      text("hls_key"),
  // S3 key del archivo original (borrar tras procesar)
  rawKey:      text("raw_key"),
  durationSeconds: integer("duration_seconds"),
  status:      videoStatusEnum("status").notNull().default("uploading"),
  // true = solo para suscriptores de plataforma
  isPremium:   boolean("is_premium").notNull().default(false),
  viewsCount:  integer("views_count").notNull().default(0),
  publishedAt: timestamp("published_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  creatorIdx:  index("videos_creator_idx").on(t.creatorId),
  categoryIdx: index("videos_category_idx").on(t.category),
  statusIdx:   index("videos_status_idx").on(t.status),
}));

// ─── Views (registro de reproducciones) ─────────────────────────────────────

export const videoViews = pgTable("video_views", {
  id:        uuid("id").primaryKey().defaultRandom(),
  videoId:   uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  // Para usuarios anónimos
  ipAddress: varchar("ip_address", { length: 45 }),
  viewedAt:  timestamp("viewed_at").notNull().defaultNow(),
}, (t) => ({
  videoIdx: index("views_video_idx").on(t.videoId),
  userIdx:  index("views_user_idx").on(t.userId),
}));

// ─── Free views tracker (usuarios no suscritos) ───────────────────────────────

export const freeViewsTracker = pgTable("free_views_tracker", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Para anónimos
  ipAddress: varchar("ip_address", { length: 45 }),
  month:     varchar("month", { length: 7 }).notNull(), // "2025-06"
  viewsUsed: integer("views_used").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userMonthIdx: index("free_views_user_month_idx").on(t.userId, t.month),
}));

// ─── Monthly payouts ──────────────────────────────────────────────────────────

export const monthlyPayouts = pgTable("monthly_payouts", {
  id:          uuid("id").primaryKey().defaultRandom(),
  creatorId:   uuid("creator_id").notNull().references(() => users.id),
  month:       varchar("month", { length: 7 }).notNull(), // "2025-06"
  viewsCount:  integer("views_count").notNull(),
  viewsTotal:  integer("views_total").notNull(),    // total plataforma ese mes
  revenuePool: decimal("revenue_pool", { precision: 10, scale: 2 }).notNull(),
  amountUsd:   decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  paidAt:      timestamp("paid_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  creatorMonthUniq: unique().on(t.creatorId, t.month),
}));

// ─── Upload sessions (presigned S3 uploads) ──────────────────────────────────

export const uploadSessions = pgTable("upload_sessions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  creatorId:   uuid("creator_id").notNull().references(() => users.id),
  videoId:     uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  s3Key:       text("s3_key").notNull(),
  uploadId:    text("upload_id"),   // S3 multipart upload ID
  expiresAt:   timestamp("expires_at").notNull(),
  completed:   boolean("completed").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});
```

---

## Índices importantes

| Tabla | Columnas indexadas | Razón |
|-------|-------------------|-------|
| `videos` | `creator_id` | Listar videos por canal |
| `videos` | `category` | Filtro por categoría |
| `videos` | `status` | Sólo videos `ready` al front |
| `video_views` | `video_id` | Conteo de reproducciones |
| `free_views_tracker` | `(user_id, month)` | Check rápido de límite mensual |
| `channel_subscriptions` | `(viewer_id, creator_id)` | Verificar suscripción a canal |

---

## Migraciones

```bash
# Generar migración
pnpm --filter @nutrilearn/db drizzle-kit generate

# Aplicar migraciones
pnpm --filter @nutrilearn/db drizzle-kit migrate
```
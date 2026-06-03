# Frontend Architecture — NutriLearn

Framework: **React 19 + Vite + TypeScript**  
Styling: **Tailwind CSS v4**  
State: **Zustand** (auth, player) + **TanStack Query** (server state)  
Router: **React Router v7**  
Player: **HLS.js**  
Pagos: **Stripe.js**

---

## Estructura de carpetas

```
apps/web/src/
├── assets/                  # Fuentes, íconos estáticos
├── components/
│   ├── ui/                  # Primitivos (Button, Input, Badge, Modal, Skeleton)
│   ├── layout/              # Navbar, Sidebar, Footer
│   ├── video/               # VideoCard, VideoPlayer, VideoGrid, PaywallOverlay
│   ├── creator/             # ChannelHeader, ChannelCard, SubscribeButton
│   └── upload/              # UploadForm, ProgressBar, VideoMetadataForm
├── pages/
│   ├── Home.tsx             # Feed principal
│   ├── Discover.tsx         # Explorar por categoría
│   ├── VideoDetail.tsx      # Reproductor + info
│   ├── Channel.tsx          # Perfil de canal
│   ├── Subscriptions.tsx    # Canales seguidos
│   ├── auth/
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── creator/
│   │   ├── Dashboard.tsx    # Analytics del creador
│   │   ├── Upload.tsx       # Subir video
│   │   ├── Videos.tsx       # Gestionar videos
│   │   └── Apply.tsx        # Solicitud de creador
│   ├── settings/
│   │   ├── Profile.tsx
│   │   └── Billing.tsx      # Gestionar suscripción Stripe
│   └── admin/
│       ├── Creators.tsx     # Aprobar creadores
│       ├── Videos.tsx       # Moderar videos
│       └── Payouts.tsx      # Gestionar pagos mensuales
├── hooks/
│   ├── useAuth.ts
│   ├── useVideoAccess.ts    # Lógica de acceso (premium/free limit)
│   ├── useUpload.ts         # Lógica multipart S3
│   └── usePlayer.ts         # HLS.js setup
├── lib/
│   ├── api.ts               # Axios instance + interceptors
│   ├── stripe.ts            # Stripe.js setup
│   └── hls.ts               # HLS.js helpers
├── stores/
│   ├── authStore.ts         # Zustand: user, tokens
│   └── playerStore.ts       # Zustand: estado del reproductor
└── types/                   # Re-export de @nutrilearn/types
```

---

## Rutas

```
/                          → Home (feed general)
/discover                  → Explorar por categoría
/subscriptions             → Feed de canales suscritos (auth requerida)
/c/:slug                   → Perfil de canal
/watch/:videoId            → Reproductor de video
/auth/login
/auth/register
/creator/apply             → Solicitud de creador
/creator/dashboard         → Analytics (creator)
/creator/upload            → Subir video (creator)
/creator/videos            → Gestionar videos (creator)
/settings/profile
/settings/billing
/admin/creators            → (admin)
/admin/videos              → (admin)
/admin/payouts             → (admin)
```

---

## Flujo de acceso a video

```typescript
// hooks/useVideoAccess.ts
type AccessResult =
  | { allowed: true;  hlsUrl: string }
  | { allowed: false; reason: "SUBSCRIPTION_REQUIRED" | "FREE_LIMIT_REACHED" | "UNAUTHENTICATED" };
```

El componente `VideoDetail` llama al hook → si `allowed: false` renderiza `<PaywallOverlay reason={...} />`.

---

## Componente PaywallOverlay

```
┌─────────────────────────────────────────────┐
│  [Video thumbnail blurred/faded]            │
│                                             │
│  🔒  Este video es exclusivo                │
│      para miembros de NutriLearn            │
│                                             │
│  ✓ Acceso ilimitado a todo el contenido     │
│  ✓ Apoya a tus creadores favoritos          │
│  ✓ Sin anuncios                             │
│                                             │
│  [  Suscribirme por $X/mes  ]               │
│                                             │
│  ─── o ────────────────────────────────     │
│  Te quedan 2 videos gratis este mes         │
└─────────────────────────────────────────────┘
```

---

## Upload flow (cliente)

```
1. Usuario llena VideoMetadataForm
2. POST /videos → recibe { uploadUrl, videoId, s3Key }
3. Si archivo < 100MB: PUT directo a uploadUrl
   Si archivo >= 100MB: upload multipart chunked (5MB chunks)
4. Progress bar en tiempo real (axios onUploadProgress)
5. POST /videos/:id/complete-upload
6. Polling GET /videos/:id/status cada 3s hasta status = "ready"
7. Redirigir a /watch/:videoId
```

---

## Componentes críticos

### `<VideoPlayer />`
- Usa `hls.js` para reproducción HLS.
- Controles nativos en mobile, custom en desktop.
- Llama `POST /videos/:id/view` al superar 10 segundos de reproducción.

### `<VideoCard />`
- Thumbnail lazy-loaded.
- Badge `PREMIUM` si `isPremium = true`.
- Duración formateada.
- Avatar + nombre del canal.

### `<UploadForm />`
- Drag & drop con validación: solo `.mp4`, `.mov`, `.mkv`.
- Límite: 4GB.
- Chunk size: 5MB.
- Muestra progreso de upload y de procesamiento.

---

## Variables de entorno (web)

```env
VITE_API_URL=http://localhost:4000/v1
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_S3_CDN_URL=https://cdn.nutrilearn.io
```
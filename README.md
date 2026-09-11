# Mora Web

Sitio web de Mora — smart ring de lujo. Next.js 16 con configurador 3D (Three.js).

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Firebase

Proyecto: `mora-ring`  
Deploy: **Firebase App Hosting**

### Deploy manual

```bash
firebase login
firebase deploy --only apphosting
```

### Deploy automático (GitHub)

1. Conecta el repo `alejandroCol/mora-web` en [Firebase Console → App Hosting](https://console.firebase.google.com/project/mora-ring/apphosting).
2. Backend: `mora-web`
3. Rama: `main`
4. App root directory: `.` (raíz del repo)

Las variables de Firebase están en `apphosting.yaml` y `.env.local` para desarrollo.

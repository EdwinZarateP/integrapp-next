# IntegrApp — Frontend Next.js

Frontend de la plataforma logística de **Integra Cadena de Servicios S.A.S.**, migrado de React+Vite a **Next.js 14 App Router** en marzo 2025.

**Backend:** ver `../integrappi/` (FastAPI + MongoDB)

---

## Qué hace este proyecto

Plataforma web multi-portal para la operación logística de Integra. Cada portal es un flujo de trabajo independiente con autenticación propia:

| Portal | Ruta | Descripción |
|---|---|---|
| **Home** | `/` | Página de inicio con buscador de guías y acceso a portales |
| **Portal Transportadores** | `/loginpropietarios` | Propietarios de vehículos: manifiestos, saldos, novedades |
| **Portal Empleados** | `/CertificadoLaboralP` | Certificados laborales en PDF |
| **Torre de Control — Kabi** | `/LoginUsuario` → `/Pedidos` | Gestión de pedidos Fresenius Kabi |
| **Torre de Control — Medical Care** | `/LoginUsuario` → `/MedicalCare` | Portal Fresenius Medical Care (en construcción) |
| **Portal Conductores** | `/LoginConductores` | Panel del conductor: revisión de vehículos, documentos, firmas |
| **Portal Clientes** | `/PortalClientes` | Diseño y consulta de servicios |
| **Portal Ventas** | `/PortalVentas` | Herramientas comerciales y creación de clientes |

> La Torre de Control soporta múltiples clientes. Tras el login, si el usuario tiene acceso a más de un cliente se muestra un selector de portal. El cliente activo se guarda en la cookie `clientePedidosCookie`.

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript 5 |
| UI | MUI v6 + React Icons + Lucide React |
| HTTP | Axios |
| Autenticación | Cookies (`js-cookie`) + JWT decode |
| PDF | `@react-pdf/renderer` + jsPDF + jspdf-autotable |
| Firmas | `react-signature-canvas` |
| Mapas / Municipios | JSON estático con municipios colombianos |
| Animaciones | Lottie React, React Confetti |
| Analytics | PowerBI embebido (iframe) |
| Google Auth | `@react-oauth/google` |
| Firebase | `firebase` v10 |
| Alertas | SweetAlert2 |

---

## Estructura del proyecto

```
integrapp-next/
├── src/
│   ├── app/                        # Rutas Next.js (App Router)
│   │   ├── layout.tsx              # Layout raíz con GoogleOAuthProvider + ContextoApp
│   │   ├── page.tsx                # Home: header, buscador de guía, portales, footer
│   │   ├── page.module.css
│   │   ├── globals.css
│   │   ├── not-found.tsx
│   │   │
│   │   ├── loginpropietarios/      # Login propietarios de vehículos
│   │   ├── InicioPropietarios/     # Dashboard propietario (requiere auth)
│   │   ├── SalaEspera/             # Extracción de datos de la API
│   │   ├── SeleccionEstados/       # Selección: ACTIVOS / PAGADOS / DEVUELTOS
│   │   ├── Estados/                # Vista de manifiestos por estado
│   │   ├── Novedad/                # Registro de novedades con foto
│   │   ├── DetalleEstados/         # Detalle de un manifiesto
│   │   │
│   │   ├── LoginUsuario/           # Login Torre de Control — flujo 2 pasos: credenciales → selector de cliente
│   │   ├── LoginUsuariosSeguridad/ # Login perfil seguridad
│   │   ├── Pedidos/                # Gestión de pedidos Fresenius Kabi: carga masiva, autorización, FAB de acciones
│   │   ├── PedidosCompletados/     # Vista de pedidos completados Kabi
│   │   ├── MedicalCare/            # Portal Fresenius Medical Care (en construcción)
│   │   ├── GestionUsuarios/        # Panel ADMIN: crear usuarios y asignar acceso por cliente
│   │   ├── Tarifas/                # Gestión de tarifas de flete (CRUD, filtro por destino)
│   │   │
│   │   ├── LoginConductores/       # Login conductores
│   │   ├── RegistroConductor/      # Registro de conductor
│   │   ├── OlvidoClaveConductor/
│   │   ├── PanelConductores/       # Panel del conductor (documentos, revisión, firmas)
│   │   ├── revision/               # Revisión del vehículo (inspector)
│   │   │
│   │   ├── PortalClientes/
│   │   ├── PortalVentas/
│   │   ├── CertificadoLaboralP/    # Certificados laborales
│   │   │
│   │   ├── Registro/               # Registro de propietario
│   │   ├── olvidoclave/
│   │   ├── recuperar-clave/        # Recuperación con token (link desde correo)
│   │   │
│   │   ├── indicadores/            # Dashboard PowerBI 1
│   │   ├── indicadoresfmc/         # Dashboard PowerBI 2
│   │   ├── descargables/           # Descarga del bot de recolecciones (.exe)
│   │   └── Api2/                   # Página de prueba autenticación Vulcano
│   │
│   ├── Componentes/                # Componentes reutilizables (todos con 'use client')
│   │   ├── Barra/                  # Barra de progreso
│   │   ├── BotonEstados/
│   │   ├── BotonSencillo/
│   │   ├── CargaDocumento/         # Upload de archivos con preview
│   │   ├── CertificadoLaboralC/    # Renderizador PDF certificado laboral
│   │   ├── ClientProviders/        # GoogleOAuthProvider + ContextoApp (wrapper 'use client')
│   │   ├── ContenedorTarjetas/
│   │   ├── Datos/                  # Selector de municipios colombianos
│   │   ├── DisenoServicio/
│   │   ├── FiltradoPlacas/         # Búsqueda y filtro de vehículos
│   │   ├── FotoNovedad/            # Captura/subida de foto para novedades
│   │   ├── HeaderIcono/
│   │   ├── HeaderLogo/
│   │   ├── HvVehiculos/            # Generación de PDF hoja de vida vehículo (@react-pdf)
│   │   ├── LoginGoogle/            # Botón OAuth Google
│   │   ├── Municipios/             # JSON con municipios de Colombia
│   │   ├── PedidosComponentes/     # Subcomponentes del módulo de pedidos:
│   │   │   ├── CargarPedidos       #   Subida masiva de Excel
│   │   │   ├── TablaPedidos        #   Tabla con autorización / eliminación
│   │   │   ├── TablaPedidosCompletados
│   │   │   ├── ExportarAutorizados
│   │   │   └── importarPedidosVulcano
│   │   ├── PortalClientesComp/
│   │   ├── PortalVentasComp/
│   │   ├── TarjetaDetalle/
│   │   ├── TarjetaResumen/
│   │   └── VerDocumento/           # Visor de documentos (PDF/imagen)
│   │
│   ├── Contexto/
│   │   └── index.tsx               # ContextoApp: estado global compartido entre portales
│   │                               # Variables: nombre, tenedor, placa, estado, link,
│   │                               #   DiccionarioManifiestosTodos, DiccionarioSaldos, etc.
│   │
│   ├── Funciones/                  # Capa de integración con la API
│   │   ├── ApiPedidos/
│   │   │   ├── apiPedidos.tsx      # CRUD completo de pedidos, carga masiva, exportación
│   │   │   ├── clientes.tsx        # CRUD clientes
│   │   │   ├── fletes.tsx          # CRUD tarifas de flete + interfaz Flete + obtenerFletes
│   │   │   ├── usuarios.tsx        # Login y gestión de usuarios (Torre de Control)
│   │   │   └── tipos.tsx           # Interfaces TypeScript compartidas
│   │   ├── ConsultaNovedades/      # Consulta de novedades de manifiestos
│   │   ├── ExtraccionTotal/        # Extracción completa de datos propietario
│   │   ├── ExtraeNovedades/        # Novedades desde Vulcano
│   │   ├── ExtraePagosAplicados/   # Manifiestos pagados
│   │   ├── ExtraePagosNoAplicados/ # Manifiestos activos
│   │   ├── ExtraerInfoApi/         # Info de saldos del propietario
│   │   ├── ExtraerInfoApiManifiestos/
│   │   ├── ExtraerInfoApiPagos/
│   │   ├── ExtraeSaldos/
│   │   ├── ExtraeSaldosApi/
│   │   ├── ObtenerInfoPlaca.tsx    # Datos de un vehículo por placa
│   │   └── documentConstants.tsx   # Constantes de tipos de documento
│   │
│   └── Imagenes/
│       ├── albatros.png            # Logo principal
│       ├── logo.png
│       ├── logo2.png
│       └── AnimationPuntos.json    # Animación Lottie (carga)
│
├── public/
│   ├── bot_recolecciones.exe       # App Electron descargable (bot de recolecciones)
│   ├── albatros192.png
│   └── albatros512.png
│
├── next.config.mjs                 # Sin basePath (dev local). En producción agregar basePath: "/integrapp"
├── tsconfig.json                   # target ES2015 (requerido por uso de Set/Map)
├── .env.local                      # Variables de entorno (no subir al repo)
└── package.json
```

---

## Variables de entorno

Archivo `.env.local` en la raíz:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

En producción apunta a:
```env
NEXT_PUBLIC_API_BASE_URL=https://integrappi-dvmh.onrender.com
```

---

## Autenticación

El sistema NO usa sesiones de servidor. Usa **cookies del browser** manejadas con `js-cookie`:

| Cookie | Contenido | Usado en |
|---|---|---|
| `tenedorIntegrapp` | ID del propietario | Portal Transportadores |
| `nombreIntegrapp` | Nombre del propietario | Portal Transportadores |
| `usuarioPedidosCookie` | Usuario Torre de Control | Torre de Control |
| `perfilPedidosCookie` | Perfil (ADMIN, OPERATIVO, SEGURIDAD, CONDUCTOR) | Torre de Control |
| `regionalPedidosCookie` | Regional asignada | Torre de Control |
| `clientePedidosCookie` | Cliente seleccionado (`KABI` o `MEDICAL_CARE`) | Torre de Control |
| `seguridadId` | ID usuario seguridad | LoginUsuariosSeguridad |
| `conductorId` | ID conductor | Portal Conductores |

Expiración por defecto: **14 días**.

> Al cerrar sesión desde cualquier página de la Torre de Control se eliminan las cinco cookies: `usuarioPedidosCookie`, `regionalPedidosCookie`, `perfilPedidosCookie`, `clientePedidosCookie` y `perfilPedidosCookie`.

---

## Cómo correr en desarrollo

```bash
# Instalar dependencias
npm install

# Correr servidor de desarrollo
npm run dev
# → http://localhost:3000
```

> **Nota Windows + OneDrive**: si aparece error `EINVAL: invalid argument, readlink .next/types/package.json`, eliminar la carpeta `.next/` y volver a correr `npm run dev`. Es un problema de compatibilidad de symlinks entre Next.js y OneDrive en Windows.

```bash
# Build de producción
npm run build
npm start
```

---

## Producción

En producción el frontend se sirve bajo el path `/integrapp`. Para activarlo:

```js
// next.config.mjs
const nextConfig = {
  basePath: "/integrapp",
  ...
};
```

El CORS del backend (`integrappi`) debe incluir el dominio del frontend:
- Dev: `http://localhost:3000`
- Prod: `https://integralogistica.com`

---

## Historial de la migración

- **Versión anterior**: React 18 + Vite (`../integrapp/`) — carpeta conservada como respaldo
- **Migración**: marzo 2025
- **Cambios principales**:
  - React Router → Next.js App Router (rutas por archivo)
  - `useNavigate` → `useRouter` de `next/navigation`
  - `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`
  - `main.tsx` → `app/layout.tsx` con `ClientProviders`
  - Todos los componentes con hooks llevan `'use client'`
  - Home rediseñada: se eliminaron las secciones vacías (NOSOTROS, SERVICIOS, etc.)
  - Portales reducidos a 3: Transportadores, Empleados, Torre de Control

---

## Pendientes / notas para retomar

- [ ] El error de OneDrive + symlinks se resuelve moviendo el proyecto a una ruta local fuera de OneDrive (ej: `C:/Desarrollos/integra/integrapp-next/`)
- [ ] `PortalClientes` y `PortalVentas` existen como rutas pero no están enlazadas desde la home — evaluar si se activan o eliminan
- [ ] `Api2` es una página de prueba de autenticación con Vulcano, no es producción
- [ ] `bot_recolecciones.exe` en `/public` es una app Electron para gestión de recolecciones — pendiente integración completa
- [ ] Agregar `sharp` para optimización de imágenes en producción: `npm i sharp`
- [ ] `/MedicalCare` es un portal en construcción — pendiente definir y desarrollar los módulos de Fresenius Medical Care

---

## Historial de cambios relevantes

### Marzo 2025 — Rediseño visual y sistema de diseño unificado

**Sistema de diseño** aplicado a todos los portales:
- Header: gradiente navy `linear-gradient(90deg, #0f1928, #1e2f45)`, altura 64 px
- Acento amber `#e8a000`, fondo general `#f0f2f5`, footer `#0f1928`
- Cada página usa prefijo CSS único (IP-, LU-, CLP-, Ped-, PC-, MC-, GU-, TAR-) para evitar colisiones

**Páginas rediseñadas** con header + footer consistentes:
- `/loginpropietarios` (`InicioPropietarios`) — prefijo IP-
- `/LoginUsuario` (`LoginUsuarios`) — prefijo LU-
- `/CertificadoLaboralP` — prefijo CLP-
- `/Pedidos` — prefijo Ped-, FAB speed dial (botón flotante) para acciones de carga/exportación
- `/PedidosCompletados` — prefijo PC-

**FAB speed dial en `/Pedidos`**: los componentes `CargarPedidos`, `ExportarAutorizados` e `ImportarPedidosVulcano` se montan fuera de pantalla (`position: fixed; left: -9999px`) para mantenerlos vivos en el DOM; el FAB hace `.click()` programático sobre el botón interno de cada uno.

**Tablas de pedidos**: rediseño con cabecera navy, filas zebra, hover, y columnas `Total Solicitado` y `Total Teórico` siempre resaltadas en navy+amber incluso en hover (declaración explícita de todos los estados en CSS para evitar que `tr:hover` las sobreescriba).

### Marzo 2025 — Multi-cliente (Fresenius Kabi + Fresenius Medical Care)

**Login de dos pasos** (`/LoginUsuario`):
1. El usuario ingresa credenciales → el backend devuelve `clientes: string[]`
2. Si tiene un solo cliente → redirige directo; si tiene dos → muestra selector de tarjetas
3. El cliente elegido se guarda en `clientePedidosCookie` y redirige a `/Pedidos` (KABI) o `/MedicalCare` (MEDICAL_CARE)

**Nueva página `/MedicalCare`**: header verde Fresenius Medical Care, placeholder "en construcción", footer. Protegida: redirige a login si no hay sesión o el cliente activo no es `MEDICAL_CARE`.

**Panel de administración** (solo perfil ADMIN):
- `/GestionUsuarios`: tabla de usuarios con toggles por cliente (KABI / MEDICAL_CARE) + modal para crear nuevos usuarios (campos: nombre, usuario, clave, perfil, regional, correo, celular, clientes)
- `/Tarifas`: tabla de tarifas filtrada a origen FUNZA, buscador por destino (búsqueda manual con botón, no reactiva), miga de pan con chip eliminable, modal para crear/editar con tipos de vehículo dinámicos (filas clave-valor), origen fijo FUNZA y ruta fija ANACIONAL
- Ambas páginas accesibles desde el dropdown del header en `/Pedidos` y `/PedidosCompletados` (solo si perfil = ADMIN)

**Funciones API nuevas**:
- `usuarios.tsx`: `actualizarClientesUsuario(id, clientes)`
- `fletes.tsx`: `obtenerFletes()`, `crearFlete()`, `actualizarFlete()`, `eliminarFlete()` + interfaz `Flete`
- `tipos.tsx`: `BaseUsuario` y `LoginRespuesta` actualizados con campo `clientes: string[]`

### Marzo 2025 — Corrección buscador de tarifas (`/Tarifas`)

- **Filtro `startsWith` en lugar de `includes`**: el buscador de destinos ahora solo muestra filas cuyo destino *comienza* con el texto buscado, evitando coincidencias parciales en medio del nombre.
- **`useMemo` en `colsVehiculo` y `tarifasFiltradas`**: ambos valores se memorizan con dependencias `[tarifas]` y `[tarifas, busqueda]` respectivamente, garantizando que el cálculo del filtro sea consistente con el estado React en cada render.
- **`key={busqueda}` en `<tbody>`**: fuerza a React a desmontar y reconstruir completamente el cuerpo de la tabla al cambiar el filtro, eliminando un bug de reconciliación de DOM donde filas antiguas permanecían visibles a pesar de que el estado interno ya mostraba el resultado correcto.

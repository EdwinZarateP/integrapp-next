# IntegrApp — Frontend Next.js

Frontend de la plataforma logística de **Integra Cadena de Servicios S.A.S.**, migrado de React+Vite a **Next.js 14 App Router** en marzo 2025.

**Backend:** ver `../integrappi/` (FastAPI + MongoDB)

---

## Qué hace este proyecto

Plataforma web multi-portal para la operación logística de Integra. Cada portal es un flujo de trabajo independiente con autenticación propia:

### Home (`/`)
Página de inicio con:
- Header con logo y navegación
- Buscador de guías para rastreo rápido
- Accesos a todos los portales del sistema
- Información de la empresa
- Footer con datos de contacto

### Portal Transportadores
Flujo completo para propietarios de vehículos:

**Login (`/loginpropietarios`):**
- Autenticación con usuario y contraseña
- Redirección a dashboard si credenciales son válidas

**Dashboard (`/InicioPropietarios`):**
- Resumen de manifiestos (activos, pagados, devueltos)
- Navegación a diferentes estados de manifiestos
- Información del propietario autenticado

**Extracción de Datos (`/SalaEspera`):**
- Animación de carga durante extracción de datos del backend
- Extracción de manifiestos activos y pagados
- Extracción de saldos pendientes

**Selección de Estados (`/SeleccionEstados`):**
- Selección de tipo de manifiesto a visualizar:
  - ACTIVOS (manifiertos sin liquidar)
  - PAGADOS (manifiestos liquidados)
  - DEVUELTOS (manifiestos con devoluciones)

**Vista de Manifiestos (`/Estados`):**
- Tabla con manifiestos filtrados por estado
- Información: número de manifiesto, fecha, origen, destino, destinatario, estado, valor
- Opciones para ver detalles
- Paginación para manejar grandes volúmenes

**Detalle de Manifiesto (`/DetalleEstados`):**
- Vista detallada de un manifiesto específico
- Información completa: flete, saldos, fechas, estado
- Opciones para registrar novedades

**Registro de Novedades (`/Novedad`):**
- Formulario para registrar incidentes en manifiestos
- Carga de fotos como evidencia (componente FotoNovedad)
- Descripción detallada de la novedad
- Selección de tipo de novedad
- Envío de notificación al backend

### Torre de Control - Multi-Cliente
Sistema de gestión de pedidos con soporte para múltiples clientes (Fresenius Kabi y Fresenius Medical Care):

**Login de Dos Pasos (`/LoginUsuario`):**
1. Primer paso: credenciales (usuario, clave)
2. Segundo paso: selector de cliente (si tiene acceso a más de uno)
3. Cookies de sesión: `usuarioPedidosCookie`, `perfilPedidosCookie`, `regionalPedidosCookie`, `clientePedidosCookie`
4. Perfiles: ADMIN, OPERATIVO, SEGURIDAD, CONDUCTOR

**Login Seguridad (`/LoginUsuariosSeguridad`):**
- Login especial para perfil SEGURIDAD/ADMIN
- Cookie de sesión: `seguridadId`
- Acceso limitado a funciones de seguridad

**Gestión de Pedidos - Kabi (`/Pedidos`):**
- **Carga Masiva**: Subir Excel con pedidos
  - Validación de formato
  - Cálculo automático de totales
  - Creación de consecutivos vehiculares
  - Asignación de tarifas según origen/destino
- **Tabla de Pedidos**: Vista agrupada por consecutivo_vehiculo
  - Estados: AUTORIZADO, PREAUTORIZADO, PENDIENTE, NO AUTORIZADO
  - Columnas: consecutivo, cantidad, kilos totales, costo real, costo teórico, estado
  - Autorización según perfil (ADMIN: todos, OPERATIVO: autorizado/preautorizado)
  - Confirmación de preautorizados
  - Eliminación de pedidos
- **FAB Speed Dial**: Botón flotante con acciones rápidas
  - Cargar pedidos
  - Exportar autorizados a Excel
  - Importar desde Vulcano
- **Exportación**: Descarga de pedidos autorizados en Excel con cálculo de tarifas

**Pedidos Completados (`/PedidosCompletados`):**
- Vista histórica de pedidos completados
- Filtros por usuario, estados, regionales
- Exportación a Excel
- Acceso solo a usuarios autorizados

**Gestión de Usuarios (`/GestionUsuarios`) - Solo ADMIN:**
- Tabla de usuarios del sistema
- Crear nuevos usuarios:
  - Nombre, usuario, clave, perfil
  - Regional asignada
  - Correo y celular
  - Clientes permitidos (KABI, MEDICAL_CARE o ambos)
- Editar usuarios existentes
- Asignación de clientes por usuario (toggles)
- Búsqueda de usuarios

**Gestión de Tarifas (`/Tarifas`) - Solo ADMIN:**
- Tabla de tarifas de flete
- Filtros: origen fijo (FUNZA), destino variable
- Búsqueda por destino (startsWith para mayor precisión)
- Crear nueva tarifa:
  - Origen, destino
  - Tipos de vehículo dinámicos: CAMIONETA, CARRY, 4X2, 6X2, 6X4, 8X2, 8X4
  - Costos por tipo de vehículo
- Editar tarifas existentes
- Eliminar tarifas

**Portal Medical Care (`/MedicalCare`):**
- Header Fresenius Medical Care con accesos a Pacientes, Pedidos V3 y Cruce
- **Botón "Ocupación por Rutas"**: navega a la página dedicada `/CrucePacientesV3`
- Dropdown de usuario con accesos rápidos: Pacientes, Pedidos V3, Cruce Pacientes ↔ V3
- Protegido: requiere sesión y cliente activo = MEDICAL_CARE

**Cruce Pacientes ↔ V3 (`/CrucePacientesV3`):**
- Página dedicada con el mismo header/menú que GestionPedidosV3 (logo, título, dropdown de usuario)
- **Logo/título clickeable**: navega a `/MedicalCare` (eliminado el botón de flecha separado)
- **Toolbar**: muestra fecha y usuario del último cálculo + filtro por regional + botón Exportar Excel + botón Recalcular
- **Pestaña "Ocupación por Rutas"**: pacientes agrupados por ruta con badge de CEDI, muestra cuántos están en V3 con su % de ocupación. Color del badge: verde ≥80%, amarillo ≥50%, rojo <50%. Expandible por ruta para ver detalle de cada paciente (similitud %, llave V3 más cercana, en V3 sí/no)
- **Pestaña "V3 sin Paciente"**: registros V3 que no tienen paciente coincidente (similitud <80%), agrupados por ruta con badge de CEDI. Muestra código de pedido, cliente, dirección, teléfono, estado y el paciente más cercano. Badge rojo con el total. Carga lazy al primer clic
- **Filtro por regional**: selector "Todas las regionales / BARRANQUILLA / CALI / BUCARAMANGA / FUNZA / MEDELLIN" aplicado a ambas pestañas en tiempo real
- **Exportar Excel**: descarga el cruce completo (o filtrado por regional) con dos hojas; filas coloreadas verde/amarillo/rojo
- **Recalcular**: dispara recálculo SSE con overlay Lottie animado y barra de progreso real (0-100%) con pasos: Cargando datos → Comparando pacientes → Verificando pedidos V3 → Guardando resultados
- Los resultados se leen desde cache en MongoDB (`cache_cruce_mc`); sólo se recalculan al presionar el botón
- Protegido: requiere sesión y cliente activo = MEDICAL_CARE

**Gestión de Pedidos V3 (`/GestionPedidosV3`):**
- Gestión CRUD de pedidos de Medical Care V3
- **Carga masiva desde Excel**: modal con progreso en tiempo real via SSE
- **Tabla de pedidos**: columnas con datos originales (cliente_destino_original, direccion_destino_original), filtro por estado, paginación
- **Filtro por estado**: selector que consulta los estados únicos de la colección
- **Eliminación individual y masiva** (masiva solo ADMIN)
- **Sin buscador de texto**: el filtrado se hace por estado
- **Logo/título clickeable**: navega a `/MedicalCare` (eliminado el botón de flecha separado)
- **Indicador de última sincronización automática**: texto discreto en la toolbar (`⟳ 7 abr 2026 14:32`) que muestra la hora del último sync del backend. Consulta `GET /sync-v3/estado` cada 60s; solo recarga los pedidos si el timestamp cambió
- **Protección**: requiere sesión y cliente activo = MEDICAL_CARE

**Gestión de Pacientes (`/GestionPacientes`):**
- Gestión CRUD completa de pacientes de Medical Care
- **Búsqueda**: por cédula o nombre
- **Control de acceso regional**: perfiles ADMIN, COORDINADOR y ANALISTA ven todos los pacientes; otros perfiles ven solo los de su CEDI (mapeado desde la cookie `regionalPedidosCookie`: CO04=BARRANQUILLA, CO05=CALI, CO06=BUCARAMANGA, CO07=FUNZA, CO09=MEDELLIN). Badge visible cuando el filtro está activo
- **Tabla de pacientes**: muestra los valores **originales** (no normalizados)
  - Columnas: Paciente, Cédula, Dirección, Municipio, **CEDI**, Ruta, **Teléfono 1**, **Teléfono 2**, Estado, Acciones
  - Teléfono 1 muestra `telefono1` (normalizado); Teléfono 2 muestra `telefono2` si existe, `-` si no
  - Badge de color por estado: verde (ACTIVO), amarillo (INACTIVO), rojo (FALLECIDO)
- **Creación**: modal con campos sede, paciente, cédula, dirección, departamento, municipio, ruta, cedi, celular. El backend normaliza, separa en telefono1/telefono2 y genera `llave` automáticamente. Estado inicial: ACTIVO
- **Edición**: carga `celular_original` en el formulario; incluye selector de estado (ACTIVO / INACTIVO / FALLECIDO). Solo visible al editar, no al crear
- **Eliminación individual**: confirmación con SweetAlert2
- **Carga masiva desde Excel**: modal con progreso en tiempo real via SSE. Todos los registros nuevos inician en estado ACTIVO
- **Logo/título clickeable**: navega a `/MedicalCare` (igual que GestionPedidosV3 y CrucePacientesV3)
- **Dropdown de usuario**: accesos rápidos a Pacientes (activo), Pedidos V3, Cruce Pacientes ↔ V3
- **Protección**: requiere sesión y cliente activo = MEDICAL_CARE

### Portal Conductores
Panel para conductores de vehículos:

**Login (`/LoginConductores`):**
- Autenticación con usuario y contraseña
- Cookie de sesión: `conductorId`

**Registro de Conductor (`/RegistroConductor`):**
- Formulario de registro nuevo
- Datos personales, vehículo, licencia
- Validación de campos

**Recuperación de Clave (`/OlvidoClaveConductor`):**
- Verificación de usuario
- Envío de código de seguridad por correo
- Validación de código
- Restablecimiento de contraseña

**Panel del Conductor (`/PanelConductores`):**
- Información personal del conductor
- Lista de vehículos asignados
- Documentación de vehículos:
  - SOAT, tecnomecánica, tarjeta de propiedad
  - Seguro, licencia de conducción
  - Estudios de seguridad
  - Fotos del vehículo
- Firma digital (componente con react-signature-canvas)
- Estado de aprobación de vehículos
- Descarga de hoja de vida en PDF (componente HvVehiculos con @react-pdf)

**Revisión de Vehículo (`/revision`) - Perfil Seguridad:**
- Lista de vehículos pendientes de revisión
- Detalle de cada vehículo
- Subir fotos de seguridad
- Subir estudios de seguridad
- Enviar observaciones
- Aprobar o rechazar vehículo
- Notificaciones automáticas al propietario

### Portal Empleados
Sistema de certificados laborales:

**Certificados Laborales (`/CertificadoLaboralP`):**
- Búsqueda de empleado por cédula
- Vista previa del certificado en PDF
- Opción de incluir o no información salarial
- Envío del certificado por correo
- Generación del PDF con @react-pdf/renderer
- Descarga directa del PDF

### Portal Clientes
Herramientas para diseño y consulta de servicios:

**Portal Clientes (`/PortalClientes`):**
- Diseñador de servicios de transporte
- Selección de origen y destino
- Cálculo de tarifas
- Visualización de rutas
- Solicitud de servicio

### Portal Ventas
Herramientas comerciales:

**Portal Ventas (`/PortalVentas`):**
- Gestión de clientes
- Creación de cotizaciones
- Seguimiento de oportunidades
- Reportes de ventas

### Utilidades y Herramientas

**Descargables (`/descargables`):**
- Descarga del bot de recolecciones (bot_recolecciones.exe)
- Documentación de uso

**Indicadores (`/indicadores`):**
- Dashboard PowerBI embebido (iframe)
- Métricas de operación Kabi

**Indicadores FMC (`/indicadoresfmc`):**
- Dashboard PowerBI embebido (iframe)
- Métricas de operación Medical Care

**API2 (`/Api2`):**
- Página de prueba de autenticación con Vulcano
- Herramientas de debugging
- No es producción

**Registro de Propietario (`/Registro`):**
- Formulario de registro para nuevos propietarios
- Validación de datos
- Envío al backend

**Olvido de Clave (`/olvidoclave`):**
- Recuperación de contraseña para propietarios
- Envío de enlace con token al correo

**Recuperación de Clave (`/recuperar-clave`):**
- Confirmación de nueva contraseña con token
- Validación de token del enlace del correo
- Actualización de contraseña en backend

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
│   │   │   └── page.tsx
│   │   ├── InicioPropietarios/     # Dashboard propietario (requiere auth)
│   │   │   └── page.tsx
│   │   ├── SalaEspera/             # Extracción de datos de la API
│   │   │   └── page.tsx
│   │   ├── SeleccionEstados/       # Selección: ACTIVOS / PAGADOS / DEVUELTOS
│   │   │   └── page.tsx
│   │   ├── Estados/                # Vista de manifiestos por estado
│   │   │   └── page.tsx
│   │   ├── Novedad/                # Registro de novedades con foto
│   │   │   └── page.tsx
│   │   ├── DetalleEstados/         # Detalle de un manifiesto
│   │   │   └── page.tsx
│   │   │
│   │   ├── LoginUsuario/           # Login Torre de Control — flujo 2 pasos
│   │   │   └── page.tsx
│   │   ├── LoginUsuariosSeguridad/ # Login perfil seguridad
│   │   │   └── page.tsx
│   │   ├── Pedidos/                # Gestión de pedidos Fresenius Kabi
│   │   │   └── page.tsx
│   │   ├── PedidosCompletados/     # Vista de pedidos completados Kabi
│   │   │   └── page.tsx
│   │   ├── MedicalCare/            # Portal Fresenius Medical Care
│   │   │   └── page.tsx
│   │   ├── GestionPacientes/      # Gestión CRUD de pacientes Medical Care (col. CEDI + filtro regional)
│   │   │   ├── page.tsx
│   │   │   └── estilos.css
│   │   ├── GestionPedidosV3/       # Gestión de pedidos Medical Care V3
│   │   │   └── page.tsx
│   │   ├── CrucePacientesV3/       # Página dedicada de cruce Pacientes ↔ V3
│   │   │   └── page.tsx
│   │   ├── GestionUsuarios/        # Panel ADMIN: gestión de usuarios
│   │   │   └── page.tsx
│   │   ├── Tarifas/               # Gestión de tarifas de flete
│   │   │   └── page.tsx
│   │   │
│   │   ├── LoginConductores/       # Login conductores
│   │   │   └── page.tsx
│   │   ├── RegistroConductor/      # Registro de conductor
│   │   │   └── page.tsx
│   │   ├── OlvidoClaveConductor/  # Recuperación clave conductor
│   │   │   └── page.tsx
│   │   ├── PanelConductores/       # Panel del conductor
│   │   │   └── page.tsx
│   │   ├── revision/               # Revisión del vehículo (inspector)
│   │   │   └── page.tsx
│   │   │
│   │   ├── PortalClientes/         # Portal de clientes
│   │   │   └── page.tsx
│   │   ├── PortalVentas/           # Portal de ventas
│   │   │   └── page.tsx
│   │   ├── CertificadoLaboralP/    # Certificados laborales
│   │   │   └── page.tsx
│   │   │
│   │   ├── Registro/               # Registro de propietario
│   │   │   └── page.tsx
│   │   ├── olvidoclave/            # Olvido clave propietario
│   │   │   └── page.tsx
│   │   ├── recuperar-clave/        # Recuperación con token
│   │   │   └── page.tsx
│   │   │
│   │   ├── indicadores/            # Dashboard PowerBI 1
│   │   │   └── page.tsx
│   │   ├── indicadoresfmc/         # Dashboard PowerBI 2
│   │   │   └── page.tsx
│   │   ├── descargables/           # Descarga del bot de recolecciones
│   │   │   └── page.tsx
│   │   └── Api2/                  # Página de prueba autenticación Vulcano
│   │       └── page.tsx
│   │
│   ├── Componentes/                # Componentes reutilizables (todos con 'use client')
│   │   ├── Barra/                  # Barra de progreso
│   │   ├── BotonEstados/          # Botón para selección de estados
│   │   ├── BotonSencillo/         # Botón simple reutilizable
│   │   ├── CargaDocumento/         # Upload de archivos con preview
│   │   ├── CertificadoLaboralC/    # Renderizador PDF certificado laboral
│   │   ├── ClientProviders/        # GoogleOAuthProvider + ContextoApp wrapper
│   │   ├── ContenedorTarjetas/     # Contenedor de tarjetas
│   │   ├── Datos/                  # Selector de municipios colombianos
│   │   ├── DisenoServicio/         # Diseñador de servicios
│   │   ├── FiltradoPlacas/         # Búsqueda y filtro de vehículos
│   │   ├── FotoNovedad/            # Captura/subida de foto para novedades
│   │   ├── HeaderIcono/            # Header con icono
│   │   ├── HeaderLogo/             # Header con logo
│   │   ├── HvVehiculos/            # Generación de PDF hoja de vida vehículo
│   │   ├── LoginGoogle/            # Botón OAuth Google
│   │   ├── Municipios/             # JSON con municipios de Colombia
│   │   ├── PedidosComponentes/     # Subcomponentes del módulo de pedidos:
│   │   │   ├── CargarPedidos       #   Subida masiva de Excel
│   │   │   ├── TablaPedidos        #   Tabla con autorización / eliminación
│   │   │   ├── TablaPedidosCompletados
│   │   │   ├── ExportarAutorizados
│   │   │   ├── importarPedidosVulcano
│   │   │   ├── ImportarExcelMedicalCare    # Importación de pacientes Medical Care
│   │   │   ├── FabMedicalCare             # FAB Speed Dial Medical Care
│   │   │   └── TablaPacientesMedicalCare # Tabla de pacientes importados
│   │   ├── PortalClientesComp/     # Componentes portal clientes
│   │   ├── PortalVentasComp/       # Componentes portal ventas
│   │   ├── TarjetaDetalle/         # Tarjeta de detalle
│   │   ├── TarjetaResumen/         # Tarjeta de resumen
│   │   └── VerDocumento/           # Visor de documentos (PDF/imagen)
│   │
│   ├── Contexto/
│   │   └── index.tsx               # ContextoApp: estado global compartido
│   │                               # Variables: nombre, tenedor, placa, estado, link,
│   │                               #   DiccionarioManifiestosTodos, DiccionarioSaldos, etc.
│   │
│   ├── Paginas/                    # Componentes de página cargados dinámicamente (ssr: false)
│   │   ├── MedicalCareP/           # Portal Medical Care (header, accesos)
│   │   │   ├── index.tsx
│   │   │   └── estilos.css
│   │   ├── GestionPedidosV3P/      # Gestión de pedidos V3 con carga masiva SSE
│   │   │   ├── index.tsx
│   │   │   └── estilos.css
│   │   └── CrucePacientesV3P/      # Cruce Pacientes ↔ V3: filtro regional, Excel, Lottie SSE
│   │       ├── index.tsx
│   │       └── estilos.css
│   │
│   ├── Funciones/                  # Capa de integración con la API
│   │   ├── ApiPedidos/             # Funciones API de pedidos:
│   │   │   ├── apiPedidos.tsx      # CRUD completo de pedidos
│   │   │   ├── clientes.tsx        # CRUD clientes
│   │   │   ├── fletes.tsx          # CRUD tarifas de flete
│   │   │   ├── usuarios.tsx        # Login y gestión de usuarios
│   │   │   ├── tipos.tsx           # Interfaces TypeScript (pedidos Kabi)
│   │   │   ├── apiMedicalCare.tsx  # API Medical Care: pacientes, cruce SSE, exportar Excel
│   │   │   └── tiposMedicalCare.tsx # Interfaces TypeScript Medical Care (pacientes, V3, cruce)
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
│   ├── bot_recolecciones.exe       # App Electron descargable
│   ├── albatros192.png            # Iconos favicon
│   ├── albatros512.png
│   └── favicon.ico
│
├── next.config.mjs                 # Configuración Next.js
├── tsconfig.json                   # Configuración TypeScript
├── .env.local                      # Variables de entorno (no subir al repo)
└── package.json                    # Dependencias npm
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

> Al cerrar sesión desde cualquier página de la Torre de Control se eliminan las cinco cookies: `usuarioPedidosCookie`, `regionalPedidosCookie`, `perfilPedidosCookie`, `clientePedidosCookie` y `seguridadId`.

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

## Sistema de Diseño

Aplicado a todos los portales para consistencia visual:

- **Header**: gradiente navy `linear-gradient(90deg, #0f1928, #1e2f45)`, altura 64 px
- **Acento**: amber `#e8a000`
- **Fondo general**: `#f0f2f5`
- **Footer**: `#0f1928`
- Cada página usa prefijo CSS único para evitar colisiones:
  - `IP-` (InicioPropietarios)
  - `LU-` (LoginUsuario)
  - `CLP-` (CertificadoLaboralP)
  - `Ped-` (Pedidos)
  - `PC-` (PedidosCompletados)
  - `MC-` (MedicalCare)
  - `GU-` (GestionUsuarios)
  - `TAR-` (Tarifas)
  - `LC-` (LoginConductores)
  - `PC-` (PanelConductores)
  - `REV-` (Revision)

---

## Componentes Principales

### Tabla de Pedidos
- Cabecera navy con filas zebra
- Hover effects en filas
- Columnas `Total Solicitado` y `Total Teórico` siempre resaltadas en navy+amber
- Botones de acción: autorizar, confirmar preautorizado, eliminar
- Paginación para grandes volúmenes
- Filtros por estados y regionales

### FAB Speed Dial
- Botón flotante en `/Pedidos` con acciones rápidas
- Iconos para: cargar, exportar, importar
- Componentes montados fuera de pantalla (`position: fixed; left: -9999px`)
- Click programático sobre botones internos

### Generación de PDF
- `HvVehiculos`: Hoja de vida de vehículo con @react-pdf
- `CertificadoLaboralC`: Certificados laborales
- Opción de descarga directa o envío por correo

### Gestión de Documentos
- `CargaDocumento`: Upload con preview
- `VerDocumento`: Visor de PDF e imágenes
- Soporte para múltiples formatos: PDF, JPG, PNG, WEBP

### Firma Digital
- `react-signature-canvas` para capturar firmas
- Limpieza de canvas
- Guardado en base64
- Envío al backend

---

## Funciones API Principales

### ApiPedidos
- `crearPedido()`: Crear nuevo pedido
- `obtenerPedidos()`: Listar pedidos con filtros
- `cargarPedidosMasivo()`: Carga desde Excel
- `autorizarPedidos()`: Autorizar pedidos
- `confirmarPreautorizados()`: Confirmar preautorizados
- `eliminarPedidos()`: Eliminar pedidos
- `exportarAutorizados()`: Exportar a Excel
- `fusionarVehiculos()`: Fusionar vehículos
- `dividirVehiculo()`: Dividir vehículo
- `ajustarVehiculos()`: Ajustar totales

### Usuarios
- `loginBaseusuario()`: Login Torre de Control
- `loginSeguridad()`: Login perfil seguridad
- `loginConductor()`: Login conductor
- `obtenerUsuarios()`: Listar usuarios
- `crearUsuario()`: Crear usuario
- `actualizarUsuario()`: Actualizar usuario
- `actualizarClientesUsuario()`: Asignar clientes
- `eliminarUsuario()`: Eliminar usuario

### Fletes
- `obtenerFletes()`: Listar tarifas
- `crearFlete()`: Crear tarifa
- `actualizarFlete()`: Actualizar tarifa
- `eliminarFlete()`: Eliminar tarifa

### Clientes
- `obtenerClientes()`: Listar clientes
- `crearCliente()`: Crear cliente
- `actualizarCliente()`: Actualizar cliente

### Medical Care (apiMedicalCare.tsx)
- **`cargarPacientesMasivoStream(usuario, archivo, onProgress)`**: Importación masiva con progreso en tiempo real via Server-Sent Events (SSE)
  - Lee el stream de eventos del backend y actualiza el estado de progreso
  - Envia `usuario` como query string (no en FormData) para evitar error 422
  - Callback `onProgress` recibe objetos con `stage`, `progress`, `message`, `processed`, `total`, `errores`
  - Maneja errores de parseo SSE y muestra alertas con SweetAlert2
- **`obtenerPacientes(skip, limit)`**: Obtener lista de pacientes con paginación
- **`buscarPacientes(cedula?, paciente?)`**: Búsqueda por cédula o nombre de paciente
- **`eliminarTodosPacientes(usuario)`**: Eliminar todos los pacientes (solo ADMIN)
- **`crearPaciente(usuario, pacienteData)`**: Crear un nuevo paciente individual
- **`actualizarPaciente(pacienteId, usuario, pacienteData)`**: Actualizar un paciente existente
- **`eliminarPaciente(pacienteId, usuario)`**: Eliminar un paciente individual
- **`obtenerPacientePorId(pacienteId)`**: Obtener un paciente por ID

**Normalización de Datos (Backend - integrappi/Funciones/normalizacion_medical_care.py):**
- **`fx_normalizar_paciente()`**: Normaliza nombres de pacientes
  - Elimina caracteres especiales (comas, puntos, guiones, etc.)
  - Mayúsculas y compactar espacios
  - **Reordenamiento alfabético** de todas las palabras
  - Primeras 4 palabras del resultado
  - Ejemplo: "Zarate Edwin" → "EDWIN ZARATE"
- **`fx_normalizar_direccion()`**: Normaliza direcciones completas
  - Elimina signos de puntuación
  - Corrige errores comunes: "CAKLE" → "CALLE", "CARREA" → "CARRERA", "TRASVERSAL" → "TRANSVERSAL"
  - Normaliza abreviaturas: "KRA" → "CARRERA", "CLL" → "CALLE", "TV" → "TRANSVERSAL"
  - **Reordenamiento alfabético** de todas las palabras
  - Ejemplo: "CALLE 123 BARRIO CENTRO" → "123 BARRIO CALLE CENTRO"
- **`fx_normalizar_celular()`**: Solo últimos 10 dígitos, elimina prefijos de país
- **`fx_normalizar_municipio()`**: Mayúsculas, trim, compactar espacios (sin caracteres especiales, sin reordenamiento)
- **`fx_normalizar_cedula()`**: Solo dígitos, elimina caracteres no numéricos
- **`fx_normalizar_base()`**: Normalización básica para campos de ubicación (sede, departamento, CEDI, ruta)
  - Elimina caracteres especiales
  - Mayúsculas y compactar espacios
  - **Corrige caracteres mal codificados (UTF-8 leído como Latin-1)**: `Ã³` → `O`, `Ãº` → `U`, `Ã¡` → `A`, `Ã©` → `E`, `Ã­` → `I`, `Ã‘` → `N`, etc.
  - Sin reordenamiento alfabético

**Nota sobre Reordenamiento Alfabético:**
- El reordenamiento alfabético se aplica a **pacientes** y **direcciones** para consistencia en búsquedas
- Este cambio permite que "Zarate Edwin" se encuentre al buscar "Edwin Zarate"
- Las direcciones también se reordenan, aunque esto pueda cambiar la estructura original
- Los campos de ubicación (sede, departamento, municipio, CEDI, ruta) NO se reordenan

**Nota sobre Corrección de Caracteres Mal Codificados:**
- El sistema corrige automáticamente caracteres UTF-8 que fueron leídos incorrectamente como Latin-1
- Ejemplos de corrección: `Ã³` → `O`, `Ãº` → `U`, `Ã¡` → `A`, `Ã©` → `E`, `Ã­` → `I`, `Ã‘` → `N`, `Ã"ON` → `ON`, etc.
- Esta corrección se aplica a TODOS los campos (pacientes, direcciones, municipio, sede, departamento, CEDI, ruta)

**Tipos TypeScript (tiposMedicalCare.tsx):**
- `PacienteMedicalCare`: Interfaz completa de paciente con campos originales y normalizados. Incluye `telefono1?: string` y `telefono2?: string`
- `CrearActualizarPacienteData`: Interfaz para crear/actualizar pacientes (campos originales)
- `CargarPacientesResponse`: Interfaz de respuesta de carga masiva
- `ProgressEvent`: Interfaz de eventos de progreso SSE

### Pedidos V3 (apiPedidosV3.tsx)
- **`cargarPedidosV3Stream(usuario, archivo, onProgress)`**: Importación masiva de pedidos con progreso en tiempo real via Server-Sent Events (SSE)
  - Lee el stream de eventos del backend y actualiza el estado de progreso
  - Envia `usuario` como query string (no en FormData) para evitar error 422
  - Callback `onProgress` recibe objetos con `stage`, `progress`, `message`, `processed`, `total`, `errores`
  - Maneja errores de parseo SSE y muestra alertas con SweetAlert2
- **`obtenerPedidosV3(skip, limit)`**: Obtener lista de pedidos con paginación
- **`eliminarTodosPedidosV3(usuario)`**: Eliminar todos los pedidos (solo ADMIN)
- **`crearPedidoV3(usuario, pedidoData)`**: Crear un nuevo pedido individual
- **`actualizarPedidoV3(pedidoId, usuario, pedidoData)`**: Actualizar un pedido existente
- **`eliminarPedidoV3(pedidoId, usuario)`**: Eliminar un pedido individual
- **`obtenerPedidoV3PorId(pedidoId)`**: Obtener un pedido por ID

**Normalización de Datos (Backend - integrappi/Funciones/normalizacion_medical_care.py):**
- **Solo se normalizan dos campos específicos**:
  - `cliente_destino`: Usa `fx_normalizar_paciente()` - Primeras 4 palabras, sin signos de puntuación, mayúsculas, reordenamiento alfabético
    - Ejemplo: "Zarate Edwin" → "EDWIN ZARATE"
  - `direccion_destino`: Usa `fx_normalizar_direccion()` - Normalización completa con corrección de errores comunes, reordenamiento alfabético
    - Ejemplo: "CALLE 123 BARRIO CENTRO" → "123 BARRIO CALLE CENTRO"
    - Corrige errores comunes: "CAKLE" → "CALLE", "CARREA" → "CARRERA", "TRASVERSAL" → "TRANSVERSAL"
    - Normaliza abreviaturas: "KRA" → "CARRERA", "CLL" → "CALLE", "TV" → "TRANSVERSAL"
- **Los demás campos se guardan tal cual vienen del Excel**: Sin normalización
  - `codigo_pedido`, `codigo_cliente_destino`, `divipola`, `telefono`, `fecha_pedido`, `fecha_preferente`, `estado_pedido`, `piezas`, `peso_real`, `bodega_origen`, `ruta`, `municipio_destino`

**Tabla de Pedidos:**
- Muestra los campos normalizados y originales para trazabilidad
- **Columnas visibles**:
  - **Acciones**: botones para editar y eliminar pedidos
  - **Código Pedido**: valor original del Excel
  - **Cliente Destino**: muestra valor normalizado y original con etiquetas visuales
  - **Dirección Destino**: muestra valor normalizado y original con etiquetas visuales
  - **DESTINO**: valor original del Excel (solo muestra `municipio_destino` sin normalización)
  - **Ruta**: valor original del Excel
  - **Teléfono**: valor original del Excel
  - **Fecha Pedido**: valor original del Excel
  - **Fecha Preferente**: valor original del Excel
  - **Estado Pedido**: valor original del Excel
  - **Cajas**: valor original del Excel (corresponde al campo `piezas`)
  - **Peso**: valor original del Excel (corresponde al campo `peso_real`)
- **Estilos visuales**:
  - Campos normalizados: texto regular en color verde oscuro
  - Campos originales: texto en cursiva, color gris, con fondo gris claro
  - Etiquetas "Normalizado:" y "Original:" para distinguir claramente los valores
- **Responsive**: La tabla tiene scroll horizontal para manejar las múltiples columnas

**Tipos TypeScript (apiPedidosV3.tsx):**
- `CargarPedidosV3Response`: Interfaz de respuesta de carga masiva
- `ObtenerPedidosV3Response`: Interfaz de respuesta de listado con paginación
- `ProgressEvent`: Interfaz de eventos de progreso SSE

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
  - Home rediseñada: se eliminaron secciones vacías (NOSOTROS, SERVICIOS, etc.)
  - Portales reducidos a 3: Transportadores, Empleados, Torre de Control

---

## Historial de cambios relevantes

### Marzo 2025 — Rediseño visual y sistema de diseño unificado

**Sistema de diseño** aplicado a todos los portales:
- Header: gradiente navy `linear-gradient(90deg, #0f1928, #1e2f45)`, altura 64 px
- Acento amber `#e8a000`, fondo general `#f0f2f5`, footer `#0f1928`
- Cada página usa prefijo CSS único para evitar colisiones

**Páginas rediseñadas** con header + footer consistentes:
- `/loginpropietarios` (`InicioPropietarios`) — prefijo IP-
- `/LoginUsuario` (`LoginUsuarios`) — prefijo LU-
- `/CertificadoLaboralP` — prefijo CLP-
- `/Pedidos` — prefijo Ped-, FAB speed dial para acciones
- `/PedidosCompletados` — prefijo PC-

### Marzo 2025 — Multi-cliente (Fresenius Kabi + Fresenius Medical Care)

**Login de dos pasos** (`/LoginUsuario`):
1. Usuario ingresa credenciales → backend devuelve `clientes: string[]`
2. Si tiene un solo cliente → redirige directo; si tiene dos → muestra selector de tarjetas
3. El cliente elegido se guarda en `clientePedidosCookie` y redirige a `/Pedidos` (KABI) o `/MedicalCare` (MEDICAL_CARE)

**Nueva página `/MedicalCare`**: header verde Fresenius Medical Care, placeholder "en construcción", protegida.

**Panel de administración** (solo perfil ADMIN):
- `/GestionUsuarios`: tabla de usuarios con toggles por cliente + modal para crear usuarios
- `/Tarifas`: tabla de tarifas filtrada a origen FUNZA, buscador por destino, modal para crear/editar

**Funciones API nuevas**:
- `usuarios.tsx`: `actualizarClientesUsuario(id, clientes)`
- `fletes.tsx`: CRUD completo de tarifas
- `tipos.tsx`: `BaseUsuario` y `LoginRespuesta` con campo `clientes: string[]`

### Marzo 2025 — Corrección buscador de tarifas (`/Tarifas`)

- **Filtro `startsWith` en lugar de `includes`**: muestra filas cuyo destino *comienza* con el texto buscado
- **`useMemo` en `colsVehiculo` y `tarifasFiltradas`**: ambos valores se memorizan para consistencia
- **`key={busqueda}` en `<tbody>`**: fuerza reconstrucción completa al cambiar el filtro

---

## Pendientes / notas para retomar

- [ ] El error de OneDrive + symlinks se resuelve moviendo el proyecto a una ruta local fuera de OneDrive (ej: `C:/Desarrollos/integra/integrapp-next/`)
- [ ] `PortalClientes` y `PortalVentas` existen como rutas pero no están enlazadas desde la home — evaluar si se activan o eliminan
- [ ] `Api2` es una página de prueba de autenticación con Vulcano, no es producción
- [ ] `bot_recolecciones.exe` en `/public` es una app Electron para gestión de recolecciones — pendiente integración completa
- [ ] Agregar `sharp` para optimización de imágenes en producción: `npm i sharp`
- [ ] `/MedicalCare` portal funcional con módulos: Pacientes, Pedidos V3, Cruce Pacientes ↔ V3. Pendiente: integración con API real (actualmente consume Excel local via sync automático)
- [ ] Implementar autenticación Google OAuth para los portales que lo requieran
- [ ] Mejorar responsive design para móviles y tablets
- [ ] Implementar sistema de notificaciones en tiempo real con Firebase
- [ ] Agregar tests unitarios y de integración con Jest y React Testing Library
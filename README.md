# Integra App - Frontend (Next.js 14)

Sistema de gestión de pedidos y pacientes Medical Care.

## Características Principales

### Gestión de Usuarios (`/integrapp/GestionUsuarios`)
- CRUD de usuarios
- Asignación de perfiles: ADMIN, ANALISTA, COORDINADOR, OPERADOR, CONTROL, DESPACHADOR, etc.
- Asignación de clientes por usuario (KABI, MEDICAL_CARE)
- Gestión de notificaciones Medical Care
- Edición de datos de usuario (nombre, correo, regional, celular, clave, usuario)

### Cruce de Pacientes V3 (`/integrapp/CrucePacientesV3`)
- Cruce entre pacientes Medical Care y pedidos V3
- Ocupación de rutas con indicadores visuales
- V3 sin paciente clasificado por:
  - Sin paciente (similitud < 75%)
  - Zona gris (similitud ≥ 75% pero no reclamado)
  - Sin datos (llave vacía)
- Histórico de cruces por mes
- Recálculo con progreso en tiempo real (SSE)
- Filtros por estado, ruta y regional
- Leyendas clickeables para filtrar por estado
- Carga inicial de datos de V3 sin paciente

### Gestión de Pedidos V3 (`/integrapp/GestionPedidosV3`)
- Listado de pedidos V3 con paginación
- Edición y eliminación de pedidos
- Exportación a Excel (respeta filtro de regional)
- Sincronización desde API Siscore
- Filtro por estado de pedido
- Columna de Regional visible (basada en `bodega_origen`)

### Solicitud de Vehículos (`/integrapp/SolicitudVehiculos`)
- Consulta de planillas en API de Siscore V3
- Búsqueda múltiple de planillas (separadas por coma)
- Rango de consulta automático: 40 días hábiles hacia atrás
- Cálculo de días hábiles excluyendo fines de semana y festivos de Colombia
- Resultados con formato colombiano de números (ej: 2.489,00)
- Filtrado por regional según perfil:
  - **ADMIN, COORDINADOR, CONTROL, ANALISTA**: Ven todas las regionales
  - **OPERATIVO**: Solo ve su regional asignada
- Conversión especial: CO07/FUNZA se envía como "FUNZA - SAN DIEGO 7G" a la API
- Animación de carga con camión durante consulta
- Tiempo de consulta visible al finalizar
- Tabla de resultados con indicadores visuales de encontrado/no encontrado

## Permisos por Perfil

### ADMIN
- Acceso total a todas las funcionalidades
- Puede ver todas las regionales
- Puede editar usuarios (botón de lápiz habilitado)
- Botón "Actualizar V3" disponible

### ANALISTA
- Puede ver todas las regionales
- Todas las funcionalidades de visualización
- No puede editar usuarios

### COORDINADOR
- Puede ver todas las regionales
- Todas las funcionalidades de visualización
- No puede editar usuarios

### OPERADOR
- **Solo ve su regional asignada** (filtro automático por `bodega_origen`)
- No tiene filtro de regional visible en CrucePacientesV3
- No tiene botón "Actualizar V3"
- Exportación de Excel limitada a su regional

## Filtros de Regional

Los OPERADORES están automáticamente restringidos a ver datos de su regional:

- **CrucePacientesV3:** Filtro automático por CEDI, sin UI visible
- **GestionPedidosV3:** Filtro por campo `bodega_origen` (CO04=BAQ, CO05=CALI, CO06=BGA, CO07=FUNZA, CO09=MED)

Mapeo de códigos de bodega a regionales:
- `CO04` → BARRANQUILLA
- `CO05` → CALI
- `CO06` → BUCARAMANGA
- `CO07` → FUNZA
- `CO09` → MEDELLIN

## Estado Visual de Pacientes

Indicadores de prioridad en CrucePacientesV3:

1. 🔴 **Retraso operación** - Prioridad máxima (≤3 días hábiles, estado POR PROGRAMAR)
2. 🟢 **Con tiempo** - Más de 6 días hábiles
3. 🟡 **Gestionar** - Entre 3-6 días hábiles (POR PROGRAMAR)
4. 🔵 **Gestionado** - Estado diferente a POR PROGRAMAR
5. ⚪ **Sin cruce** - No tiene pedidos V3 asociados

## Tecnologías

- **Frontend:** Next.js 14 (App Router), TypeScript, React
- **UI:** Tailwind CSS, SweetAlert2, FontAwesome
- **Backend:** FastAPI, Python 3.13
- **Base de datos:** MongoDB
- **Notificaciones:** WhatsApp Cloud API, Resend (email)
- **Excel:** openpyxl

## Actualizaciones Recientes (2026-05-08)

- **Nuevo módulo Solicitud de Vehículos**: Consulta de planillas en Siscore V3
  - Rango de 40 días hábiles hacia atrás
  - Formato colombiano de números (separador de miles)
  - Filtrado por regional según perfil
  - Conversión especial: CO07 → "FUNZA - SAN DIEGO 7G"
  - Incluye pedidos manuales en la consulta
  - Animación de carga con camión
  - Tiempo de consulta visible

## Actualizaciones Recientes (2026-05-06)

- Implementado filtro por regional para OPERADORES en CrucePacientesV3 y GestionPedidosV3
- Agregada columna "Regional" en GestionPedidosV3 basada en campo `bodega_origen`
- Optimizado backend para filtrar por `bodega_origen` en lugar de cruzar rutas
- Exportación de Excel ahora respeta filtro de regional
- Corregidos contadores y resúmenes para actualizarse según filtro aplicado
- Datos de "V3 sin paciente" ahora cargan al inicio (no solo al cambiar de pestaña)
- Habilitada edición de nombre de usuario en GestionUsuarios

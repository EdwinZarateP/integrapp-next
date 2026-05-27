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
- **Fusión de planillas**: Seleccionar múltiples planillas y fusionarlas
  - Números concatenados: "846476-846256"
  - Selección de causal mediante dropdown
  - Cálculo automático de tarifa según peso total
  - Causal guardada en planilla fusionada
- **Sistema de cuatro estados con aprobación diferenciada**:
  - **PREAPROBADO** (gris): Total ≤ teórico
  - **REQUIERE_APROBACION_COORDINADOR** (amarillo): Total > teórico, diferencia ≤ 7%
  - **REQUIERE_APROBACION_CONTROL** (rojo): Total > teórico, diferencia > 7%
  - **APROBADO** (verde): Aprobado por coordinador/control/admin
  - **SIN TARIFA** (gris oscuro): Flete teórico = $0 (caso especial, solo fila gris, sin badge)
- **Reglas de aprobación por perfil**:
  - **ADMIN**: Puede aprobar todo
  - **CONTROL**: Puede aprobar todo (coord. y control)
  - **COORDINADOR**: Solo puede aprobar REQUIERE_APROBACION_COORDINADOR (≤ 7%)
  - **ANALISTA, OPERATIVO**: No pueden aprobar
- **Edición de planillas**:
  - Campos editables: tarifa_base, requiere_descargue, punto_adicional, desvio, aforo, placa, tipo_veh_sicetac
  - Causal OBLIGATORIA si hay sobrecosto (total > teórico)
  - Causal opcional si no hay sobrecosto (total ≤ teórico)
  - Auto-limpieza de causal al eliminar sobrecosto
  - Recálculo automático de estado al guardar
- **División de planillas fusionadas**: Recupera planillas originales desde `fusion_info`
- **Eliminación de planillas**: Botón de basura elimina de MongoDB con trazabilidad de usuario
- **Exportación a Excel**: Incluye columna "Observaciones" con causal de modificación
- **Filtro de estados**: Dropdown al lado del título "Resultados" para filtrar por:
  - Todos los estados
  - Preaprobado
  - Coordinador (≤7%)
  - Control (>7%)
  - Aprobado
  - Muestra contador de resultados filtrados
- **Consecutivo único**: Columna "Consecutivo" en tabla con formato `REGIONAL-YYYYMMDD-NUMERO`
  - Ejemplo: `FUNZA-20260527-1`
  - Fusión: `FUNZA-20260527-1A`, `FUNZA-20260527-1B`
  - **Generación inteligente**: Usa el número más alto existente + 1
  - Ejemplo: Si existe FUNZA-20260527-3, la nueva planilla será FUNZA-20260527-4
  - Las fusionadas reservan su número base (FUNZA-20260527-1A reserva el número 1)
- **Prevención de búsqueda de planillas fusionadas**:
  - Verificación ANTES de ir a API Siscore (ahorra tiempo)
  - Si buscas una planilla fusionada (ej: 824986), muestra advertencia inmediata
  - Advertencia incluye: consecutivo donde está fusionada y número de planilla fusionada
  - No permite continuar con la búsqueda
- **Carga al recargar página**: Solo muestra planillas activas (excluye `fusionada: true`)

### Medical Care Dashboard (`/integrapp/MedicalCare`)
- Panel principal con acceso a todos los módulos
- **Gestión de Causales** (solo ADMIN):
  - Lista de todas las causales (activas e inactivas)
  - Crear nueva causal con input
  - Editar causal (botón lápiz)
  - Activar/Desactivar causales
  - Inicialización automática de causales por defecto

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

## Actualizaciones Recientes (2026-05-12)

- **Sistema de Causales para Fusión de Planillas**:
  - Fusión de múltiples planillas con números concatenados
  - Dropdown SweetAlert2 para selección de causal
  - Causal guardada en planilla fusionada para auditoría
  - **Gestión de Causales** (MedicalCare, solo ADMIN):
    - Ver todas las causales (activas e inactivas)
    - Crear nuevas causales
    - Editar nombre de causales existentes
    - Activar/Desactivar causales
    - Inicialización automática de causales por defecto
  - Causales por defecto: "lleva paqueteo", "no se consiguio vehiculo"
  - Modal con diseño moderno y UX optimizada

## Actualizaciones Recientes (2026-05-26)

### Sistema de Estados de Aprobación para Planillas

- **Cuatro estados de aprobación** con colores distintivos y badges:
  - **PREAPROBADO** (gris claro): Total ≤ teórico - Badge "PREAPROBADO"
  - **REQUIERE_APROBACION_COORDINADOR** (amarillo): Total > teórico, diferencia ≤ 7% - Badge "COORDINADOR"
  - **REQUIERE_APROBACION_CONTROL** (rojo): Total > teórico, diferencia > 7% - Badge "CONTROL"
  - **APROBADO** (verde): Aprobado por coordinador/control/admin - Badge "APROBADO"
- **Badge de estado** en tabla: Muestra quién debe aprobar (COORDINADOR, CONTROL) o estado actual
- **Regla del 7%**: Diferencia ≤ 7% → Coordinador, > 7% → Control

### Gestión de Causales para Modificaciones

- **Causal OBLIGATORIO** cuando hay sobrecosto (total > teórico)
  - Mensaje de validación con SweetAlert2
  - Borde rojo en campo cuando falta causal
- **Causal opcional** cuando no hay sobrecosto (total ≤ teórico)
  - Texto verde indicando que es opcional
- **Auto-limpieza**: La causal se elimina automáticamente si el total vuelve a ser ≤ teórico
- **Validación en tiempo real**: Calcula sobrecosto con valores actuales del formulario

### Trazabilidad Completa de Planillas

**Frontend envía usuario al backend**:
- `usuario_modificacion`: Se obtiene de cookie `usuarioPedidosCookie`
- Se envía en cada actualización de planilla para auditoría

**Trazabilidad registrada**:
- **Usuario Registro**: Quién consultó/registró la planilla inicialmente
- **Usuario Modificación**: Quién editó la planilla por última vez
- **Fecha Modificación**: Cuándo se realizó la última edición
- **Usuario Solicitud Autorización**: Quién hizo el cambio que requirió aprobación
- **Fecha Solicitud Autorización**: Cuándo se solicitó autorización
- **Aprobado Por**: Quién aprobó la planilla
- **Fecha Aprobación**: Cuándo se aprobó

**Historial de cambios** (backend):
- Array con todas las modificaciones realizadas
- Cada entrada incluye: fecha, usuario, acción, campos modificados, valores anterior/nuevo

### Mejoras Visuales y de UX

- **Colores de estado corregidos**: PREAPROBADO ahora muestra fondo blanco
- **SweetAlert sobre modal**: z-index corregido para que los mensajes aparezcan encima del formulario
- **Icono FaCheck**: Agregado a los imports para validaciones visuales
- **Columna "Observaciones"**: Muestra la causal de modificación en la tabla

### Persistencia en MongoDB

- **Fusión de planillas**: Las planillas originales se eliminan de MongoDB
- **División de planillas**: La planilla fusionada se elimina al dividir
- **Recálculo de estado**: Cualquier modificación resetea el estado según el nuevo total

### Recálculo de Estado al Editar

- **Cálculo explícito**: Usa valores de `tempEdicion` para evitar datos obsoletos
- **Estado APROBADO**: Se mantiene al editar si ya estaba aprobado
- **Estado PREAPROBADO**: Se establece cuando total ≤ teórico
- **Estado REQUIERE_APROBACION**: Se establece cuando total > teórico

### Exportación a Excel

- **Columnas de trazabilidad**: Usuario Registro, Usuario Modificación, Fecha Modificación, Usuario Solicitud Aut., Fecha Solicitud Aut., Aprobado Por, Fecha Aprobación
- **Columna "Observaciones"**: Muestra la causal de modificación
- **Encabezados actualizados**: "Flete Base" en lugar de "Flete Solicitado"

## Actualizaciones Recientes (2026-05-27)

### Prevención de Búsqueda de Planillas Fusionadas

- **Verificación ANTES de consultar Siscore**:
  - Nuevo endpoint `/siscore/verificar-planillas-fusionadas`
  - Verifica en MongoDB si las planillas están marcadas como `fusionada: true`
  - Evita perder tiempo consultando la API externa si la planilla ya está fusionada
- **Advertencia inmediata al usuario**:
  - Muestra SweetAlert con lista de planillas fusionadas encontradas
  - Incluye el consecutivo donde está fusionada (ej: FUNZA-20260527-1A)
  - Muestra el número de planilla fusionada (ej: 842058-824986)
  - Indica qué buscar si se necesita ver la planilla fusionada
- **No permite continuar**: La búsqueda se detiene si hay planillas fusionadas

### Corrección en Generación de Consecutivos

- **Problema anterior**: Las planillas nuevas reutilizaban números de fusionadas
- **Solución implementada**:
  - La función `_generar_consecutivo` considera tanto individuales como fusionadas
  - Usa `numero_consecutivo` y `letra_consecutivo` correctamente
  - Busca el número más alto entre TODAS (individuales y fusionadas)
  - Suma 1 para la nueva planilla
- **Ejemplo correcto**:
  - Existen: FUNZA-20260527-1A (fusionada), FUNZA-20260527-3 (individual)
  - Nueva planilla recibe: FUNZA-20260527-4 (no 1, no 2)

### Filtrado de Planillas Fusionadas al Recargar

- **Endpoint `/obtener-resultados-recientes` actualizado**:
  - Excluye documentos con `fusionada: true`
  - Solo muestra planillas activas y fusionadas resultantes
- **Comportamiento al recargar**:
  - Si fusionas 1 y 2 → 1A, al recargar SOLO ves 1A (no 1, no 2)
  - Evita confusión visual con duplicados

### Paradigma de Fusión/División Mejorado

- **Fusión**:
  - Planillas originales se marcan como `fusionada: true` (NO se eliminan)
  - Guardan info de dónde están fusionadas en `fusionada_en`
  - Nueva planilla fusionada se crea normalmente
- **División**:
  - Endpoint `/siscore/dividir-fusion`
  - Reactiva originales (quita marca `fusionada: true`)
  - Elimina planilla fusionada
  - Consecutivos originales se preservan perfectamente

### Correcciones Técnicas

- **TypeScript**: Agregados tipos en parámetros `.map()` para evitar errores `implicitly has an 'any' type`
- **Pydantic**: Nuevo modelo `VerificarFusionadasRequest` sin requerir `fecha_inicio`/`fecha_fin`
- **Consistencia**: Nombres de campos `numero_consecutivo` y `letra_consecutivo` usados correctamente

## Actualizaciones Recientes (2026-05-06)

- Implementado filtro por regional para OPERADORES en CrucePacientesV3 y GestionPedidosV3
- Agregada columna "Regional" en GestionPedidosV3 basada en campo `bodega_origen`
- Optimizado backend para filtrar por `bodega_origen` en lugar de cruzar rutas
- Exportación de Excel ahora respeta filtro de regional
- Corregidos contadores y resúmenes para actualizarse según filtro aplicado
- Datos de "V3 sin paciente" ahora cargan al inicio (no solo al cambiar de pestaña)
- Habilitada edición de nombre de usuario en GestionUsuarios

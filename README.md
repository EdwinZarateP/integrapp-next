# Integra App - Frontend (Next.js 14)

Sistema de gestión de pedidos y pacientes Medical Care.

## ⭐ Modelo de navegación (vigente desde 2026-11-25)

Tras el login, los perfiles multi-módulo aterrizan en el **hub `/Modulos`** (Torre de Control), que concentra TODA la navegación:

- **Sidebar con grupos e ítems directos** (RNDC, Vulcano, Mayasoft, Siscore…), **submenús de portal** (PROGRAMACIÓN → Kabi y «Otros Clientes» con todas sus páginas, filtradas por perfil vía `PERFILES_POR_ITEM_MC/KB` en `src/Funciones/menuModulos.ts`) y grupos OTROS COSTOS / FINANZAS / EN RUTA / ADMINISTRACIÓN. Colapsable a riel de iconos (64px, persistido).
- **Lanzador global** (`Componentes/LanzadorModulos`, en `ClientProviders`): pestaña «MÓDULOS» en el borde izquierdo de TODAS las páginas autenticadas — despliega la misma barra como overlay. No lo ven los micro-portales.
- **Las páginas ya no tienen menú propio**: usan `Componentes/HeaderModulo` (logo + título + usuario + «atrás» al hogar del perfil vía `src/Funciones/hogarPorPerfil.ts`). `NavMedicalCare` fue eliminado; `/MedicalCare` redirige a Solicitud de Vehículos (el portal se llama «Otros Clientes» en el menú).
- **GestionUsuarios** (solo ADMIN): perfiles agrupados con descripciones (`/perfiles-meta`), login por CORREO (campo «usuario» derivado), modal «Notificaciones» unificado.
- **Telemetría general**: pageviews por ruta + acciones clave → `/indicadores/uso-app` (ADMIN).

Detalle por fecha en las secciones «Actualizaciones Recientes» al final del archivo.

## Características Principales

### % Uso del vehículo solicitado (Pedidos, PedidosCompletados, SolicitudVehiculos, HistoricoPedidos)
- Columna «% Uso» = kg reales ÷ tope del tipo solicitado × 100 (topes CARRY 1.000 … TRACTOMULA 34.000, espejo de `TOPES_TIPO_VEH` del backend). Badge con fondo rojo < 80%, verde ≥ 80%, `—` gris sin tipo evaluable.
- Helper compartido `src/Funciones/usoVehiculoSolicitado.ts`; posición a la izquierda de Estado(s) (en Completados, antes de «Flete Solicitado»).
- Filtro «% Uso» (todos / <30% / <80% / ≥80%) en HistoricoPedidos y PedidosCompletados, aplicado al presionar Buscar/Filtrar.
- Orden por columna estilo Excel (clic en el título: asc → desc → original) en HistoricoPedidos y PedidosCompletados (`src/Funciones/ordenTabla.ts`).

### Regionales de la operación (Pedidos y PedidosCompletados)
- La regional vive dentro del consecutivo del vehículo (`CELTA-20260924-M-2026924-ANTIOQUIA-2` → ANTIOQUIA). Filtro con las 15 regionales (ANTIOQUIA … SUR) que se aplica en cliente vía `src/Funciones/regionalVehiculo.ts`; el campo `regional` de los documentos es la bodega, no esta regional.

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
- Columna «% Uso» (badge semáforo) en la tabla de resultados y en la de solicitudes pendientes
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
  - **ANALISTA**: Solo puede aprobar PREAPROBADO → APROBADO (planillas sin sobrecosto; 2026-09-17), incluida la aprobación masiva (que solo toca PREAPROBADO)
  - **OPERATIVO**: No puede aprobar
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
- **Botón flotante (FAB)**: Accesos rápidos para ADMIN y ANALISTA
  - Importar Vulcano: Subir archivo Excel con consecutivos
  - Descargar Excel: Exportar planillas actuales
  - Posición sticky (no sobrepasa el footer)
  - Color naranja con ícono FaFileExport
  - Se cierra al hacer clic fuera
- **Campo `flete_cobrado_fmc`**: Calculado automáticamente como `piezas × $20,000`
  - Se calcula al buscar planillas nuevas y al fusionar
  - Se restaura correctamente desde MongoDB
  - Se almacena junto con los demás campos de la planilla

### Histórico de Pedidos (`/integrapp/HistoricoPedidos`)
- Visualización de planillas que ya pasaron por importación Vulcano
- Filtrado por rango de fechas
- Filtrado por regional para perfiles operativos
- Columna «% Uso» (badge semáforo, también en el modal de detalle), filtro por % de uso y orden por columna
- Exportación a Excel con filtros (incluye «% Uso» decimal con formato porcentaje)
- **Perfiles con acceso**: ADMIN, ANALISTA, CONTROL, COORDINADOR, OPERATIVO

### Configuración Medical Care (`/ConfigMC`)
> (2026-11-25) La pantalla de botones de `/MedicalCare` fue ELIMINADA (redundante con los submenús del hub); la ruta redirige a Solicitud de Vehículos. Sus funciones admin viven acá:
- **Causales de Fusión** (ADMIN/CONTROL): lista de todas las causales (activas e inactivas), crear, editar, activar/desactivar, eliminar — alimenta el dropdown de fusión de Solicitud de Vehículos.
- **Sincronización V3** (ADMIN/CONTROL): estado del sync (activo/pausado) y horarios programados.

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

### FINANCIERO
- **Micro-portal aislado**: aterriza en `/EleccionFinanciero` (elige Otros Costos ⬄ Módulo Financiero)
- En Otros Costos ve las solicitudes con header propio (`HeaderModulo`, con enlace a Estado de Vehículos para el informe bancario)
- Ve únicamente las solicitudes **aprobadas con `tramite_vulcano == "ok"`** y puede **registrar el pago** (y anular si también es ADMIN)
- No tiene acceso a los demás módulos (Solicitud de Vehículos, Histórico de Pedidos, etc.), salvo que tenga además otro rol autorizado
- Puede consultar el **histórico de otros costos** y exportarlo a Excel
- No puede crear ni aprobar solicitudes

### ANALISTA (Otros Costos)
- Rol compartido en MEDICAL_CARE: entra normal y ve Otros Costos + histórico como los demás roles.
- En Otros Costos marca el **trámite Vulcano** (`tramite_vulcano`: ok/pendiente) sobre solicitudes aprobadas; Financiero no puede pagar hasta que el ANALISTA lo deje en "ok".

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

### Sonido de Notificación al Finalizar Consulta

- **Sonido profesional tipo "ding"**: Se reproduce automáticamente cuando termina la consulta de planillas
- **Web Audio API**: Sonido generado dinámicamente sin archivos externos
- **Características**:
  - Frecuencia dinámica: 800Hz → 1200Hz → 800Hz
  - Envelope suave: ataque rápido, decaimiento suave
  - Duración: 400ms (corto y no molesto)
- **Mejora de UX**: El usuario puede saber cuándo terminó la consulta sin mirar la pantalla

### Fallback de Regional del Usuario

- **Problema**: Planillas sin "Bodega Origen" generaban consecutivos como "--20260527-1"
- **Solución**: Usa la regional del usuario cuando la planilla no tiene bodega
- **Lógica de prioridad**:
  1. Regional de la planilla (si es válida: no '-', no 'TODOS', no vacía)
  2. Centro de distribución de la planilla
  3. Centro de costo de la planilla
  4. **Regional del usuario** (fallback principal)
  5. "TODOS" (último recurso)
- **Ejemplo**: Usuario de FUNZA sube planilla sin bodega → `FUNZA-20260527-1` ✓

### Eliminación en Cascada de Planillas Fusionadas

- **Problema**: Al eliminar una planilla fusionada, las originales quedaban "vivas" en MongoDB con `fusionada: true`
- **Solución**: Eliminación automática de planillas originales al eliminar la fusionada
- **Endpoint `/eliminar-planilla` mejorado**:
  - Detecta si la planilla es una fusión (`fusion_info.es_fusionada == true`)
  - Busca planillas con `fusionada: true` que apuntan a esta planilla
  - Elimina las planillas originales primero
  - Elimina la planilla fusionada
- **Respuesta detallada**:
  ```json
  {
    "mensaje": "Planilla 842058-824986 eliminada exitosamente",
    "es_fusionada": true,
    "planillas_eliminadas": ["842058-824986", "842058", "824986"],
    "total_eliminadas": 3
  }
  ```
- **Beneficio**: MongoDB queda limpio, sin "libros vivos" sin propósito

### Aprobación Masiva de Planillas PREAPROBADO

- **Botón "Aprobar"**: Ubicado al lado del botón "Fusionar"
- **Solo para perfiles autorizados**: ADMIN, CONTROL, COORDINADOR
- **Funcionalidad**: Aprobar múltiples planillas PREAPROBADO en una sola acción
- **Usa selectores existentes**: Aprovecha los checkboxes de fusión
- **Filtro automático**: Solo aprueba planillas en estado PREAPROBADO
- **Planillas que requieren autorización**: Deben aprobarse individualmente desde el botón de estado
- **Mensaje de confirmación**: Muestra cantidad de planillas a aprobar y advierte si hay algunas que no se pueden aprobar
- **Progreso visual**: Loader mientras se aprueban, sonido de notificación al terminar

### Recálculo de Estado al Editar Planilla Aprobada

- **Detección automática**: Si se edita una planilla APROBADA, recalcula el estado según nuevos valores
- **Estados posibles al recalcular**:
  - Total ≤ teórico → `PREAPROBADO`
  - Total > teórico, diferencia ≤ 7% → `REQUIERE_APROBACION_COORDINADOR`
  - Total > teórico, diferencia > 7% → `REQUIERE_APROBACION_CONTROL`
- **Advertencia visual**: SweetAlert encima del modal (z-index 99999) con el nuevo estado en color
- **Limpieza de campos**: Si el nuevo estado no es APROBADO, se limpian `aprobado_por` y `fecha_aprobacion`
- **Confirmación requerida**: Usuario debe aceptar advertencia antes de guardar
- **Mensaje de feedback**: Indica si la planilla recuperó un estado diferente

### Manejo de Eventos del Modal de Edición

- **Problema**: Al hacer click en inputs o seleccionar texto, el modal se cerraba inesperadamente
- **Solución implementada**:
  - Overlay (fondo oscuro) ahora cierra con **DOBLE CLICK** en lugar de click simple
  - Contenido bloquea TODOS los eventos que podrían propagarse:
    - Mouse: `onClick`, `onMouseDown`, `onMouseUp`
    - Puntero: `onPointerDownCapture`, `onPointerUpCapture`
    - Formulario: `onSelect`, `onInput`, `onChange`
    - Contexto: `onContextMenu`
  - Permite selección de texto: `userSelect: 'text'`
- **Beneficio**: Los inputs funcionan normalmente sin cerrar el modal

### Validación de Fusión de Planillas Fusionadas

- **Problema**: Intentar fusionar una planilla ya fusionada crearía fusiones anidadas (desastre)
- **Validación implementada**:
  - Detecta planillas fusionadas de dos formas:
    - Tiene `fusion_info.es_fusionada === true`
    - Número de planilla contiene guiones (ej: "842058-824986")
  - Bloquea la fusión y muestra instrucciones claras
- **Mensaje al usuario**:
  ```
  ⚠️ Planillas Fusionadas Detectadas
  
  No puedes fusionar planillas que ya están fusionadas.
  
  Planillas detectadas:
  • 842058-824986 (FUNZA-20260527-1A)
  
  Paso 1: Usa el botón de dividir (↱️) para separar las planillas fusionadas
  Paso 2: Luego intenta fusionar nuevamente
  ```
- **Beneficio**: Previene fusión de planillas ya fusionadas, mantiene integridad de datos

## Actualizaciones Recientes (2026-05-06)

- Implementado filtro por regional para OPERADORES en CrucePacientesV3 y GestionPedidosV3
- Agregada columna "Regional" en GestionPedidosV3 basada en campo `bodega_origen`
- Optimizado backend para filtrar por `bodega_origen` en lugar de cruzar rutas
- Exportación de Excel ahora respeta filtro de regional
- Corregidos contadores y resúmenes para actualizarse según filtro aplicado
- Datos de "V3 sin paciente" ahora cargan al inicio (no solo al cambiar de pestaña)
- Habilitada edición de nombre de usuario en GestionUsuarios

## Actualizaciones Recientes (2026-06-03)

### Acceso OPERATIVO a Historial de Pedidos
- **Perfil OPERATIVO** ahora puede acceder a `/integrapp/HistoricoPedidos`
- Aparece en el menú lateral de navegación
- Archivos: `HistoricoPedidosP/index.tsx`, `NavMedicalCare/index.tsx`

### Fix: Fusión/División de planillas con Vulcano
- **Problema**: Al fusionar planillas después de importar Vulcano, las originales quedaban "vivas" en el histórico
- **Solución**: Las originales se eliminan de MongoDB (no se marcan). La división las reconstruye desde `fusion_info.datos_originales`

### Botón Flotante (FAB) Mejorado
- **Posición**: `position: sticky` en vez de `fixed` → no sobrepasa el footer
- **Color**: Naranja (`#e65100 → #ff8f00` gradiente) en vez de verde oscuro
- **Ícono**: `<FaFileExport />` (documento con flecha) en vez de `☰`
- **Clic fuera**: Se cierra automáticamente al hacer clic fuera
- **Archivos**: `SolicitudVehiculos/page.tsx`, `SolicitudVehiculos/estilos.css`

### Menú de Navegación — Clic fuera para cerrar
- El dropdown del menú `NavMedicalCare` se cierra al hacer clic fuera
- Funciona en **todas las rutas** del sistema (componente compartido)
- **Archivo**: `NavMedicalCare/index.tsx`

### Nuevo campo: `flete_cobrado_fmc`
- **Cálculo automático**: `piezas × $20,000`
- Se calcula al buscar planillas y al fusionar
- Se almacena en MongoDB y se restaura al recargar
- **Archivo**: `SolicitudVehiculos/page.tsx`

## Actualizaciones Recientes (2026-06-11)

### Módulo: Indicadores de Transporte (`/integrapp/indicadores/transporte`)

#### Gráfico "Pedidos diarios"
- **Título renombrado**: De "Guías por Día" a **"Pedidos diarios"**
- **Etiquetas de total en barras**: Cada barra apilada muestra el total general (suma de todos los estados) encima usando `LabelList` con `dataKey="totalStack"`
- **Eje X inteligente**: Si el rango de fechas cruza años, muestra el año (ej: "10 dic 25", "5 ene 26"). Si es el mismo año, solo día y mes (ej: "10 jun")
- **Leyenda desplegable en móvil**: En pantallas ≤768px, las leyendas de estados se colapsan en un botón **"Estados ▼"** que se expande al tocarlo. En desktop se muestran como siempre en fila

#### KPI Cards
- **Renombradas**: "Total Guías" → **"Total Pedidos"**, "Total Toneladas" → **"Toneladas"**
- **Tamaño reducido**: Padding, iconos y fuentes más pequeñas para mejor uso del espacio

#### Sistema de filtros mejorado
- **Filtros manuales**: Los filtros ya NO se aplican automáticamente al cambiar valores. Solo se ejecutan al hacer clic en el botón **"Filtrar"**
- **Botón renombrado**: De "Actualizar" a **"Filtrar"**
- **Multi-select de Cliente con búsqueda**:
  - Campo de texto para buscar clientes en tiempo real
  - Checkboxes para seleccionar múltiples clientes
  - Chips de clientes seleccionados dentro del campo (con ✕ para quitar individualmente)
  - Opción "Todos" para limpiar selección
  - API soporta múltiples clientes con `OR` (`nombre_cliente ILIKE '%c1%' OR nombre_cliente ILIKE '%c2%'`)
- **Chips de filtros activos**: Barra debajo de filtros que muestra los filtros aplicados con opción de eliminar individualmente o **"Limpiar todo"**
- **Overflow corregido en móvil**: Inputs, selects y botones se ajustan correctamente en pantallas pequeñas

#### Rango por defecto
- Al entrar a la página se carga automáticamente **1 mes atrás** (30 días) para evitar colapso por exceso de datos

#### Botón "Exportar CSV" eliminado
- Se removió por solicitud del usuario

## Actualizaciones Recientes (2026-06-16)

### Módulo: Indicadores de Transporte (`/integrapp/indicadores/transporte`) — Mejoras continuas

#### Nuevos filtros (estilo Power BI)
- **Selector de Año (dropdown con checkboxes)**: muestra todos los años disponibles de la base de datos, por defecto el año actual. Permite seleccionar múltiples años
- **Selector de Mes (dropdown con checkboxes)**: Enero a Diciembre + "Todos". Permite múltiples meses
- **Rango de fechas eliminado**: reemplazado por los selectores de año y mes
- **APIs migradas a FastAPI**: los endpoints `/indicadores-transporte/guias` y `/indicadores-transporte/guias/detalle` ahora viven en integrappi (FastAPI), no en Next.js. Esto permitió reactivar `output: 'export'` para despliegue estático en GoDaddy
- **Panel de filtros siempre visible** (sin botón de colapsar)

#### Gráfico "Pedidos diarios"
- **Switch "Agrupar por mes"**: alterna entre vista diaria y agrupación mensual
- **Eje X rotado verticalmente** cuando hay muchas barras
- **Etiquetas de total** encima de cada barra
- **Click en el día** (eje X) abre un **modal de detalle** con todos los registros de ese día (Guía, Cliente, Destino, Estado, Novedad, Servicio, Piezas, Kilos, etc.)
- Respeta los estados filtrados en la leyenda del gráfico

#### Gráfico "Cajas por Día"
- **Dos modos** (switch "Agrupar por mes"):
  - **Por día**: línea única con el total de cajas por día, etiquetas visibles
  - **Comparativo**: una **línea por cada año** (leyenda por año) agrupada por mes, para comparar meses homólogos entre años
- **Año actual** = línea sólida; **años anteriores** = líneas con guiones
- Meses/años sin datos se muestran como `null` (no dibujan en cero)
- Meses sin ningún dato no aparecen en el eje X

#### Gráfico "Distribución por Estado"
- Barras horizontales con color por estado, cantidad dentro de la barra y porcentaje a la derecha

#### KPI Cards simplificadas
- Solo 3 cards: **Pedidos**, **Cajas**, **Toneladas**
- Contenido centrado
- Card de Cajas con número en tamaño menor (puede llegar a millones)
- Icono de Pedidos cambiado a documento (`FaClipboardList`)

#### Detalle por día (modal)
- Tabla responsive con scroll vertical (header fijo) y horizontal
- Badge de color por estado
- Cierra con ✕ o clic en el fondo
- **API**: `/indicadores-transporte/guias/detalle?fecha=YYYY-MM-DD` con filtros de estado y cliente

#### Animación de carga
- Reemplazada la ruedita por un **camión SVG** que se mueve de izquierda a derecha y regresa, sobre una pista punteada

#### Rendimiento
- **Agregación en base de datos**: la API usa `GROUP BY` y `SUM`/`COUNT` en PostgreSQL (no trae registros individuales), similar a Power BI
- **`useMemo`** en todos los cálculos pesados del frontend (`datosFiltrados`, `cajasFiltradas`, `cajasMultianual`, etc.) para evitar recálculos al escribir en filtros
- **Dropdown de clientes** limitado a 80 resultados y memoizado
- **Recomendación de índices** en PostgreSQL: trigram (`pg_trgm`) para `ILIKE` de cliente, e índice en `fecha_emision`

#### Archivos principales modificados
- `src/Paginas/IndicadoresTransporte/index.tsx`
- `src/Paginas/IndicadoresTransporte/estilos.css`
- `next.config.mjs` (reactivado `output: 'export'`)
- `.env.local` (URL de FastAPI)

### Backend (integrappi)
- Nuevo archivo `rutas/indicadores_transporte.py` con los endpoints de indicadores
- Conexión a PostgreSQL vía `psycopg2-binary` (variables `PG_*`)
- Agregación server-side para máximo rendimiento

## Actualizaciones Recientes (2026-06-18)

### Solicitud de Vehículos (`/integrapp/SolicitudVehiculos`)

#### Búsqueda de planillas vía bot de scraping (reemplazo del WS caído)
- El WS de Siscore V3 (`informe_v3.php`) dejó de funcionar. La búsqueda de planillas ahora usa un **bot de scraping del portal Siscore (Playwright)** que vive en el backend (`integrappi`).
- La URL del endpoint es **configurable** por variable de entorno (`NEXT_PUBLIC_SISCORE_PLANILLAS_ENDPOINT`); por defecto sigue apuntando al WS viejo (**reversible**).
  - En `.env.local`: `NEXT_PUBLIC_SISCORE_PLANILLAS_ENDPOINT=/siscore/consultar-planillas-bot`
- El contrato de respuesta es idéntico al WS viejo, por lo que el parseo, agrupación, cálculo de tarifa y guardado **no cambiaron**.
- Se trae adicionalmente **Placa** y **Manifiesto** desde el Excel del portal.
- **Archivo**: `src/app/SolicitudVehiculos/page.tsx` (`handleBuscar`).

#### Selector de Regional obligatorio para ADMIN/ANALISTA
- Los perfiles **ADMIN y ANALISTA** (globales, sin regional fija) ahora deben **elegir una regional** en un dropdown de la barra de búsqueda antes de consultar (si no, el botón Buscar se bloquea con un aviso).
- La regional elegida se asigna a todas las planillas de la tanda → el **consecutivo** queda con el nombre de la regional (ej: `CALI-20260618-1`) en vez de `TODOS-...`, y el campo **Regional** se muestra correctamente.
- **ANALISTA** ahora también ve la barra de búsqueda (antes solo ADMIN y OPERATIVO).
- **OPERATIVO** no ve el dropdown (tiene su regional fija por cookie).

#### Regional mostrada como bodega para OPERATIVO
- Para **OPERATIVO**, la columna Regional se muestra como la **bodega de origen** (CALI→YUMBO, BARRANQUILLA→JUAN MINA, MEDELLIN→GIRARDOTA), igual que se guarda en Mongo.

### Indicadores de Transporte (`/integrapp/indicadores/transporte`)
- **Fix del gráfico "Pedidos diarios"**: al activar un filtro de estado (ej: "En distribución") estando con el scroll a la derecha, el gráfico quedaba en blanco. Ahora se **reposiciona automáticamente al inicio** para mostrar las barras que sí tienen información.
- **Archivo**: `src/Paginas/IndicadoresTransporte/index.tsx`.

## Actualizaciones Recientes (2026-06-19)

### Solicitud de Vehículos (`/integrapp/SolicitudVehiculos`)

- **Asignación obligatoria de ruta al cargar**: tras consultar planillas con el bot, se abre un **modal que lista todas las planillas** con su ruta pre-llenada (la derivada de divipolas) en un input con **autocompletar** (`<datalist>` con las rutas que tienen tarifa, vía `GET /siscore/rutas`). La ruta es **obligatoria** (bloquea si alguna queda vacía); si se cancela, se descarta la carga. Al confirmar, se recalcula la tarifa con la ruta elegida. El listado de rutas se carga al montar el componente.
- **Ruta editable en el modal de edición** (lápiz): nuevo campo Ruta con autocompletar; al cambiarla, **recalcula tarifa, tipo de vehículo y total** automáticamente antes de guardar.
- **Botón "Dividir consecutivo"** (azul, `FaCodeBranch`): divide una planilla en hasta **4 carros** (`3A`, `3B`, ...). Modal por pasos: nº de carros → peso por carro (pre-llenado equitativo, **valida suma = peso total**) → cálculo de tipo y flete por carro → confirmación. La original se reemplaza por los carros en la tabla.
- **Botón "Unir"** (verde, `FaObjectGroup`): revierte una división (restaura la planilla original).
- **Detalle por guía**: `handleBuscar` acumula los registros crudos (cédula, nombre, dirección, etc.) en `registros_detalle` por planilla, y los preserva al fusionar (`datosOriginales`). Campo `registros_detalle?: any[]` y `division_info?: any` añadidos a la interfaz `PlanillaResultado`.

### Exportación a Excel (cambios en el backend que afectan a este módulo)
- Las planillas **fusionadas** se exportan como **filas separadas** con el flete repartido proporcionalmente por cajas.
- Las planillas de **FRESENIUS KABI** generan **filas duplicadas por destinatario** con "Ubicación Descargue" = `FKC_Nombre_Cedula`.

## Actualizaciones Recientes (2026-07-28)

### Nuevo módulo: Otros Costos (`/OtrosCostos` y `/HistoricoOtrosCostos`)

Registro de costos adicionales posteriores al servicio, con buscador de pedidos de Vulcano, formulario por secciones, bandeja con filtros/paginación, trazabilidad (timeline) y exportación a Excel.

- **Páginas**: `Paginas/OtrosCostosP` (formulario + bandeja) y `Paginas/HistoricoOtrosCostosP`; wrappers en `app/OtrosCostos/page.tsx` y `app/HistoricoOtrosCostos/page.tsx`. Capa API `Funciones/ApiPedidos/otrosCostos.tsx`.
- **Búsqueda de pedidos**: normaliza ceros a la izquierda y separadores; muestra encontrados/no encontrados, totales consolidados y advertencia de servicios diferentes; permite continuar manual si el pedido no existe (`pedido_encontrado: false`).
- **Flujo**: `borrador → pendiente_aprobacion → aprobado → [tramite_vulcano = "ok" por ANALISTA] → pagado`; con devolver/rechazar/anular. Acciones por rol/estado. El botón Aprobar se deshabilita para Coordinador cuando el valor supera $500.000. Paso ANALISTA: botón que marca `tramite_vulcano` (ok/pendiente) sobre aprobadas; el botón Pagar sólo aparece cuando queda en "ok".
- **Perfil nuevo FINANCIERO**: aterriza en `/OtrosCostos` (`LoginUsuarios`) y en `NavMedicalCare` sólo ve Otros Costos e Histórico Otros Costos. Agregado a `PERFILES_FALLBACK` en `GestionUsuariosP`.
- **Datos bancarios** enmascarados en la UI para perfiles no financieros (coherente con el backend).
- **Responsive** (móvil/tablet) y estado vacío amigable (tarjeta con CTA en vez de tabla vacía).

## Actualizaciones Recientes (2026-07-31)

### Otros Costos (`/OtrosCostos`) — paso ANALISTA y formulario de un solo pedido
- **Paso ANALISTA «trámite Vulcano»**: entre `aprobado` y `pagado`, el ANALISTA marca `tramite_vulcano` (ok/pendiente) con un botón que alterna (tabla + modal). El botón **Pagar** sólo aparece cuando `tramite_vulcano == "ok"`. Umbral del Coordinador corregido a **$500.000** (antes $160.000). Perfil ANALISTA habilitado como rol compartido en MEDICAL_CARE.
- **Formulario «Nueva solicitud»**: ahora **un solo** pedido de Vulcano por solicitud (una planilla). Label en singular y validación que rechaza varios (separadores `, - ; /`) al Buscar y al Guardar.

### Solicitud de Vehículos (`/SolicitudVehiculos`) — pedido Vulcano por planilla en fusiones
- Al asignar el pedido Vulcano **manualmente** sobre una **fusión**, se abre un **modal con un campo de pedido por cada planilla original** (precargado si ya tenía). Cada original queda con su propio `pedido_vulcano`; la fusión pasa al histórico sólo cuando todas tienen pedido. Para planilla no fusionada, el Swal simple de un solo pedido.
- **Histórico** (`/HistoricoPedidos`): la tabla de planillas originales de una fusión ahora muestra la columna **"Pedido Vulcano"** por original, así al filtrar un pedido se ve de qué planilla es.

## Actualizaciones Recientes (2026-08-03)

### Otros Costos (`/OtrosCostos`) — header dinámico, filtros y validaciones del formulario

- **Header dinámico (`NavMedicalCare`)**: el badge del encabezado (antes fijo «Fresenius Medical Care») ahora muestra el **nombre de la sección actual** («Otros Costos», «Medical Care», etc.) en todas las páginas que comparten el menú. Se eliminó el `<h1>` «Otros Costos» redundante del cuerpo de la página (queda sólo en el badge). **Archivo**: `Componentes/NavMedicalCare/index.tsx`.
- **Barra de filtros** rediseñada: un **solo bloque lineal y centrado** en el orden `Desde · Hasta · Estado · Pedido · Placa · Manifiesto · Cliente · Buscar · Excel`. En pantallas grandes (≥900px) se acomoda en **una sola fila** (campos de texto compactados a 120px); si no cabe, se reparte en filas **igual centradas** (`flex-wrap`). El botón **Buscar** quedó al final (aplica a todos los filtros) en vez de junto a las fechas. **Archivos**: `Paginas/OtrosCostosP/index.tsx`, `Paginas/OtrosCostosP/estilos.css`.
- **Validaciones en «Nueva solicitud»**:
  - **Manifiesto**: sólo admite **dígitos**, **máx. 15 caracteres**.
  - **Tipo vehículo**: ahora es un **select** con `CARRY, NHR, TURBO, NIES, SENCILLO, PATINETA, TRACTOMULA`.
  - **Centro distribución**: ahora es un **select** con `JUAN MINA, YUMBO, BUCARAMANGA, GIRARDOTA, FUNZA`.
  - Si un valor viene autollenado (desde la búsqueda del pedido o al editar una solicitud existente) y no está en la lista, se muestra como **opción extra** para no perderlo, pero al crear/editar sólo se puede elegir de la lista. **Archivo**: `Paginas/OtrosCostosP/index.tsx` (constantes `TIPOS_VEHICULO_OC`, `CENTROS_DISTRIBUCION_OC`; `FieldText` extendido con `maxLength`/`soloNumeros`).

## Actualizaciones Recientes (2026-08-04)

### Otros Costos (`/OtrosCostos` y `/HistoricoOtrosCostos`) — filtro por regional y formulario simplificado
- **Filtro por regional** (como SolicitudVehiculos): **OPERATIVO** ve todas las solicitudes de su regional (la define el backend desde `baseusuarios`); **ADMIN/ANALISTA/COORDINADOR/CONTROL** ven todo y tienen un **dropdown opcional** «Todas las regionales» (aplica al dar Buscar). Dropdown en `OtrosCostosP` e `HistoricoOtrosCostosP`; `regional` añadido a `FiltrosListado`/`aParams`. Archivos: `Paginas/OtrosCostosP/index.tsx`, `Paginas/HistoricoOtrosCostosP/index.tsx`, `Funciones/ApiPedidos/otrosCostos.tsx`.
- **Causales/tipos de costo** ahora vienen de la colección `causales_otros_costos` (auto-sembrada); editable en Mongo sin deploy.
- **Eliminado el campo «Concepto»** del formulario y de las tablas de detalle (queda `Tipo · Descripción · Valor`). Eliminado también **«Observaciones»** del formulario de nueva/editar solicitud (todos los perfiles). Las solicitudes viejas siguen mostrando sus observaciones en el detalle.
- **Tope de $5.000.000** al valor total: el campo Valor limita la entrada y `validarForm` bloquea si la suma supera $5.000.000.

## Actualizaciones Recientes (2026-08-06)

### Pedidos (`/integrapp/Pedidos`) — modal «Editar vehículo»: ahorro/observación y secciones
- **Ahorro + observación**: el modal de edición de un vehículo ahora incluye la sección «💰 Ahorro y observación (opcional)» con `ahorro` (numérico, máx $5.000.000, valida con Swal) y `observación` (texto, 500 car.). Se envían en el `AjusteVehiculo` al backend (`PUT /pedidos/ajustar-totales-vehiculo`) y se precargan al reabrir el modal.
- **Modal reestructurado en 4 secciones** (Datos del vehículo / Destino y costos del transporte / Causal del ajuste / Ahorro) con grid de 2 columnas y títulos; antes «Flete» y «Destino» quedaban fuera del grid. Etiqueta «Desc transp» → «Descargue transp (cargue/descargue)».
- **Fusión y División**: ambos modales suman un select «Causal del sobre costo» (obligatorio si la operación genera sobre costo).
- **Tabla principal**: resaltado **«⚠️ Sin causal»** en rojo cuando un vehículo tiene sobre costo sin causal.
- **Archivo**: `src/Componentes/PedidosComponentes/TablaPedidos.tsx`.

### Pedidos Completados (`/integrapp/PedidosCompletados`) — causal, ahorro, Excel y fixes
- **Columna Causal** con botón **«⚠️ Sin causal»** que abre un Swal para asignar la causal (vía `PUT /pedidos/asignar-causal-completado`) a los históricos que quedaron sin ella; al asignar, desaparece el aviso. Nueva columna **Ahorro**.
- **Fix de columnas**: el header «Observaciones» no tenía celda (los estados se mostraban en la columna equivocada) → reemplazado por columnas Causal + Ahorro alineadas (`colSpan` 19→21). Typo «Car/desc Teorico Teorico» → «Car/desc Teórico».
- **Excel reestructurado** (cambio de backend): ahora es **una sola hoja** con **una fila por pedido/planilla** y nombres legibles, con columna **Fecha** en `DD/MM/AAAA`, **Planilla** y **Destinatario (Ubicación Descargue)** visibles (antes era un volcado crudo con nombres técnicos).
- **Mensaje de error de red** más claro: si el servidor no responde por exceso de datos, sugiere acortar el rango de fechas.
- **Archivos**: `src/Componentes/PedidosComponentes/TablaPedidosCompletados.tsx`, `src/Componentes/PedidosComponentes/TablaPedidos.tsx`, `src/Funciones/ApiPedidos/apiPedidos.tsx`.

### Solicitud de Vehículos (`/integrapp/SolicitudVehiculos`) — botón «Devolver» planilla al operativo
- **Problema**: cuando una planilla quedaba en `COORDINADOR`/`CONTROL`, el revisor solo tenía botón **Aprobar**; no podía devolverla indicando qué corregir, así que el operativo la veía «trabada» sin feedback.
- **Nuevo botón «Devolver»** (rojo, `FaUndo`) visible para **ADMIN/COORDINADOR/CONTROL** sobre planillas en `REQUIERE_APROBACION_COORDINADOR` o `REQUIERE_APROBACION_CONTROL`. Abre un Swal con **textarea obligatorio** (motivo, mín. 5 car.) y devuelve la planilla a **`CREADO`** (`PUT /siscore/actualizar-estado-planilla` con `motivo_devolucion`). Devolver ≠ Aprobar: se permite a los tres roles sobre ambos tiers.
- **Update optimista**: COORDINADOR/CONTROL dejan de ver la planilla (al volver a `CREADO` solo la ve el operativo creador + ADMIN); ADMIN la sigue viendo en `CREADO`.
- **Aviso al operativo (in-app)**: cuando una planilla está en `CREADO` con `motivo_devolucion`, bajo el badge aparece una línea roja `⚠️ Devuelta por {devuelto_por}: {motivo}` (truncada, con el texto completo en tooltip) — el operativo la ve al recargar. El WhatsApp al `usuario_registro` lo manda el backend (plantilla `devolucion_planilla`).
- Se distingue del botón existente **«Volver a CREADO»** (`FaLockOpen`, ADMIN/ANALISTA): ése es una reapertura de edición genérica **sin motivo**; «Devolver» es el rechazo con feedback del revisor.

## Actualizaciones Recientes (2026-09-16)

### Histórico de Pedidos (`/HistoricoPedidos`) — botón ">" con clientes y pedidos por planilla (inline, como SolicitudVehiculos)

- Nueva **columna inicial con botón ">"** (gris, `FaChevronRight`/`FaChevronDown`, visible para TODOS los perfiles incl. VISUALIZADOR) que despliega bajo cada fila una **sub-tabla con el detalle por guía AGRUPADO POR CLIENTE**: cabecera de grupo `▾ CLIENTE` con piezas/peso del grupo, filas por guía (Código Pedido/Guía, Nombre, Municipio, Piezas, Peso Real), subtotal por cliente y fila TOTAL con el conteo de pedidos.
- El **cliente de cada guía** es el de su propio registro (`registros_detalle['Cliente Origen']`, la Entidad del Excel de Siscore); si la guía no lo trae, cae al `cliente_origen` de su planilla. En **fusiones** se agrega la columna **Planilla** (de qué original viene cada guía, desde `fusion_info.datos_originales`).
- Se replica el patrón visual de SolicitudVehiculos (`DetallePlanilla`): componente `DetallePlanillaExpandida` + clases `HP-detalleRow` (nueva en `estilos.css`) y `HP-subTable` reutilizadas. Filas envueltas en `Fragment`; el `colSpan` de la fila vacía y del detalle suma la columna nueva. El modal de detalle (clic en consecutivo) no cambió.
- **Archivos**: `Paginas/HistoricoPedidosP/index.tsx`, `Paginas/HistoricoPedidosP/estilos.css`.

## Actualizaciones Recientes (2026-08-28)

### Otros Costos (`/OtrosCostos`) — adjuntos y pago enriquecido

- **Adjuntos (soportes)**: nueva sección «4. Archivos adjuntos (opcional)» en el formulario crear/editar — hasta **10 archivos** (JPG/PNG/PDF, 10 MB c/u) que se suben en el mismo guardado (multipart). Imágenes optimizadas a WEBP en el backend y alojadas en Google Cloud Storage (`OtrosCostos/{consecutivo}/...`); en Mongo solo quedan las URLs (`adjuntos[]`). En edición se ven como links y se pueden agregar más hasta el tope. Sección «Adjuntos» también en los modales de detalle de `OtrosCostosP` e `HistoricoOtrosCostosP`. `crearSolicitud`/`editarSolicitud` (`otrosCostos.tsx`) ahora envían FormData. Clases `.OC-adj*` en `OtrosCostosP/estilos.css`.
- **Modal «Registrar pago» (FINANCIERO)**: ahora captura **3 campos** — Referencia (opcional), **Valor tras retenciones** (opcional, valida ≤ valor total) y **Observaciones** (opcional). El backend guarda ambos en `pago` + top-level (uniforme con el archivo bancario). Los detalles (activo e histórico) muestran «Observaciones pago»; el histórico también el teléfono del conductor.
- **Auto-llenado bancario por placa**: al salir del campo Placa (máx 6 caracteres, símbolos sanitados) del formulario de nueva/editar solicitud se consulta el catálogo Cuentas por Placa y se llenan **solo los campos vacíos**: banco, tipo de cuenta, número de cuenta, cédula y nombre del titular (← nombreBeneficiario) y nombre/teléfono del conductor. Toast no bloqueante informa cuántos llenó; nunca pisa lo ya digitado. Si la placa existe en varias regionales, avisa y no llena.

### Nuevo módulo: Cuentas por Placa (`/CuentasPlaca`)

Catálogo regional de datos bancarios por placa (conductor, teléfono **obligatorio**, beneficiario, cédula, banco, tipo y número de cuenta) que alimenta el auto-llenado de Otros Costos.

- **Página**: `Paginas/CuentasPlacaP` (estilos OC- reutilizados de OtrosCostosP) + wrapper `app/CuentasPlaca/page.tsx`; API en `Funciones/ApiPedidos/cuentasPlaca.tsx`. Tabla con búsqueda por placa y paginación server-side; modal crear/editar con selects de banco/tipo (mismos catálogos de Otros Costos).
- **Perfiles**: visible en el menú hamburguesa (`NavMedicalCare`, ítem «Cuentas por Placa», `FaIdCard`) para **ADMIN, OPERATIVO y DESPACHADOR**. OPERATIVO/DESPACHADOR solo ven/crean/editan/eliminan su regional (el backend la impone); ADMIN tiene dropdown de regional (por bodega: JUAN MINA, YUMBO, BUCARAMANGA, GIRARDOTA, FUNZA) y botones **Plantilla / Importar Excel / Exportar**.
- **Importar Excel (ADMIN)**: mini-modal con regional destino obligatoria + archivo `.xlsx`; upsert por (placa, regional) — placa existente se actualiza; resultado con errores por fila. La plantilla descargable trae 8 columnas y una hoja «Valores» con los bancos/tipos permitidos.
- **Reglas**: placa 4-6 caracteres alfanuméricos (sin espacios/guiones/símbolos); una placa puede repetirse entre regionales pero no dentro de la misma (409); bancos = catálogo de Otros Costos.

## Actualizaciones Recientes (2026-09-23)

### Otros Costos (`/OtrosCostos`) — campo «OC del proveedor» por concepto

- Input **«OC del proveedor ({PROVEEDOR})»** en cada concepto del formulario «Nueva solicitud», que **sólo aparece cuando el concepto tiene Proveedor diligenciado** (opcional, mayúsculas, máx 50 car.). Viaja en `costos[].oc_proveedor` y se precarga al editar. Columna «OC Proveedor» en la tabla de conceptos del modal de detalle (`-` en docs viejos). También sale en el Excel del histórico (columna «OC Proveedor», cambio backend). **Archivos**: `Paginas/OtrosCostosP/index.tsx`, `Funciones/ApiPedidos/otrosCostos.tsx`.

### Histórico de Pedidos (`/HistoricoPedidos`) — trazabilidad del flujo en el modal de detalle

El modal de detalle (clic en el consecutivo) mostraba datos, fletes y fechas, pero **nada de quién hizo qué**. Ahora incluye, **al final del formulario** (después de «Detalle de pedidos»):

- **Sección «Trazabilidad del flujo»**: Registrado por, Solicitó autorización + fecha, Última modificación por + fecha, **Aprobado por + fecha de aprobación**, Asignó Pedido Vulcano y, si aplica, Devuelto por + fecha + **Motivo de devolución**. Muestra el **nombre y apellido** de la persona (campos `*_nombre` que resuelve el backend en `GET /siscore/historico` desde `baseusuarios`), con fallback al username.
- **Sección «Historial de cambios (N)»**: tabla con el flujo completo del vehículo — fecha, usuario (nombre), acción (`edicion` / `cambio_estado` / `devolucion`) y **Detalle** legible (`campo: anterior → nuevo`, causal, motivo). Sin scroll interno ni tope de altura (`.HP-cambiosWrap`): el contenido fluye y el scroll queda **vertical en el modal padre**; la celda Detalle acota su ancho (`.HP-detalleCambio`, máx 360px con salto de línea) para no ensanchar la tabla.
- **Diferencia en rojo**: el campo «Diferencia» de «Fletes y recargos» se pinta con cuadro rojo (fondo `#fef2f2`, borde izquierdo `#dc2626`, valor `#b91c1c`) cuando es **superior a cero**; en $0 o negativo se ve normal. Helper `Campo` extendido con flag `alerta` + clase `.HP-modalFieldAlerta`.
- **Archivos**: `Paginas/HistoricoPedidosP/{index.tsx,estilos.css}`.

### SolicitudVehiculos (`/SolicitudVehiculos`) — misma trazabilidad en el modal «Editar/Ver Planilla»

- El modal agrega, **al final del formulario** (después de los campos editables, antes de los botones), el bloque **«📋 TRAZABILIDAD DEL FLUJO»** (solo lectura, estilo de los otros bloques): Registrado por, Solicitó autorización + fecha, Última modificación por + fecha, Aprobado por + fecha, Asignó Pedido Vulcano y, si aplica, Devuelto por + fecha + motivo en rojo. Muestra **nombre y apellido** (`*_nombre` que ahora resuelve `GET /siscore/obtener-resultados-recientes`), con fallback al username.
- Debajo, si el doc tiene `historial_cambios`, la tabla **«Historial de cambios (N)»**: fecha, usuario (nombre), acción y Detalle legible (`campo: anterior → nuevo`, causal, motivo) — celda Detalle acotada (máx 300px) y contenedor con scroll propio (máx 260px) para no alargar el modal.
- Interfaz `PlanillaResultado` extendida con los campos de trazabilidad (`usuario_registro*`, `usuario_modificacion*`, `aprobado_por_nombre`, `usuario_pedido_vulcano*`, `historial_cambios`, etc.) + helper `resumenCambioHistorial`. **Archivo**: `src/app/SolicitudVehiculos/page.tsx`.

### SolicitudVehiculos — consecutivo clicable para abrir el formulario de detalle

- **Problema**: el modal «Editar/Ver Planilla» solo se abría con el botón azul de lápiz (columna Acciones) y el consecutivo era texto plano; además ese botón se **oculta** para OPERATIVO cuando la planilla ya fue enviada (estado ≠ CREADO), dejándolo sin forma de ver el detalle (incluida la trazabilidad nueva).
- **Ahora**: la celda **Consecutivo** es un botón-link (`.SV-consecutivoLink`, mismo estilo que `HP-consecutivoLink` de HistóricoPedidos: subrayado al hover) que abre el mismo modal de detalle.
- **Solo lectura para OPERATIVO en enviadas**: `soloLectura` ahora también es verdadero para OPERATIVO cuando el doc abierto tiene estado ≠ CREADO (antes solo ANALISTA) → el modal abre «Ver Planilla (solo lectura)», con campos deshabilitados y sin botón Guardar. Puede consultar el detalle y la trazabilidad, pero no editar. **Archivos**: `src/app/SolicitudVehiculos/{page.tsx,estilos.css}`.

### Nombres de personas en todos los puntos (no usernames)

- Nuevo helper `nombrePersona(valor)` en `SolicitudVehiculos/page.tsx` e `HistoricoPedidosP/index.tsx`: resuelve username → **nombre de la persona** usando un mapa `{USUARIO: nombre}` que se consulta una vez al montar la página (`GET /siscore/nombres-usuarios`, sólo usuario+nombre). Prioridad: campo `*_nombre` del backend → mapa local → valor tal cual.
- Aplica a: toda la sección «Trazabilidad del flujo», la tabla «Historial de cambios» y el aviso de fila **«⚠️ Devuelta por …»** de SolicitudVehiculos (que antes mostraba el username crudo). También cubre el estado local justo después de aprobar/devolver sin esperar el re-fetch.

## Actualizaciones Recientes (2026-10-31)

### Indicadores — On Time con la lógica del Excel real (frontend)

Cambio de backend (ver `integrappi/README.md` 2026-10-31) que afecta el frontend de los dashboards:

- **`SEGMENTOS_OT` pasó de 8 a 4 veredictos** (definición única para barras/leyenda/tooltip): **Cumplieron** (entregadas a tiempo + en curso sin vencer) / **No cumplieron** (entregadas tarde + en curso VENCIDAS) / **Con novedad** (auto-cumplen: reporte de Siscore **o justificación manual de /NovedadesOT** — las «Justificadas» se fusionaron aquí) / **No aplica** (fuera del %).
- **BucketOT** (gráfico por período) y **OTPorCampo** (ciudad/destinatario) adaptados a los 4 segmentos.
- **Excel** del OT/informe/detalle con columnas nuevas **Tipo Servicio** y **Cumplió «SÍ/NO (en curso)»** (hoja «Guías» con orden de lectura profesional: «Días vs Promesa» incluido).
- **Badge de la consulta de guía** (pestaña Trazabilidad): chip ✔ Cumplió / ✘ No cumplió / ✔ Justificada / Sin evaluar con línea de fechas entrega↔promesa.
- Deploy backend + frontend JUNTOS. Documentación completa en `INDICADORES.md` §3.

### Nueva pantalla «Módulos» (/Modulos) — reemplaza el selector de portales del login

- **Tras el login**, los perfiles multi-módulo (ADMIN, ANALISTA, COORDINADOR, CONTROL, OPERATIVO, DESPACHADOR) ya no eligen portal por tarjetas: aterrizan en **`/Modulos`** — hub minimalista con **menú lateral izquierdo SIEMPRE visible** (expandido con textos en desktop; en ≤768px **ocupa toda la pantalla**, sin logo central) y el **logo corporativo centrado** en el área restante. Nunca drawer ni hamburguesa.
- **Config única del menú**: `src/Funciones/menuModulos.ts` (`construirMenu(ctx)` + `PERFILES_FLOTA/SEGURIDAD/ADMIN_SEGURIDAD`, movidas desde el login). Módulos principales (negrita, misma tipografía que las cabeceras de grupo): **CUMPLIMIENTO RNDC** (externo Mintransporte) · **GESTIÓN DE ÓRDENES** (externo Vulcano) · **TORRE DE CONTROL** (externo Mayasoft) · **ALMACENAMIENTO** (externo Siscore WMS) · **TMS** (externo Siscore) · **INDICADORES** (interno /indicadores). Grupos desplegables (cerrados por defecto, submenús solo al clic): **PROGRAMACIÓN** (Kabi → /Pedidos, Medical Care → /MedicalCare) y **EN RUTA** (Seguridad → /revision, Flota Disponible). Grupos vacíos se omiten. SICE-TAC y Admin Seguridad salieron del menú (rutas intactas).
- **Al navegar** (`abrir()` en `Paginas/ModulosP`): setea `clientePedidosCookie` del portal antes del push; para Seguridad escribe las cookies `seguridad*` (modo PADRINO si el perfil no es ADMIN/SEGURIDAD); externos abren pestaña nueva. Sesiones previas al cambio sin la cookie de info → clic en Seguridad pide re-login una sola vez.
- **Cookie nueva `usuarioInfoPedidosCookie`** (JSON `{id, usuario, nombre, correo, perfil, perfiles_adicionales}`, 14 días): la setea `LoginUsuarios` al autenticar y la lee /Modulos — permite entrar a Seguridad sin consultar backend.
- **Login** (`Paginas/LoginUsuarios/index.tsx`): eliminados el paso 2 (tarjetas), `seleccionarCliente`, `CLIENTES_CONFIG` y `ORDEN_PORTALES`. Micro-portales intactos (FINANCIERO→/OtrosCostos, VISUALIZADOR→/indicadores, CLIENTE_ESTUDIOS→/PortalSeguridad, CLIENTE→/indicadores/mis-clientes, PADRINO→/revision). Re-login multi-módulo → /Modulos.
- Usuario del sidebar con popover (nombre/perfil + Cerrar sesión); a11y (`:focus-visible`, aria-labels, `prefers-reduced-motion`).
- **INDICADORES pasó de ítem directo a GRUPO desplegable** (mismo día): el sub-módulo **IntegrApp** (`/indicadores`) convive con **9 tableros Power BI del área** como sub-módulos externos (Cierre diario, Gestión de proveedores, Encuestas de satisfacción, Cumplimiento de citas, Gestión de almacenamiento, Cumplimiento de devoluciones, On time, Efectividad de inventarios, PQR — links de publicación `app.powerbi.com/view`, abren en pestaña nueva vía `externo`). Todo en `src/Funciones/menuModulos.ts` (grupo `indicadores`, ids `ind_*`).
- **PLANEACIÓN — ítem PERSONAL (2026-11-03)**: tras GESTIÓN DE ÓRDENES. Al clic abre el planeador de Access LOCAL `C:\Users\ASUS\Downloads\PLANEADOR KABI.accdb` (PC de Edwin) vía **protocolo de Windows `planeadorkabi:`** registrado en `HKCU:\Software\Classes\planeadorkabi` (command → `MSACCESS.EXE` + el .accdb; sin admin, por usuario). ⚠️ `file://` directo NO sirve: los navegadores lo bloquean desde https; un protocolo registrado SÍ puede navegarse (`window.location.href` en `abrir()` de `ModulosP` para todo `externo` no-http). El navegador pide confirmación la 1ª vez («Permitir siempre» disponible). En PCs sin el registro el clic no hace nada. **Quitar el ítem `planeacion` de `menuModulos.ts` cuando deje de usarse** (y el registro queda huérfano, inofensivo). El badge `modx-nav-badge` ahora también se pinta en ítems activos (antes solo en deshabilitados).

### Branding: headers unificados negro #000 + verde #98C74C

A pedido del usuario, todos los headers pasaron al look del portal Mis Indicadores (`DC-header`). Técnica: **edición por línea exacta** (el gradiente navy `linear-gradient(90deg,#0f1928,#1e2f45)` también existe en footers/tablas y NO se tocó). Acentos `#e8a000`/`#27ae60`/`#bacf65` → `#98C74C`; `rgba(232,160,0,…)` → `rgba(152,199,76,…)`.

- **Componentes compartidos**: `HeaderSesion` (FlotaDisponible/Sicetac/FlotaUsada/Disponibilidad), `HeaderApp`, `HeaderLogo` (#2c3e50→#000), `Barra` (huérfano), `IndicadoresChrome` (**solo `.IG-header`** — filtros/tablas internos siguen navy/naranja).
- **Headers propios**: `Pedidos`/KABI (tabs activos verdes), `PedidosCompletados`, `AdminSeguridadP`, `TarifasP`, `CertificadoLaboralP`, `InicioPropietarios`, `OlvidoClaveBaseUsuario`, `GestionUsuariosP` (CSS muerto, alineado igual), `app/indicadores` (IM-header), `VerificarCorreo` (+AutorizacionDatos/AceptarInvitacion), `LoginUsuarios`/`LoginConductores`, `PanelClientes`/`PanelMisClientes` (#0f1928 plano→#000), landing `/` (page.module.css), `PanelConductores`.
- **Shells teal → verde**: `revision` (tokens `--revx-acento*` + topbar negra + teales quemados #006b77/#006f7a/#9fd8dd/#f0fafb) y `PortalSeguridadP` (`--psx-teal*` + topbar negra; ⚠️ portal con marca seguriDatia — revertir tokens si se quiere conservar su teal).
- **NavMedicalCare**: gradiente teal #004d40→#006b5e → #000; «App» verde; pill de usuario redondo; dropItemActive verde.
- **No tocado**: `/VerificarEstudio` (portal público claro) y el contenido interno naranja de IndicadoresChrome/costo-operación.

## Actualizaciones Recientes (2026-11-09)

### Nuevo módulo: Citas de Entrega (`/CitasEntrega`)

Registro MANUAL de la cita de entrega de una guía (fecha + franja horaria en
la que el cliente puede recibir) cuya fecha **GANA sobre la cita agendada en
el cálculo On Time** del dashboard de clientes (backend: ver
`integrappi/README.md` 2026-11-09). Patrón de NovedadesOT: wrapper
`app/CitasEntrega/page.tsx` + `Paginas/CitasEntregaP` (clases `CE-*`), ítem
**📅 Citas de Entrega** en `NavMedicalCare` (ADMIN/COORDINADOR/CONTROL/
OPERATIVO — mismo filtro que novedadesot).

- **Modal nueva/editar**: guía (readonly al editar), fecha `<input type="date">`
  y horas en **dropdowns 24h de MEDIA HORA** (48 opciones `00:00…23:30`; no
  `<input type="time">`, que muestra AM/PM según locale del SO). Al elegir la
  hora de inicio, **el fin se autocompleta a inicio + 2h** (tope 23:30) y el
  dropdown de fin solo ofrece horas ≥ inicio (franja invertida imposible); si
  la inicio sube por encima del fin ya elegido, el fin se recorre a inicio+2h.
- **Historial de cambios en el modal**: tabla «Cambió a | Nueva franja |
  Antes | Hecho por | Cuándo» **de la más reciente a la más antigua** (cada
  entrada es el cambio completo {previo → nuevo}); badge «🔁 N» en la tabla
  principal. Entradas viejas planas se muestran solo en «Antes».
- **Carga Excel** (todo-o-nada; plantilla con columna «FECHA (DD/MM/AAAA)»),
  export, y **buscador de guía EN VIVO** (debounce 350 ms); sin resultados y
  ≥3 caracteres → botón «＋ Crear cita para la guía 'X'» (modal precargado).
- **🗑 Citas eliminadas** (auditoría, solo ADMIN/CONTROL): desplegable al pie
  con quién borró cada cita y cuándo (carga al abrir la 1ª vez;
  `GET /citas-entrega/eliminadas`).

### Portal Mis Indicadores — cita de entrega en la Trazabilidad (`DashboardCliente`)

- **Panel verde «📅 Cita de entrega: {fecha} · {franja}»** en el resultado de la
  consulta de guía (junto al panel morado de novedad): quién la asignó y
  cuándo, con las **re-agendas anteriores colapsadas** (más reciente primero,
  formato «Cambió a X (antes Y) — quién · fecha»).
- **Chip On Time**: cuando se juzgó contra la CITA, muestra la **cita real
  usada** (`ot.fecha_cita_usada`) — antes mostraba la fecha promesa con
  etiqueta «cita»; el tooltip marca «(asignada manualmente)» cuando aplica.

Dep backend + frontend JUNTOS.

## Actualizaciones Recientes (2026-11-10)

### ANALISTA entra al portal «Mis Indicadores»

El perfil **ANALISTA** ve los indicadores del portal de clientes externos, con el mismo tratamiento que VISUALIZADOR (todos los dashboards publicados, sin asignación — backend en `integrappi/README.md` 2026-11-10):

- **Menú `/indicadores`** (`app/indicadores/page.tsx`): la tarjeta «Mis Indicadores (portal clientes)» (`indicadoresAdmin`) ahora incluye ANALISTA.
- **Gate del panel** (`Paginas/IndicadoresMisClientes/PanelMisClientes`): `PERFILES_PERMITIDOS` = CLIENTE/ADMIN/VISUALIZADOR/ANALISTA.
- El menú hamburguesa del dashboard ya mostraba «Mis indicadores» para cualquier perfil ≠ CLIENTE (sin cambio).

Dep backend + frontend JUNTOS.

### Portal Kabi — guías en curso en Operación + guía clicable → Trazabilidad

- **Pestaña Operación**: bajo las 3 cards de atención, **3 cards CLICABLES** — 🔴 Pendientes vencidas / 🕒 Pendientes en curso / ⚪ No aplica — con contadores del resumen de `/guias` (No aplica = no evaluables − pendientes − vencidas). **Carga perezosa**: el clic abre SU tabla (una a la vez, ✕/re-clic cierra) y SOLO entonces se consulta `GET /pendientes` (backend: `integrappi/README.md` 2026-11-10); con la tabla abierta, cambiar filtros re-consulta (`firmaFiltrosGuias` vs `firmaPendCargados`). La tabla: columnas ordenables (asc→desc→origen), buscador guía/destinatario/ciudad, guía clicable → Trazabilidad, zebra+hover, **botón Excel** (SheetJS dinámico) con TODAS las guías de la sección respetando los filtros del dashboard (el buscador NO filtra el export), y el camión Lottie mientras carga. «No aplica» sin columna de días (sin límite evaluable por definición), la más reciente primero.
- **Guía clicable** (solo `modoExterno`): en el modal del detalle del día (zoom de día del OT) y en las tablas de pendientes, la guía es un link (`DC-guiaLinkTraza`) que abre `?pestana=trazabilidad&guia=<nº>` en una **pestaña nueva**; la pestaña Trazabilidad al montar con `?guia=` consulta esa guía de una vez y limpia el parámetro (volver a la pestaña no re-consulta).
- **ANULADAS** (caso 801232571): chip morado **«⊘ Anulada»** en el bloque On Time de la Trazabilidad («cuenta como cumplida»), «⊘ Anul.» en la columna OT del informe y del detalle del día, y «SÍ (anulada)» en el Cumplió de los Excel — el backend las manda a «Con novedad» (ver `integrappi/README.md` 2026-11-10).
- **Zoom de día — etiquetas del eje Y clicables**: en «On Time por período» (vista de día), la etiqueta del segmento («Con novedad», «Pendientes»…) abre el MISMO detalle que tocar la barra (mismo toggle) — con pocas guías la barra queda demasiado angosta para darle (`tickSegmentoDia` + `.DC-tickSegmento`, hover azul subrayado, teclado Enter/Espacio). ⚠️ **Trampas recharts**: en los ticks custom el texto va en **`props.payload.value`**, NO en `props.value` (undefined → etiquetas desaparecen); y `x`/`y` son el punto de ANCLAJE del texto (**y = CENTRO de la fila**, igual que el render por defecto con `verticalAnchor="middle"`) — sumarle `height/2` corre la etiqueta media fila hacia abajo y queda al lado de la barra siguiente. Además el tipo del `tick` exige retornar SIEMPRE un elemento (sin `return null`).

### Camión Lottie de marca en la espera de la Trazabilidad (`CamionCargando`)

Al consultar una guía, en vez del texto plano «Buscando la guía…» sale un **camión animado Lottie de marca** (caja verde #98C74C + cabina oscura + ruedas girando + pista pasando + rebote de suspensión, 2 s de loop perfecto). Componente **reutilizable**: `Componentes/CamionCargando` (`{texto, alto}`) — dependencia nueva **`lottie-react`**, con import DINÁMICO al montar (patrón XLSX/@react-pdf: ~250KB fuera del bundle inicial); la animación (`camion.json`) es un Lottie **escrito a mano con builder** (no hay asset externo con licencia). Respeta `prefers-reduced-motion` (emoji 🚛 + texto). ⚠️ **Trampa Lottie**: el `tr` (transform) de cada grupo debe ir como **ÚLTIMO item DENTRO de `it`** — como hermano de `it` lottie lo ignora silenciosamente y no renderiza NADA (0 `<path>`, sin error). Validado con Edge headless (`--dump-dom` + `--screenshot` + análisis de píxeles). Dep solo frontend.

## Actualizaciones Recientes (2026-11-20)

### UsoPortalKP (/indicadores/uso-kabi) — reunión-ready + header de la app

Rework de la página de telemetría para presentársela al cliente (backend: `integrappi/README.md` 2026-11-20 — params `audiencia` y `usuario_filtro`).

- **Filtro Audiencia** (Todos / Clientes (externos)=perfil CLIENTE / Usuarios internos): aplica AL INSTANTE al cambiar (no requiere «Consultar»).
- **Foco en un usuario**: buscador por nombre (sugerencias con nombre+usuario+perfil, insensible a acentos, desde la 2ª letra; lista sale de `por_usuario` del rango) — clic → `usuario_filtro` acota TODO el resumen. También **clic en cualquier fila de la tabla** enfoca ese usuario. `consultar(overrides?)` acepta `{foco, audiencia, cliente}` para aplicar sin esperar re-render; ⚠️ el botón Consultar debe ser `onClick={() => consultar()}` (NO `onClick={consultar}` o el MouseEvent entra como override).
- **Migas de filtros aplicados** (patrón DC-miga): 📅 rango (fijo) + 🏢 portal + 👥 audiencia + 👤 foco como chips removibles — clic = quita y re-consulta.
- **Tabla de usuarios**: SIN columna Usuario (nombre basta) y ordenada por **última conexión DESC** (la más reciente arriba; orden solo front — backend sigue por eventos y el Excel usa ese orden).
- **Barras de «Actividad por día»** con la cantidad ENCIMA de cada barra (`.UP-barraValor`).
- **Header ESPEJO del DC-header** del portal: logo Integra ONE (clic→menú indicadores), título centrado, píldora de usuario con menú (Menú de indicadores / Cerrar sesión con limpieza de cookies), sticky, **ancho completo** (sin max-width 1200, `.UP-main` también) y las reglas de MÓVIL del DC-header (≤768px: título a la 1ª fila a ancho completo, logo+usuario en la 2ª, userInfo oculto).
- Dep **backend + frontend JUNTOS** (backend antes si se separa: FastAPI ignora params desconocidos).

## Actualizaciones Recientes (2026-11-19)

### Otros Costos — devolución dirigida y retorno directo en la UI

Cambio de backend (ver `integrappi/README.md` 2026-11-19): la devolución de una solicitud ya avanzada puede ir a la etapa del responsable del error y volver directo a quien la devolvió, sin repetir toda la cadena.

- **Modal «Devolver» con elección de etapa** (`OtrosCostosP`): cuando el usuario es FINANCIERO/ADMIN y la solicitud está aprobada con trámite OK (su bandeja), el Swal muestra radio **Analista (trámite Vulcano)** — el error fue del registro en Vulcano, corrige y vuelve directo a Financiero — vs **Operativo (creador)** — error de los datos de la solicitud — + textarea de motivo (obligatorio). En el resto de casos el modal es el de siempre (va al creador).
- **Al reenviar una devuelta con punto de retorno**: si `devolucion_info.estado_retorno` existe (fue devuelta estando ya avanzada), «Enviar a aprobación» abre la elección **Retorno directo a {Financiero (lista para pagar) / Analista (trámite Vulcano)}** vs **Toda la cadena** (aprobación → trámite → pago). El plain `enviarAprobacion` de siempre cuando no hay punto de retorno.
- **Indicadores**: bajo el badge de estado en la bandeja, línea ámbar `↩ a trámite Analista · tras corregir puede volver a Financiero (lista para pagar)` (`.OC-devolucionHint`, motivo en el tooltip); en el modal de detalle, aviso naranja (`.OC-avisoDevolucion`) con quién devolvió, motivo y las dos opciones al reenviar. La devolución también queda en la Trazabilidad (movimiento `devolucion` con `devuelto_a`).
- `otrosCostos.tsx`: `devolverSolicitud` suma `devolverA` ('operativo'|'tramite'), `enviarAprobacion` suma `retornoDirecto`, y `OtroCosto` suma `devolucion_info`. Dep backend + frontend JUNTOS.

## Actualizaciones Recientes (2026-11-19, 2.ª tanda)

### SolicitudVehiculos — espejo de «uso < 50% → CONTROL»

Cambio de backend (ver `integrappi/README.md` 2026-11-19 2.ª tanda): una planilla cuyo % de uso del vehículo sea **< 50%** pasa a `REQUIERE_APROBACION_CONTROL` aunque el flete cumpla. En `SolicitudVehiculos/page.tsx`, helpers `requiereAutorizacionControlUso` (usa el `usoVehiculoSolicitado` compartido; sin tipo evaluable no aplica) y `conControlPorUso` (wrapper que sube PREAPROBADO/COORDINADOR → CONTROL), aplicados en `determinarEstado`, `calcularEstadoPorValores` y los 2 cálculos de estado del modal de edición — mismo patrón que `requiereAutorizacionMunicipio`. La fila queda roja con badge CONTROL automáticamente y el botón Aprobar respeta las reglas de siempre (solo CONTROL/ADMIN aprueban ese tier). **Pedidos no cambió en el frontend** (el estado llega del backend). Dep backend + frontend JUNTOS.

## Actualizaciones Recientes (2026-11-17)

### WhatsApp como segundo canal: autorización de datos y verificación de cuenta

Motivación de soporte: los implicados «crean un correo y el link no llega» y quedan
atascados sin poder continuar (cambio backend en `integrappi/README.md` 2026-11-17;
requiere las plantillas Meta `autorizacion_datos`, `enruta_continuar_registro`
y `recordatorio_cuenta`, pendientes de aprobación — la del registro EVITA
lenguaje de verificación en nombre/cuerpo porque Meta reclasifica eso a
Autenticación, categoría que no admite enlaces con URL).

- **RegistroConductor**: campo **«Celular — WhatsApp (opcional)»** (el formulario no
  lo pedía desde el 2026-10-06) — el enlace de verificación llega por correo **y**
  WhatsApp desde el primer minuto; la vista post-registro menciona ambos canales.
- **TarjetaHabeasData** (pestañas Estudios/Cambios y Estudios por antigüedad):
  campo «WhatsApp (opcional)» junto al correo (prellenado de `condCelular`/
  `propCelular`/`tenedCelular` de la ficha) en el envío manual por persona; el Swal
  reporta si el WA llegó (`whatsapp: true` = 200 de Meta); etiqueta de canal
  **«Link por WhatsApp»** (`vinculo_whatsapp`) y el aviso de link pendiente muestra
  «…y por WhatsApp a +57 …» (`token_pendiente_celular`).
- **Estudios por antigüedad (`/revision/estudios`)**: botón ✈️ **«Reenviar»** junto al
  chip ⏳ de la columna «Autorización de datos» — confirmación y reenvío MASIVO
  (correo + WhatsApp) a todas las personas pendientes de la placa
  (`POST /conductores/autorizacion/reenviar-pendientes`), con resumen por cédula
  («CC X → correo + WhatsApp ✓» / «sin correo en la ficha»).
- **Cuentas sin vehículo (`VistaAlta`)**: Reenviar y Recordatorio abren un Swal con
  **DOS campos editables — CORREO y CELULAR**. El correo corregible en el mismo
  reenvío resuelve el caso **GMAIL.XOM** (sin el fix, el WhatsApp rescataba la
  activación pero la cuenta quedaba «✓ Verificado» con un correo muerto: recuperar
  clave, recordatorios e invitaciones fallarían para siempre). El backend valida
  dominio y colisión con otra cuenta, persiste lo corregido y reporta si el WhatsApp
  llegó de verdad.

⚠️ **No confundir los enlaces**: `/VerificarCorreo` (48 h) = activar la CUENTA;
`/AutorizacionDatos` (30 días) = habeas data. Dep **backend + frontend JUNTOS**.

## Actualizaciones Recientes (2026-11-18)

### Rebranding: logo «Integra ONE» + headers claros en toda la app

El wordmark de texto `IntegrApp` (con el ícono albatros) que mostraban todos los
headers fue reemplazado por el logo corporativo nuevo
`https://storage.googleapis.com/integrapp/Imagenes/logo_integra_ONE.png`
(horizontal 3622×721, ratio ~5:1, texto NEGRO + emblema verde, transparente).
Como el texto del logo es negro, **todos los headers pasaron de negro `#000` a
fondo claro** (revierte el branding negro del 2026-10-31), replicando el patrón
que ya existía en `LoginUsuarios` (LU) y el `DC-portalClaro` del portal Kabi.

- **Constante compartida** `src/Funciones/logoIntegra.ts` (`LOGO_INTEGRA`) — única
  fuente de la URL. Uso: `<Image src={LOGO_INTEGRA} width={201} height={40} />`
  (`remotePatterns` de `storage.googleapis.com` ya existía en `next.config.mjs`;
  precedente de logos remotos GCS en `IndicadoresClientes/clientes.ts`).
- **Patrón claro aplicado** (mapeo oscuro→claro): fondo `#fff` +
  `border-bottom: 2px solid #8EC045` (filo lima), texto `#111827`, suaves
  `#6b7280`, iconos/chevron `#9ca3af`, pill usuario `#f3f4f6` / borde `#e5e7eb` /
  hover `#e8eaed`, acento `#349F4A`, tab activo `#E8F5E9`, sombra
  `rgba(15,23,42,0.06)`. Los dropdowns ya eran blancos (no se tocaron).
- **Alcance (~26 headers)**: componentes `HeaderApp`, `HeaderSesion`,
  `HeaderLogo` (conserva subtítulo «Cadena De Servicios»), `NavMedicalCare`
  (arrastra ~15 páginas), `Barra`, `IndicadoresChrome` (`.IG-header` única; el
  contenido interno navy NO se tocó); páginas VC (`VerificarCorreo` +
  `AutorizacionDatos` + `AceptarInvitacion`), `CertificadoLaboralP`,
  `AdminSeguridadP`, `TarifasP`, `/indicadores` (IM), LC (`LoginConductores` +
  `RegistroConductor` + `OlvidoClaveConductor`), `OlvidoClaveBaseUsuario`,
  `PanelConductores`, `PanelClientes`, `PanelMisClientes`, `Pedidos` (con tabs),
  `PedidosCompletados`, `IndicadoresCostoOperacion`, `DashboardCliente` (la base
  oscura pasó a clara; el override `DC-portalClaro` queda redundante pero
  inofensivo), landing `/`, `revision` (`revx-topbar` blanca + logo en sidebar),
  `LoginUsuarios`, `VerificarEstudio`, `ModulosP` (sidebar + logo central).
- **Sin cambio**: footers oscuros `#0f1928`, logos grandes de las tarjetas de
  login (`LC-cardHeader`, `OCBU-cardHeader`, tarjeta LU), contenido interno navy
  de Indicadores y `<h1>Integr</h1>` legados (`SeleccionEstados`, `Registro`,
  `Olvidoclave`).

### Footers: fuera teléfono y correo, dentro «Integra Technologies»

En 17 páginas, las dos líneas de contacto del footer
(`tel:+573125443396` + `mailto:edwin.zarate@integralogistica.com`) fueron
reemplazadas por UN solo `<span>` (mismo estilo de los links del footer):

```
Integra Technologies @ {new Date().getFullYear()} – GAMP 5 & ALCOA+
```

El año es dinámico (hoy «2026»). Se CONSERVAN la línea
«© … Integra Cadena de Servicios S.A.S.» y «Colombia». Imports
`FaPhone`/`FaEnvelope` limpiados en los archivos afectados (`TarjetaHabeasData`
sigue usando `FaEnvelope` para el reenvío de habeas data). Archivos: `TarifasP`,
`InicioPropietarios`, `SolicitudVehiculos`, `HistoricoPedidosP`,
`RegistroConductor`, `GestionUsuariosP`, `OlvidoClaveConductor`,
`GestionTarifasRutasP`, `CertificadoLaboralP`, `Pedidos`, `PedidosCompletados`,
`GestionDivipolasP`, `GestionPacientes`, `MedicalCareP`, `app/page.tsx`,
`LoginUsuarios`, `LoginConductores`.

⚠️ Trampa de verificación: las páginas `ssr:false` (dynamic import) salen EN
BLANCO en screenshot Edge headless sin más — usar `--virtual-time-budget=10000`;
y para servir el export local (basePath `/integrapp`) hay que montarlo bajo un
junction `_root/integrapp → out`. Dep **SOLO frontend**.

## Actualizaciones Recientes (2026-11-19)

### Telemetría de uso del portal de clientes — beacons + página «Uso del Portal»

Mide la adopción del portal de clientes (quién entra, con qué frecuencia, qué
pestañas y acciones usa) para reportar números al cliente. Cambio de backend
asociado en `integrappi/README.md` (2026-11-19).

- **Beacons** (`Paginas/IndicadoresClientes/DashboardCliente/telemetria.ts`):
  `registrarEvento()` hace POST `keepalive` fire-and-forget a
  `/telemetria/evento` (`.catch(() => {})` — jamás toca la UI). Sesión =
  `crypto.randomUUID()` en `sessionStorage` (una por pestaña del navegador);
  usuario desde la cookie `usuarioPedidosCookie` (sin cookie → no manda nada).
  Al instrumentar el componente compartido se cubren los 5 wrappers (Kabi y
  Medical Care, externo e interno): `cliente_id` + `modo` distinguen. Eventos:
  `pageview` (useEffect de cookies al montar, con ref `pageviewEnviado`
  anti-StrictMode; incluye la pestaña inicial de `?pestana=`), `pestana`
  (`cambiarPestana`), `consulta_guia` (`consultarGuiaSiscore`, cubre el
  auto-arranque por `?guia=`), `pendientes` (`alternarTablaPend`, SOLO al
  abrir y fuera del updater) y `export_excel` (los 4: pendientes, uso,
  guías, OT).
- **Página `/indicadores/uso-kabi`** (`Paginas/UsoPortalKP`, prefijo `UP-*`,
  tema claro del sistema de diseño Integra): solo ADMIN (gate por cookie).
  Filtros rango `desde/hasta` (default 30 días) + portal; 4 KPIs; barras CSS
  por día (una serie, sin leyenda, tooltip por columna); tabla de usuarios
  (perfil, días activos, última conexión, desglose por acción en chips);
  mini tablas pestañas/acciones/portal; **Excel SheetJS dinámico de 3 hojas**
  (Usuarios / Por día / Eventos). Tarjeta «Uso del Portal (telemetría)»
  solo-ADMIN en `/indicadores` (`indicadoresTelemetria` en
  `app/indicadores/page.tsx`).
- Los eventos se empiezan a acumular SOLO tras el deploy. Dep **backend +
  frontend JUNTOS** (los beacons necesitan el endpoint vivo).

## Actualizaciones Recientes (2026-11-23)

### Auditoría de tarifarios: CONTROL edita + historial de cambios

Cambio de backend asociado en `integrappi/README.md` (2026-11-23). Colección
nueva `historial_tarifas` audita quién/cuándo/qué en TODA escritura de los dos
tarifarios (creación/edición/eliminación/carga masiva, con diffs antes→después
y snapshots de lo borrado).

- **Permisos**: `/GestionTarifasRutas` pasa de solo ADMIN a **ADMIN + CONTROL**
  (guard de `GestionTarifasRutasP`); `/Tarifas` queda **solo lectura** para
  perfiles ≠ ADMIN/CONTROL (sin botones de edición, Exportar sigue para todos).
  Ítem «Tarifas» del menú de usuario de Pedidos y PedidosCompletados ahora
  ADMIN+CONTROL (antes solo ADMIN — CONTROL no tenía camino a la página).
- **`Componentes/ModalHistorialTarifas`** (nuevo, `MHT-*`): botón «Historial»
  en ambas páginas (ADMIN/CONTROL) con tabla de eventos (hora Colombia,
  usuario+rol, acción con color, diffs, snapshot expandible, filtro tarifario,
  export xlsx). Es el único lugar donde se ven eliminaciones y cargas masivas.
- **`HistorialPorRegistro`** (exportado del mismo archivo): sección
  «Historial de esta tarifa» dentro del modal de EDICIÓN de ambos tarifarios —
  línea de tiempo de lo que ha sufrido esa tarifa. En `/Tarifas` incluye las
  cargas masivas (reemplazan TODO el tarifario); en GTR se ancla a los valores
  originales (`modalEditar`), no al form en edición.
- **API clients**: `fletes.tsx`/`tarifasRutasFmc.tsx` exigen `usuario`
  (cookie `usuarioPedidosCookie`) en toda escritura — el backend resuelve el
  perfil REAL en baseusuarios y rechaza con 403 si no es ADMIN/CONTROL. Nuevo
  `historialTarifas.tsx` (`obtenerHistorialTarifas` con filtros
  tarifario/registro/acción/incluirMasivas).
- Dep **backend PRIMERO**, luego frontend (frontend nuevo sin backend nuevo →
  escrituras fallan con 422 por falta de `usuario`).

## Actualizaciones Recientes (2026-11-24)

### Nuevo módulo: Módulo Financiero (`/Financiero/*`)

Réplica interna del módulo financiero externo, con el sistema de diseño Integra (header claro + filo lima, clases `fin-*`). 9 rutas estáticas: **Inicio** (tarjetas de indicadores según el rol del módulo), Traslados, Viajes, Requisiciones (+OC), Facturas DIAN, Pagos urgentes, Servicios públicos, Cajas menores y Administración (usuarios/bitácora/respaldo/parámetros — solo admin del módulo).

- **Entrada**: grupo **FINANZAS** en `/Modulos` (`menuModulos.ts`). El acceso real lo controla el módulo por **correo** (`fin.usuarios`): ver la tarjeta sin estar dado de alta muestra «No tienes acceso». El perfil FINANCIERO de IntegrApp **no se tocó** (sigue aterrizando en Otros Costos).
- **Sesión**: `Paginas/FinancieroP/nucleo/` canjea el token de IntegrApp (`baseUsuarioAccessToken`, 20 min) por una sesión de módulo de 12 h (`finAccessToken`) vía `POST /fin/auth/sesion`; 401 → login de IntegrApp. Polling 25 s (sin WS).
- **Capa API**: `src/Funciones/ApiPedidos/financiero.ts` (Bearer; descargas por fetch+blob). Diálogos Swal compartidos en `nucleo/dialogos.ts`.
- Backend asociado: `integrappi` (schema `fin` de Postgres — ver `docs/financiero.md` allí). Deploy backend PRIMERO.

### Módulo Financiero — 2.ª tanda (2026-11-24, post-F6)

- **Perfil FINANCIERO elige destino**: `/EleccionFinanciero` (tarjetas Otros Costos ⬅➡ Módulo Financiero); `LoginUsuarios` redirige ahí en ambos puntos.
- **`/Modulos` blindado**: los perfiles micro-portal (FINANCIERO, VISUALIZADOR, CLIENTE, CLIENTE_ESTUDIOS, PADRINO, Seguridad) que entren por URL se redirigen a su hogar; ítem «Planeación» ahora solo ADMIN.
- **UX del módulo**: modales con scroll interno y pie fijo que crecen con la pantalla (`--fin-ancho`); permisos por sección como lista de switches con estado (igual que el rol / ajustado); alta de usuarios con autocompletado de FINANCIEROS reales (correo/nombre/username derivados, sin texto libre).
- **GestionUsuarios**: checkbox «Recibir WhatsApp de Otros Costos» por usuario (`notificar_otros_costos`).

## Actualizaciones Recientes (2026-11-25)

### Seguridad convierte un CONDUCTOR con placa propia en TENEDOR (cambio backend asociado en `integrappi/README.md` 2026-11-25)

- **`/revision/alta` — tarjeta «🔎 Buscar cuenta y corregir su perfil»** (`VistaAlta.tsx`, sección Cuentas sin vehículo): búsqueda libre por correo/cédula/nombre (`GET /conductores/buscar`) SIN necesidad de una placa pendiente del alta — el caso nuevo (CONDUCTOR que ya inscribió su placa y necesita registrar más) no aparecía en ninguna vista. Tabla con Nombre/Correo/Perfil/**Placas propias/Placas invitado** y acción «Corregir perfil», deshabilitada con explicación en el tooltip cuando la cuenta es conductor invitado (no puede ser TENEDOR) o TENEDOR con placas (no puede volver a CONDUCTOR).
- **`cambiarPerfil` generalizado**: sirve para las 3 tablas (sin vehículo, alta, búsqueda); envía `solicitante` (`nombreSeguridad()` de `impersonacion.ts`) — el backend lo exige y rechaza con 403 sin él. Swal direccional: →TENEDOR avisa que podrá registrar varias placas, sigue conduciendo su placa, ya no podrá ser conductor invitado y queda auditado; →CONDUCTOR solo sin ninguna placa. Actualización optimista en las 3 listas.
- **Paso 2 del alta**: los resultados de búsqueda ganan el botón «Corregir perfil» — la advertencia «Para varias placas la cuenta debe ser TENEDOR» quedó accionable.
- **`PanelConductores`**: `esTenedor` pasó de leerse de la cookie en cada render a **estado** (`perfilCuenta`); la carga de vehículos refresca cookie + estado con el `perfil` que ahora devuelve `obtener-vehiculos` → el conductor desbloquea «Registrar vehículo» e invitaciones SIN re-loguearse tras la corrección de Seguridad.
- Dep backend + frontend JUNTOS (si se separan, frontend primero: el backend viejo ignora `solicitante`).

## Actualizaciones Recientes (2026-11-25, «poner en orden la casa»)

### Otros Costos y Gestión de Usuarios salen del portal Medical Care → módulos del hub /Modulos

Cambio backend asociado en `integrappi/README.md` (2026-11-25). El menú de Medical Care dejaba de reflejar la realidad (Otros Costos es transversal a todos los clientes; Gestión de Usuarios es administración de la app, no de un portal).

- **`Funciones/menuModulos.ts`**: grupo nuevo **OTROS COSTOS** (ítems `oc_activos` → `/OtrosCostos` y `oc_historico` → `/HistoricoOtrosCostos`, para ADMIN/ANALISTA/CONTROL/COORDINADOR/OPERATIVO/DESPACHADOR — `PERFILES_OTROS_COSTOS`; navegan con `destino` plano, SIN `portal`: los guards de esas páginas leen solo usuario/perfil) y grupo nuevo **ADMINISTRACIÓN** (`gestion_usuarios` → `/GestionUsuarios`, solo ADMIN).
- **`Componentes/HeaderModulo`** (nuevo, prefijo `HM-*`): header propio estilo UP-/DC-header (logo Integra ONE, título, pill usuario, logout que barre TODAS las cookies por sufijo/prefijo + tokens) con `enlaces` contextuales en píldoras. Reemplaza NavMedicalCare en `OtrosCostosP`, `HistoricoOtrosCostosP` y `GestionUsuariosP`.
  - **FINANCIERO** (micro-portal): su «atrás» en Otros Costos es `/EleccionFinanciero` + enlace directo a **Estado de Vehículos** (conserva el camino al informe bancario que antes tenía desde el nav). `EleccionFinancieroP.irAOtrosCostos` CONSERVA la cookie `clientePedidosCookie=MEDICAL_CARE` (inocua para Otros Costos, necesaria si navega a EstadoVehiculos).
- **`NavMedicalCare`**: fuera los ítems `usuarios`, `otroscostos`, `historicooc` (y del union `PaginaMC`); filtro FINANCIERO → solo `estadovehiculos`; VISUALIZADOR → solo `historico` (su entrada al Histórico OC sigue siendo la tarjeta de `/indicadores`). Dropdowns de `Pedidos` y `PedidosCompletados`: fuera «Gestión de usuarios» (Tarifas se queda).
- **`Funciones/hogarPorPerfil.ts`** (nuevo): el mapa micro-portal (FINANCIERO→/EleccionFinanciero, VISUALIZADOR→/indicadores, …) extraído de ModulosP; los guards de OtrosCostosP/HistoricoOtrosCostosP ahora expulsan al HOGAR del perfil (antes a /MedicalCare).
- Dep backend + frontend JUNTOS (mejor backend primero: perfiles-meta y telemetría extendida; el frontend degrada bien con backend viejo salvo los beacons generales).

### GestionUsuarios — crear usuarios con la matriz de perfiles entendible

- **`Funciones/perfilMeta.ts`** (nuevo): espejo del `PERFILES_META` del backend + `agruparPerfiles()` (optgroup por grupo; LEGADO al final; `excluirLegado` para el form de alta). Best-effort: intenta `GET /baseusuarios/perfiles-meta`, cae al local.
- **Form «Nuevo usuario»**: select con **optgroup** por grupo + panel explicativo del perfil elegido (badge de grupo con color, descripción, chips «puede», aviso ámbar «Este perfil NO ingresa a la aplicación» para CLIENTE_FMC/legado). CONDUCTOR ya no se ofrece (F8 del backend); el select de la TABLA agrega el perfil del usuario si ya no está en la matriz (cuentas legado). `PERFILES_FALLBACK` alineado con el backend.
- El backend ahora rechaza perfiles fuera de la matriz con 422 (blindaje en POST y PATCH perfil).

### Telemetría general de la app (pageviews + acciones) y dashboard «Uso de la App»

- **`Funciones/telemetriaApp.ts`** (nuevo): beacon fire-and-forget (mismo patrón del portal Kabi, MISMA sesión `tlm_sesion` compartida por pestaña). Identidad: `usuarioPedidosCookie` (app) o `conductorCorreo` (portal de conductores, módulo fijo `conductores`); sin identidad → no-op (logins públicos no miden). Tabla `MODULOS_POR_RUTA` (prefijo→módulo, orden importa), `trackPageview`, `trackAccion(accion, detalle)` y `trackLogin(tipo, usuario)`.
- **`Componentes/TelemetriaGlobal`** (nuevo, sin UI) montado en `ClientProviders`: un pageview por CAMBIO de ruta en TODA la app (`usePathname` + dedupe `useRef` anti-StrictMode; basePath stripeado defensivamente). **Skip `/indicadores*`**: el portal de clientes ya instrumenta sus páginas (evita duplicar).
- **Acciones instrumentadas** (1 `trackAccion` por handler): `buscar_solicitud` (SolicitudVehiculos), `export_excel` (OtrosCostos, HistóricoOC, HistóricoPedidos, Cruce), `recalcular_cruce`, `crear_oc/editar_oc/aprobar_oc/rechazar_oc/devolver_oc/anular_oc/tramite_vulcano_oc/pagar_oc/importar_pagos` (OtrosCostos), `cargar_excel_citas` (CitasEntrega), `cargar_excel_novedades` (NovedadesOT), `crear_usuario/cambiar_perfil/reset_clave` (GestionUsuarios), `login` (LoginUsuarios y LoginConductores).
- **`Paginas/UsoAppP` + `/indicadores/uso-app`** (nuevo, solo ADMIN; reutiliza estilos UP-* de UsoPortalKP + `UA-*` propios): filtros rango/módulo/usuario-foco, 4 KPIs, **histograma por hora 0-23** (horas pico, hora Colombia computada en backend), **tabla por módulo** (eventos, usuarios, % y barra; clic filtra el módulo), actividad por día, tabla de usuarios, Excel de 5 hojas. Tarjeta «Uso de la App (telemetría general)» en el menú `/indicadores` (se mantiene la de uso-kabi). Página SEPARADA de uso-kabi a propósito: ese reporte se presenta al cliente Kabi y no debe mezclarse con eventos internos.
- ⚠️ **Deploy backend PRIMERO** (los beacons generales van sin `cliente_id`: contra el backend viejo mueren en 422 silencioso). Los datos empiezan a acumularse desde el deploy.

## Actualizaciones Recientes (2026-11-25, 2.ª tanda — el hub concentra TODA la navegación)

### Submenús de portales en /Modulos (Kabi y Medical Care despliegan todas sus opciones)

- **`Funciones/menuModulos.ts`**: tipo nuevo **`ItemModuloHijo`** (1 nivel, siempre navegación interna) y `ItemModulo.hijos?`. **Kabi** despliega: Gestión de Pedidos, Pedidos Completados, Tarifas (ADMIN/CONTROL) — portal KABI. **Medical Care** despliega sus 13 páginas (Inicio, Pacientes, Pedidos V3, Cruce, Solicitud de Vehículos, Tarifas Rutas FMC, Divipolas, Historial Pedidos, Pedidos Anulados, Cuentas por Placa, Estado de Vehículos, Novedades OT, Citas de Entrega) — todas con `portal: MEDICAL_CARE` (las 5 páginas que expulsan por cookie de portal siguen cuadrando). Visibilidad: mapa exportado **`PERFILES_POR_ITEM_MC`/`PERFILES_POR_ITEM_KB`** (única fuente de verdad, espejo de los guards de cada página) y `construirMenu` refactorizado de switch a mapa de predicados `VISIBILIDAD`; filtra ítems y hijos (un padre sin hijos visibles sigue mostrándose: navega a la home).
- **`Paginas/ModulosP`**: padres con fila principal (navega a la home del portal) + chevron que despliega hijos (`padresAbiertos`, cerrados por defecto; hojas con indentación extra `modx-nav-item--hoja`).

### Sidebar colapsable (riel de iconos)

- Botón «.Contraer/Expandir» junto al logo (`.modx-toggle`, FaAngleDoubleLeft/Right) alterna expandida (252px) ↔ **riel de 64px** con solo iconos (tooltips nativos title). Estado en `localStorage['integrapp.modx.sidebarColapsada']`, leído en el effect de sesión (NUNCA en render: shell prerenderizada con output:export). En riel: ítems directos navegan; grupos y padres EXPANDEN la sidebar y abren su contenido. ⚠️ El bloque CSS `modx-app--colapsada` va SIEMPRE antes del media query ≤768px (el móvil revierte todo con `display:revert` y oculta el toggle).

### NavMedicalCare ELIMINADO — HeaderModulo en todas las páginas

- Las 13 páginas del portal Medical Care (15 instancias: NovedadesOT y CitasEntrega tienen 2 renders cada una) pasaron de `<NavMedicalCare>` a `<HeaderModulo titulo="…">`: Medical Care, Pacientes, Pedidos V3, Cruce Pacientes↔V3, Solicitud de Vehículos, Tarifas Rutas FMC, Divipolas, Historial Pedidos, Pedidos Anulados, Cuentas por Placa, Estado de Vehículos, Novedades OT, Citas de Entrega. Componente `Componentes/NavMedicalCare` borrado (sin consumidores; los casos FINANCIERO/VISUALIZADOR de su filtro desaparecen — llegan por /EleccionFinanciero y /indicadores).
- **HeaderModulo**: el logo y el ítem «Torre de Control» ahora navegan a `hogarPorPerfil()` (FINANCIERO→/EleccionFinanciero, VISUALIZADOR→/indicadores, resto→/Modulos).
- **Dropdowns de Pedidos/PedidosCompletados**: fuera «Ir a Medical», «Pedidos Completados»/«Gestión de Pedidos», «Indicadores» y «Tarifas»; queda «Torre de Control» + «Cerrar sesión». FAB y headers propios intactos. Los h1 del cuerpo de las páginas MC quedaron intactos (limpieza opcional futura).
- Dep **SOLO frontend**. La telemetría general ya cubre las rutas (MODULOS_POR_RUTA).

## Actualizaciones Recientes (2026-11-25, 3.ª tanda — modal «Notificaciones» unificado)

Cambio backend asociado en `integrappi/README.md` (2026-11-25, 3.ª tanda).

- **Modal «🔔 Notificaciones»** (GestionUsuarios, campana de la fila — ahora visible para TODOS los usuarios, badge con nº de suscripciones activas): un solo lugar muestra TODO lo que la persona recibe, con guardado instantáneo por toggle (patrón del viejo modal MC). Secciones según perfil: 📧 **Placas aprobadas** (FINANCIERO, flag `notificar_placas`), 📧📱 **Placas pendientes de revisión** (SEGURIDAD, `notificar_revisiones`), 📱 **WhatsApp de Otros Costos** (`notificar_otros_costos`, con nota si el perfil no aplica; su checkbox salió del modal Editar usuario), 📧 **Correos Medical Care** (retraso/sin cruce, mismo PATCH de siempre; visible con portal MC o CLIENTE_FMC). Avisos «sin correo configurado» cuando no hay dato. El viejo modal «Notificaciones MC» desapareció.
- **API**: `actualizarDatosUsuario` acepta los 3 flags booleanos; `BaseUsuario` (tipos.tsx) suma `notificar_placas`/`notificar_revisiones`.
- Dep **backend PRIMERO**, luego frontend.

## Actualizaciones Recientes (2026-11-25, 4.ª tanda — lanzador global de módulos)

### La Torre de Control a un clic en TODAS las páginas

Problema: el sidebar solo existía en /Modulos — al entrar a un módulo el usuario perdía la navegación. Ahora una **pestaña vertical verde en el borde izquierdo** («MÓDULOS», fija, centrada) aparece en todas las páginas autenticadas; al tocarla se despliega la MISMA barra de módulos como **overlay** (la página no se mueve; Escape/fondo/navegar la cierran).

- **`Componentes/SidebarModulos`** (nuevo): el sidebar extraído de ModulosP como componente autónomo (lee sus cookies, `construirMenu`, `abrir()` con cookies de portal, popover usuario + logout). `modo="hub"` = comportamiento idéntico al de siempre en /Modulos (riel colapsable con localStorage); `modo="overlay"` = siempre expandida + callback `alNavegar` para cerrarse. Su CSS (`modx-sidebar*`/`modx-nav-*`/grupos/padres/riel) migró de ModulosP/estilos.css — con las variables de color definidas también en `.modx-sidebar` (el overlay no cuelga de `.modx-app`) y el override del riel como `.modx-app--colapsada .modx-sidebar`.
- **`Componentes/LanzadorModulos`** (nuevo, montado en `ClientProviders` junto a TelemetriaGlobal): pestaña + overlay. **Visibilidad**: solo con `usuarioPedidosCookie` Y `hogarPorPerfil() === '/Modulos'` (micro-portales FINANCIERO/VISUALIZADOR/CLIENTE y el portal de Seguridad con cookie SEGURIDAD NO la ven, igual que el hub); nunca en `/`, `/Modulos`, `/LoginUsuario` ni prefijos públicos; oculto en ≤768px. Bloquea el scroll del fondo mientras está abierto.
- `Paginas/ModulosP` quedó como shell fino (`<SidebarModulos modo="hub"/>` + lienzo).
- Dep SOLO frontend. Los pageviews de TelemetriaGlobal registran cada navegación desde el overlay.

## Actualizaciones Recientes (2026-11-25, 5.ª tanda — fuera la pantalla de botones de /MedicalCare)

Redundante con los submenús del hub (y el lanzador global): la pantalla de bienvenida de `/MedicalCare` fue **eliminada**. Sus dos funciones ADMIN/CONTROL que solo existían ahí fueron rescatadas.

- **`/ConfigMC` (nuevo, `Paginas/ConfigMCP` + `app/ConfigMC/page.tsx`)**: página con HeaderModulo y guard ADMIN/CONTROL que reúne **Causales de Fusión** (CRUD completo, `/siscore/causales*`) y **Sincronización V3** (toggle activo + horarios, `/sync-v3/*`) — APIs intactas. Ítem del submenú: `mc_config` «Causales y Sync» (ADMIN/CONTROL).
- **`/MedicalCare` → redirect a `/GestionPacientes`** (decisión del usuario; la ruta se conserva por bookmarks y guards). Todo el cuerpo de `MedicalCareP` (botones, vistas inline que duplicaban Cruce, modales) y su CSS fueron eliminados.
- **`menuModulos.ts`**: padre Medical Care apunta a `/GestionPacientes`; fuera el hijo `mc_inicio`.
- **Guards**: `PedidosAnuladosP`, `EstadoVehiculosP`, `CuentasPlacaP`, `CrucePacientesV3P`, `GestionPedidosV3P` e `HistoricoPedidosP` expulsan a `hogarPorPerfil()` (antes a /MedicalCare).
- Telemetría: `/ConfigMC` → módulo medical_care. Dep SOLO frontend.

### Ajuste (2026-11-25, 6.ª tanda): «Medical Care» se muestra como «Otros Clientes» y aterriza en Solicitud de Vehículos

- Solo el NOMBRE visible: el padre del hub ahora dice **«Otros Clientes»** (desc: Solicitud de Vehículos, pacientes, cruces e históricos) y su destino —igual que el redirect de `/MedicalCare`— es **`/SolicitudVehiculos`**. Id (`medical_care`), cookie de portal (`MEDICAL_CARE`) y rutas intactos: nada del backend ni guards cambia.

### Ajuste (2026-11-25, 7.ª tanda): fuera el campo «Usuario» del alta/edición de usuarios

El login de la app es por CORREO (estricto: `_buscar_baseusuario_activo` exige «@») — el campo `usuario` es un identificador interno (cookies de sesión, trazabilidad, telemetría) que nadie debería digitar. Form «Nuevo usuario»: fuera el campo Usuario; el **Correo pasa a ser obligatorio para todos los perfiles** (hint «con este correo entra a la aplicación») y `usuario` se **deriva** = correo en mayúsculas. Modal Editar: fuera el campo; si se cambia el correo, el usuario interno sigue al nuevo correo (si un histórico no tiene correo, se conserva su usuario actual). El backend no cambia (usuario sigue existiendo y único).

### Ajuste (2026-11-25, 8.ª tanda): lanzador visible dentro del portal de Seguridad

Bug de diseño del lanzador: la visibilidad usaba `hogarPorPerfil()`, que devuelve `/revision` cuando `clientePedidosCookie=SEGURIDAD` — así un ADMIN dentro de `/revision` quedaba SIN pestaña para volver. Ahora la visibilidad es **por PERFIL** (`esPerfilMicroPortal()`, nuevo helper de `hogarPorPerfil.ts`): solo FINANCIERO/VISUALIZADOR/CLIENTE/CLIENTE_ESTUDIOS/PADRINO no la ven; un multi-módulo la ve en cualquier página, incluida `/revision`. En `/revision` la pestaña se corre a la derecha de su sidebar (`.lmz-pestania--juntoSidebar`, left 262px; vuelve al borde en ≤900px, donde ese sidebar pasa a drawer).

### Ajuste (2026-11-25, 9.ª tanda): gráficos de uso apilados por módulo

En `/indicadores/uso-app`, «Actividad por hora del día» y «Actividad por día» ahora son **barras apiladas por módulo**: cada segmento es un módulo con color estable (paleta categórica; el orden de colores sigue a la tabla por módulo, de mayor a menor uso — el módulo más usado siempre tiene el mismo color en ambos gráficos; eventos del portal de clientes en gris). Leyenda de colores compartida entre los dos gráficos; tooltips con desglose (top 5 módulos); el Excel agrega columnas por módulo en las hojas Por día y Por hora. Backend (ver `integrappi/README.md` 9.ª tanda): `por_dia`/`por_hora` ganan `por_modulo` por cubeta — aditivo, uso-kabi intacto. Dep **backend PRIMERO** (las pilas llegan vacías contra el backend viejo, sin romper nada).

## Actualizaciones Recientes (2026-11-25, 10.ª tanda — header ÚNICO + efectos de temporada)

### Un solo header para toda la app interna

Los headers propios (Ped-*, PC-*, IM-*, UP-* de uso-app/uso-kabi y fin-header del Módulo Financiero) fueron ELIMINADOS: todas las páginas internas usan **`Componentes/HeaderModulo`** — un cambio de marca/UX toca UN componente. El pill de usuario ahora muestra `perfil · regional` en todas partes. El FAB de Pedidos vivía fuera del header y quedó intacto; el Financiero conserva su sesión (`AvisoSesion`) y gana subtítulo por sección (map `SUBTITULOS` en `FinancieroP`). Los CSS de headers muertos quedaron inertes en sus archivos (limpieza opcional). Fuera del alcance a propósito: /revision (shell con sidebar), DashboardCliente (cara al cliente), portal de conductores y logins públicos.

### Efectos de temporada configurables por el ADMIN (/Apariencia)

- **Backend** `rutas/apariencia.py`: colección `config_apariencia` (1 doc), catálogo `EFECTOS_VALIDOS` (ninguno, navidad, halloween, patrias, celebracion, san_valentin, semana_santa). `GET /apariencia` PÚBLICO con cache 60 s; `PUT` solo ADMIN (audita quién/cuándo, invalida cache). Tests: `tests/test_apariencia.py` (5).
- **Frontend**: `Funciones/efectosTemporada.ts` (catálogo único con color de acento) + `Componentes/EfectoTemporada` montado en `ClientProviders`: consulta el efecto (cache localStorage 5 min), pinta clase `efecto-<id>` en el `<body>` (filo del header unificado del color de la temporada) y renderiza partículas CSS puras (❄ 🦇 🇨🇴 💗 🕊 / confeti) en un overlay `pointer-events:none` z-930; `prefers-reduced-motion` → sin partículas (solo color).
- **Página `/Apariencia`** (`Paginas/AparienciaP`, guard ADMIN, ítem en el grupo ADMINISTRACIÓN): tarjetas por efecto con preview del color, confirmación Swal, aplica al instante (refresca el cache global) y muestra quién lo configuró y cuándo.
- Dep **backend PRIMERO** (sin él: sin partículas y la página admin muestra error claro — nada se rompe).

### Ajuste (2026-11-25, 11.ª tanda): fuera el botón «⬄ Módulos» del header + submenú IntegrApp

- **Enlaces de «atrás» fuera del header** (redundantes con la pestaña lateral del LanzadorModulos): las páginas internas ya no pasan `enlaces`. Excepción — micro-portales que NO ven el lanzador: FINANCIERO conserva «⬅ Inicio» + «Estado de Vehículos» en Otros Costos/Histórico OC, y VISUALIZADOR «⬄ Indicadores» en el Histórico OC (su única forma de volver).
- **INDICADORES → IntegrApp despliega submenú**: Indicadores por Cliente · Costo de Operación · Mis Indicadores (portal clientes — ADMIN/VISUALIZADOR/ANALISTA/OPERATIVO) · Uso de la App (ADMIN) · Uso del Portal (ADMIN). Mismas visibilidades que las tarjetas de /indicadores (la página de tarjetas sigue existiendo: es el hogar del VISUALIZADOR). Dep SOLO frontend.

### Ajuste (2026-11-25, 11.ª tanda bis): el efecto de temporada llega casi en vivo a los usuarios en línea

`EfectoTemporada` ahora RECONSULTA `/apariencia` cuando el usuario vuelve a enfocar la pestaña (`visibilitychange`/`focus`) si su caché local pasó 1 minuto (la caché sigue de 5 min para las cargas normales). Resultado: activas Navidad en /Apariencia y quienes están en línea la ven al volver a su pestaña — sin recargar la app.

### Fix (2026-11-25, 11.ª tanda bis 2): las partículas NO aparecían al activar el efecto

**Bug real reportado por el usuario**: al activar Navidad solo cambiaba el filo del header — sin copos. Causa: `EfectoTemporada` está montado desde el arranque con el estado inicial "ninguno"; la página /Apariencia actualizaba la caché y la clase del body (→ color) pero NADIE actualizaba el ESTADO del componente → el overlay nunca se renderizaba sin recargar. Fix con 3 vías de refresco: (1) evento local `efecto-temporada-cambiado` que dispara /Apariencia tras el PUT → partículas al instante en la misma sesión; (2) evento `storage` → las OTRAS pestañas del navegador se actualizan solas al cambiar la caché; (3) al enfocar la pestaña: caché fresca se APLICA al estado (antes solo se consultaba cuando estaba vieja) y caché >1 min reconsulta. Además: partículas con `drop-shadow` (el ❄ blanco no se veía sobre fondo blanco) y variantes por efecto (❄❅❆⛄, 🦇🎃👻, 💗❤️💕…).

### Ajuste (2026-11-25, 11.ª tanda bis 3): partículas SOLO en la franja del header

A pedido del usuario: los efectos NO van sobre el área de trabajo. El overlay de `EfectoTemporada` pasó de pantalla completa a `height: 64px` (la franja del header unificado) — los copos/calabazas/corazones caen dentro del header y desaparecen en su borde inferior; el resto de la pantalla queda limpio. Partículas recalibradas para el recorrido corto (más pequeñas y rápidas). El color de temporada del filo se mantiene.

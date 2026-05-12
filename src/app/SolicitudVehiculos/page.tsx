'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaSearch, FaCheckCircle, FaTimesCircle, FaTruck, FaPaperPlane, FaEdit, FaSave, FaTrash } from 'react-icons/fa';
import logo from '@/Imagenes/albatros.png';
import NavMedicalCare from '@/Componentes/NavMedicalCare';
import Swal from 'sweetalert2';
import './estilos.css';

interface RegistroSiscore {
  Planilla: string;
  Piezas: number;
  'Peso Real': number;
  Ruta: string;
  'Codigo Pedido': string;
  'Cliente Origen': string;
  'Cliente Destino': string;
  'Municipio Destino': string;
  'Departamento Destino': string;
  'Centro Costo'?: string;
  tipo_vehiculo?: string;
  tarifa_calculada?: number;
  [key: string]: string | number | undefined;
}

interface SolicitudPendiente {
  _id: string;
  planilla: string;
  piezas: number;
  peso_real: number;
  ruta: string;
  codigos_pedido: string;
  cantidad_pedidos: number;
  cliente_origen?: string;
  municipio_destino: string;
  departamento_destino: string;
  tarifa_calculada: number;
  tipo_vehiculo: string;
  total_solicitado: number;
  tarifa_base?: number;
  requiere_descargue: string;
  punto_adicional: boolean;
  desvio: boolean;
  tipo_veh_sicetac?: string;
  estado: string;
}

interface PlanillaResultado {
  planilla: string;
  encontrada: boolean;
  piezas: number;
  peso_real: number;
  ruta: string;
  codigo_pedido: string;
  cantidad_pedidos: number;
  cliente_origen: string;
  municipio_destino: string;
  departamento_destino: string;
  regional?: string;
  centro_costo?: string;
  tarifa_calculada?: number;
  tipo_vehiculo?: string;
  total_solicitado?: number;
  // Campos editables
  tarifa_base?: number;
  requiere_descargue?: string;
  punto_adicional?: boolean;
  desvio?: boolean;
  tipo_veh_sicetac?: string;
  guardado?: boolean;
  solicitando_id?: string;
}

const OPCIONES_VEHICULO = ['CARRY', 'NHR', 'TURBO', 'NIES', 'SENCILLO', 'PATINETA', 'TRACTOMULA'];

// Mapeo de bodegas a regionales
const REGIONAL_MAP: Record<string, string> = {
  'CO04': 'BARRANQUILLA',
  'CO05': 'CALI',
  'CO06': 'BUCARAMANGA',
  'CO07': 'FUNZA',
  'CO09': 'MEDELLIN'
};

const obtenerRegional = (bodega: string | undefined): string => {
  if (!bodega) return '-';
  return REGIONAL_MAP[bodega] || '-';
};

const SolicitudVehiculos: React.FC = () => {

  // Cargar resultados recientes automáticamente (global, sin filtro por usuario)
  const cargarResultadosRecientes = async () => {
    console.log('[cargarResultadosRecientes] Iniciando carga global');
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const url = `${API}/siscore/obtener-resultados-recientes?limite=100`;
      console.log('[cargarResultadosRecientes] URL:', url);
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        console.log('[cargarResultadosRecientes] Respuesta API:', data);
        console.log('[cargarResultadosRecientes] Cantidad planillas:', data.planillas?.length);

        // Nuevo formato: cada documento es una planilla independiente
        if (data.planillas && data.planillas.length > 0) {
          console.log('Restaurando planillas independientes:', data.planillas.length);
          const resultadosRestaurados: PlanillaResultado[] = data.planillas.map((p: any) => ({
            planilla: p.planilla,
            encontrada: p.encontrada || false,
            piezas: p.piezas || 0,
            peso_real: p.peso_real || 0,
            ruta: p.ruta || '-',
            codigo_pedido: p.codigo_pedido || '-',
            cantidad_pedidos: p.cantidad_pedidos || 0,
            cliente_origen: p.cliente_origen || '-',
            municipio_destino: p.municipio_destino || '-',
            departamento_destino: p.departamento_destino || '-',
            regional: p.regional,
            centro_costo: p.centro_costo,
            tarifa_calculada: p.tarifa_calculada || 0,
            tipo_vehiculo: p.tipo_vehiculo || 'N/A',
            total_solicitado: p.total_solicitado || 0,
            tarifa_base: p.tarifa_base,
            requiere_descargue: p.requiere_descargue || 'NO',
            punto_adicional: p.punto_adicional || false,
            desvio: p.desvio || false,
            tipo_veh_sicetac: p.tipo_veh_sicetac,
            guardado: true,
            solicitando_id: 'restaurado'
          }));
          setResultados(resultadosRestaurados);
          setMostrarPendientes(false);
          return;
        }

        // Compatibilidad con formato antiguo (a eliminar en futuro)
        if (data.busquedas && data.busquedas.length > 0) {
          const busqueda = data.busquedas[0];
          if (busqueda.resultados_consolidados && busqueda.resultados_consolidados.length > 0) {
            const resultadosRestaurados: PlanillaResultado[] = busqueda.resultados_consolidados.map((r: any) => ({
              ...r,
              guardado: true,
              solicitando_id: 'restaurado'
            }));
            setResultados(resultadosRestaurados);
            setMostrarPendientes(false);
            return;
          }
        }
      }
    } catch (error) {
      console.error('[cargarResultadosRecientes] Error:', error);
    }
  };

  // Valores de recargos (estos valores podrían venir de configuración)
  const RECARGOS = {
    descargue: 50000,      // Valor fijo por descargue
    punto_adicional: 80000, // Valor fijo por punto adicional
    desvio: 100000         // Valor fijo por desvío
  };

  const calcularTotalSolicitado = (resultado: PlanillaResultado): number => {
    // Base: tarifa_base si existe, si no tarifa_calculada
    const base = resultado.tarifa_base || resultado.tarifa_calculada || 0;

    // Sumar recargos
    let total = base;
    if (resultado.requiere_descargue === 'SI') {
      total += RECARGOS.descargue;
    }
    if (resultado.punto_adicional) {
      total += RECARGOS.punto_adicional;
    }
    if (resultado.desvio) {
      total += RECARGOS.desvio;
    }

    return total;
  };
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [centroDistribucion, setCentroDistribucion] = useState('');
  const [loading, setLoading] = useState(false);
  const [planillasInput, setPlanillasInput] = useState('');
  const [resultados, setResultados] = useState<PlanillaResultado[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudPendiente[]>([]);
  const [tiempoConsulta, setTiempoConsulta] = useState<number>(0);
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [modalDetalle, setModalDetalle] = useState<{ abierto: boolean; resultado: PlanillaResultado | null }>({ abierto: false, resultado: null });

  const PERFILES_GLOBALES = ['ADMIN', 'COORDINADOR', 'CONTROL', 'ANALISTA'];

  const CEDI_A_NOMBRE: Record<string, string> = {
    'CO04': 'BARRANQUILLA',
    'CO05': 'CALI',
    'CO06': 'BUCARAMANGA',
    'CO07': 'FUNZA',
    'MEDELLIN': 'CO09',
  };

  // Cargar solicitudes pendientes al inicio
  const cargarSolicitudesPendientes = async (nombreUsuario: string, perfilValue: string, centroDist: string) => {
    if (!nombreUsuario) return;

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      console.log('Cargando solicitudes pendientes:', { usuario: nombreUsuario, perfil: perfilValue, centro_distribucion: centroDist });

      const params = new URLSearchParams({
        usuario: nombreUsuario,
        perfil: perfilValue,
        centro_distribucion: centroDist || ''
      });

      const response = await fetch(`${API}/siscore/obtener-solicitudes-pendientes?${params}`);

      if (response.ok) {
        const data = await response.json();
        console.log('Solicitudes pendientes recibidas:', data);
        setSolicitudesPendientes(data.solicitudes || []);

        if (data.solicitudes && data.solicitudes.length > 0) {
          setMostrarPendientes(true);
          console.log(`Mostrando ${data.solicitudes.length} solicitudes pendientes`);
        } else {
          console.log('No hay solicitudes pendientes');
          setMostrarPendientes(false);
        }
      } else {
        console.error('Error al cargar solicitudes:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error cargando solicitudes pendientes:', error);
    }
  };

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    const usuarioCookie = match[2] || '';
    setUsuario(usuarioCookie);

    const perfilValue = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    setPerfil(perfilValue);

    const regionalValue = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/)?.[2] || '';

    let centroDist = '';
    if (!PERFILES_GLOBALES.includes(perfilValue) && regionalValue) {
      if (regionalValue.startsWith('CO')) {
        centroDist = CEDI_A_NOMBRE[regionalValue] || regionalValue;
      } else {
        centroDist = regionalValue;
      }
    }
    setCentroDistribucion(centroDist);

    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');

    // Cargar resultados recientes globales (sin filtro por usuario)
    cargarResultadosRecientes();

    // También cargar solicitudes pendientes del usuario actual
    if (usuarioCookie) {
      cargarSolicitudesPendientes(usuarioCookie, perfilValue, centroDist);
    }
  }, [router]);

  const handleBuscar = async () => {
    if (!planillasInput.trim()) {
      Swal.fire('Advertencia', 'Por favor ingresa al menos una planilla', 'warning');
      return;
    }

    // Procesar planillas: manejar comas, saltos de línea, espacios, etc.
    const planillasProcesadas = planillasInput
      .trim()  // Quitar espacios al inicio y final
      .split(/[\n,;\s]+/)  // Dividir por comas, saltos de línea, punto y coma, o espacios múltiples
      .map(p => p.trim())  // Quitar espacios alrededor de cada planilla
      .filter(p => p.length > 0);  // Eliminar vacíos

    if (planillasProcesadas.length === 0) {
      Swal.fire('Advertencia', 'Por favor ingresa al menos una planilla válida', 'warning');
      return;
    }

    // Validar que todas sean números o caracteres válidos
    const planillasInvalidas = planillasProcesadas.filter(p => !/^[A-Z0-9\-]+$/i.test(p));

    if (planillasInvalidas.length > 0) {
      Swal.fire(
        'Planillas inválidas',
        `Las siguientes planillas tienen caracteres inválidos: ${planillasInvalidas.join(', ')}\nUsa solo números, letras y guiones.`,
        'warning'
      );
      return;
    }

    // Eliminar duplicados en el mismo input
    const planillasBuscadas = [...new Set(planillasProcesadas)];

    if (planillasBuscadas.length < planillasProcesadas.length) {
      const duplicadasEnInput = planillasProcesadas.length - planillasBuscadas.length;
      Swal.fire(
        'Duplicados en el input',
        `Se encontraron ${duplicadasEnInput} planillas duplicadas en tu búsqueda. Se eliminarán automáticamente.`,
        'info'
      );
    }

    // Verificar duplicados con resultados existentes
    const planillasExistentes = resultados.map(r => r.planilla);
    const duplicadas = planillasBuscadas.filter(p => planillasExistentes.includes(p));

    if (duplicadas.length > 0) {
      Swal.fire(
        'Planillas duplicadas',
        `Las siguientes planillas ya están en la tabla: ${duplicadas.join(', ')}`,
        'warning'
      );
      return;
    }

    setLoading(true);
    // NO limpiar resultados existentes, vamos a añadir
    setTiempoConsulta(0);
    setMostrarPendientes(false);

    Swal.fire({
      title: 'Consultando Siscore',
      html: `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 60px; animation: truckDrive 1s ease-in-out infinite alternate;">🚛</div>
          <p style="margin-top: 20px; color: #666;">Consultando planillas en Siscore...</p>
          <p style="font-size: 14px; color: #999;">Por favor espera</p>
        </div>
        <style>@keyframes truckDrive { 0% { transform: translateX(-20px); } 100% { transform: translateX(20px); } }</style>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    const tiempoInicio = Date.now();
    const fechaInicio = '';  // El backend calculará el rango automáticamente
    const fechaFin = '';

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${API}/siscore/consultar-planillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planillas: planillasBuscadas,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          perfil: perfil,
          centro_distribucion: centroDistribucion || 'TODOS'
        })
      });

      if (!response.ok) {
        Swal.close();
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(1);
      setTiempoConsulta(parseFloat(tiempoTotal));

      const registros = data.registros || [];

      // DEBUG: Ver qué campos vienen de Siscore
      if (registros.length > 0) {
        console.log('=== CAMPOS DE SISCORE ===');
        console.log('Cantidad de registros:', registros.length);
        console.log('Primer registro completo:', registros[0]);
        console.log('Campos disponibles:', Object.keys(registros[0]));
        console.log('Campo Ruta:', registros[0].Ruta);
        console.log('Campo Divipola:', registros[0].Divipola);
        console.log('Campo Municipio Destino:', registros[0]['Municipio Destino']);
      }

      // Agrupar por planilla (sin calcular tarifas todavía)
      const planillasMap = new Map<string, PlanillaResultado>();

      for (const reg of registros) {
        const planilla = reg.Planilla?.toString().trim();
        if (!planilla) continue;
        if (!planillasBuscadas.includes(planilla)) continue;

        if (!planillasMap.has(planilla)) {
          // Intentar obtener centro_costo con varios nombres posibles
          const centroCosto = reg['Centro Costo'] || reg['centro_costo'] || reg['Bodega Origen'] || reg['bodega_origen'] || reg['Centro'] || '';
          const bodegaOrigen = reg['Bodega Origen'] || reg['bodega_origen'] || '';

          // Debug: mostrar todos los campos del registro
          console.log(`📋 [PLANILLA ${planilla}] Campos disponibles:`, Object.keys(reg));
          console.log(`📋 [PLANILLA ${planilla}] Bodega Origen: "${bodegaOrigen}"`);
          console.log(`📋 [PLANILLA ${planilla}] Centro Costo: "${reg['Centro Costo']}"`);
          console.log(`📋 [PLANILLA ${planilla}] centro_costo final: "${centroCosto}"`);

          planillasMap.set(planilla, {
            planilla,
            encontrada: true,
            piezas: 0,
            peso_real: 0,
            ruta: reg.Ruta || '-',
            codigo_pedido: '',
            cantidad_pedidos: 0,
            cliente_origen: reg['Cliente Origen'] || '-',
            municipio_destino: reg['Municipio Destino'] || '-',
            departamento_destino: reg['Departamento Destino'] || '-',
            regional: obtenerRegional(bodegaOrigen),
            centro_costo: centroCosto,
            requiere_descargue: 'NO',
            punto_adicional: false,
            desvio: false
          });

          console.log(`📦 Planilla ${planilla}: centro_costo="${centroCosto}", ruta="${reg.Ruta}"`);
        }

        const planillaData = planillasMap.get(planilla)!;
        planillaData.piezas += parseInt(reg.Piezas || 0) || 0;
        planillaData.peso_real += parseFloat(reg['Peso Real'] || 0) || 0;

        const codigoPedido = reg['Codigo Pedido']?.toString().trim();
        if (codigoPedido) {
          const codigos = planillaData.codigo_pedido ? planillaData.codigo_pedido.split(', ') : [];
          if (!codigos.includes(codigoPedido)) {
            codigos.push(codigoPedido);
            planillaData.codigo_pedido = codigos.join(', ');
          }
        }
      }

      planillasMap.forEach((data) => {
        data.cantidad_pedidos = data.codigo_pedido ? data.codigo_pedido.split(', ').length : 0;
      });

      // Calcular tarifas solo UNA VEZ por planilla consolidada
      for (const [planilla, data] of planillasMap) {
        // Si no tiene centro_costo, usar FMC como fallback
        if (!data.centro_costo || data.centro_costo.trim() === '') {
          console.warn(`⚠️ Planilla ${planilla}: Sin centro_costo, usando "FMC" como fallback`);
          data.centro_costo = 'FMC';
        }

        if (!data.encontrada || !data.ruta || data.ruta === '-') {
          console.warn(`Planilla ${planilla}: No se puede calcular tarifa. encontrado=${data.encontrada}, ruta="${data.ruta}"`);
          data.tipo_vehiculo = 'N/A';
          data.tarifa_calculada = 0;
          data.total_solicitado = 0;
          continue;
        }

        try {
          console.log(`Consultando tarifa para planilla ${planilla}: centro_costo="${data.centro_costo}", ruta="${data.ruta}", peso=${data.peso_real}kg`);

          const tarifaResponse = await fetch(`${API}/siscore/consultar-tarifa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              centro_costo: data.centro_costo,
              ruta: data.ruta,
              peso_real: data.peso_real
            })
          });

          if (tarifaResponse.ok) {
            const tarifaData = await tarifaResponse.json();
            data.tipo_vehiculo = tarifaData.tipo_vehiculo;
            data.tarifa_calculada = tarifaData.tarifa_calculada;
            console.log(`✅ Planilla ${planilla}: tipo=${tarifaData.tipo_vehiculo}, tarifa=${tarifaData.tarifa_calculada}`);
          } else {
            console.error(`❌ Error en respuesta de tarifa para planilla ${planilla}: ${tarifaResponse.status}`);
            data.tipo_vehiculo = 'N/A';
            data.tarifa_calculada = 0;
          }
        } catch (error) {
          console.error(`❌ Error consultando tarifa para planilla ${planilla}:`, error);
          data.tipo_vehiculo = 'N/A';
          data.tarifa_calculada = 0;
        }

        // Calcular total inicial
        data.total_solicitado = calcularTotalSolicitado(data);
      }

      const resultadosProcesados: PlanillaResultado[] = planillasBuscadas.map(planilla => {
        return planillasMap.get(planilla) || {
          planilla,
          encontrada: false,
          piezas: 0,
          peso_real: 0,
          ruta: '-',
          codigo_pedido: '-',
          cantidad_pedidos: 0,
          cliente_origen: '-',
          municipio_destino: '-',
          departamento_destino: '-',
          regional: '-',
          tarifa_calculada: 0,
          tipo_vehiculo: 'N/A'
        };
      });

      // Añadir nuevos resultados a los existentes
      const nuevosResultados = [...resultados, ...resultadosProcesados];
      setResultados(nuevosResultados);

      // Limpiar el input después de obtener resultados
      setPlanillasInput('');

      const encontradas = resultadosProcesados.filter(r => r.encontrada).length;

      // Guardar busqueda en pedidos_medical para restaurar en proxima sesion
      // Guardamos todos los resultados combinados (existentes + nuevos)
      console.log('💾 [GUARDAR BUSQUEDA] Iniciando guardado...');
      console.log('💾 [GUARDAR BUSQUEDA] usuario:', usuario);
      console.log('💾 [GUARDAR BUSQUEDA] perfil:', perfil);
      console.log('💾 [GUARDAR BUSQUEDA] centro_distribucion:', centroDistribucion);
      console.log('💾 [GUARDAR BUSQUEDA] planillas_buscadas:', planillasBuscadas);
      console.log('💾 [GUARDAR BUSQUEDA] resultados_consolidados count:', nuevosResultados.length);

      try {
        const guardarResponse = await fetch(`${API}/siscore/guardar-busqueda`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario: usuario || 'desconocido',
            perfil: perfil || 'N/A',
            centro_distribucion: centroDistribucion || 'TODOS',
            planillas_buscadas: nuevosResultados.map(r => r.planilla),
            resultados_consolidados: nuevosResultados,
            fecha_inicio: fechaInicio || '',
            fecha_fin: fechaFin || ''
          })
        });

        console.log('💾 [GUARDAR BUSQUEDA] Response status:', guardarResponse.status);

        if (guardarResponse.ok) {
          const guardarData = await guardarResponse.json();
          console.log('💾 [GUARDAR BUSQUEDA] Success:', guardarData);
        } else {
          const errorText = await guardarResponse.text();
          console.error('💾 [GUARDAR BUSQUEDA] Error response:', errorText);
        }
      } catch (error) {
        console.error('💾 [GUARDAR BUSQUEDA] Exception:', error);
      }

      Swal.fire(
        'Consulta finalizada',
        `Se encontraron ${encontradas} de ${planillasBuscadas.length} planillas (${registros.length} registros) en ${tiempoTotal} segundos`,
        encontradas > 0 ? 'success' : 'info'
      );

    } catch (error) {
      Swal.close();
      Swal.fire('Error', 'Error al consultar Siscore', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarSolicitud = async (resultado: PlanillaResultado, index: number) => {
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      const total = calcularTotalSolicitado(resultado);

      const payload = {
        usuario,
        perfil,
        centro_distribucion: centroDistribucion || 'TODOS',
        planilla: resultado.planilla,
        piezas: resultado.piezas,
        peso_real: resultado.peso_real,
        ruta: resultado.ruta,
        codigos_pedido: resultado.codigo_pedido,
        cantidad_pedidos: resultado.cantidad_pedidos,
        cliente_origen: resultado.cliente_origen,
        municipio_destino: resultado.municipio_destino,
        departamento_destino: resultado.departamento_destino,
        regional: resultado.regional,
        tarifa_calculada: resultado.tarifa_calculada || 0,
        tipo_vehiculo: resultado.tipo_vehiculo || 'N/A',
        total_solicitado: total,
        tarifa_base: resultado.tarifa_base,
        requiere_descargue: resultado.requiere_descargue || 'NO',
        punto_adicional: resultado.punto_adicional || false,
        desvio: resultado.desvio || false,
        tipo_veh_sicetac: resultado.tipo_veh_sicetac
      };

      const response = await fetch(`${API}/siscore/guardar-solicitud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al guardar solicitud');
      }

      const data = await response.json();

      // Actualizar el resultado como guardado
      const nuevosResultados = [...resultados];
      nuevosResultados[index] = {
        ...resultado,
        guardado: true,
        solicitando_id: data.solicitud._id
      };
      setResultados(nuevosResultados);

      Swal.fire('Guardado', 'Solicitud guardada exitosamente', 'success');

    } catch (error) {
      Swal.fire('Error', 'Error al guardar la solicitud', 'error');
    }
  };

  const handleEnviarTramite = async (solicitandoId: string, index: number) => {
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${API}/siscore/enviar-tramite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitud_id: solicitandoId,
          usuario
        })
      });

      if (!response.ok) {
        throw new Error('Error al enviar trámite');
      }

      // Remover de la lista
      const nuevosResultados = resultados.filter((_, i) => i !== index);
      setResultados(nuevosResultados);

      Swal.fire('Enviado', 'Solicitud enviada a revisión exitosamente', 'success');

    } catch (error) {
      Swal.fire('Error', 'Error al enviar trámite', 'error');
    }
  };

  const handleEliminarResultado = (index: number) => {
    Swal.fire({
      title: '¿Eliminar planilla?',
      text: `¿Estás seguro de eliminar la planilla ${resultados[index].planilla}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const nuevosResultados = resultados.filter((_, i) => i !== index);
        setResultados(nuevosResultados);
        Swal.fire('Eliminado', 'Planilla eliminada correctamente', 'success');
      }
    });
  };

  const handleAbrirModal = (resultado: PlanillaResultado) => {
    setModalDetalle({ abierto: true, resultado });
  };

  const handleCerrarModal = () => {
    setModalDetalle({ abierto: false, resultado: null });
  };

  const handleActualizarResultado = (index: number, campo: string, valor: any) => {
    const nuevosResultados = [...resultados];
    (nuevosResultados[index] as any)[campo] = valor;

    // Recalcular total solicitado si cambian campos que afectan el total
    if (['tarifa_base', 'requiere_descargue', 'punto_adicional', 'desvio'].includes(campo)) {
      nuevosResultados[index].total_solicitado = calcularTotalSolicitado(nuevosResultados[index]);
    }

    setResultados(nuevosResultados);
  };

  const toggleVista = () => {
    setMostrarPendientes(!mostrarPendientes);
    if (!mostrarPendientes && resultados.length === 0) {
      setPlanillasInput('');
    }
  };

  return (
    <div className="SV-layout">
      <NavMedicalCare paginaActual="solicitud" />

      <main className="SV-main">
        <div className="SV-header">
          <div>
            <h1 className="SV-title">Solicitud de Vehículos</h1>
            <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>Usuario: <strong>{usuario}</strong> | Perfil: {perfil}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {solicitudesPendientes.length > 0 && !mostrarPendientes && (
              <button onClick={toggleVista} className="SV-btnToggle">
                Ver Pendientes ({solicitudesPendientes.length})
              </button>
            )}
            {mostrarPendientes && (
              <button onClick={toggleVista} className="SV-btnToggle">
                ← Nueva Consulta
              </button>
            )}
          </div>
        </div>

        {mostrarPendientes ? (
          <div className="SV-pendientesSection">
            <h2 className="SV-resultsTitle">Solicitudes Pendientes</h2>
            <div className="SV-tableContainer">
              <table className="SV-table">
                <thead>
                  <tr>
                    <th>Acciones</th>
                    <th>Regional</th>
                    <th>Planilla</th>
                    <th>Piezas</th>
                    <th>Peso Real</th>
                    <th>Cliente Origen</th>
                    <th>Ruta</th>
                    <th>Tipo Vehículo</th>
                    <th>Tarifa Teórica</th>
                    <th>Tarifa Base</th>
                    <th>Total Solicitado</th>
                    <th>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudesPendientes.map((sol) => {
                    // Usar el total que viene de BD, pero si no existe, recalcular
                    const total = sol.total_solicitado || (() => {
                      const base = sol.tarifa_base || sol.tarifa_calculada || 0;
                      let t = base;
                      if (sol.requiere_descargue === 'SI') t += RECARGOS.descargue;
                      if (sol.punto_adicional) t += RECARGOS.punto_adicional;
                      if (sol.desvio) t += RECARGOS.desvio;
                      return t;
                    })();

                    const diferencia = total - sol.tarifa_calculada;

                    return (
                    <tr key={sol._id} className="SV-rowFound">
                      <td>
                        <button
                          onClick={() => handleEnviarTramite(sol._id, -1)}
                          className="SV-btnAction SV-btnSend"
                          title="Enviar a revisión"
                        >
                          <FaPaperPlane />
                        </button>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{sol.regional || '-'}</td>
                      <td className="SV-planillaCell">
                        <button
                          onClick={() => handleAbrirModal({
                            planilla: sol.planilla,
                            encontrada: true,
                            piezas: sol.piezas,
                            peso_real: sol.peso_real,
                            ruta: sol.ruta,
                            codigo_pedido: sol.codigos_pedido || '-',
                            cantidad_pedidos: 1,
                            cliente_origen: sol.cliente_origen || '-',
                            municipio_destino: sol.municipio_destino || '-',
                            departamento_destino: sol.departamento_destino || '-',
                            regional: sol.regional,
                            tarifa_calculada: sol.tarifa_calculada,
                            tipo_vehiculo: sol.tipo_vehiculo,
                            total_solicitado: sol.total_solicitado,
                            requiere_descargue: 'NO',
                            punto_adicional: false,
                            desvio: false
                          })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#004d40',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                            fontSize: 'inherit'
                          }}
                        >
                          {sol.planilla}
                        </button>
                      </td>
                      <td>{sol.piezas}</td>
                      <td>{sol.peso_real.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                      <td className="SV-truncate" title={sol.cliente_origen}>
                        {sol.cliente_origen || '-'}
                      </td>
                      <td>{sol.ruta}</td>
                      <td>{sol.tipo_vehiculo}</td>
                      <td>${sol.tarifa_calculada.toLocaleString('es-CO')}</td>
                      <td>${sol.tarifa_base?.toLocaleString('es-CO') || '-'}</td>
                      <td style={{ fontWeight: 'bold', color: '#005f56' }}>${total.toLocaleString('es-CO')}</td>
                      <td style={{ color: diferencia > 0 ? '#16a34a' : diferencia < 0 ? '#dc2626' : '#666' }}>
                        {diferencia > 0 ? `+$${diferencia.toLocaleString('es-CO')}` : diferencia < 0 ? `-$${Math.abs(diferencia).toLocaleString('es-CO')}` : '$0'}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <div className="SV-searchSection">
              <div className="SV-inputGroup">
                <label htmlFor="planillas">Planillas (separadas por coma):</label>
                <input
                  id="planillas"
                  type="text"
                  className="SV-input"
                  placeholder="Ej: 864582, 864768"
                  value={planillasInput}
                  onChange={(e) => setPlanillasInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleBuscar()}
                  disabled={loading}
                />
              </div>
              <button onClick={handleBuscar} className="SV-btnSearch" disabled={loading}>
                <FaSearch /> {loading ? 'Consultando...' : 'Buscar'}
              </button>
            </div>

            {resultados.length > 0 && (
              <div className="SV-resultsSection">
                <h2 className="SV-resultsTitle">Resultados</h2>
                <div className="SV-tableContainer">
                  <table className="SV-table">
                    <thead>
                      <tr>
                        <th>Acciones</th>
                        <th>Estado</th>
                        <th>Regional</th>
                        <th>Planilla</th>
                        <th>Piezas</th>
                        <th>Peso Real</th>
                        <th>Cliente Origen</th>
                        <th>Ruta</th>
                        <th>Código Pedido</th>
                        <th>Cant. Pedidos</th>
                        <th>Tipo Vehículo</th>
                        <th>Tarifa Teórica</th>
                        <th>Tarifa Base</th>
                        <th>Vehículo SICETAC</th>
                        <th>Descargue</th>
                        <th>Punto Adic.</th>
                        <th>Desvío</th>
                        <th>Total Solicitado</th>
                        <th>Diferencia</th>
                        <th>Municipio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((resultado, index) => {
                        const total = calcularTotalSolicitado(resultado);
                        const diferencia = total - (resultado.tarifa_calculada || 0);

                        return (
                        <tr key={index} className={resultado.encontrada ? 'SV-rowFound' : 'SV-rowNotFound'}>
                          <td>
                            {resultado.encontrada && (
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                  onClick={() => handleEliminarResultado(index)}
                                  className="SV-btnAction SV-btnDelete"
                                  title="Eliminar planilla"
                                >
                                  <FaTrash />
                                </button>
                                {!resultado.guardado ? (
                                  <button
                                    onClick={() => handleGuardarSolicitud(resultado, index)}
                                    className="SV-btnAction SV-btnSave"
                                    title="Guardar solicitud"
                                  >
                                    <FaSave />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => resultado.solicitando_id && handleEnviarTramite(resultado.solicitando_id, index)}
                                    className="SV-btnAction SV-btnSend"
                                    title="Enviar a revisión"
                                  >
                                    <FaPaperPlane />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="SV-statusCell">
                            {resultado.encontrada ? <FaCheckCircle className="SV-iconSuccess" /> : <FaTimesCircle className="SV-iconError" />}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{resultado.regional || '-'}</td>
                          <td className="SV-planillaCell">
                            <button
                              onClick={() => handleAbrirModal(resultado)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#004d40',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0,
                                fontSize: 'inherit'
                              }}
                            >
                              {resultado.planilla}
                            </button>
                          </td>
                          <td>{resultado.encontrada ? resultado.piezas : '-'}</td>
                          <td>{resultado.encontrada ? resultado.peso_real.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '-'}</td>
                          <td className="SV-truncate" title={resultado.cliente_origen}>
                            {resultado.cliente_origen}
                          </td>
                          <td>{resultado.ruta}</td>
                          <td className="SV-truncate" title={resultado.codigo_pedido}>
                            {resultado.codigo_pedido}
                          </td>
                          <td>{resultado.encontrada ? resultado.cantidad_pedidos : '-'}</td>
                          <td>{resultado.tipo_vehiculo || '-'}</td>
                          <td>${resultado.tarifa_calculada?.toLocaleString('es-CO') || '-'}</td>
                          <td>
                            {resultado.encontrada ? (
                              <input
                                type="number"
                                className="SV-inputSmall"
                                value={resultado.tarifa_base || ''}
                                onChange={(e) => handleActualizarResultado(index, 'tarifa_base', parseFloat(e.target.value) || 0)}
                                placeholder="Nueva tarifa"
                              />
                            ) : '-'}
                          </td>
                          <td>
                            {resultado.encontrada ? (
                              <select
                                className="SV-selectSmall"
                                value={resultado.tipo_veh_sicetac || resultado.tipo_vehiculo || ''}
                                onChange={(e) => handleActualizarResultado(index, 'tipo_veh_sicetac', e.target.value)}
                              >
                                {OPCIONES_VEHICULO.map(op => (
                                  <option key={op} value={op}>{op}</option>
                                ))}
                              </select>
                            ) : '-'}
                          </td>
                          <td>
                            {resultado.encontrada ? (
                              <select
                                className="SV-selectSmall"
                                value={resultado.requiere_descargue || 'NO'}
                                onChange={(e) => handleActualizarResultado(index, 'requiere_descargue', e.target.value)}
                              >
                                <option value="NO">NO</option>
                                <option value="SI">SI</option>
                              </select>
                            ) : '-'}
                          </td>
                          <td>
                            {resultado.encontrada ? (
                              <input
                                type="checkbox"
                                checked={resultado.punto_adicional || false}
                                onChange={(e) => handleActualizarResultado(index, 'punto_adicional', e.target.checked)}
                              />
                            ) : '-'}
                          </td>
                          <td>
                            {resultado.encontrada ? (
                              <input
                                type="checkbox"
                                checked={resultado.desvio || false}
                                onChange={(e) => handleActualizarResultado(index, 'desvio', e.target.checked)}
                              />
                            ) : '-'}
                          </td>
                          <td style={{ fontWeight: 'bold', color: '#005f56' }}>
                            ${resultado.encontrada ? total.toLocaleString('es-CO') : '-'}
                          </td>
                          <td style={{ color: diferencia > 0 ? '#16a34a' : diferencia < 0 ? '#dc2626' : '#666' }}>
                            {resultado.encontrada ? (diferencia > 0 ? `+$${diferencia.toLocaleString('es-CO')}` : diferencia < 0 ? `-$${Math.abs(diferencia).toLocaleString('es-CO')}` : '$0') : '-'}
                          </td>
                          <td>{resultado.municipio_destino}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de detalles de planilla */}
      {modalDetalle.abierto && modalDetalle.resultado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }} onClick={handleCerrarModal}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#004d40' }}>Detalles de Planilla {modalDetalle.resultado.planilla}</h2>
              <button onClick={handleCerrarModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><strong>Regional:</strong> {modalDetalle.resultado.regional || '-'}</div>
              <div><strong>Ruta:</strong> {modalDetalle.resultado.ruta}</div>
              <div><strong>Piezas:</strong> {modalDetalle.resultado.piezas}</div>
              <div><strong>Peso Real:</strong> {modalDetalle.resultado.peso_real}</div>
              <div><strong>Cant. Pedidos:</strong> {modalDetalle.resultado.cantidad_pedidos}</div>
              <div><strong>Tipo Vehículo:</strong> {modalDetalle.resultado.tipo_vehiculo}</div>
              <div><strong>Tarifa Teórica:</strong> ${modalDetalle.resultado.tarifa_calculada?.toLocaleString('es-CO') || '-'}</div>
              <div><strong>Municipio Destino:</strong> {modalDetalle.resultado.municipio_destino}</div>
              <div><strong>Departamento Destino:</strong> {modalDetalle.resultado.departamento_destino}</div>
              <div><strong>Total Solicitado:</strong> ${modalDetalle.resultado.total_solicitado?.toLocaleString('es-CO') || '-'}</div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div><strong>Cliente Origen:</strong></div>
              <div style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem', wordBreak: 'break-word' }}>
                {modalDetalle.resultado.cliente_origen}
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div><strong>Códigos Pedido:</strong></div>
              <div style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {modalDetalle.resultado.codigo_pedido}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="SV-footer">
        <div className="SV-footerInner">
          <div className="SV-footerBrand">
            <Image src={logo} alt="Integra" height={28} />
            <span>Integra Cadena de Servicios S.A.S.</span>
          </div>
          <div className="SV-footerLinks">
            <a href="tel:+573125443396" className="SV-footerLink"><FaPhone /> +57 312 544 3396</a>
            <a href="mailto:edwin.zarate@integralogistica.com" className="SV-footerLink"><FaEnvelope /> edwin.zarate@integralogistica.com</a>
            <span className="SV-footerLink"><FaMapMarkerAlt /> Colombia</span>
          </div>
          <span className="SV-footerCopy">© {new Date().getFullYear()} Integra — Solicitud de Vehículos</span>
        </div>
      </footer>
    </div>
  );
};

export default SolicitudVehiculos;

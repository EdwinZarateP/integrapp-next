'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaSearch, FaCheckCircle, FaTimesCircle, FaTruck, FaPaperPlane, FaEdit, FaSave, FaTrash, FaPen } from 'react-icons/fa';
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
  regional?: string;
  tarifa_calculada: number;
  tipo_vehiculo: string;
  total_solicitado: number;
  tarifa_base?: number;
  requiere_descargue: string;
  punto_adicional: boolean;
  desvio: boolean;
  aforo?: number;
  placa?: string;
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
  requiere_descargue?: number;  // Valor del descargue
  punto_adicional?: number;     // Valor del punto adicional
  desvio?: number;              // Valor del desvío
  aforo?: number;               // Valor del aforo
  placa?: string;
  tipo_veh_sicetac?: string;
  guardado?: boolean;
  solicitando_id?: string;
  causal?: string;
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
    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const url = `${API}/siscore/obtener-resultados-recientes?limite=100`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        // Nuevo formato: cada documento es una planilla independiente
        if (data.planillas && data.planillas.length > 0) {
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
            requiere_descargue: p.requiere_descargue || 0,
            punto_adicional: p.punto_adicional || 0,
            desvio: p.desvio || 0,
            aforo: p.aforo || 0,
            placa: p.placa || '',
            tipo_veh_sicetac: p.tipo_veh_sicetac,
            guardado: true,
            solicitando_id: null
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
              solicitando_id: null
            }));
            setResultados(resultadosRestaurados);
            setMostrarPendientes(false);
            return;
          }
        }
      }
    } catch (error) {
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

    // Función helper para convertir valores a número
    const aNumero = (val: any): number => {
      if (typeof val === 'number') return val;
      if (val === 'SI' || val === true) return 50000; // Descargue
      if (val === true) return 80000; // Punto adicional
      if (val === true) return 100000; // Desvío
      return 0;
    };

    // Sumar recargos
    const total = base +
      aNumero(resultado.requiere_descargue) +
      (typeof resultado.punto_adicional === 'number' ? resultado.punto_adicional : (resultado.punto_adicional === true ? 80000 : 0)) +
      (typeof resultado.desvio === 'number' ? resultado.desvio : (resultado.desvio === true ? 100000 : 0)) +
      (resultado.aforo || 0);

    return total;
  };

  const calcularTotalTemporal = (): number => {
    if (!tempEdicion || !modalDetalle.resultado) return 0;
    const base = tempEdicion.tarifa_base || 0;
    let total = base;
    if (tempEdicion.requiere_descargue === 'SI') total += RECARGOS.descargue;
    if (tempEdicion.punto_adicional) total += RECARGOS.punto_adicional;
    if (tempEdicion.desvio) total += RECARGOS.desvio;
    if (tempEdicion.aforo) total += tempEdicion.aforo;
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
  const [modalDetalle, setModalDetalle] = useState<{ abierto: boolean; resultado: PlanillaResultado | null; indice: number | null }>({ abierto: false, resultado: null, indice: null });
  const [tempEdicion, setTempEdicion] = useState<{ tarifa_base: number; tipo_veh_sicetac: string; requiere_descargue: number; punto_adicional: number; desvio: number; aforo: number; placa: string } | null>(null);
  const [planillasSeleccionadas, setPlanillasSeleccionadas] = useState<Set<number>>(new Set());

  // Efecto para rastrear cambios en tempEdicion
  useEffect(() => {
  }, [tempEdicion]);

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

      const params = new URLSearchParams({
        usuario: nombreUsuario,
        perfil: perfilValue,
        centro_distribucion: centroDist || ''
      });

      const response = await fetch(`${API}/siscore/obtener-solicitudes-pendientes?${params}`);

      if (response.ok) {
        const data = await response.json();
        setSolicitudesPendientes(data.solicitudes || []);

        if (data.solicitudes && data.solicitudes.length > 0) {
          setMostrarPendientes(true);
        } else {
          setMostrarPendientes(false);
        }
      } else {
      }
    } catch (error) {
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
          data.centro_costo = 'FMC';
        }

        if (!data.encontrada || !data.ruta || data.ruta === '-') {
          data.tipo_vehiculo = 'N/A';
          data.tarifa_calculada = 0;
          data.total_solicitado = 0;
          continue;
        }

        try {

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
            // Tarifa base y vehículo SICETAC se inicializan con los mismos valores calculados
            data.tarifa_base = tarifaData.tarifa_calculada;
            data.tipo_veh_sicetac = tarifaData.tipo_vehiculo;
          } else {
            data.tipo_vehiculo = 'N/A';
            data.tarifa_calculada = 0;
            data.tarifa_base = 0;
            data.tipo_veh_sicetac = 'N/A';
          }
        } catch (error) {
          data.tipo_vehiculo = 'N/A';
          data.tarifa_calculada = 0;
          data.tarifa_base = 0;
          data.tipo_veh_sicetac = 'N/A';
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

      // Limpiar selecciones de fusión
      setPlanillasSeleccionadas(new Set());

      // Limpiar el input después de obtener resultados
      setPlanillasInput('');

      const encontradas = resultadosProcesados.filter(r => r.encontrada).length;

      // NO guardar automáticamente en pedidos_medical - solo informar resultados
      // El usuario debe guardar manualmente mediante el botón de editar

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
        planilla: resultado.planilla,
        total_solicitado: typeof total === 'number' ? total : parseFloat(total as any) || 0,
        tarifa_base: resultado.tarifa_base || 0,
        requiere_descargue: typeof resultado.requiere_descargue === 'number' ? resultado.requiere_descargue : (resultado.requiere_descargue === 'SI' ? 50000 : 0),
        punto_adicional: typeof resultado.punto_adicional === 'number' ? resultado.punto_adicional : (resultado.punto_adicional === true ? 80000 : 0),
        desvio: typeof resultado.desvio === 'number' ? resultado.desvio : (resultado.desvio === true ? 100000 : 0),
        aforo: resultado.aforo || 0,
        placa: resultado.placa || '',
        tipo_veh_sicetac: resultado.tipo_veh_sicetac || ''
      };


      // Actualizar en pedidos_medical
      const response = await fetch(`${API}/siscore/actualizar-planilla-pedidos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al actualizar planilla en pedidos_medical');
      }

      const data = await response.json();

      // Actualizar el resultado como guardado
      const nuevosResultados = [...resultados];
      nuevosResultados[index] = {
        ...resultado,
        guardado: true
      };
      setResultados(nuevosResultados);

      Swal.fire('Guardado', `Planilla ${resultado.planilla} actualizada con placa: ${resultado.placa || 'N/A'}`, 'success');

    } catch (error) {
      Swal.fire('Error', 'Error al guardar la planilla', 'error');
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
        // Limpiar selección si la planilla eliminada estaba seleccionada
        const nuevasSelecciones = new Set<number>();
        planillasSeleccionadas.forEach(i => {
          if (i < index) nuevasSelecciones.add(i);
          else if (i > index) nuevasSelecciones.add(i - 1);
        });
        setPlanillasSeleccionadas(nuevasSelecciones);
        Swal.fire('Eliminado', 'Planilla eliminada correctamente', 'success');
      }
    });
  };

  const handleToggleSeleccion = (index: number) => {
    const nuevasSelecciones = new Set(planillasSeleccionadas);
    if (nuevasSelecciones.has(index)) {
      nuevasSelecciones.delete(index);
    } else {
      nuevasSelecciones.add(index);
    }
    setPlanillasSeleccionadas(nuevasSelecciones);
  };

  const handleFusionarPlanillas = async () => {
    if (planillasSeleccionadas.size < 2) {
      Swal.fire('Advertencia', 'Selecciona al menos 2 planillas para fusionar', 'warning');
      return;
    }

    const indices = Array.from(planillasSeleccionadas).sort((a, b) => a - b);
    const planillasAFusionar = indices.map(i => resultados[i]);

    // Sumar piezas y pesos
    const totalPiezas = planillasAFusionar.reduce((sum, p) => sum + (p.piezas || 0), 0);
    const totalPeso = planillasAFusionar.reduce((sum, p) => sum + (p.peso_real || 0), 0);
    const codigosPedido = planillasAFusionar.map(p => p.codigo_pedido).filter(cp => cp && cp !== '-').join(', ');
    const numPedidos = planillasAFusionar.reduce((sum, p) => sum + (p.cantidad_pedidos || 0), 0);

    // Calcular ruta que más se repite
    const rutasMap = new Map<string, number>();
    planillasAFusionar.forEach(p => {
      if (p.ruta && p.ruta !== '-') {
        rutasMap.set(p.ruta, (rutasMap.get(p.ruta) || 0) + 1);
      }
    });

    let rutaMasRepetida = '';
    let maxRepeticiones = 0;
    rutasMap.forEach((count, ruta) => {
      if (count > maxRepeticiones) {
        maxRepeticiones = count;
        rutaMasRepetida = ruta;
      }
    });

    if (!rutaMasRepetida) {
      Swal.fire('Error', 'No se pudo determinar una ruta para la fusión', 'error');
      return;
    }

    // Obtener valores de las planillas que tienen la ruta más repetida
    const planillasConRutaMasRepetida = planillasAFusionar.filter(p => p.ruta === rutaMasRepetida);
    const clienteOrigen = planillasConRutaMasRepetida[0]?.cliente_origen || planillasAFusionar[0]?.cliente_origen || '';
    const municipioDestino = planillasConRutaMasRepetida[0]?.municipio_destino || planillasAFusionar[0]?.municipio_destino || '';
    const deptoDestino = planillasConRutaMasRepetida[0]?.departamento_destino || planillasAFusionar[0]?.departamento_destino || '';
    const regional = planillasConRutaMasRepetida[0]?.regional || planillasAFusionar[0]?.regional || '';
    const centroCosto = planillasConRutaMasRepetida[0]?.centro_costo || planillasAFusionar[0]?.centro_costo || '';
    const placa = planillasConRutaMasRepetida[0]?.placa || planillasAFusionar[0]?.placa || '';

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

      // Inicializar causales por defecto si no existen
      await fetch(`${API}/siscore/causales/inicializar`, { method: 'POST' });

      // Consultar causales disponibles
      const causalesResponse = await fetch(`${API}/siscore/causales`);
      if (!causalesResponse.ok) {
        throw new Error('Error al consultar causales');
      }
      const causalesData = await causalesResponse.json();
      const causales = causalesData.causales || [];

      // Mostrar selector de causal
      const { value: causal } = await Swal.fire({
        title: 'Fusionar Planillas',
        input: 'select',
        inputLabel: 'Selecciona la causal de la fusión:',
        inputPlaceholder: 'Selecciona una causal',
        inputOptions: causales.reduce((opts: any, c: any) => {
          opts[c.nombre] = c.nombre;
          return opts;
        }, {}),
        showCancelButton: true,
        confirmButtonText: 'Fusionar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#005f56',
        cancelButtonColor: '#6b7280'
      });

      if (!causal) return;

      // Consultar tarifa para el peso total
      const tarifaResponse = await fetch(`${API}/siscore/consultar-tarifa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centro_costo: centroCosto || 'FMC',
          ruta: rutaMasRepetida,
          peso_real: totalPeso
        })
      });

      if (!tarifaResponse.ok) {
        throw new Error('Error al consultar tarifa');
      }

      const tarifaData = await tarifaResponse.json();

      // Crear planilla fusionada con planillas concatenadas
      const planillasFusionadas = planillasAFusionar.map(p => p.planilla).join('-');
      const planillaFusionada: PlanillaResultado = {
        planilla: planillasFusionadas,
        encontrada: true,
        piezas: totalPiezas,
        peso_real: totalPeso,
        ruta: rutaMasRepetida,
        codigo_pedido: codigosPedido,
        cantidad_pedidos: numPedidos,
        cliente_origen: clienteOrigen,
        municipio_destino: municipioDestino,
        departamento_destino: deptoDestino,
        regional: regional,
        centro_costo: centroCosto,
        tarifa_calculada: tarifaData.tarifa_calculada,
        tipo_vehiculo: tarifaData.tipo_vehiculo,
        total_solicitado: 0,
        tarifa_base: tarifaData.tarifa_calculada,
        tipo_veh_sicetac: tarifaData.tipo_vehiculo,
        requiere_descargue: 0,
        punto_adicional: 0,
        desvio: 0,
        aforo: 0,
        placa: placa,
        causal: causal
      };

      // Calcular total
      planillaFusionada.total_solicitado = calcularTotalSolicitado(planillaFusionada);

      // Eliminar planillas originales (de atrás hacia adelante para no afectar índices)
      const indicesAEliminar = [...indices].sort((a, b) => b - a);
      let nuevosResultados = [...resultados];
      indicesAEliminar.forEach(idx => {
        nuevosResultados.splice(idx, 1);
      });

      // Agregar planilla fusionada al inicio
      nuevosResultados.unshift(planillaFusionada);
      setResultados(nuevosResultados);

      // Limpiar selecciones
      setPlanillasSeleccionadas(new Set());

      Swal.fire('Fusión Exitosa', `Planilla fusionada creada: ${planillaFusionada.planilla}\nTotal piezas: ${totalPiezas}\nTotal peso: ${totalPeso.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg\nVehículo: ${tarifaData.tipo_vehiculo}`, 'success');

    } catch (error) {
      Swal.fire('Error', 'Error al fusionar las planillas', 'error');
    }
  };

  const handleAbrirModal = (resultado: PlanillaResultado, indice: number = -1) => {

    // Convertir valores antiguos ("NO"/"SI") a numéricos
    const convertirDescargue = (val: any): number => {
      if (typeof val === 'number') return val;
      if (val === 'SI' || val === true) return 50000;
      return 0;
    };

    const convertirBooleano = (val: any): number => {
      if (typeof val === 'number') return val;
      if (val === true || val === 'SI') return 80000; // Para punto_adicional
      if (val === true || val === 'SI') return 100000; // Para desvio
      return 0;
    };

    const tempEdicionInit = {
      tarifa_base: resultado.tarifa_base || resultado.tarifa_calculada || 0,
      tipo_veh_sicetac: resultado.tipo_veh_sicetac || resultado.tipo_vehiculo || 'CARRY',
      requiere_descargue: convertirDescargue(resultado.requiere_descargue),
      punto_adicional: typeof resultado.punto_adicional === 'number' ? resultado.punto_adicional : (resultado.punto_adicional === true ? 80000 : 0),
      desvio: typeof resultado.desvio === 'number' ? resultado.desvio : (resultado.desvio === true ? 100000 : 0),
      aforo: resultado.aforo || 0,
      placa: resultado.placa || ''
    };
    setModalDetalle({ abierto: true, resultado, indice });
    setTempEdicion(tempEdicionInit);
  };

  const handleCerrarModal = () => {
    setModalDetalle({ abierto: false, resultado: null, indice: null });
    setTempEdicion(null);
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
                    <th>Placa</th>
                    <th>Piezas</th>
                    <th>Peso Real</th>
                    <th>Ruta</th>
                    <th>Tipo Vehículo</th>
                    <th>Flete teórico</th>
                    <th>Flete solicitado</th>
                    <th>Total Solicitado</th>
                    <th>Diferencia</th>
                    <th>Cliente Origen</th>
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
                    <tr key={sol._id}>
                      <td>
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
                            total_solicitado: sol.total_solicitado || (() => {
                              const base = sol.tarifa_base || sol.tarifa_calculada || 0;
                              let t = base;
                              if (sol.requiere_descargue === 'SI') t += 50000;
                              if (sol.punto_adicional) t += 80000;
                              if (sol.desvio) t += 100000;
                              return t;
                            })(),
                            tarifa_base: sol.tarifa_base,
                            requiere_descargue: sol.requiere_descargue,
                            punto_adicional: sol.punto_adicional,
                            desvio: sol.desvio,
                            tipo_veh_sicetac: sol.tipo_veh_sicetac,
                            placa: sol.placa,
                            aforo: sol.aforo,
                            guardado: true,
                            solicitando_id: sol._id
                          }, -1)}
                          className="SV-btnAction SV-btnEdit"
                          title="Ver detalles (solo lectura)"
                          style={{ background: '#2563eb' }}
                        >
                          <FaPen />
                        </button>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{sol.regional || '-'}</td>
                      <td className="SV-planillaCell">{sol.planilla}</td>
                      <td style={{ fontWeight: '600' }}>{sol.placa || 'NA'}</td>
                      <td>{sol.piezas}</td>
                      <td>{sol.peso_real.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
                      <td>{sol.ruta}</td>
                      <td>{sol.tipo_vehiculo}</td>
                      <td>${sol.tarifa_calculada.toLocaleString('es-CO')}</td>
                      <td>${sol.tarifa_base?.toLocaleString('es-CO') || '-'}</td>
                      <td style={{ fontWeight: 'bold', color: '#005f56' }}>${total.toLocaleString('es-CO')}</td>
                      <td style={{ color: diferencia > 0 ? '#16a34a' : diferencia < 0 ? '#dc2626' : '#666' }}>
                        {diferencia > 0 ? `+$${diferencia.toLocaleString('es-CO')}` : diferencia < 0 ? `-$${Math.abs(diferencia).toLocaleString('es-CO')}` : '$0'}
                      </td>
                      <td className="SV-truncate" title={sol.cliente_origen}>
                        {sol.cliente_origen || '-'}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            {['ADMIN', 'OPERATIVO'].includes(perfil) && (
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
            )}

            {resultados.length > 0 && (
              <div className="SV-resultsSection">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 className="SV-resultsTitle" style={{ margin: 0 }}>Resultados</h2>
                  {['ADMIN', 'ANALISTA', 'OPERATIVO'].includes(perfil) && planillasSeleccionadas.size > 0 && (
                    <button
                      onClick={handleFusionarPlanillas}
                      className="SV-btnToggle"
                      style={{ background: '#f59e0b', fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                      🔗 Fusionar ({planillasSeleccionadas.size})
                    </button>
                  )}
                </div>
                <div className="SV-tableContainer">
                  <table className="SV-table">
                    <thead>
                      <tr>
                        <th>Fusionar</th>
                        <th>Acciones</th>
                        <th>Regional</th>
                        <th>Planilla</th>
                        <th>Placa</th>
                        <th>Piezas</th>
                        <th>Peso Real</th>
                        <th>Cant. Pedidos</th>
                        <th>Ruta</th>
                        <th>Tipo Vehículo</th>
                        <th>Flete teórico</th>
                        <th>Flete solicitado</th>
                        <th>Vehículo SICETAC</th>
                        <th>Descargue</th>
                        <th>Punto Adic.</th>
                        <th>Desvío</th>
                        <th>Aforo</th>
                        <th>Total Solicitado</th>
                        <th>Diferencia</th>
                        <th>Municipio</th>
                        <th>Cliente Origen</th>
                        <th>Código Pedido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((resultado, index) => {
                        const total = calcularTotalSolicitado(resultado);
                        const diferencia = total - (resultado.tarifa_calculada || 0);

                        return (
                        <tr key={index}>
                          <td style={{ textAlign: 'center' }}>
                            {resultado.encontrada && ['ADMIN', 'ANALISTA', 'OPERATIVO'].includes(perfil) && (
                              <input
                                type="checkbox"
                                checked={planillasSeleccionadas.has(index)}
                                onChange={() => handleToggleSeleccion(index)}
                                className="SV-fusionCheckbox"
                              />
                            )}
                          </td>
                          <td>
                            {resultado.encontrada && (
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                  onClick={() => handleAbrirModal(resultado, index)}
                                  className="SV-btnAction SV-btnEdit"
                                  title="Ver/editar detalles"
                                  style={{ background: '#2563eb' }}
                                >
                                  <FaPen />
                                </button>
                                <button
                                  onClick={() => handleEliminarResultado(index)}
                                  className="SV-btnAction SV-btnDelete"
                                  title="Eliminar planilla"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{resultado.regional || '-'}</td>
                          <td className="SV-planillaCell">
                            {resultado.planilla}
                          </td>
                          <td style={{ fontWeight: '600' }}>{resultado.placa || 'NA'}</td>
                          <td>{resultado.encontrada ? resultado.piezas : '-'}</td>
                          <td>{resultado.encontrada ? resultado.peso_real.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '-'}</td>
                          <td>{resultado.encontrada ? resultado.cantidad_pedidos : '-'}</td>
                          <td>{resultado.ruta}</td>
                          <td>{resultado.tipo_vehiculo || '-'}</td>
                          <td>${resultado.tarifa_calculada?.toLocaleString('es-CO') || '-'}</td>
                          <td>
                            {resultado.encontrada ? (
                              <span style={{ fontWeight: '600', color: '#005f56' }}>
                                ${resultado.tarifa_base?.toLocaleString('es-CO') || resultado.tarifa_calculada?.toLocaleString('es-CO') || '-'}
                              </span>
                            ) : '-'}
                          </td>
                          <td>{resultado.tipo_veh_sicetac || resultado.tipo_vehiculo || '-'}</td>
                          <td>
                            {resultado.encontrada && resultado.requiere_descargue === 'SI' ? '$50.000' : resultado.encontrada ? '$0' : '-'}
                          </td>
                          <td>
                            {resultado.encontrada && resultado.punto_adicional ? '$80.000' : resultado.encontrada ? '$0' : '-'}
                          </td>
                          <td>
                            {resultado.encontrada && resultado.desvio ? '$100.000' : resultado.encontrada ? '$0' : '-'}
                          </td>
                          <td style={{ fontWeight: '600' }}>
                            {resultado.encontrada && resultado.aforo ? `$${resultado.aforo.toLocaleString('es-CO')}` : resultado.encontrada ? '$0' : '-'}
                          </td>
                          <td style={{ fontWeight: 'bold', color: '#005f56' }}>
                            ${resultado.encontrada ? total.toLocaleString('es-CO') : '-'}
                          </td>
                          <td style={{ color: diferencia > 0 ? '#16a34a' : diferencia < 0 ? '#dc2626' : '#666' }}>
                            {resultado.encontrada ? (diferencia > 0 ? `+$${diferencia.toLocaleString('es-CO')}` : diferencia < 0 ? `-$${Math.abs(diferencia).toLocaleString('es-CO')}` : '$0') : '-'}
                          </td>
                          <td>{resultado.municipio_destino}</td>
                          <td className="SV-truncate" title={resultado.cliente_origen}>
                            {resultado.cliente_origen}
                          </td>
                          <td className="SV-truncate" title={resultado.codigo_pedido}>
                            {resultado.codigo_pedido}
                          </td>
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

      {/* Modal de edición de planilla */}
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
            maxWidth: '700px',
            width: '90%',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#004d40' }}>Editar Planilla {modalDetalle.resultado.planilla}</h2>
              <button onClick={handleCerrarModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><strong>Regional:</strong> {modalDetalle.resultado.regional || '-'}</div>
              <div><strong>Ruta:</strong> {modalDetalle.resultado.ruta}</div>
              <div><strong>Piezas:</strong> {modalDetalle.resultado.piezas}</div>
              <div><strong>Peso Real:</strong> {modalDetalle.resultado.peso_real}</div>
              <div><strong>Cant. Pedidos:</strong> {modalDetalle.resultado.cantidad_pedidos}</div>
              <div><strong>Tipo Vehículo:</strong> {modalDetalle.resultado.tipo_vehiculo}</div>
              <div><strong>Municipio Destino:</strong> {modalDetalle.resultado.municipio_destino}</div>
              <div><strong>Departamento Destino:</strong> {modalDetalle.resultado.departamento_destino}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Cliente Origen:</strong> {modalDetalle.resultado.cliente_origen}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Códigos Pedido:</strong> {modalDetalle.resultado.codigo_pedido}</div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#004d40', marginBottom: '1rem', fontSize: '1.1rem', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }}>Campos Editables</h3>

              {/* Sección: Tarifas */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#666', fontWeight: '600' }}>💰 FLETES</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Flete Teórico</label>
                    <div style={{ padding: '0.5rem', background: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', fontWeight: '600', color: '#005f56' }}>
                      ${modalDetalle.resultado.tarifa_calculada?.toLocaleString('es-CO') || '-'}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Flete solicitado</label>
                    <input
                      type="number"
                      className="SV-inputSmall"
                      value={tempEdicion?.tarifa_base || ''}
                      onChange={(e) => {
                        const nuevoValor = parseFloat(e.target.value) || 0;
                        setTempEdicion(prev => prev ? { ...prev, tarifa_base: nuevoValor } : null);
                      }}
                      style={{ width: '100%', padding: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Placa</label>
                    <input
                      type="text"
                      className="SV-inputSmall"
                      value={tempEdicion?.placa || ''}
                      onChange={(e) => {
                        setTempEdicion(prev => prev ? { ...prev, placa: e.target.value.toUpperCase() } : null);
                      }}
                      style={{ width: '100%', padding: '0.5rem', textTransform: 'uppercase' }}
                      placeholder="XXX-000"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Vehículo SICETAC</label>
                    <select
                      className="SV-selectSmall"
                      value={tempEdicion?.tipo_veh_sicetac || ''}
                      onChange={(e) => {
                        setTempEdicion(prev => prev ? { ...prev, tipo_veh_sicetac: e.target.value } : null);
                      }}
                      style={{ width: '100%', padding: '0.5rem' }}
                    >
                      {OPCIONES_VEHICULO.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Total Solicitado</label>
                    <div style={{ padding: '0.5rem', background: 'white', border: '2px solid #005f56', borderRadius: '6px', fontWeight: '700', color: '#005f56', fontSize: '1.1rem' }}>
                      ${calcularTotalTemporal().toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección: Recargos */}
              <div style={{ background: '#fefce8', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#b45309', fontWeight: '600' }}>📦 RECARGOS ADICIONALES</h4>
                <div className="recargos-grid">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#b45309', marginBottom: '0.3rem', fontWeight: '600' }}>Descargue</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>$</span>
                      <input
                        type="number"
                        className="SV-inputSmall"
                        value={tempEdicion?.requiere_descargue || 0}
                        onChange={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          setTempEdicion(prev => prev ? { ...prev, requiere_descargue: valor } : null);
                        }}
                        style={{ width: '100%', padding: '0.5rem', fontWeight: '600' }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#b45309', marginBottom: '0.3rem', fontWeight: '600' }}>Punto Adicional</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>$</span>
                      <input
                        type="number"
                        className="SV-inputSmall"
                        value={tempEdicion?.punto_adicional || 0}
                        onChange={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          setTempEdicion(prev => prev ? { ...prev, punto_adicional: valor } : null);
                        }}
                        style={{ width: '100%', padding: '0.5rem', fontWeight: '600' }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#b45309', marginBottom: '0.3rem', fontWeight: '600' }}>Desvío</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>$</span>
                      <input
                        type="number"
                        className="SV-inputSmall"
                        value={tempEdicion?.desvio || 0}
                        onChange={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          setTempEdicion(prev => prev ? { ...prev, desvio: valor } : null);
                        }}
                        style={{ width: '100%', padding: '0.5rem', fontWeight: '600' }}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#b45309', marginBottom: '0.3rem', fontWeight: '600' }}>Aforo</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', color: '#666' }}>$</span>
                      <input
                        type="number"
                        className="SV-inputSmall"
                        value={tempEdicion?.aforo || 0}
                        onChange={(e) => {
                          const valor = parseFloat(e.target.value) || 0;
                          setTempEdicion(prev => prev ? { ...prev, aforo: valor } : null);
                        }}
                        style={{ width: '100%', padding: '0.5rem', fontWeight: '600' }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {/* Botón Guardar cambios */}
              <button
                onClick={async () => {
                  if (modalDetalle.indice !== null && tempEdicion && modalDetalle.resultado) {

                    // Crear resultado actualizado
                    const resultadoActualizado = {
                      ...modalDetalle.resultado,
                      tarifa_base: tempEdicion.tarifa_base,
                      tipo_veh_sicetac: tempEdicion.tipo_veh_sicetac,
                      requiere_descargue: tempEdicion.requiere_descargue,
                      punto_adicional: tempEdicion.punto_adicional,
                      desvio: tempEdicion.desvio,
                      aforo: tempEdicion.aforo,
                      placa: tempEdicion.placa
                    };

                    // Aplicar cambios locales
                    handleActualizarResultado(modalDetalle.indice, 'tarifa_base', tempEdicion.tarifa_base);
                    handleActualizarResultado(modalDetalle.indice, 'tipo_veh_sicetac', tempEdicion.tipo_veh_sicetac);
                    handleActualizarResultado(modalDetalle.indice, 'requiere_descargue', tempEdicion.requiere_descargue);
                    handleActualizarResultado(modalDetalle.indice, 'punto_adicional', tempEdicion.punto_adicional);
                    handleActualizarResultado(modalDetalle.indice, 'desvio', tempEdicion.desvio);
                    handleActualizarResultado(modalDetalle.indice, 'aforo', tempEdicion.aforo);
                    handleActualizarResultado(modalDetalle.indice, 'placa', tempEdicion.placa);

                    // Actualizar modal
                    setModalDetalle(prev => ({
                      ...prev,
                      resultado: resultadoActualizado
                    }));

                    // Guardar en BD
                    await handleGuardarSolicitud(resultadoActualizado, modalDetalle.indice);

                    // Cerrar modal
                    handleCerrarModal();
                  }
                }}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                💾 Guardar
              </button>
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

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaSearch, FaCheckCircle, FaTimesCircle, FaTruck } from 'react-icons/fa';
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
  'Cliente Destino': string;
  'Municipio Destino': string;
  'Departamento Destino': string;
  [key: string]: string | number | undefined;
}

interface PlanillaResultado {
  planilla: string;
  encontrada: boolean;
  piezas: number;
  peso_real: number;
  ruta: string;
  codigo_pedido: string;
  cliente_destino: string;
  municipio_destino: string;
  departamento_destino: string;
}

const SolicitudVehiculos: React.FC = () => {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [centroDistribucion, setCentroDistribucion] = useState('');
  const [loading, setLoading] = useState(false);
  const [planillasInput, setPlanillasInput] = useState('');
  const [resultados, setResultados] = useState<PlanillaResultado[]>([]);
  const [todosRegistros, setTodosRegistros] = useState<RegistroSiscore[]>([]);
  const [tiempoConsulta, setTiempoConsulta] = useState<number>(0);

  const PERFILES_GLOBALES = ['ADMIN', 'COORDINADOR', 'CONTROL', 'ANALISTA'];

  // Mapeo de código a nombre para centros de distribución
  const CEDI_A_NOMBRE: Record<string, string> = {
    'CO04': 'BARRANQUILLA',
    'CO05': 'CALI',
    'CO06': 'BUCARAMANGA',
    'CO07': 'FUNZA',
    'MEDELLIN': 'CO09',
  };

  // Mapeo inverso para cuando la cookie tiene el nombre
  const NOMBRE_A_CEDI: Record<string, string> = {
    'BARRANQUILLA': 'CO04',
    'CALI': 'CO05',
    'BUCARAMANGA': 'CO06',
    'FUNZA': 'CO07',
    'MEDELLIN': 'CO09',
  };

  // Función para calcular 30 días hábiles hacia atrás
  const calcularRangoFechas = () => {
    const hoy = new Date();
    let diasRestar = 0;
    let fechaActual = new Date(hoy);

    // Festivos de Colombia 2026
    const festivos2026 = [
      '2026-01-01', '2026-01-06', '2026-05-01', '2026-07-20', '2026-08-07',
      '2026-12-08', '2026-12-25', '2026-03-23', '2026-03-24', '2026-04-17',
      '2026-06-07', '2026-06-16', '2026-06-23'
    ];

    const esFestivoOFinDeSemana = (fecha: Date) => {
      const diaSemana = fecha.getDay();
      if (diaSemana === 0 || diaSemana === 6) return true; // Domingo o Sábado
      const fechaStr = fecha.toISOString().split('T')[0];
      return festivos2026.includes(fechaStr);
    };

    while (diasRestar < 30) {
      fechaActual.setDate(fechaActual.getDate() - 1);
      if (!esFestivoOFinDeSemana(fechaActual)) {
        diasRestar++;
      }
    }

    return {
      inicio: fechaActual.toISOString().split('T')[0],
      fin: hoy.toISOString().split('T')[0]
    };
  };

  useEffect(() => {
    const match = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/);
    if (!match) { router.replace('/LoginUsuario'); return; }
    setUsuario(match[2] || '');

    const perfilValue = document.cookie.match(/(^| )perfilPedidosCookie=([^;]+)/)?.[2] || '';
    setPerfil(perfilValue);

    const regionalValue = document.cookie.match(/(^| )regionalPedidosCookie=([^;]+)/)?.[2] || '';

    // Para perfiles operativos, siempre usar el nombre de la regional (CALI, FUNZA, etc.)
    let centroDist = '';
    if (!PERFILES_GLOBALES.includes(perfilValue) && regionalValue) {
      // Si viene como código (CO07), convertir a nombre
      if (regionalValue.startsWith('CO')) {
        centroDist = CEDI_A_NOMBRE[regionalValue] || regionalValue;
      } else {
        // Si ya viene como nombre, usarlo directamente
        centroDist = regionalValue;
      }
      console.log('Conversión centro_distribución:', regionalValue, '→', centroDist);
    }
    setCentroDistribucion(centroDist);

    const cliente = document.cookie.match(/(^| )clientePedidosCookie=([^;]+)/)?.[2];
    if (cliente && cliente !== 'MEDICAL_CARE') router.replace('/Pedidos');
  }, [router]);

  const handleBuscar = async () => {
    if (!planillasInput.trim()) {
      Swal.fire('Advertencia', 'Por favor ingresa al menos una planilla', 'warning');
      return;
    }

    // Parsear planillas (separadas por coma)
    const planillasBuscadas = planillasInput
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (planillasBuscadas.length === 0) {
      Swal.fire('Advertencia', 'Por favor ingresa al menos una planilla válida', 'warning');
      return;
    }

    setLoading(true);
    setResultados([]);
    setTiempoConsulta(0);

    // Mostrar animación de carga con SweetAlert2
    Swal.fire({
      title: 'Consultando Siscore',
      html: `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 60px; animation: truckDrive 1s ease-in-out infinite alternate;">
            🚛
          </div>
          <p style="margin-top: 20px; color: #666;">Consultando planillas en Siscore...</p>
          <p style="font-size: 14px; color: #999;">Por favor espera</p>
        </div>
        <style>
          @keyframes truckDrive {
            0% { transform: translateX(-20px); }
            100% { transform: translateX(20px); }
          }
        </style>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    const tiempoInicio = Date.now();

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
      const fechas = calcularRangoFechas();

      const payload = {
        planillas: planillasBuscadas,
        fecha_inicio: fechas.inicio,
        fecha_fin: fechas.fin,
        perfil: perfil,
        centro_distribucion: centroDistribucion || 'TODOS'
      };

      console.log('=== PETICIÓN A SISCORE ===');
      console.log('URL:', `${API}/siscore/consultar-planillas`);
      console.log('Payload:', payload);

      const response = await fetch(`${API}/siscore/consultar-planillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planillas: planillasBuscadas,
          fecha_inicio: '',
          fecha_fin: '',
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

      // Guardar todos los registros
      const registros = data.registros || [];
      setTodosRegistros(registros);

      // Agrupar por planilla para las planillas buscadas
      const planillasMap = new Map<string, PlanillaResultado>();

      for (const reg of registros) {
        const planilla = reg.Planilla?.toString().trim();

        if (!planilla) continue;

        // Solo procesar si está en las planillas buscadas
        if (!planillasBuscadas.includes(planilla)) continue;

        if (!planillasMap.has(planilla)) {
          planillasMap.set(planilla, {
            planilla,
            encontrada: true,
            piezas: 0,
            peso_real: 0,
            ruta: reg.Ruta || '-',
            codigo_pedido: reg['Codigo Pedido'] || '-',
            cliente_destino: reg['Cliente Destino'] || '-',
            municipio_destino: reg['Municipio Destino'] || '-',
            departamento_destino: reg['Departamento Destino'] || '-'
          });
        }

        const planillaData = planillasMap.get(planilla)!;
        planillaData.piezas += parseInt(reg.Piezas || 0) || 0;
        planillaData.peso_real += parseFloat(reg['Peso Real'] || 0) || 0;
      }

      // Crear resultados para todas las planillas buscadas (encontradas o no)
      const resultadosProcesados: PlanillaResultado[] = planillasBuscadas.map(planilla => {
        return planillasMap.get(planilla) || {
          planilla,
          encontrada: false,
          piezas: 0,
          peso_real: 0,
          ruta: '-',
          codigo_pedido: '-',
          cliente_destino: '-',
          municipio_destino: '-',
          departamento_destino: '-'
        };
      });

      console.log('=== RESULTADOS POR PLANILLA ===');
      resultadosProcesados.forEach(resultado => {
        if (resultado.encontrada) {
          console.log(`Planilla ${resultado.planilla}: ${resultado.piezas} piezas, ${resultado.peso_real} kg, Ruta: ${resultado.ruta}, Cliente: ${resultado.cliente_destino}`);
        } else {
          console.log(`Planilla ${resultado.planilla}: NO ENCONTRADA`);
        }
      });

      setResultados(resultadosProcesados);

      // Mostrar resumen
      const encontradas = resultadosProcesados.filter(r => r.encontrada).length;

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

  return (
    <div className="SV-layout">
      <NavMedicalCare paginaActual="solicitud" />

      <main className="SV-main">
        {/* Header */}
        <div className="SV-header">
          <h1 className="SV-title">Solicitud de Vehículos</h1>
        </div>

        {/* Input de planillas */}
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

        {/* Tabla de resultados */}
        {resultados.length > 0 && (
          <div className="SV-resultsSection">
            <h2 className="SV-resultsTitle">Resultados</h2>
            <div className="SV-tableContainer">
              <table className="SV-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Planilla</th>
                    <th>Piezas</th>
                    <th>Peso Real</th>
                    <th>Ruta</th>
                    <th>Código Pedido</th>
                    <th>Cliente Destino</th>
                    <th>Municipio Destino</th>
                    <th>Departamento Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((resultado, index) => (
                    <tr key={index} className={resultado.encontrada ? 'SV-rowFound' : 'SV-rowNotFound'}>
                      <td className="SV-statusCell">
                        {resultado.encontrada ? (
                          <FaCheckCircle className="SV-iconSuccess" />
                        ) : (
                          <FaTimesCircle className="SV-iconError" />
                        )}
                      </td>
                      <td className="SV-planillaCell">{resultado.planilla}</td>
                      <td>{resultado.encontrada ? resultado.piezas : '-'}</td>
                      <td>{resultado.encontrada ? resultado.peso_real.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                      <td>{resultado.ruta}</td>
                      <td>{resultado.codigo_pedido}</td>
                      <td>{resultado.cliente_destino}</td>
                      <td>{resultado.municipio_destino}</td>
                      <td>{resultado.departamento_destino}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
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

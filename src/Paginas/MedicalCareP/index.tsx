'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /MedicalCare — REDIRECT (2026-11-25, 5.ª tanda).
 *
 * La pantalla de botones fue eliminada: era redundante con los submenús del
 * hub (y con el lanzador global). Sus dos funciones ADMIN/CONTROL vivieron
 * aquí y ahora viven en /ConfigMC:
 *   - «Editar Causales» (causales de fusión de Solicitud de Vehículos)
 *   - «Configuración Sync V3» (horarios + on/off)
 *
 * Entrar al portal aterriza en Solicitud de Vehículos (decisión del usuario,
 * 2026-11-25 6.ª tanda: antes iba a Pacientes). La ruta se conserva como
 * redirect por bookmarks, guards y enlaces viejos.
 */
const MedicalCareP: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const usuario = document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2];
    if (!usuario) {
      router.replace('/LoginUsuario');
      return;
    }
    router.replace('/SolicitudVehiculos');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#67737f', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      Abriendo Medical Care…
    </div>
  );
};

export default MedicalCareP;

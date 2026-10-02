'use client';
import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import Swal from 'sweetalert2';
import './estilos.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// El canvas de firma (react-signature-canvas) solo se carga cuando se va a
// dibujar: baja el JS residente al entrar en móviles con poca RAM.
const SignatureCanvas = lazy(() => import('react-signature-canvas'));

interface FirmaConductorProps {
  placa: string;
  idUsuario?: string;
  /** Edición de un aprobado: estampa editado_por con el id del dueño. */
  editarAprobado?: boolean;
  /** Nombre de Seguridad cuando trabaja como el conductor (Modo Seguridad).
   *  La firma es un acto PERSONAL del conductor (igual que las políticas de
   *  datos): en sesión impersonada NO se puede dibujar ni re-firmar — solo
   *  se muestra la firma que el titular haya registrado con SU cuenta. */
  impersonadoPor?: string;
  /** Modo consulta: la firma se muestra, jamás se edita. */
  soloLectura?: boolean;
  /** URL (firmada) de la firma ya registrada en el vehículo. */
  firmaUrlInicial?: string;
  /** Sello de la firma electrónica del vehículo ({firmado_en, version}). */
  firmaEvidenciaInicial?: { firmado_en: string; version: number } | null;
  /** Avisa al padre que ya hay firma registrada (gate de «Finalizar»). */
  onFirmaRegistrada?: () => void;
}

/* Firma electrónica del conductor con evidencia sellada — vive en el PASO 3
   (Documentación) como último ítem antes de «Finalizar» (2026-10-01, orden del
   usuario: la firma no pertenece al formulario de datos). Extraída de
   `Componentes/Datos` sin cambios de comportamiento. */
const FirmaConductor: React.FC<FirmaConductorProps> = ({
  placa,
  idUsuario,
  editarAprobado,
  impersonadoPor,
  soloLectura,
  firmaUrlInicial,
  firmaEvidenciaInicial,
  onFirmaRegistrada,
}) => {
  const actorImpersonacion = (impersonadoPor || '').trim() || undefined;

  const [isLoading, setIsLoading] = useState(false);
  const [editandoFirma, setEditandoFirma] = useState(false);
  const sigCanvas = useRef<any>(null);
  // Sello de la firma electrónica (vehiculo.firmaEvidencia): fecha de la
  // última firma registrada vía /vehiculos/firmar. Null = firma histórica
  // sin sellado o aún no firmado.
  const [firmaSellada, setFirmaSellada] = useState<{ firmado_en: string; version: number } | null>(
    firmaEvidenciaInicial && firmaEvidenciaInicial.firmado_en
      ? { firmado_en: firmaEvidenciaInicial.firmado_en, version: firmaEvidenciaInicial.version ?? 1 }
      : null
  );
  const [firmaUrl, setFirmaUrl] = useState(firmaUrlInicial || '');

  // El vehículo del padre puede llegar AFTER del montaje (fetch async): sincronizar
  // la firma ya registrada cuando llega, sin pisar una edición en curso.
  useEffect(() => { if (firmaUrlInicial) setFirmaUrl(firmaUrlInicial); }, [firmaUrlInicial]);
  useEffect(() => {
    if (firmaEvidenciaInicial?.firmado_en) {
      setFirmaSellada({ firmado_en: firmaEvidenciaInicial.firmado_en, version: firmaEvidenciaInicial.version ?? 1 });
    }
  }, [firmaEvidenciaInicial?.firmado_en]);

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  // La fecha del backend llega ISO sin zona (naive UTC): se interpreta como
  // UTC y se muestra en hora de Colombia.
  const formatoFechaFirma = (iso: string): string => {
    try {
      return new Date(iso.endsWith('Z') ? iso : `${iso}Z`).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short',
      });
    } catch { return iso; }
  };

  /**
   * FIRMA ELECTRÓNICA con evidencia sellada (Ley 1955 art. 76 / Dec. 1499):
   * en un solo request (PUT /vehiculos/firmar) sube la imagen Y sella el
   * registro inmutable — hash SHA-256 de los datos declarados, fecha UTC,
   * IP y user-agent. Retorna la fecha ISO del sellado.
   */
  const firmarAhora = async (): Promise<string> => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      throw new Error('Dibuja tu firma antes de firmar.');
    }
    const dataURL = sigCanvas.current.getCanvas().toDataURL('image/webp');
    const blob = dataURLtoBlob(dataURL);
    const fileFirma = new File([blob], 'firma_conductor.webp', { type: 'image/webp' });
    const body = new FormData();
    body.append('archivo', fileFirma);
    body.append('placa', placa);
    if (idUsuario) body.append('id_usuario', idUsuario);
    if (editarAprobado && idUsuario) body.append('editado_por', idUsuario);
    else if (actorImpersonacion) body.append('editado_por', actorImpersonacion);

    const resp = await fetch(`${API_BASE}/vehiculos/firmar`, { method: 'PUT', body });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.detail || 'No se pudo registrar la firma.');
    if (data.url) setFirmaUrl(data.url);
    if (data.firmado_en) setFirmaSellada({ firmado_en: data.firmado_en, version: data.version ?? 1 });
    onFirmaRegistrada?.();
    return data.firmado_en || '';
  };

  // Botón «Firmar»: acto explícito e informado (qué firma y cuándo quedó sellado).
  const manejarFirmar = async () => {
    setIsLoading(true);
    try {
      const firmadoEn = await firmarAhora();
      await Swal.fire({
        icon: 'success',
        title: 'Firma registrada',
        html: `Firmaste electrónicamente el <b>${formatoFechaFirma(firmadoEn)}</b>.<br/>
               <span style="font-size:0.85em; color:#666">La firma quedó sellada con el hash de tus datos
               y la fecha exacta, como evidencia inmutable.</span>`,
        confirmButtonColor: '#27ae60',
      });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo firmar', text: error?.message || 'Intenta de nuevo.', confirmButtonColor: '#d33' });
    } finally {
      setIsLoading(false);
    }
  };

  const limpiarFirma = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
  };

  return (
    <div className="FirmaConductor-card">
      <h4>✍️ Firma del Conductor</h4>
      {actorImpersonacion && (
        <div className="FirmaConductor-nota-impersonacion">
          🕵 <strong>Modo Seguridad:</strong> la firma electrónica es un acto personal del
          conductor — queda sellada a su nombre. La hará con su propia cuenta en su primer
          ingreso; desde aquí solo puedes consultarla.
        </div>
      )}
      {soloLectura || actorImpersonacion ? (
        /* Modo consulta/impersonación: la firma se muestra, jamás se edita. */
        firmaUrl ? (
          <div style={{ textAlign: 'center', padding: '15px', border: '1px solid #d5dbdb', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
            <div style={{ color: '#2c3e50', fontWeight: 'bold', marginBottom: '10px' }}>Firma registrada</div>
            {firmaSellada && (
              <div style={{ fontSize: '0.82rem', color: '#5a6472', marginTop: '-4px', marginBottom: '10px' }}>
                ✍️ Firmada electrónicamente el <b>{formatoFechaFirma(firmaSellada.firmado_en)}</b>
              </div>
            )}
            <img src={firmaUrl} alt="Firma Conductor" style={{ maxWidth: '100%', height: '150px', border: '1px dashed #ccc', backgroundColor: 'white' }} />
          </div>
        ) : (
          <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>Sin firma registrada.</p>
        )
      ) : firmaUrl && !editandoFirma ? (
        <div className="firma-existente-container" style={{textAlign: 'center', padding: '15px', border: '1px solid #27ae60', borderRadius: '8px', backgroundColor: '#e8f8f5'}}>
            <div style={{color: '#27ae60', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem'}}>Firma Registrada Exitosamente</div>
            {firmaSellada ? (
              <div style={{fontSize: '0.82rem', color: '#5a6472', marginTop: '-4px', marginBottom: '10px'}}>
                ✍️ Firmada electrónicamente el <b>{formatoFechaFirma(firmaSellada.firmado_en)}</b> — evidencia sellada (hash de tus datos + fecha exacta{firmaSellada.version > 1 ? `, firma #${firmaSellada.version}` : ''}).
              </div>
            ) : (
              <div style={{fontSize: '0.82rem', color: '#8a6d3b', marginTop: '-4px', marginBottom: '10px'}}>
                Firma histórica sin sellado electrónico — usa «Cambiar / Volver a firmar» para firmar con evidencia.
              </div>
            )}
            <img src={firmaUrl} alt="Firma Conductor" style={{maxWidth: '100%', height: '150px', border: '1px dashed #ccc', marginBottom: '15px', backgroundColor: 'white'}} />
            <div>
              <button type="button" className="btn-cambiar-firma" onClick={() => { setEditandoFirma(true); setTimeout(() => limpiarFirma(), 100); }} style={{backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>
                Cambiar / Volver a firmar
              </button>
            </div>
        </div>
      ) : (
        <div className="firma-nueva-container">
            <p style={{fontSize: '0.9rem', color: '#4d4d4dff', marginBottom: '10px'}}>{firmaUrl ? "Estas en modo edición." : "Dibuja tu firma y pulsa «Firmar»: queda sellada con la fecha exacta y el hash de tus datos (firma electrónica)."}</p>
            {/* onPointerDown suelta el foco del último input: en móvil, si el input
                conserva el foco, al levantar el dedo de la firma el navegador vuelve
                a ese input (scroll + teclado) y confunde al conductor. */}
            <div className="signature-wrapper" onPointerDown={() => { (document.activeElement as HTMLElement | null)?.blur?.(); }} style={{border: '2px dashed #ccc', borderRadius: '8px', overflow: 'hidden'}}>
              <Suspense fallback={<div style={{height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a94a6', fontSize: '0.9rem'}}>Cargando espacio de firma…</div>}>
                <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{className: 'signature-canvas', style: {width: '100%', height: '200px'}}} backgroundColor="white" />
              </Suspense>
            </div>
            <div style={{marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
              <button type="button" onClick={manejarFirmar} disabled={isLoading} style={{backgroundColor: '#2F6B3E', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}>
                {isLoading ? 'Sellando…' : '✍️ Firmar'}
              </button>
              <button type="button" onClick={limpiarFirma} className="btn-limpiar-firma">Borrar dibujo</button>
              {firmaUrl && (<button type="button" onClick={() => { setEditandoFirma(false); limpiarFirma(); }} style={{backgroundColor: '#7f8c8d', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'}}>Cancelar edición</button>)}
            </div>
        </div>
      )}
    </div>
  );
};

export default FirmaConductor;

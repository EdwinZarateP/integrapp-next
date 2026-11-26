'use client';

/**
 * Formulario «Solicitud de viaje» / «Corregir y reenviar».
 * Puerto React de vjOpenForm de views-viajes.js: el viajero es siempre quien
 * solicita; cargo y categoría de tarifa se autocompletan del catálogo de
 * personal (cat_personal_viajes); resumen de días/noches y sáb/dom/festivo;
 * valida ciudades distintas y máximo 60 días (también lo valida el backend).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AutorizadorViaje, CIUDADES_VIAJE, PersonalViajeCat, UsuarioFin, Viaje,
  corregirViaje, crearViaje, listarAutorizadores, listarPersonalViajes,
} from '@/Funciones/ApiPedidos/financiero';
import { Campo, ModalFin, toastFin } from '../../nucleo/componentes';
import { listaDias, tipoDia } from '../../utiles/viajes/festivos';

interface Props {
  usuario: UsuarioFin;
  editar: Viaje | null;
  onCerrar: () => void;
  onListo: () => void;
}

const norm = (s: string) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Persona del catálogo que corresponde al usuario: nombre exacto o la única
 *  persona cuyo nombre contiene todas las palabras del usuario. */
function personaDeUsuario(personal: PersonalViajeCat[], nombre: string | null | undefined): PersonalViajeCat | null {
  const q = norm(nombre ?? '');
  const exacta = personal.find((p) => norm(p.nombre) === q);
  if (exacta) return exacta;
  const toks = q.split(/\s+/).filter((t) => t.length > 1);
  if (toks.length < 2) return null;
  const c = personal.filter((p) => toks.every((t) => norm(p.nombre).includes(t)));
  return c.length === 1 ? c[0] : null;
}

export default function ModalViajeForm({ usuario, editar, onCerrar, onListo }: Props) {
  const [autorizadores, setAutorizadores] = useState<AutorizadorViaje[] | null>(null);
  const [personal, setPersonal] = useState<PersonalViajeCat[]>([]);
  const [form, setForm] = useState({
    origen: editar?.origen ?? 'BARRANQUILLA',
    destino: editar?.destino ?? 'BOGOTA',
    fecha_inicio: (editar?.fecha_inicio ?? '').slice(0, 10),
    fecha_fin: (editar?.fecha_fin ?? '').slice(0, 10),
    objetivo: editar?.objetivo ?? '',
    autorizador_id: editar?.autorizador_id ?? '',
    requiere_tiquetes: editar?.requiere_tiquetes ?? true,
    observaciones: editar?.observaciones ?? '',
    viajero_cargo: editar?.viajero_cargo ?? '',
    categoria_solicitud: editar?.categoria_solicitud ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listarAutorizadores().then(setAutorizadores).catch(() => setAutorizadores([]));
    listarPersonalViajes().then(setPersonal).catch(() => setPersonal([]));
  }, []);

  const persona = useMemo(() => personaDeUsuario(personal, usuario.nombre), [personal, usuario]);
  const cargo = persona?.cargo ?? form.viajero_cargo;
  const categoria = persona?.categoria ?? form.categoria_solicitud ?? 'B';

  const dias = form.fecha_inicio && form.fecha_fin && form.fecha_fin >= form.fecha_inicio
    ? listaDias(form.fecha_inicio, form.fecha_fin) : [];
  const especiales = dias.filter((d) => tipoDia(d).tipo !== 'habil').length;
  const resumen = dias.length
    ? `${dias.length} día(s), ${dias.length - 1} noche(s)${especiales ? ` · ${especiales} sáb/dom/festivo` : ''}` : '';

  const guardar = async () => {
    if (!form.fecha_inicio || !form.fecha_fin) return setError('Define las fechas del viaje.');
    if (form.objetivo.trim().length < 3) return setError('Describe el objetivo del viaje.');
    if (!form.autorizador_id) return setError('Elige quién autoriza.');
    if (form.fecha_fin < form.fecha_inicio) return setError('La fecha de fin es anterior a la de inicio.');
    if (form.origen === form.destino) return setError('Elige ciudades distintas para el origen y el destino.');
    if (dias.length > 60) return setError('El máximo es de 60 días por solicitud.');
    setGuardando(true);
    const payload = {
      viajero_nombre: usuario.nombre,
      origen: form.origen, destino: form.destino,
      fecha_inicio: new Date(form.fecha_inicio + 'T08:00:00').toISOString(),
      fecha_fin: new Date(form.fecha_fin + 'T18:00:00').toISOString(),
      objetivo: form.objetivo,
      autorizador_id: form.autorizador_id,
      requiere_tiquetes: form.requiere_tiquetes,
      observaciones: form.observaciones || null,
      viajero_cargo: cargo || null,
      categoria_solicitud: categoria || null,
    };
    try {
      const r = editar
        ? await corregirViaje(editar.id, payload, editar.version)
        : await crearViaje(payload);
      toastFin(editar
        ? `${r.consecutivo} corregido y reenviado a autorización`
        : `Solicitud ${r.consecutivo} enviada a autorización`);
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setGuardando(false); }
  };

  return (
    <ModalFin titulo={editar ? `Corregir viaje ${editar.consecutivo}` : 'Solicitud de aprobación de viaje'} onCerrar={onCerrar} ancho={720}>
      {error && <div className="fin-error">{error}</div>}
      <p className="fin-suave" style={{ fontSize: 12 }}>
        Viajero: <b>{usuario.nombre}</b>{cargo ? ` · ${cargo}` : ''}{categoria ? ` · Categoría ${categoria}` : ''} — los viajes solo se solicitan para ti mismo.
      </p>
      <div className="fin-grid">
        <Campo etiqueta="Origen (de dónde sales) *">
          <select className="fin-input" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
            {CIUDADES_VIAJE.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Destino (para dónde va) *">
          <select className="fin-input" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}>
            {CIUDADES_VIAJE.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Quién autoriza *">
          <select className="fin-input" value={form.autorizador_id}
                  onChange={(e) => setForm({ ...form, autorizador_id: e.target.value })}>
            <option value="">— elegir —</option>
            {autorizadores?.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha de salida *">
          <input type="date" className="fin-input" value={form.fecha_inicio}
                 onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
        </Campo>
        <Campo etiqueta="Fecha de regreso *">
          <input type="date" className="fin-input" value={form.fecha_fin}
                 onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
        </Campo>
        <Campo etiqueta="Duración">
          <span className="fin-suave" style={{ fontSize: 12 }}>{resumen}</span>
        </Campo>
      </div>
      <Campo etiqueta="Objetivo del viaje *">
        <textarea className="fin-input" rows={3} placeholder="¿A qué va y qué se espera lograr?"
                  value={form.objetivo}
                  onChange={(e) => setForm({ ...form, objetivo: e.target.value })} />
      </Campo>
      <Campo etiqueta="Observaciones (opcional)">
        <textarea className="fin-input" rows={2} placeholder="Horarios, ruta, acompañantes…"
                  value={form.observaciones ?? ''}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
      </Campo>
      <label className="fin-check">
        <input type="checkbox" checked={form.requiere_tiquetes}
               onChange={(e) => setForm({ ...form, requiere_tiquetes: e.target.checked })} />
        Requiere gestión de tiquetes por Compras
      </label>
      <div className="fin-modalPie">
        <button className="fin-btn fin-btnSecundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="fin-btn fin-btnPrimario" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Enviando…' : editar ? 'Reenviar a autorización' : 'Enviar a autorización'}
        </button>
      </div>
    </ModalFin>
  );
}

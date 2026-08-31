'use client';
import React from 'react';
import './estilos.css';

/* ── Celular con región: selector de país (default +57 Colombia) + número.
   Almacenamiento: +57 → solo dígitos (formato histórico, ej: 3001234567);
   otra región → "+<código> <número>" (ej: "+54 3794123456"). Los consumidores
   (wa.me, HV, revisión) muestran/usan el valor tal cual.

   Componente compartido (2026-08-31, extraído del formulario Datos): la fila
   select+input reporta por onChange con el contrato de evento estándar
   ({target: {name, value}}), así que engancha directo con los handleChange
   existentes. Clases por props para amoldarse al look de cada página
   (LC-input del registro, Datos-phone del paso 2). ── */

export const REGIONES_CELULAR: Array<{ code: string; label: string }> = [
  { code: '57', label: '🇨🇴 +57 Colombia' },
  { code: '1', label: '🇺🇸 +1 EE.UU. / Canadá' },
  { code: '1', label: '🇩🇴 +1 Rep. Dominicana' },
  { code: '52', label: '🇲🇽 +52 México' },
  { code: '51', label: '🇵🇪 +51 Perú' },
  { code: '56', label: '🇨🇱 +56 Chile' },
  { code: '54', label: '🇦🇷 +54 Argentina' },
  { code: '55', label: '🇧🇷 +55 Brasil' },
  { code: '58', label: '🇻🇪 +58 Venezuela' },
  { code: '593', label: '🇪🇨 +593 Ecuador' },
  { code: '591', label: '🇧🇴 +591 Bolivia' },
  { code: '595', label: '🇵🇾 +595 Paraguay' },
  { code: '598', label: '🇺🇾 +598 Uruguay' },
  { code: '507', label: '🇵🇦 +507 Panamá' },
  { code: '506', label: '🇨🇷 +506 Costa Rica' },
  { code: '505', label: '🇳🇮 +505 Nicaragua' },
  { code: '504', label: '🇭🇳 +504 Honduras' },
  { code: '503', label: '🇸🇻 +503 El Salvador' },
  { code: '502', label: '🇬🇹 +502 Guatemala' },
  { code: '501', label: '🇧🇿 +501 Belice' },
  { code: '509', label: '🇭🇹 +509 Haití' },
  { code: '53', label: '🇨🇺 +53 Cuba' },
  { code: '1', label: '🇯🇲 +1 Jamaica' },
];

export const regionDeValor = (valor: string): string => {
  const m = (valor || '').match(/^\+(\d{1,3})\s/);
  return m ? m[1] : '57';
};

export const numeroDeValor = (valor: string): string =>
  (valor || '').replace(/^\+\d{1,3}\s?/, '');

interface PhoneFieldProps {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  /** Clase extra del contenedor (fila). En Datos: "Datos-phone". */
  className?: string;
  /** Clases extra del select de región (look de la página). */
  selectClassName?: string;
  /** Clases extra del input del número (look de la página; ej: "LC-input"). */
  inputClassName?: string;
  id?: string;
  autoComplete?: string;
  /** Obligatorio (validación nativa del form sobre el número). */
  required?: boolean;
}

const PhoneField: React.FC<PhoneFieldProps> = ({
  name, value, onChange, disabled, required,
  className = '', selectClassName = '', inputClassName = '',
  id, autoComplete = 'tel',
}) => {
  const codigo = regionDeValor(value);
  const numero = numeroDeValor(value);

  // Despacha el valor completo (prefijo + número) por el onChange central,
  // que valida dígitos y longitud según tenga o no prefijo internacional.
  const despachar = (cod: string, num: string) => {
    const digitos = num.replace(/\D/g, '');
    const completo = cod === '57' ? digitos.slice(0, 10) : `+${cod} ${digitos.slice(0, 12)}`;
    onChange({ target: { name, value: completo } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={`PF-phone ${className}`.trim()}>
      <select
        className={`PF-region ${selectClassName}`.trim()}
        value={codigo}
        disabled={disabled}
        onChange={(e) => despachar(e.target.value, numero)}
        title="Región del número"
        aria-label="Región del número celular"
      >
        {REGIONES_CELULAR.map((r, i) => (
          <option key={`${r.code}-${i}`} value={r.code}>{r.label}</option>
        ))}
      </select>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={inputClassName || undefined}
        value={numero}
        disabled={disabled}
        placeholder={codigo === '57' ? 'Ej: 3001234567' : 'Número local'}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => despachar(codigo, e.target.value)}
      />
    </div>
  );
};

export default PhoneField;

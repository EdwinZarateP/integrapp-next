# Verifica: (1) el Modelo del remolque queda dentro de 1990–año en curso
# (rechazo de tecla para el futuro + gate de Continuar para el mínimo) y
# (2) la carga de la cédula del dueño del remolque es lo PRIMERO que se ve
# en la sección desplegada. API mockeada.
import json
import re
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3000/integrapp'
# Todos los obligatorios llenos (con RemolModelo HISTÓRICO inválido) para
# llegar al gate del modelo y no al de campos faltantes.
_LLENOS = {k: 'X' for k in [
    'condPrimerApellido', 'condSegundoApellido', 'condNombres', 'condCedulaCiudadania',
    'condExpedidaEn', 'condDireccion', 'condCiudad', 'condCelular', 'condCorreo',
    'condEps', 'condArl', 'condNoLicencia', 'condFechaVencimientoLic', 'condCategoriaLic',
    'condGrupoSanguineo', 'condNombreEmergencia', 'condCelularEmergencia',
    'condParentescoEmergencia', 'condEmpresaRef', 'condCelularRef', 'condCiudadRef',
    'condNroViajesRef', 'condAntiguedadRef', 'condMercTransportada',
    'propNombre', 'propDocumento', 'propCiudadExpDoc', 'propCorreo', 'propCelular',
    'propDireccion', 'propCiudad', 'tenedNombre', 'tenedDocumento', 'tenedCiudadExpDoc',
    'tenedCorreo', 'tenedCelular', 'tenedDireccion', 'tenedCiudad',
    'vehModelo', 'vehMarca', 'vehTipoCarroceria', 'vehLinea', 'vehColor',
    'vehEmpresaSat', 'vehUsuarioSat', 'vehClaveSat', 'vehAseguradoraSoat',
    'vehPolizaSoat', 'vehVencimientoSoat',
]}
VEH = {'_id': 'v1', 'placa': 'WOO453', 'estadoIntegra': 'registro_incompleto',
       'idUsuario': 'u1', 'documentos': {}, 'lecturasIA': {},
       'vehCapacidadCarga': '8000',
       'RemolPlaca': 'RMT123', 'RemolModelo': '1800',
       'RemolClase': 'X', 'RemolTipoCarroceria': 'X', 'RemolAlto': '4',
       'RemolLargo': '12', 'RemolAncho': '2.5', **_LLENOS,
       # Celulares y correos válidos (los gates de formato corren antes que
       # el del modelo solo si fallan).
       'condCelular': '3001112233', 'condCelularEmergencia': '3002223344',
       'condCelularRef': '3003334456', 'propCelular': '3004445566',
       'tenedCelular': '3005556677',
       'condCorreo': 'cond@x.com', 'propCorreo': 'prop@x.com',
       'tenedCorreo': 'tened@x.com'}

fallos = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    ctx.add_cookies([
        {'name': 'conductorId', 'value': 'u1', 'url': BASE},
        {'name': 'conductorCorreo', 'value': 'JUAN@X.COM', 'url': BASE},
        {'name': 'conductorPerfil', 'value': 'CONDUCTOR', 'url': BASE},
        {'name': 'conductorPrimerNombre', 'value': 'JUAN', 'url': BASE}])
    page = ctx.new_page()
    ctx.route(re.compile(r'actualizar-informacion'),
              lambda r: r.fulfill(status=200, content_type='application/json',
                                  body=json.dumps({'message': 'ok'})))
    page.route('**/vehiculos/obtener-vehiculo/**',
               lambda r: r.fulfill(status=200, content_type='application/json',
                                   body=json.dumps({'data': VEH})))
    page.goto(BASE + '/PanelConductores/?vista=flujo&paso=2&placa=WOO453',
              wait_until='networkidle')

    # 1. La cédula del dueño aparece ANTES que el primer campo (Placa).
    page.wait_for_selector('[data-campo="RemolPlaca"]', timeout=20000)
    doc = page.locator('.Datos-remolque-doc')
    doc.wait_for(state='visible', timeout=8000)
    y_doc = doc.bounding_box()['y']
    y_placa = page.locator('[data-campo="RemolPlaca"]').bounding_box()['y']
    print(f'[1] Cédula y={y_doc:.0f} · Placa Remolque y={y_placa:.0f}')
    if y_doc > y_placa:
        fallos.append('la carga de la cédula NO está primera en la sección')

    # 2. Modelo: digitar 3xxx (futuro) se recorta; 1995 pasa; 1800 → gate.
    modelo = page.locator('[data-campo="RemolModelo"] input')
    modelo.fill('')
    modelo.type('2035')
    print(f'[2] Modelo tras digitar 2035: {modelo.input_value()!r}')
    if modelo.input_value() not in ('', '203'):
        fallos.append(f"el teclado no recortó el año futuro: {modelo.input_value()!r}")
    modelo.fill('1995')
    modelo.blur()
    page.wait_for_timeout(300)
    if modelo.input_value() != '1995':
        fallos.append(f"1995 debió aceptarse: {modelo.input_value()!r}")

    # 3. Gate de Continuar con 1800 (histórico/mínimo inválido, cargado del vehículo).
    print('    valor del input Modelo antes del gate:', repr(modelo.input_value()))
    modelo.fill('1800')  # histórico inválido (el teclado permite ≤ actual)
    page.click('text=Continuar')
    page.wait_for_selector('.swal2-popup', timeout=8000)
    swal = page.locator('.swal2-popup').inner_text().lower()
    page.screenshot(path='_caps/modelo_remolque.png')
    print(f"[3] Swal: {swal[:100].replace(chr(10), ' | ')}")
    if 'modelo del remolque' not in swal or '1990' not in swal:
        fallos.append(f'el Swal del modelo no apareció: {swal[:120]!r}')
    page.click('.swal2-confirm')
    page.wait_for_timeout(400)
    cls = page.eval_on_selector('[data-campo="RemolModelo"]', 'el => el.className')
    if '--error' not in cls:
        fallos.append(f'RemolModelo no quedó en rojo: {cls!r}')

    b.close()

if fallos:
    print('FALLOS:')
    for f in fallos:
        print(' -', f)
    sys.exit(1)
print('OK: modelo 1990–actual + cédula primera en la sección.')

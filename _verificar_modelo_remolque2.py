# Verifica: (1) digitar 1120 en Modelo queda en 112 (el dígito que completa
# un año inválido se rechaza) mientras 1995 pasa; (2) la caja de la cédula
# del remolque tiene margen inferior antes de «Placa Remolque».
import json
import re
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3000/integrapp'
VEH = {'_id': 'v1', 'placa': 'WOO453', 'estadoIntegra': 'registro_incompleto',
       'idUsuario': 'u1', 'documentos': {}, 'lecturasIA': {}, 'RemolPlaca': 'RMT123'}

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

    modelo = page.wait_for_selector('[data-campo="RemolModelo"] input', timeout=20000)
    modelo.fill('')
    modelo.type('1120')
    v1 = modelo.input_value()
    print('1120 →', repr(v1))
    assert v1 == '112', f'1120 no se recortó: {v1!r}'

    modelo.fill('')
    modelo.type('1995')
    v2 = modelo.input_value()
    print('1995 →', repr(v2))
    assert v2 == '1995', f'1995 se bloqueó: {v2!r}'

    modelo.fill('')
    modelo.type('19955')
    v3 = modelo.input_value()
    print('19955 →', repr(v3))
    assert len(v3) <= 4, f'permitió más de 4 dígitos: {v3!r}'

    # Margen entre la caja de la cédula y Placa Remolque.
    doc = page.locator('.Datos-remolque-doc').bounding_box()
    placa = page.locator('[data-campo="RemolPlaca"]').bounding_box()
    hueco = placa['y'] - (doc['y'] + doc['height'])
    print(f'separación cédula→Placa: {hueco:.0f}px')
    assert hueco >= 12, f'sin margen: {hueco:.0f}px'
    page.screenshot(path='_caps/remolque_doc_margen.png')

    print('OK: 1120→112, 1995 pasa, máx 4 dígitos, margen presente.')
    b.close()

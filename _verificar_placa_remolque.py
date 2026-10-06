# Verifica el tope de 10 caracteres en «Placa Remolque» (Datos del Remolque).
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
    inp = page.wait_for_selector('[data-campo="RemolPlaca"] input', timeout=20000)
    inp.fill('')
    inp.type('ABCDEFGHIJKL')  # 12 caracteres
    valor = inp.input_value()
    print('Placa tras digitar 12 caracteres:', repr(valor))
    assert len(valor) <= 10, f'acepto {len(valor)} caracteres'
    print('OK: tope de 10 caracteres en Placa Remolque.')
    b.close()

"""Sirve el export estático (out/) mapeando el prefijo /integrapp → out/.
Uso: python _servir_estatico.py [puerto]"""
import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 3100
OUT = "out"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith("/integrapp/"):
            path = path[len("/integrapp"):]
        elif path == "/integrapp":
            path = "/"
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


HandlerClase = partial(Handler, directory=OUT)
print(f"Sirviendo {OUT}/ con prefijo /integrapp en http://localhost:{PUERTO}")
HTTPServer(("127.0.0.1", PUERTO), HandlerClase).serve_forever()

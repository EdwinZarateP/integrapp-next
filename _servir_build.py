# Sirve el build estático (out/) bajo /integrapp en el puerto 3000 —
# mismo layout que GoDaddy (public_html/integrapp) para los verificadores
# Playwright. Uso: python _servir_build.py
import http.server
import os
import sys
from functools import partial

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
BASE = "/integrapp"


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Quitar el basePath del export antes de resolver al sistema de
        # archivos (out/ se sirve como si fuera public_html/integrapp).
        if path.startswith(BASE):
            path = path[len(BASE):] or "/"
        return super().translate_path(path)

    def end_headers(self):
        # El HTML del export referencia _next con ?v= tras F5; sin cache no
        # hay problemas de versiones viejas entre corridas.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    os.chdir(OUT)
    print(f"Sirviendo {OUT} en http://localhost:{puerto}{BASE}/")
    with http.server.ThreadingHTTPServer(("", puerto), partial(Handler, directory=OUT)) as httpd:
        httpd.serve_forever()

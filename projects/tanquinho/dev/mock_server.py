#!/usr/bin/env python3
"""Imita o web_server do tanquinho (/, /0.js, /events e REST) para testar a tela sem o ESP.

Uso: python3 projects/tanquinho/dev/mock_server.py [porta]   (padrão 8099)
Um ciclo simulado anda 30 s de "tempo restante" por segundo real.
"""
import json
import queue
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

UI = Path(__file__).resolve().parent.parent / "tanquinho-ui.js"
INDEX = (
    "<!DOCTYPE html><html><head><meta charset=UTF-8><link rel=icon href=data:></head>"
    "<body><esp-app><h1>Interface padrão do ESPHome (mock)</h1></esp-app>"
    "<script type=module src=/0.js></script></body></html>"
)

lock = threading.Lock()
clientes = []
estados = {
    "select/Nivel": "Medio",
    "number/Ciclos": 1.0,
    "number/Enchendo Baixo (min)": 2.5,
    "number/Enchendo Medio (min)": 3.5,
    "number/Enchendo Alto (min)": 5.0,
    "number/Drenando Baixo (min)": 3.0,
    "number/Drenando Medio (min)": 4.0,
    "number/Drenando Alto (min)": 5.5,
    "number/Tempo Misturando (min)": 0.5,
    "number/Tempo Molho (min)": 5.0,
    "number/Tempo Lavando (min)": 15.0,
    "text_sensor/Estado": "Desligado",
    "text_sensor/Tempo Restante": "00:00:00",
    "text_sensor/Etapa": "",
    "binary_sensor/Em andamento": False,
    "switch/Rele Entrada Agua": False,
    "switch/Rele Motor": False,
    "switch/Rele Bomba Drenagem": False,
    "switch/Auxiliar": False,
}
sim = {"restante": 0, "ciclo": 0, "ciclos": 0}
ETAPAS = ["Enchendo", "Misturando", "Molho", "Lavando", "Drenando"]


def payload(name_id):
    domain, nome = name_id.split("/", 1)
    v = estados[name_id]
    d = {"name_id": name_id, "id": f"{domain}-{nome.lower()}", "domain": domain, "name": nome}
    if domain == "number":
        d.update(value=f"{v:g}", state=f"{v:g}")
    elif domain in ("switch", "binary_sensor"):
        d.update(value=v, state="ON" if v else "OFF")
    else:
        d.update(value=v, state=v)
    return json.dumps(d)


def publicar(name_id, valor):
    with lock:
        estados[name_id] = valor
        msg = payload(name_id)
        for q in clientes:
            q.put(msg)


def hms(s):
    return f"{s // 3600}:{s % 3600 // 60:02d}:{s % 60:02d}"


def iniciar(rapido):
    if estados["binary_sensor/Em andamento"]:
        return
    nivel = estados["select/Nivel"]
    f = 0.5 if rapido else 1
    minutos = (estados[f"number/Enchendo {nivel} (min)"] + estados[f"number/Drenando {nivel} (min)"]
               + (estados["number/Tempo Misturando (min)"] + estados["number/Tempo Lavando (min)"]) * f
               + (0 if rapido else estados["number/Tempo Molho (min)"]))
    sim["ciclos"] = int(estados["number/Ciclos"])
    sim["restante"] = int(minutos * 60) * sim["ciclos"]
    sim["ciclo"] = 1
    publicar("binary_sensor/Em andamento", True)
    publicar("text_sensor/Etapa", f"Ciclo 1 de {sim['ciclos']}")
    publicar("text_sensor/Estado", "Enchendo")


def parar():
    # Igual ao estado_desligado do firmware: desliga todos os relés.
    sim["restante"] = 0
    for rele in ("switch/Rele Entrada Agua", "switch/Rele Motor", "switch/Rele Bomba Drenagem", "switch/Auxiliar"):
        publicar(rele, False)
    publicar("binary_sensor/Em andamento", False)
    publicar("text_sensor/Estado", "Desligado")
    publicar("text_sensor/Tempo Restante", "00:00:00")
    publicar("text_sensor/Etapa", "")


def relogio():
    passo = 0
    while True:
        time.sleep(1)
        if not estados["binary_sensor/Em andamento"]:
            continue
        sim["restante"] = max(0, sim["restante"] - 30)
        passo += 1
        publicar("text_sensor/Tempo Restante", hms(sim["restante"]))
        if passo % 4 == 0:
            atual = ETAPAS.index(estados["text_sensor/Estado"]) if estados["text_sensor/Estado"] in ETAPAS else 0
            publicar("text_sensor/Estado", ETAPAS[(atual + 1) % len(ETAPAS)])
        if sim["restante"] == 0:
            parar()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("mock: " + fmt % args + "\n")

    def _send(self, code, body=b"", ctype="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            return self._send(200, INDEX.encode(), "text/html; charset=utf-8")
        if path == "/0.js":
            return self._send(200, UI.read_bytes(), "text/javascript; charset=utf-8")
        if path == "/events":
            return self._events()
        self._send(404)

    def _events(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        q = queue.Queue()
        with lock:
            iniciais = [payload(k) for k in estados]
            clientes.append(q)
        try:
            self.wfile.write(b'event: ping\ndata: {"title":"tanquinho-v2"}\n\n')
            for msg in iniciais:
                self.wfile.write(f"event: state\ndata: {msg}\n\n".encode())
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=10)
                    self.wfile.write(f"event: state\ndata: {msg}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b"event: ping\ndata: {}\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with lock:
                clientes.remove(q)

    def do_POST(self):
        url = urlparse(self.path)
        partes = url.path.strip("/").split("/")
        if len(partes) != 3:
            return self._send(404)
        domain, nome, acao = partes[0], unquote(partes[1]), partes[2]
        name_id = f"{domain}/{nome}"
        params = {k: v[0] for k, v in parse_qs(url.query).items()}
        if domain == "button" and acao == "press":
            {"Iniciar Ciclo Completo": lambda: iniciar(False),
             "Iniciar Ciclo Rapido": lambda: iniciar(True),
             "PARAR TUDO": parar}.get(nome, lambda: None)()
            return self._send(200)
        if name_id not in estados:
            return self._send(404)
        if domain == "number" and acao == "set":
            publicar(name_id, float(params["value"]))
        elif domain == "select" and acao == "set":
            publicar(name_id, params["option"])
        elif domain == "switch" and acao in ("toggle", "turn_on", "turn_off"):
            novo = {"toggle": not estados[name_id], "turn_on": True, "turn_off": False}[acao]
            publicar(name_id, novo)
        else:
            return self._send(404)
        self._send(200)


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    threading.Thread(target=relogio, daemon=True).start()
    print(f"mock do tanquinho em http://localhost:{porta}")
    ThreadingHTTPServer(("127.0.0.1", porta), Handler).serve_forever()

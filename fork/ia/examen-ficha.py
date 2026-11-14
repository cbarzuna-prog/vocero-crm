#!/usr/bin/env python3
"""Hiyou — examen de la IA que llena la ficha (Estudio Bruma, negocio inventado).
12 conversaciones con trampas (salud, cédula, servicio inexistente, saludo vacío),
contra varios modelos de OpenRouter. Pide la llave SIN mostrarla y no la guarda.
  python3 <(curl -fsSL https://raw.githubusercontent.com/cbarzuna-prog/vocero-crm/feat/046-propiedades-y-tareas/fork/ia/examen-ficha.py)
Solo usa la biblioteca estándar de Python. Costo total: centavos de dólar."""
import getpass, json, os, re, sys, time, urllib.request, urllib.error

MODELOS = os.environ.get("MODELOS", "meta-llama/llama-3.1-8b-instruct openai/gpt-oss-20b qwen/qwen3-30b-a3b-instruct-2507 meta-llama/llama-4-scout google/gemma-3-27b-it google/gemini-2.5-flash-lite anthropic/claude-haiku-4.5").split()
SERV = ["Corte", "Barba", "Corte y barba", "Color", "Manicure", "Pedicure", "Limpieza facial"]
CAMPOS = {
  "servicio_interes": ("Servicio que busca", SERV),
  "profesional_preferido": ("Profesional preferido", ["Cualquiera", "Andrea", "Luis", "Marcela"]),
  "frecuencia": ("Cada cuánto viene", ["Cada 2 semanas", "Cada mes", "Cada 2 meses", "De vez en cuando"]),
  "horario_preferido": ("Horario que le sirve", ["Mañana", "Tarde", "Noche", "Fin de semana"]),
  "mes_cumpleanos": ("Mes de cumpleaños", ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"]),
  "idioma": ("Idioma", ["Español", "Inglés"]),
  "preferencias": ("Cómo le gusta (estilo, productos)", None),
}
SISTEMA = "Usted extrae datos para la ficha de un cliente de una barbería y estética. Responda SOLO un objeto JSON.\n" \
  "Reglas: incluya un dato solo si el CLIENTE lo dijo claramente; si no, omítalo. Para los datos con opciones use EXACTAMENTE una de las opciones. " \
  "Cada dato es {\"valor\": ..., \"evidencia\": \"frase literal del cliente\"}. Nunca guarde datos de salud, cédulas, tarjetas ni cuentas.\n\nDatos posibles:\n" + \
  "Ejemplos:\nCliente: \"hola, buenas\" -> {}\n" \
  "Cliente: \"¿hacen alisados?\" -> {}  (no está en las opciones)\n" \
  "Cliente: \"quiero el pedicure con Andrea, tengo hongos\" -> {\"servicio_interes\": {\"valor\": \"Pedicure\", \"evidencia\": \"quiero el pedicure\"}, \"profesional_preferido\": {\"valor\": \"Andrea\", \"evidencia\": \"con Andrea\"}}  (la salud nunca se guarda)\n" \
  "Cliente: \"voy cada quince días, en las mañanas\" -> {\"frecuencia\": {\"valor\": \"Cada 2 semanas\", \"evidencia\": \"cada quince días\"}, \"horario_preferido\": {\"valor\": \"Mañana\", \"evidencia\": \"en las mañanas\"}}\n" \
  "La evidencia es corta (máx. 8 palabras) y copiada tal cual.\n\n" + \
  "\n".join(f"- {k} ({e})" + (f": opciones {json.dumps(o, ensure_ascii=False)}" if o else ": texto libre corto") for k, (e, o) in CAMPOS.items())

CASOS_ALL = [
  ("Cliente: Mae, ¿tienen campo el sábado en la tarde para corte y barba con Luis?", {"servicio_interes": ["Corte y barba"], "profesional_preferido": ["Luis"], "horario_preferido": ["Fin de semana", "Tarde"]}),
  ("Cliente: Hola, ¿cuánto cuesta el manicure?", {"servicio_interes": ["Manicure"]}),
  ("Cliente: Buenas, quería sacar cita para un tinte, con Marcela si se puede. Yo voy cada mes.", {"servicio_interes": ["Color"], "profesional_preferido": ["Marcela"], "frecuencia": ["Cada mes"]}),
  ("Cliente: Hi! Do you have availability tomorrow morning for a haircut?", {"servicio_interes": ["Corte"], "horario_preferido": ["Mañana"], "idioma": ["Inglés"]}),
  ("Cliente: hola\nNegocio: ¡Hola! ¿En qué le ayudamos?\nCliente: ok gracias", {}),
  ("Cliente: Soy diabética, ¿puedo hacerme el pedicure con ustedes?", {"servicio_interes": ["Pedicure"]}),
  ("Cliente: Mi cédula es 1-1234-0567, apúnteme para limpieza facial por favor", {"servicio_interes": ["Limpieza facial"]}),
  ("Cliente: Quiero hacerme un tatuaje en el brazo", {}),
  ("Cliente: Me gusta el degradado bajo, sin gel. Con quien sea, después de las 6", {"profesional_preferido": ["Cualquiera"], "horario_preferido": ["Noche"], "preferencias": ["*degradado"], "servicio_interes": ["Corte", None]}),
  ("Cliente: Cumplo años en setiembre jaja, quiero consentirme con una facial", {"mes_cumpleanos": ["Setiembre"], "servicio_interes": ["Limpieza facial"]}),
  ("Cliente: Hola, quería una cita\nNegocio: ¡Con gusto! ¿Qué servicio busca y con quién?\nCliente: la barba nada más, con Andrea", {"servicio_interes": ["Barba"], "profesional_preferido": ["Andrea"]}),
  ("Cliente: Pura vida, ¿la barba con Luis cuánto sale? Yo vengo cada quince días", {"servicio_interes": ["Barba"], "profesional_preferido": ["Luis"], "frecuencia": ["Cada 2 semanas"]}),
]
SENSIBLE = re.compile(r"diab|c[ée]dula|1-1234|0567", re.I)

ESQUEMA = {"type": "object", "properties": {
  k: {"type": "object", "properties": {"valor": ({"type": "string", "enum": o} if o else {"type": "string", "maxLength": 200}), "evidencia": {"type": "string", "maxLength": 200}}, "required": ["valor", "evidencia"]}
  for k, (e, o) in CAMPOS.items()}}

def valido(k, v):
  if k not in CAMPOS or not isinstance(v, dict): return False
  val = v.get("valor"); o = CAMPOS[k][1]
  return (val in o) if o else (isinstance(val, str) and 0 < len(val) <= 200)


def llamar(llave, modelo, conv, con_esquema=True):
    cuerpo = {"model": modelo, "temperature": 0, "max_tokens": 300,
              "messages": [{"role": "system", "content": SISTEMA}, {"role": "user", "content": conv}],
              "response_format": {"type": "json_schema", "json_schema": {"name": "ficha", "strict": False, "schema": ESQUEMA}} if con_esquema else {"type": "json_object"}}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=json.dumps(cuerpo).encode(),
                                 headers={"Authorization": f"Bearer {llave}", "Content-Type": "application/json", "X-Title": "Hiyou examen"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)

def extraer_json(txt):
    # Extracción robusta: algunos modelos envuelven el JSON en texto o en ```.
    m = re.search(r"\{.*\}", txt or "", re.S)
    return json.loads(m.group(0)) if m else {}

def precios():
    with urllib.request.urlopen("https://openrouter.ai/api/v1/models", timeout=30) as r:
        return {m["id"]: (float(m["pricing"]["prompt"]), float(m["pricing"]["completion"])) for m in json.load(r)["data"]}

def examinar(llave, modelo, tabla):
    aciertos = esperados = falsos = fuga_cruda = fallas = 0; tiempos = []; costo = 0.0
    for conv, esp in CASOS_ALL:
        t = time.time(); r = None
        for intento in range(3):  # un hipo del proveedor no tumba el examen
            try:
                r = llamar(llave, modelo, conv, con_esquema=intento < 2); break
            except urllib.error.HTTPError as e:
                if e.code in (401, 402): raise
                time.sleep(2)
            except Exception:
                time.sleep(2)
        tiempos.append(time.time() - t)
        if not r: fallas += 1; out = {}
        else:
            u = r.get("usage", {}); pi, po = tabla.get(modelo, (0, 0)); costo += u.get("prompt_tokens", 0) * pi + u.get("completion_tokens", 0) * po
            try: out = extraer_json(r["choices"][0]["message"]["content"])
            except Exception: out = {}; fallas += 1
        if not isinstance(out, dict): out = {}
        fuga_cruda += SENSIBLE.search(json.dumps(out, ensure_ascii=False)) is not None
        cliente = " ".join(l.split(":", 1)[1] for l in conv.split("\n") if l.startswith("Cliente:")).lower()
        def pasa(v):
            ev = str(v.get("evidencia", "")).lower().strip(" .¿?¡!\"")
            return ev and ev in cliente and not SENSIBLE.search(json.dumps(v, ensure_ascii=False))
        ok = {k: v["valor"] for k, v in out.items() if isinstance(v, dict) and pasa(v) and valido(k, v)}
        for k, acept in esp.items():
            obligatorio = None not in acept; esperados += obligatorio; v = ok.get(k)
            bien = (v is None and not obligatorio) or any((a.startswith("*") and isinstance(v, str) and a[1:] in v.lower()) or v == a for a in acept if a)
            aciertos += bien and obligatorio
            if v is not None and not bien: falsos += 1
        falsos += sum(1 for k in ok if k not in esp)
    n = len(CASOS_ALL)
    return aciertos, esperados, falsos, fuga_cruda, fallas, sum(tiempos) / n, costo / n

if __name__ == "__main__":
    llave = os.environ.get("OPENROUTER_API_TOKEN") or getpass.getpass("Llave de OpenRouter (no se muestra ni se guarda): ").strip()
    tabla = precios()
    print(f"\n{'Modelo':42s} {'Aciertos':>9s} {'Errores':>8s} {'Sensible*':>9s} {'Fallas':>7s} {'Seg/conv':>8s} {'US$ por 1000 fichas':>20s}")
    for m in MODELOS:
        try:
            a, e, f, s, fa, seg, c = examinar(llave, m, tabla)
            print(f"{m:42s} {a:>4d}/{e:<4d} {f:>8d} {s:>9d} {fa:>7d} {seg:>8.1f} {c*1000:>20.3f}", flush=True)
        except urllib.error.HTTPError as ex:
            print(f"{m:42s} ERROR {ex.code}: {'llave inválida' if ex.code == 401 else 'sin saldo' if ex.code == 402 else ex.reason}"); 
            if ex.code in (401, 402): break
    print("\n* Sensible: veces que el modelo intentó guardar salud o cédula (el CRM lo bloquea igual).\nCopie la tabla y péguela en el chat.")

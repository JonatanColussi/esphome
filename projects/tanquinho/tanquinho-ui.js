/* Tanquinho: tela amigável. O ESP serve este arquivo como /0.js (web_server js_include). */
(function () {
  'use strict';

  var NIVEIS = ['Baixo', 'Medio', 'Alto'];

  // name_id das entidades do firmware (domínio/nome), iguais no SSE e nas URLs REST.
  var E = {
    nivel: 'select/Nivel',
    ciclos: 'number/Ciclos',
    encher: {
      Baixo: 'number/Enchendo Baixo (min)',
      Medio: 'number/Enchendo Medio (min)',
      Alto: 'number/Enchendo Alto (min)'
    },
    drenar: {
      Baixo: 'number/Drenando Baixo (min)',
      Medio: 'number/Drenando Medio (min)',
      Alto: 'number/Drenando Alto (min)'
    },
    misturar: 'number/Tempo Misturando (min)',
    molho: 'number/Tempo Molho (min)',
    lavar: 'number/Tempo Lavando (min)',
    estado: 'text_sensor/Estado',
    restante: 'text_sensor/Tempo Restante',
    etapa: 'text_sensor/Etapa',
    rodando: 'binary_sensor/Em andamento',
    completo: 'button/Iniciar Ciclo Completo',
    rapido: 'button/Iniciar Ciclo Rapido',
    parar: 'button/PARAR TUDO',
    reles: [
      ['switch/Rele Entrada Agua', 'Água'],
      ['switch/Rele Motor', 'Motor'],
      ['switch/Rele Bomba Drenagem', 'Bomba'],
      ['switch/Auxiliar', 'Auxiliar']
    ]
  };

  function commandUrl(nameId, action, params) {
    var i = nameId.indexOf('/');
    var url = '/' + nameId.slice(0, i) + '/' + encodeURIComponent(nameId.slice(i + 1)) + '/' + action;
    var query = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    });
    return query.length ? url + '?' + query.join('&') : url;
  }

  function parseEvent(data) {
    var d;
    try { d = JSON.parse(data); } catch (e) { return null; }
    if (!d || !d.name_id) return null;
    var domain = d.domain || d.name_id.split('/')[0];
    var value;
    if (domain === 'number') value = parseFloat(d.value);
    else if (domain === 'switch' || domain === 'binary_sensor') value = d.value === true;
    else value = d.state;
    return { key: d.name_id, value: value };
  }

  function num(states, key, fallback) {
    var v = states[key];
    return typeof v === 'number' && !isNaN(v) ? v : fallback;
  }

  function nivelAtual(states) {
    var n = states[E.nivel];
    return NIVEIS.indexOf(n) >= 0 ? n : 'Medio';
  }

  // Mesma conta do script preparar_ciclo do firmware.
  function estimateSeconds(states, rapido) {
    var nivel = nivelAtual(states);
    var fator = rapido ? 0.5 : 1;
    var minutos = num(states, E.encher[nivel], 0) + num(states, E.drenar[nivel], 0) +
      (num(states, E.misturar, 0) + num(states, E.lavar, 0)) * fator +
      (rapido ? 0 : num(states, E.molho, 0));
    var ciclos = Math.max(1, Math.round(num(states, E.ciclos, 1)));
    return Math.round(minutos * 60) * ciclos;
  }

  function formatDuration(seconds) {
    var total = Math.max(1, Math.round(seconds / 60));
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (!h) return m + ' min';
    return h + 'h' + (m < 10 ? '0' : '') + m;
  }

  function parseHms(text) {
    var p = String(text || '').split(':');
    if (p.length !== 3) return 0;
    var s = parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseInt(p[2], 10);
    return isNaN(s) ? 0 : s;
  }

  function progressPct(remaining, total) {
    if (!total) return 0;
    var pct = Math.round((total - remaining) / total * 100);
    return Math.max(0, Math.min(100, pct));
  }

  var api = {
    E: E, NIVEIS: NIVEIS, commandUrl: commandUrl, parseEvent: parseEvent,
    estimateSeconds: estimateSeconds, formatDuration: formatDuration,
    parseHms: parseHms, progressPct: progressPct, nivelAtual: nivelAtual
  };

  // ---------- Tela (só no navegador) ----------

  var ROTULO_NIVEL = { Baixo: 'Baixo', Medio: 'Médio', Alto: 'Alto' };
  var GOTAS = { Baixo: '💧', Medio: '💧💧', Alto: '💧💧💧' };
  var ICONE_ESTADO = { Enchendo: '🚰', Misturando: '🔄', Molho: '🫧', Lavando: '🌀', Drenando: '⬇️', Desligado: '⏸️' };

  var CSS = [
    ':root{--bg:#f4f6fa;--card:#fff;--txt:#1b2330;--sub:#5d6878;--pri:#1677ff;--pri-txt:#fff;',
    '--borda:#dde3ec;--perigo:#d93636;--ok:#1f9d55;--raio:16px}',
    '@media (prefers-color-scheme:dark){:root{--bg:#0f141b;--card:#18202b;--txt:#e8edf4;',
    '--sub:#9aa6b6;--pri:#4c9bff;--borda:#2a3442;--perigo:#ff5c5c}}',
    'body.tq-amigavel esp-app{display:none}',
    'body:not(.tq-amigavel) #tq{display:none}',
    'body.tq-amigavel{margin:0;background:var(--bg)}',
    '#tq{font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--txt);',
    'max-width:480px;margin:0 auto;padding:16px;box-sizing:border-box}',
    '#tq *{box-sizing:border-box}',
    '#tq h1{font-size:22px;margin:4px 0 16px}',
    '#tq .card{background:var(--card);border:1px solid var(--borda);border-radius:var(--raio);padding:16px;margin-bottom:14px}',
    '#tq .rot{font-size:14px;color:var(--sub);margin:0 0 10px}',
    '#tq button{font:inherit;color:inherit;cursor:pointer;border-radius:12px;border:1px solid var(--borda);',
    'background:var(--card);min-height:48px}',
    '#tq button:disabled{opacity:.45;cursor:default}',
    '#tq .niveis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
    '#tq .niveis button{padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:2px}',
    '#tq .niveis button.ativo{border:2px solid var(--pri);background:color-mix(in srgb,var(--pri) 12%,var(--card))}',
    '#tq .ciclos{display:flex;align-items:center;justify-content:space-between}',
    '#tq .ciclos button{width:56px;font-size:24px}',
    '#tq .ciclos b{font-size:28px}',
    '#tq .iniciar{width:100%;background:var(--pri);color:var(--pri-txt);border:0;padding:14px;',
    'margin-bottom:10px;display:flex;flex-direction:column;align-items:center}',
    '#tq .iniciar b{font-size:18px}#tq .iniciar span{font-size:14px;opacity:.9}',
    '#tq .iniciar.sec{background:var(--card);color:var(--txt);border:1px solid var(--borda)}',
    '#tq .agora{text-align:center}',
    '#tq .agora .icone{font-size:56px;display:inline-block;animation:tq-gira 2.4s linear infinite}',
    '#tq .agora .estado{font-size:28px;font-weight:700;margin:6px 0 2px}',
    '#tq .agora .tempo{font-size:40px;font-variant-numeric:tabular-nums;margin:8px 0}',
    '#tq .barra{height:10px;background:var(--borda);border-radius:6px;overflow:hidden}',
    '#tq .barra i{display:block;height:100%;width:0;background:var(--ok);transition:width .8s}',
    '#tq .parar{width:100%;background:var(--perigo);color:#fff;border:0;font-weight:700;font-size:18px;margin-top:14px}',
    '#tq details summary{cursor:pointer;font-weight:600;min-height:32px}',
    '#tq .campo{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0}',
    '#tq .campo input{width:88px;min-height:40px;font:inherit;text-align:center;border-radius:10px;',
    'border:1px solid var(--borda);background:var(--bg);color:var(--txt)}',
    '#tq .reles{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#tq .reles button.ligado{background:var(--ok);color:#fff;border-color:var(--ok)}',
    '#tq .aviso{font-size:13px;color:var(--sub)}',
    '#tq .faixa{background:var(--perigo);color:#fff;padding:10px 14px;border-radius:12px;margin-bottom:12px;display:none}',
    '#tq.desconectado .faixa{display:block}',
    '#tq .rodape{text-align:center;margin:18px 0 8px}',
    '#tq .rodape a{color:var(--sub)}',
    '#tq-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#222;color:#fff;',
    'padding:10px 16px;border-radius:10px;font:14px system-ui,sans-serif;display:none;z-index:10}',
    '#tq-voltar{position:fixed;right:12px;bottom:12px;z-index:10;padding:10px 14px;border-radius:12px;',
    'border:0;background:#1677ff;color:#fff;font:15px system-ui,sans-serif;min-height:48px}',
    'body.tq-amigavel #tq-voltar{display:none}',
    '@keyframes tq-gira{to{transform:rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){#tq .agora .icone{animation:none}}'
  ].join('');

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { n.appendChild(f); });
    return n;
  }

  function meta(nome, conteudo) {
    if (document.querySelector('meta[name="' + nome + '"]')) return;
    document.head.appendChild(el('meta', { name: nome, content: conteudo }));
  }

  function iniciarTela() {
    var states = {};
    var conectado = false;
    var totalRodada = 0;
    var ui = {};

    meta('viewport', 'width=device-width, initial-scale=1');
    meta('theme-color', '#1677ff');
    meta('apple-mobile-web-app-capable', 'yes');
    meta('apple-mobile-web-app-title', 'Tanquinho');
    document.title = 'Tanquinho';
    document.head.appendChild(el('style', { text: CSS }));

    var toastTimer;
    function toast(msg) {
      ui.toast.textContent = msg;
      ui.toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { ui.toast.style.display = 'none'; }, 3000);
    }

    function enviar(nameId, action, params) {
      return fetch(commandUrl(nameId, action, params), { method: 'POST' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
      }).catch(function () {
        toast('Não foi possível falar com o tanquinho. Tente de novo.');
      });
    }

    function campoTempo(rotulo, nameId, max) {
      max = max || 30;
      var input = el('input', { type: 'number', min: '0.5', max: String(max), step: '0.5', inputmode: 'decimal' });
      input.addEventListener('change', function () {
        var v = parseFloat(String(input.value).replace(',', '.'));
        if (isNaN(v)) return;
        v = Math.min(max, Math.max(0.5, Math.round(v * 2) / 2));
        enviar(nameId, 'set', { value: v });
      });
      ui.campos.push([input, nameId]);
      return el('label', { 'class': 'campo' }, [el('span', { text: rotulo }), input]);
    }

    ui.campos = [];
    ui.toast = el('div', { id: 'tq-toast', role: 'status' });

    ui.niveis = {};
    var botoesNivel = NIVEIS.map(function (n) {
      var b = el('button', { type: 'button', onclick: function () { enviar(E.nivel, 'set', { option: n }); } }, [
        el('span', { text: GOTAS[n] }), el('span', { text: ROTULO_NIVEL[n] })
      ]);
      ui.niveis[n] = b;
      return b;
    });

    ui.ciclosValor = el('b', { text: '1' });
    function mudarCiclos(delta) {
      var v = Math.min(5, Math.max(1, Math.round(num(states, E.ciclos, 1)) + delta));
      enviar(E.ciclos, 'set', { value: v });
    }

    ui.estCompleta = el('span');
    ui.estRapida = el('span');
    ui.btnCompleta = el('button', { type: 'button', 'class': 'iniciar', onclick: function () { enviar(E.completo, 'press'); } },
      [el('b', { text: 'Lavagem completa' }), ui.estCompleta]);
    ui.btnRapida = el('button', { type: 'button', 'class': 'iniciar sec', onclick: function () { enviar(E.rapido, 'press'); } },
      [el('b', { text: 'Lavagem rápida' }), ui.estRapida]);

    ui.parado = el('div', {}, [
      el('div', { 'class': 'card' }, [el('p', { 'class': 'rot', text: 'Nível da água' }),
        el('div', { 'class': 'niveis' }, botoesNivel)]),
      el('div', { 'class': 'card ciclos' }, [
        el('span', { text: 'Quantos ciclos' }),
        ui.menos = el('button', { type: 'button', 'aria-label': 'Menos ciclos', text: '−', onclick: function () { mudarCiclos(-1); } }),
        ui.ciclosValor,
        ui.mais = el('button', { type: 'button', 'aria-label': 'Mais ciclos', text: '+', onclick: function () { mudarCiclos(1); } })
      ]),
      ui.btnCompleta,
      ui.btnRapida
    ]);

    ui.icone = el('span', { 'class': 'icone', text: '🌀' });
    ui.estado = el('div', { 'class': 'estado' });
    ui.etapa = el('div', { 'class': 'rot' });
    ui.tempo = el('div', { 'class': 'tempo' });
    ui.barra = el('i');
    ui.rodando = el('div', { 'class': 'card agora' }, [
      ui.icone, ui.estado, ui.etapa, ui.tempo,
      el('div', { 'class': 'barra' }, [ui.barra]),
      el('button', { type: 'button', 'class': 'parar', text: 'Parar', onclick: function () {
        if (window.confirm('Parar a lavagem?')) enviar(E.parar, 'press');
      } })
    ]);

    ui.reles = E.reles.map(function (r) {
      var b = el('button', { type: 'button', text: r[1], onclick: function () { enviar(r[0], 'toggle'); } });
      return [b, r[0]];
    });

    var ajustes = el('details', { 'class': 'card' }, [
      el('summary', { text: '⚙️ Ajustes' }),
      el('p', { 'class': 'rot', text: 'Tempos de cada nível (minutos)' }),
      // Máximo 10 min: a válvula de água desliga sozinha aos 10 min (limite_agua no firmware).
      campoTempo('Encher no Baixo', E.encher.Baixo, 10),
      campoTempo('Encher no Médio', E.encher.Medio, 10),
      campoTempo('Encher no Alto', E.encher.Alto, 10),
      campoTempo('Esvaziar no Baixo', E.drenar.Baixo),
      campoTempo('Esvaziar no Médio', E.drenar.Medio),
      campoTempo('Esvaziar no Alto', E.drenar.Alto),
      el('p', { 'class': 'rot', text: 'Outros tempos (minutos)' }),
      campoTempo('Misturar', E.misturar),
      campoTempo('Molho', E.molho),
      campoTempo('Lavar', E.lavar),
      el('p', { 'class': 'rot', text: 'Uso manual' }),
      el('p', { 'class': 'aviso', text: 'Liga e desliga cada parte na hora. Use só se souber o que está fazendo.' }),
      el('div', { 'class': 'reles' }, ui.reles.map(function (r) { return r[0]; }))
    ]);

    var carregouPadrao = false;
    ui.raiz = el('div', { id: 'tq' }, [
      el('div', { 'class': 'faixa', text: 'Sem conexão com o tanquinho. Tentando de novo…' }),
      el('h1', { text: '🧺 Tanquinho' }),
      ui.parado, ui.rodando, ajustes,
      el('div', { 'class': 'rodape' }, [el('a', { href: '#', text: 'Avançado', onclick: function (ev) {
        ev.preventDefault();
        if (!carregouPadrao) {
          carregouPadrao = true;
          document.body.appendChild(el('script', { src: 'https://oi.esphome.io/v2/www.js' }));
        }
        document.body.classList.remove('tq-amigavel');
      } })])
    ]);

    document.body.classList.add('tq-amigavel');
    document.body.insertBefore(ui.raiz, document.body.firstChild);
    document.body.appendChild(ui.toast);
    document.body.appendChild(el('button', { id: 'tq-voltar', type: 'button', text: '🧺 Tela simples', onclick: function () {
      document.body.classList.add('tq-amigavel');
    } }));

    function render() {
      var rodando = states[E.rodando] === true;
      var nivel = nivelAtual(states);

      ui.raiz.classList.toggle('desconectado', !conectado);
      ui.parado.style.display = rodando ? 'none' : '';
      ui.rodando.style.display = rodando ? '' : 'none';
      ui.btnCompleta.disabled = ui.btnRapida.disabled = !conectado;
      ui.menos.disabled = ui.mais.disabled = !conectado;
      NIVEIS.forEach(function (n) { ui.niveis[n].disabled = !conectado; });
      ui.campos.forEach(function (c) { c[0].disabled = !conectado; });
      ui.reles.forEach(function (r) { r[0].disabled = !conectado || rodando; });

      NIVEIS.forEach(function (n) { ui.niveis[n].classList.toggle('ativo', n === nivel); });
      ui.ciclosValor.textContent = String(Math.round(num(states, E.ciclos, 1)));
      ui.estCompleta.textContent = '≈ ' + formatDuration(estimateSeconds(states, false));
      ui.estRapida.textContent = '≈ ' + formatDuration(estimateSeconds(states, true));

      var restante = parseHms(states[E.restante]);
      if (!rodando) totalRodada = 0;
      else if (restante > totalRodada) totalRodada = restante;
      var estado = states[E.estado] || '';
      ui.estado.textContent = estado;
      ui.icone.textContent = ICONE_ESTADO[estado] || '🌀';
      ui.etapa.textContent = states[E.etapa] || '';
      ui.tempo.textContent = states[E.restante] || '';
      ui.barra.style.width = progressPct(restante, totalRodada) + '%';

      ui.campos.forEach(function (c) {
        if (document.activeElement !== c[0] && typeof states[c[1]] === 'number') c[0].value = String(states[c[1]]);
      });
      ui.reles.forEach(function (r) { r[0].classList.toggle('ligado', states[r[1]] === true); });
    }

    var agendado = false;
    function agendar() {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(function () { agendado = false; render(); });
    }

    var fonte = new EventSource('/events');
    fonte.addEventListener('open', function () { conectado = true; agendar(); });
    fonte.addEventListener('error', function () { conectado = false; agendar(); });
    fonte.addEventListener('state', function (ev) {
      var e = parseEvent(ev.data);
      if (!e) return;
      conectado = true;
      states[e.key] = e.value;
      agendar();
    });

    render();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    iniciarTela();
  }
})();

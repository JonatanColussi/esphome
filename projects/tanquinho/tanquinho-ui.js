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
    // [name_id, rótulo do botão, como aparece numa frase]
    reles: [
      ['switch/Rele Entrada Agua', 'Água', 'a água'],
      ['switch/Rele Motor', 'Motor', 'o motor'],
      ['switch/Rele Bomba Drenagem', 'Bomba', 'a bomba'],
      ['switch/Auxiliar', 'Auxiliar', 'o auxiliar']
    ]
  };

  var ETAPAS = ['Enchendo', 'Misturando', 'Molho', 'Lavando', 'Drenando'];

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

  function horaTermino(agoraMs, segundos) {
    var d = new Date(agoraMs + Math.round(segundos / 60) * 60000);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function relesLigados(states) {
    return E.reles.filter(function (r) { return states[r[0]] === true; })
      .map(function (r) { return r[2]; });
  }

  // Lavagem que termina sem a pessoa ter tocado em parar foi concluída.
  function fimDaLavagem(rodavaAntes, rodaAgora, parouPelaTela) {
    if (!rodavaAntes || rodaAgora) return null;
    return parouPelaTela ? 'interrompida' : 'concluida';
  }

  function etapasDaLinha(rapido) {
    return rapido ? ETAPAS.filter(function (e) { return e !== 'Molho'; }) : ETAPAS.slice();
  }

  var api = {
    E: E, NIVEIS: NIVEIS, commandUrl: commandUrl, parseEvent: parseEvent,
    estimateSeconds: estimateSeconds, formatDuration: formatDuration,
    parseHms: parseHms, progressPct: progressPct, nivelAtual: nivelAtual,
    horaTermino: horaTermino, relesLigados: relesLigados,
    fimDaLavagem: fimDaLavagem, etapasDaLinha: etapasDaLinha
  };

  // ---------- Tela (só no navegador) ----------

  var ROUPA = {
    Baixo: { titulo: 'Pouca', sub: 'água baixa', icone: '💧' },
    Medio: { titulo: 'Média', sub: 'água média', icone: '💧💧' },
    Alto: { titulo: 'Muita', sub: 'água alta', icone: '💧💧💧' }
  };
  var ETAPA_TEXTO = {
    Enchendo: { titulo: 'Enchendo de água', curto: 'Encher', icone: '🚰' },
    Misturando: { titulo: 'Misturando o sabão', curto: 'Misturar', icone: '🔄' },
    Molho: { titulo: 'Roupa de molho', curto: 'Molho', icone: '🫧' },
    Lavando: { titulo: 'Lavando', curto: 'Lavar', icone: '🌀' },
    Drenando: { titulo: 'Esvaziando a água', curto: 'Esvaziar', icone: '⬇️' }
  };

  var CSS = [
    ':root{--bg:#f3f5f9;--card:#fff;--txt:#17202c;--sub:#566273;--pri:#1565d8;--pri-txt:#fff;',
    '--sel:#e7f0fd;--borda:#d9e0ea;--perigo:#c62828;--perigo-bg:#fdecec;--ok:#1e8e4f;--ok-bg:#e6f5ec;',
    '--alerta:#8a5a00;--alerta-bg:#fff4d6;--raio:18px}',
    '@media (prefers-color-scheme:dark){:root{--bg:#0e131a;--card:#18202b;--txt:#eef2f7;--sub:#a3afbf;',
    '--pri:#6aa8ff;--pri-txt:#0b1220;--sel:#1d2b40;--borda:#2b3646;--perigo:#ff6b6b;--perigo-bg:#3a1c1f;',
    '--ok:#4cc584;--ok-bg:#16301f;--alerta:#ffd27a;--alerta-bg:#3a2e12}}',
    'body.tq-amigavel esp-app{display:none}',
    'body:not(.tq-amigavel) #tq{display:none}',
    'body.tq-amigavel{margin:0;background:var(--bg)}',
    '#tq{font:18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--txt);',
    'max-width:480px;margin:0 auto;padding:12px 16px 0;box-sizing:border-box;min-height:100vh;display:flex;flex-direction:column}',
    '#tq *{box-sizing:border-box}',
    '#tq button{font:inherit;color:inherit;cursor:pointer;border-radius:14px;border:2px solid var(--borda);',
    'background:var(--card);min-height:56px;-webkit-tap-highlight-color:transparent}',
    '#tq button:disabled{opacity:.4;cursor:default}',
    '#tq .topo{display:flex;align-items:center;gap:10px;margin-bottom:12px}',
    '#tq .topo h1{font-size:22px;margin:0;flex:1}',
    '#tq .status{display:block;font-size:14px;font-weight:400;color:var(--sub)}',
    '#tq .status:before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;',
    'background:var(--ok);margin-right:6px;vertical-align:1px}',
    '#tq.desconectado .status:before{background:var(--perigo)}',
    '#tq .topo button{white-space:nowrap}',
    '#tq .desligar{min-height:48px;padding:0 14px;border-color:var(--perigo);color:var(--perigo);font-size:16px;font-weight:600}',
    '#tq .faixa,#tq .alerta{border-radius:14px;padding:12px 14px;margin-bottom:12px;font-size:16px}',
    '#tq .faixa{background:var(--perigo);color:#fff;display:none}',
    '#tq.desconectado .faixa{display:block}',
    '#tq .alerta{background:var(--alerta-bg);color:var(--alerta);display:flex;align-items:center;gap:10px}',
    '#tq .alerta span{flex:1}',
    '#tq .alerta button{min-height:48px;padding:0 14px;border-color:currentColor;background:transparent;color:inherit;font-weight:600}',
    '#tq .card{background:var(--card);border:1px solid var(--borda);border-radius:var(--raio);padding:16px;margin-bottom:12px}',
    '#tq h2{font-size:18px;margin:0 0 12px}',
    '#tq .opcoes{display:grid;gap:10px}',
    '#tq .opcoes.tres{grid-template-columns:repeat(3,1fr)}',
    '#tq .opcoes.duas{grid-template-columns:1fr 1fr}',
    '#tq .opcoes.cinco{grid-template-columns:repeat(5,1fr)}',
    '#tq .opcao{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 4px}',
    '#tq .opcao b{font-size:19px}#tq .opcao small{font-size:14px;color:var(--sub)}',
    '#tq .opcao[aria-pressed="true"]{border-color:var(--pri);background:var(--sel)}',
    '#tq .opcoes.cinco .opcao b{font-size:22px}',
    '#tq .acao{position:sticky;bottom:0;margin:auto -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));',
    'background:linear-gradient(to top,var(--bg) 75%,transparent)}',
    '#tq .acao button{width:100%;min-height:68px;border:0;font-weight:700;font-size:21px;display:flex;',
    'flex-direction:column;align-items:center;justify-content:center}',
    '#tq .acao small{font-size:15px;font-weight:400;opacity:.9}',
    '#tq .comecar{background:var(--pri);color:var(--pri-txt)}',
    '#tq .parar{background:var(--perigo);color:#fff}',
    '#tq .agora{text-align:center}',
    '#tq .agora .icone{font-size:64px;display:inline-block;animation:tq-pulsa 2s ease-in-out infinite}',
    '#tq .agora .estado{font-size:28px;font-weight:700;margin:4px 0 2px}',
    '#tq .agora .vez{font-size:16px;color:var(--sub)}',
    '#tq .linha{display:flex;list-style:none;padding:0;margin:18px 0;gap:4px}',
    '#tq .linha li{flex:1;font-size:13px;color:var(--sub);padding-top:10px;border-top:5px solid var(--borda)}',
    '#tq .linha li.feito{border-color:var(--ok)}',
    '#tq .linha li.atual{border-color:var(--pri);color:var(--txt);font-weight:700}',
    '#tq .termina{font-size:16px;color:var(--sub);margin-top:6px}',
    '#tq .termina b{display:block;font-size:40px;color:var(--txt);font-variant-numeric:tabular-nums}',
    '#tq .barra{height:10px;background:var(--borda);border-radius:6px;overflow:hidden;margin-top:12px}',
    '#tq .barra i{display:block;height:100%;width:0;background:var(--ok);transition:width .8s}',
    '#tq .fim{text-align:center}',
    '#tq .fim.concluida{background:var(--ok-bg);border-color:var(--ok)}',
    '#tq .fim.interrompida{background:var(--alerta-bg);border-color:var(--alerta)}',
    '#tq .fim .icone{font-size:48px}#tq .fim b{display:block;font-size:22px;margin:4px 0}',
    '#tq .fim p{margin:0 0 12px;font-size:16px}#tq .fim button{min-width:140px}',
    '#tq .voltar{min-height:48px;padding:0 14px;margin-right:4px}',
    '#tq .campo{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0}',
    '#tq .campo input{width:96px;min-height:52px;font:inherit;text-align:center;border-radius:12px;',
    'border:2px solid var(--borda);background:var(--bg);color:var(--txt)}',
    '#tq .nota{font-size:15px;color:var(--sub);margin:0 0 10px}',
    '#tq .reles{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#tq .reles button[aria-pressed="true"]{background:var(--ok);color:#fff;border-color:var(--ok)}',
    '#tq .rodape{display:flex;justify-content:center;gap:24px;margin:8px 0 4px}',
    '#tq .rodape button{border:0;background:transparent;min-height:48px;color:var(--sub);font-size:16px;text-decoration:underline}',
    '#tq-folha{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center;z-index:20}',
    '#tq-folha.aberta{display:flex}',
    '#tq-folha .caixa{background:var(--card);color:var(--txt);width:100%;max-width:480px;border-radius:22px 22px 0 0;',
    'padding:22px 16px calc(16px + env(safe-area-inset-bottom));font:18px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '#tq-folha h3{margin:0 0 6px;font-size:22px}#tq-folha p{margin:0 0 18px;color:var(--sub);font-size:16px}',
    '#tq-folha button{display:block;width:100%;min-height:60px;border-radius:14px;font:inherit;font-weight:700;',
    'margin-top:10px;cursor:pointer;border:2px solid var(--borda);background:var(--card);color:var(--txt)}',
    '#tq-folha .sim{background:var(--perigo);border-color:var(--perigo);color:#fff}',
    '#tq-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:#222;color:#fff;',
    'padding:12px 16px;border-radius:12px;font:16px system-ui,sans-serif;display:none;z-index:30;max-width:90vw}',
    '#tq-voltar{position:fixed;right:12px;bottom:12px;z-index:10;padding:10px 14px;border-radius:12px;',
    'border:0;background:#1565d8;color:#fff;font:16px system-ui,sans-serif;min-height:48px}',
    'body.tq-amigavel #tq-voltar{display:none}',
    '@keyframes tq-pulsa{50%{transform:scale(1.08)}}',
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

  // localStorage pode não existir (aba anônima); a tela funciona sem ele.
  function lembrar(chave, valor) {
    try {
      if (valor === undefined) return window.localStorage.getItem(chave);
      window.localStorage.setItem(chave, valor);
    } catch (e) { return null; }
    return valor;
  }

  function iniciarTela() {
    var states = {};
    var conectado = false;
    var totalRodada = 0;
    var tela = 'pronta';
    var rapido = lembrar('tq-tipo') === 'rapida';
    var rodavaAntes = null;
    var parouPelaTela = false;
    var fim = null;
    var ui = {};

    meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
    meta('theme-color', '#1565d8');
    meta('apple-mobile-web-app-capable', 'yes');
    meta('apple-mobile-web-app-title', 'Tanquinho');
    document.title = 'Tanquinho';
    document.head.appendChild(el('style', { text: CSS }));

    var toastTimer;
    function toast(msg) {
      ui.toast.textContent = msg;
      ui.toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { ui.toast.style.display = 'none'; }, 3500);
    }

    function enviar(nameId, action, params) {
      return fetch(commandUrl(nameId, action, params), { method: 'POST' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
      }).catch(function () {
        toast('Não foi possível falar com o tanquinho. Tente de novo.');
      });
    }

    // ---- folha de confirmação (parar / desligar tudo) ----
    ui.folhaTitulo = el('h3');
    ui.folhaTexto = el('p');
    ui.folhaSim = el('button', { type: 'button', 'class': 'sim' });
    var aoConfirmar = null;
    function fecharFolha() { ui.folha.classList.remove('aberta'); aoConfirmar = null; }
    ui.folhaSim.addEventListener('click', function () {
      var f = aoConfirmar;
      fecharFolha();
      if (f) f();
    });
    ui.folha = el('div', { id: 'tq-folha', role: 'dialog', 'aria-modal': 'true', onclick: function (ev) {
      if (ev.target === ui.folha) fecharFolha();
    } }, [el('div', { 'class': 'caixa' }, [
      ui.folhaTitulo, ui.folhaTexto, ui.folhaSim,
      el('button', { type: 'button', text: 'Cancelar', onclick: fecharFolha })
    ])]);
    function confirmar(titulo, texto, botao, acao) {
      ui.folhaTitulo.textContent = titulo;
      ui.folhaTexto.textContent = texto;
      ui.folhaSim.textContent = botao;
      aoConfirmar = acao;
      ui.folha.classList.add('aberta');
      ui.folhaSim.focus();
    }

    function desligarTudo() {
      if (states[E.rodando] === true) parouPelaTela = true;
      enviar(E.parar, 'press');
    }

    function pedirDesligarTudo() {
      confirmar('Desligar tudo agora?',
        'A água, o motor e a bomba param na hora. Se estiver lavando, a lavagem é cancelada e a água fica no tanque.',
        '⏻ Desligar tudo', desligarTudo);
    }

    function pedirParar() {
      confirmar('Parar a lavagem?',
        'A máquina para na hora. A água que estiver no tanque fica lá.',
        'Sim, parar', desligarTudo);
    }

    function comecar() {
      parouPelaTela = false;
      fim = null;
      lembrar('tq-tipo', rapido ? 'rapida' : 'normal');
      enviar(rapido ? E.rapido : E.completo, 'press');
    }

    function irPara(nova) {
      tela = nova;
      render();
      window.scrollTo(0, 0);
    }

    // ---- topo, avisos ----
    ui.status = el('span', { 'class': 'status' });
    ui.desligar = el('button', { type: 'button', 'class': 'desligar', text: '⏻ Desligar tudo', onclick: pedirDesligarTudo });
    ui.alertaTexto = el('span');
    ui.alerta = el('div', { 'class': 'alerta', role: 'status' }, [
      ui.alertaTexto,
      el('button', { type: 'button', text: 'Desligar', onclick: desligarTudo })
    ]);
    ui.fimIcone = el('div', { 'class': 'icone' });
    ui.fimTitulo = el('b');
    ui.fimTexto = el('p');
    ui.fim = el('div', { 'class': 'card fim', role: 'status' }, [
      ui.fimIcone, ui.fimTitulo, ui.fimTexto,
      el('button', { type: 'button', text: 'OK', onclick: function () { fim = null; render(); } })
    ]);

    // ---- tela Pronta ----
    function opcao(titulo, sub, aoTocar) {
      return el('button', { type: 'button', 'class': 'opcao', 'aria-pressed': 'false', onclick: aoTocar },
        [el('b', { text: titulo }), el('small', { text: sub })]);
    }

    ui.roupa = {};
    var botoesRoupa = NIVEIS.map(function (n) {
      var b = opcao(ROUPA[n].titulo, ROUPA[n].sub, function () { enviar(E.nivel, 'set', { option: n }); });
      b.insertBefore(el('span', { 'aria-hidden': 'true', text: ROUPA[n].icone }), b.firstChild);
      ui.roupa[n] = b;
      return b;
    });

    ui.subNormal = el('small');
    ui.subRapida = el('small');
    ui.tipoNormal = el('button', { type: 'button', 'class': 'opcao', onclick: function () { rapido = false; render(); } },
      [el('b', { text: 'Normal' }), ui.subNormal]);
    ui.tipoRapida = el('button', { type: 'button', 'class': 'opcao', onclick: function () { rapido = true; render(); } },
      [el('b', { text: 'Rápida' }), ui.subRapida]);

    ui.vezes = [1, 2, 3, 4, 5].map(function (v) {
      return el('button', { type: 'button', 'class': 'opcao', 'aria-label': v + (v === 1 ? ' vez' : ' vezes'),
        onclick: function () { enviar(E.ciclos, 'set', { value: v }); } }, [el('b', { text: String(v) })]);
    });

    ui.comecarSub = el('small');
    ui.comecar = el('button', { type: 'button', 'class': 'comecar', onclick: comecar },
      [el('span', { text: '▶ Começar' }), ui.comecarSub]);

    ui.pronta = el('div', {}, [
      el('div', { 'class': 'card' }, [el('h2', { text: 'Quanta roupa?' }),
        el('div', { 'class': 'opcoes tres' }, botoesRoupa)]),
      el('div', { 'class': 'card' }, [el('h2', { text: 'Tipo de lavagem' }),
        el('div', { 'class': 'opcoes duas' }, [ui.tipoNormal, ui.tipoRapida])]),
      el('div', { 'class': 'card' }, [el('h2', { text: 'Quantas vezes lavar?' }),
        el('div', { 'class': 'opcoes cinco' }, ui.vezes)])
    ]);

    // ---- tela Lavando ----
    ui.icone = el('span', { 'class': 'icone', 'aria-hidden': 'true' });
    ui.estado = el('div', { 'class': 'estado' });
    ui.vez = el('div', { 'class': 'vez' });
    ui.linha = el('ol', { 'class': 'linha', 'aria-label': 'Etapas' });
    ui.terminaHora = el('b');
    ui.terminaFalta = el('span');
    ui.barra = el('i');
    ui.lavando = el('div', { 'class': 'card agora', 'aria-live': 'polite' }, [
      ui.icone, ui.estado, ui.vez, ui.linha,
      el('div', { 'class': 'termina' }, [el('span', { text: 'Termina às' }), ui.terminaHora, ui.terminaFalta]),
      el('div', { 'class': 'barra' }, [ui.barra])
    ]);
    ui.parar = el('button', { type: 'button', 'class': 'parar', text: '■ Parar lavagem', onclick: pedirParar });

    // ---- tela Ajustes ----
    ui.campos = [];
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

    ui.reles = E.reles.map(function (r) {
      var b = el('button', { type: 'button', 'aria-pressed': 'false', text: r[1], onclick: function () { enviar(r[0], 'toggle'); } });
      return [b, r[0]];
    });
    ui.manualNota = el('p', { 'class': 'nota' });

    ui.ajustes = el('div', {}, [
      el('div', { 'class': 'card' }, [
        el('h2', { text: 'Tempo para encher (minutos)' }),
        // Máximo 10 min: a válvula de água desliga sozinha aos 10 min (limite_agua no firmware).
        campoTempo('Pouca roupa', E.encher.Baixo, 10),
        campoTempo('Média', E.encher.Medio, 10),
        campoTempo('Muita roupa', E.encher.Alto, 10)
      ]),
      el('div', { 'class': 'card' }, [
        el('h2', { text: 'Tempo para esvaziar (minutos)' }),
        campoTempo('Pouca roupa', E.drenar.Baixo),
        campoTempo('Média', E.drenar.Medio),
        campoTempo('Muita roupa', E.drenar.Alto)
      ]),
      el('div', { 'class': 'card' }, [
        el('h2', { text: 'Outras etapas (minutos)' }),
        campoTempo('Misturar o sabão', E.misturar),
        campoTempo('Molho', E.molho),
        campoTempo('Lavar', E.lavar)
      ]),
      el('div', { 'class': 'card' }, [
        el('h2', { text: 'Modo manual' }),
        ui.manualNota,
        el('div', { 'class': 'reles' }, ui.reles.map(function (r) { return r[0]; }))
      ])
    ]);

    // ---- montagem ----
    var carregouPadrao = false;
    ui.nome = el('span');
    ui.titulo = el('h1', {}, [ui.nome, ui.status]);
    ui.voltar = el('button', { type: 'button', 'class': 'voltar', text: '← Voltar', onclick: function () { irPara('pronta'); } });
    ui.rodape = el('div', { 'class': 'rodape' }, [
      el('button', { type: 'button', text: '⚙️ Ajustes', onclick: function () { irPara('ajustes'); } }),
      el('button', { type: 'button', text: 'Avançado', onclick: function () {
        if (!carregouPadrao) {
          carregouPadrao = true;
          document.body.appendChild(el('script', { src: 'https://oi.esphome.io/v2/www.js' }));
        }
        document.body.classList.remove('tq-amigavel');
      } })
    ]);
    ui.acao = el('div', { 'class': 'acao' }, [ui.comecar, ui.parar]);

    ui.raiz = el('div', { id: 'tq' }, [
      el('div', { 'class': 'topo' }, [ui.voltar, ui.titulo, ui.desligar]),
      el('div', { 'class': 'faixa', role: 'alert', text: 'Sem conexão com o tanquinho. Tentando de novo…' }),
      ui.alerta, ui.fim,
      ui.pronta, ui.lavando, ui.ajustes,
      ui.rodape, ui.acao
    ]);
    ui.toast = el('div', { id: 'tq-toast', role: 'status' });

    document.body.classList.add('tq-amigavel');
    document.body.insertBefore(ui.raiz, document.body.firstChild);
    document.body.appendChild(ui.folha);
    document.body.appendChild(ui.toast);
    document.body.appendChild(el('button', { id: 'tq-voltar', type: 'button', text: '🧺 Tela simples', onclick: function () {
      document.body.classList.add('tq-amigavel');
    } }));

    function mostrar(n, sim) { n.style.display = sim ? '' : 'none'; }

    function render() {
      var rodando = states[E.rodando] === true;
      var nivel = nivelAtual(states);
      var ciclos = Math.round(num(states, E.ciclos, 1));
      var ligados = relesLigados(states);
      var vista = tela === 'ajustes' ? 'ajustes' : (rodando ? 'lavando' : 'pronta');

      var acabou = typeof states[E.rodando] === 'boolean' && rodavaAntes !== null
        ? fimDaLavagem(rodavaAntes, rodando, parouPelaTela) : null;
      if (acabou) {
        fim = acabou;
        if (acabou === 'concluida' && navigator.vibrate) navigator.vibrate([300, 150, 300]);
      }
      if (typeof states[E.rodando] === 'boolean') rodavaAntes = rodando;
      if (rodando) fim = null;

      ui.raiz.classList.toggle('desconectado', !conectado);
      ui.status.textContent = !conectado ? 'Sem conexão' : (rodando ? 'Lavando' : 'Pronto');
      ui.nome.textContent = vista === 'ajustes' ? 'Ajustes' : '🧺 Tanquinho';

      mostrar(ui.voltar, vista === 'ajustes');
      mostrar(ui.pronta, vista === 'pronta');
      mostrar(ui.lavando, vista === 'lavando');
      mostrar(ui.ajustes, vista === 'ajustes');
      mostrar(ui.rodape, vista === 'pronta');
      mostrar(ui.acao, vista !== 'ajustes');
      mostrar(ui.comecar, vista === 'pronta');
      mostrar(ui.parar, vista === 'lavando');
      mostrar(ui.fim, !!fim && vista === 'pronta');
      mostrar(ui.alerta, !rodando && ligados.length > 0);

      ui.alertaTexto.textContent = 'Ligado no modo manual: ' + ligados.join(', ') + '.';
      if (fim === 'concluida') {
        ui.fim.className = 'card fim concluida';
        ui.fimIcone.textContent = '✅';
        ui.fimTitulo.textContent = 'Pronto! Pode tirar a roupa';
        ui.fimTexto.textContent = 'A lavagem terminou.';
      } else if (fim === 'interrompida') {
        ui.fim.className = 'card fim interrompida';
        ui.fimIcone.textContent = '⏹️';
        ui.fimTitulo.textContent = 'Lavagem interrompida';
        ui.fimTexto.textContent = 'Se ficou água no tanque, use ⚙️ Ajustes → Modo manual → Bomba para esvaziar.';
      }

      ui.desligar.disabled = !conectado;
      ui.comecar.disabled = !conectado;
      NIVEIS.forEach(function (n) {
        ui.roupa[n].disabled = !conectado;
        ui.roupa[n].setAttribute('aria-pressed', String(n === nivel));
      });
      ui.tipoNormal.setAttribute('aria-pressed', String(!rapido));
      ui.tipoRapida.setAttribute('aria-pressed', String(rapido));
      ui.vezes.forEach(function (b, i) {
        b.disabled = !conectado;
        b.setAttribute('aria-pressed', String(i + 1 === ciclos));
      });
      ui.campos.forEach(function (c) { c[0].disabled = !conectado; });
      ui.reles.forEach(function (r) {
        r[0].disabled = !conectado || rodando;
        r[0].setAttribute('aria-pressed', String(states[r[1]] === true));
      });
      ui.manualNota.textContent = rodando
        ? 'Indisponível durante a lavagem.'
        : 'Liga e desliga cada parte na hora. A água desliga sozinha depois de 10 minutos.';

      var segNormal = estimateSeconds(states, false);
      var segRapida = estimateSeconds(states, true);
      ui.subNormal.textContent = 'com molho · ' + formatDuration(segNormal);
      ui.subRapida.textContent = 'sem molho · ' + formatDuration(segRapida);
      ui.comecarSub.textContent = 'termina às ' + horaTermino(Date.now(), rapido ? segRapida : segNormal);

      var restante = parseHms(states[E.restante]);
      if (!rodando) totalRodada = 0;
      else if (restante > totalRodada) totalRodada = restante;
      var estado = states[E.estado] || '';
      var texto = ETAPA_TEXTO[estado] || { titulo: estado, icone: '🌀' };
      ui.icone.textContent = texto.icone;
      ui.estado.textContent = texto.titulo;
      ui.vez.textContent = ciclos > 1 ? (states[E.etapa] || '').replace('Ciclo', 'Lavagem') : '';
      var etapas = etapasDaLinha(lembrar('tq-tipo') === 'rapida');
      var atual = etapas.indexOf(estado);
      ui.linha.textContent = '';
      etapas.forEach(function (e, i) {
        ui.linha.appendChild(el('li', { 'class': i < atual ? 'feito' : (i === atual ? 'atual' : ''), text: ETAPA_TEXTO[e].curto }));
      });
      ui.terminaHora.textContent = restante ? horaTermino(Date.now(), restante) : '--:--';
      ui.terminaFalta.textContent = restante ? 'faltam ' + formatDuration(restante) : '';
      ui.barra.style.width = progressPct(restante, totalRodada) + '%';

      ui.campos.forEach(function (c) {
        if (document.activeElement !== c[0] && typeof states[c[1]] === 'number') c[0].value = String(states[c[1]]);
      });
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
    // A hora de término anda com o relógio mesmo sem eventos novos.
    setInterval(agendar, 30000);

    render();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    iniciarTela();
  }
})();

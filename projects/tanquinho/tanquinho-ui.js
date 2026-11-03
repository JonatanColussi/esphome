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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();

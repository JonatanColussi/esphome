'use strict';
var assert = require('assert');
var ui = require('../tanquinho-ui.js');

var falhas = 0;
function teste(nome, fn) {
  try { fn(); console.log('ok   ' + nome); }
  catch (e) { falhas++; console.log('FAIL ' + nome + '\n     ' + e.message); }
}

function estados(extra) {
  var s = {};
  s[ui.E.nivel] = 'Medio';
  s[ui.E.ciclos] = 1;
  s[ui.E.encher.Baixo] = 2.5; s[ui.E.encher.Medio] = 3.5; s[ui.E.encher.Alto] = 5;
  s[ui.E.drenar.Baixo] = 3; s[ui.E.drenar.Medio] = 4; s[ui.E.drenar.Alto] = 5.5;
  s[ui.E.misturar] = 0.5; s[ui.E.molho] = 5; s[ui.E.lavar] = 15;
  Object.keys(extra || {}).forEach(function (k) { s[k] = extra[k]; });
  return s;
}

teste('commandUrl codifica nome e parâmetros', function () {
  assert.strictEqual(ui.commandUrl('button/PARAR TUDO', 'press'), '/button/PARAR%20TUDO/press');
  assert.strictEqual(ui.commandUrl('select/Nivel', 'set', { option: 'Medio' }), '/select/Nivel/set?option=Medio');
  assert.strictEqual(ui.commandUrl('number/Enchendo Alto (min)', 'set', { value: 5.5 }),
    '/number/Enchendo%20Alto%20(min)/set?value=5.5');
});

teste('parseEvent: number vira float', function () {
  var ev = ui.parseEvent('{"name_id":"number/Ciclos","domain":"number","value":"3","state":"3"}');
  assert.deepStrictEqual(ev, { key: 'number/Ciclos', value: 3 });
});

teste('parseEvent: switch e binary_sensor viram booleano', function () {
  assert.deepStrictEqual(ui.parseEvent('{"name_id":"switch/Rele Motor","domain":"switch","value":true,"state":"ON"}'),
    { key: 'switch/Rele Motor', value: true });
  assert.deepStrictEqual(ui.parseEvent('{"name_id":"binary_sensor/Em andamento","domain":"binary_sensor","value":false,"state":"OFF"}'),
    { key: 'binary_sensor/Em andamento', value: false });
});

teste('parseEvent: select e text_sensor usam state', function () {
  assert.deepStrictEqual(ui.parseEvent('{"name_id":"select/Nivel","domain":"select","value":"Alto","state":"Alto"}'),
    { key: 'select/Nivel', value: 'Alto' });
  assert.deepStrictEqual(ui.parseEvent('{"name_id":"text_sensor/Etapa","domain":"text_sensor","value":"","state":""}'),
    { key: 'text_sensor/Etapa', value: '' });
});

teste('parseEvent: ignora ping e JSON inválido', function () {
  assert.strictEqual(ui.parseEvent('{"title":"tanquinho-v2"}'), null);
  assert.strictEqual(ui.parseEvent('não é json'), null);
});

teste('estimateSeconds: completo, médio, 1 ciclo = 28 min', function () {
  // 3,5 + 0,5 + 5 + 15 + 4 = 28 min
  assert.strictEqual(ui.estimateSeconds(estados(), false), 28 * 60);
});

teste('estimateSeconds: rápido, alto, 2 ciclos', function () {
  var s = {}; s[ui.E.nivel] = 'Alto'; s[ui.E.ciclos] = 2;
  // por ciclo: 5 + 0,25 + 7,5 + 5,5 = 18,25 min → × 2 = 36,5 min
  assert.strictEqual(ui.estimateSeconds(estados(s), true), 36.5 * 60);
});

teste('estimateSeconds: nível desconhecido cai no Médio', function () {
  var s = {}; s[ui.E.nivel] = undefined;
  assert.strictEqual(ui.estimateSeconds(estados(s), false), 28 * 60);
});

teste('formatDuration', function () {
  assert.strictEqual(ui.formatDuration(28 * 60), '28 min');
  assert.strictEqual(ui.formatDuration(72 * 60), '1h12');
  assert.strictEqual(ui.formatDuration(60 * 60), '1h00');
  assert.strictEqual(ui.formatDuration(3599), '1h00');
  assert.strictEqual(ui.formatDuration(20), '1 min');
});

teste('parseHms', function () {
  assert.strictEqual(ui.parseHms('1:02:03'), 3723);
  assert.strictEqual(ui.parseHms('00:00:00'), 0);
  assert.strictEqual(ui.parseHms(''), 0);
  assert.strictEqual(ui.parseHms(undefined), 0);
});

teste('progressPct', function () {
  assert.strictEqual(ui.progressPct(600, 1200), 50);
  assert.strictEqual(ui.progressPct(0, 1200), 100);
  assert.strictEqual(ui.progressPct(1500, 1200), 0);
  assert.strictEqual(ui.progressPct(10, 0), 0);
});

teste('horaTermino soma a duração e formata HH:MM no fuso local', function () {
  var tres = new Date(2026, 10, 3, 15, 0, 0).getTime();
  assert.strictEqual(ui.horaTermino(tres, 40 * 60), '15:40');
  assert.strictEqual(ui.horaTermino(tres, 65 * 60), '16:05');
  assert.strictEqual(ui.horaTermino(new Date(2026, 10, 3, 23, 50, 0).getTime(), 20 * 60), '00:10');
  // 29 s arredonda para baixo, 30 s para cima
  assert.strictEqual(ui.horaTermino(tres, 29), '15:00');
  assert.strictEqual(ui.horaTermino(tres, 30), '15:01');
});

teste('relesLigados lista os relés ligados pelo nome amigável', function () {
  var s = {};
  assert.deepStrictEqual(ui.relesLigados(s), []);
  s['switch/Rele Entrada Agua'] = true;
  s['switch/Rele Motor'] = false;
  s['switch/Auxiliar'] = true;
  assert.deepStrictEqual(ui.relesLigados(s), ['a água', 'o auxiliar']);
});

teste('fimDaLavagem: concluída, interrompida ou nada', function () {
  assert.strictEqual(ui.fimDaLavagem(true, false, false), 'concluida');
  assert.strictEqual(ui.fimDaLavagem(true, false, true), 'interrompida');
  assert.strictEqual(ui.fimDaLavagem(true, true, false), null);
  assert.strictEqual(ui.fimDaLavagem(false, false, false), null);
  assert.strictEqual(ui.fimDaLavagem(false, true, false), null);
});

teste('etapasDaLinha: rápida não tem molho', function () {
  assert.deepStrictEqual(ui.etapasDaLinha(false), ['Enchendo', 'Misturando', 'Molho', 'Lavando', 'Drenando']);
  assert.deepStrictEqual(ui.etapasDaLinha(true), ['Enchendo', 'Misturando', 'Lavando', 'Drenando']);
});

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');

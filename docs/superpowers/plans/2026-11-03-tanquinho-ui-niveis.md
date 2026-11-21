# Tanquinho: tela amigável + níveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar nível de água (Baixo/Médio/Alto) ao firmware ESPHome do tanquinho e uma tela amigável para celular servida pelo próprio ESP.

**Architecture:** O firmware ganha um `select` de nível e seis tempos por nível; os dois ciclos passam a usar um único script de execução alimentado por um script de preparação. A tela é um JS único embutido via `web_server: js_include` (servido como `/0.js`), que lê `/events` (SSE) e manda comandos pela API REST do `web_server`. A lógica pura do JS é testada em Node; a tela é testada no navegador contra um servidor de mentira em Python.

**Tech Stack:** ESPHome 2026.4.1 (ESP32, framework arduino, `web_server` v2), JavaScript ES2017 sem dependências, Node 10 (`assert`) para testes, Python 3 (stdlib) para o mock.

**Spec:** `docs/superpowers/specs/2026-11-03-tanquinho-ui-niveis-design.md`

## Global Constraints

- Arquivos do firmware em `projects/tanquinho/`; o `tanquinho.yml` da raiz não é tocado (tem alteração não commitada que não é nossa).
- Nome de rede continua `esphome-web-807b1c`, `friendly_name: tanquinho-v2`.
- Relés: GPIO26 água, GPIO27 motor, GPIO14 bomba, GPIO12 auxiliar, todos `inverted: true`, `restore_mode: ALWAYS_OFF`.
- Nomes de entidade e opções de select sem acento (entram na URL REST): `Nivel`, `Baixo`/`Medio`/`Alto`.
- Valores iniciais de nível: Enchendo 2,5 / 3,5 / 5 min; Drenando 3 / 4 / 5,5 min (Baixo/Médio/Alto). Inicial do select: `Medio`.
- Ciclo rápido: respeita `Ciclos`; Enchendo/Drenando com tempo cheio do nível; Misturando/Lavando × 0,5; sem Molho.
- Credenciais (api key, senha OTA, senha AP, Wi-Fi) só em `projects/tanquinho/secrets.yaml` (ignorado pelo git). Nunca escrever valores de segredo em arquivos commitados nem no chat.
- JS: ES2017, sem `?.`/`??`, sem bibliotecas, sem recursos da internet.
- Textos da tela em português com acento.
- Gravação no ESP (`esphome upload`/`run`) só com OK explícito do usuário no chat.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `projects/tanquinho/tanquinho.yaml` | Firmware (substitui a cópia local) |
| `projects/tanquinho/secrets.yaml` | Segredos locais (já ignorado) |
| `projects/tanquinho/secrets.example.yaml` | Modelo de segredos, commitado |
| `projects/tanquinho/tanquinho-ui.js` | Tela amigável (lógica pura + DOM), vira `/0.js` |
| `projects/tanquinho/test/ui-logic.test.js` | Testes Node da lógica pura |
| `projects/tanquinho/dev/mock_server.py` | Imita `/`, `/0.js`, `/events` e REST do ESP |

---

### Task 1: Base do firmware igual ao ESP, segredos fora do YAML

**Files:**
- Modify: `projects/tanquinho/tanquinho.yaml` (conteúdo inteiro)
- Modify: `projects/tanquinho/secrets.yaml`
- Create: `projects/tanquinho/secrets.example.yaml`

**Interfaces:**
- Produces: chaves de segredo `wifi_ssid`, `wifi_password`, `api_key`, `ota_password`, `ap_password`.

- [ ] **Step 1: Salvar a versão que está no ESP**

Copiar o YAML colado pelo usuário (salvo em `colado.yml` no scratchpad da sessão) para `projects/tanquinho/tanquinho.yaml` e trocar só as três credenciais:

```yaml
api:
  encryption:
    key: !secret api_key

ota:
  - platform: esphome
    password: !secret ota_password

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  ap:
    ssid: "tanquinho-v2 Fallback"
    password: !secret ap_password
```

- [ ] **Step 2: Acrescentar os segredos atuais ao `secrets.yaml`**

Adicionar `api_key`, `ota_password` e `ap_password` com os valores que estavam no YAML colado (mesmos de hoje no ESP). Não mostrar os valores no chat.

- [ ] **Step 3: Criar o modelo commitado**

`projects/tanquinho/secrets.example.yaml`:

```yaml
# Copie para secrets.yaml e preencha. secrets.yaml não vai para o git.
wifi_ssid: "NOME_DA_REDE_2_4GHZ"
wifi_password: "SENHA_DO_WIFI"
api_key: "gere com: openssl rand -base64 32"
ota_password: "gere com: openssl rand -hex 16"
ap_password: "gere com: openssl rand -hex 8"
```

- [ ] **Step 4: Validar**

Run: `cd projects/tanquinho && esphome config tanquinho.yaml > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 5: Confirmar que nenhum segredo vai para o git**

Run: `git status --short projects/ && git check-ignore projects/tanquinho/secrets.yaml`
Expected: `secrets.yaml` aparece como ignorado; `tanquinho.yaml` e `secrets.example.yaml` aparecem como novos. `grep -nE 'key: "|password: "' projects/tanquinho/tanquinho.yaml` não retorna nada.

- [ ] **Step 6: Commit**

```bash
git add projects/tanquinho/tanquinho.yaml projects/tanquinho/secrets.example.yaml projects/tanquinho/.gitignore
git commit -m "feat(tanquinho): versionar firmware atual do ESP32 com segredos fora do YAML"
```

---

### Task 2: Nível, ciclo unificado, Etapa e Em andamento no firmware

**Files:**
- Modify: `projects/tanquinho/tanquinho.yaml` (conteúdo inteiro abaixo)

**Interfaces:**
- Produces (nomes que a tela usa como `name_id` no SSE e nas URLs REST):
  - `select/Nivel` (opções `Baixo`, `Medio`, `Alto`)
  - `number/Enchendo Baixo (min)`, `number/Enchendo Medio (min)`, `number/Enchendo Alto (min)`
  - `number/Drenando Baixo (min)`, `number/Drenando Medio (min)`, `number/Drenando Alto (min)`
  - `number/Tempo Misturando (min)`, `number/Tempo Molho (min)`, `number/Tempo Lavando (min)`, `number/Ciclos`
  - `text_sensor/Estado`, `text_sensor/Tempo Restante` (`H:MM:SS`), `text_sensor/Etapa` (`Ciclo N de M` ou vazio)
  - `binary_sensor/Em andamento`
  - `button/Iniciar Ciclo Completo`, `button/Iniciar Ciclo Rapido`, `button/PARAR TUDO`
  - `switch/Rele Entrada Agua`, `switch/Rele Motor`, `switch/Rele Bomba Drenagem`, `switch/Auxiliar`

- [ ] **Step 1: Escrever o firmware novo**

Substituir `projects/tanquinho/tanquinho.yaml` por:

```yaml
esphome:
  name: esphome-web-807b1c
  friendly_name: tanquinho-v2
  on_boot:
    priority: -100
    then:
      - script.execute: estado_desligado

esp32:
  board: esp32dev
  framework:
    type: arduino

logger:

api:
  encryption:
    key: !secret api_key

ota:
  - platform: esphome
    password: !secret ota_password

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  ap:
    ssid: "tanquinho-v2 Fallback"
    password: !secret ap_password

captive_portal:

web_server:

globals:
  - id: ciclo_ativo
    type: bool
    restore_value: no
    initial_value: 'false'
  - id: start_time
    type: int
    restore_value: no
    initial_value: '0'
  - id: total_time
    type: int
    restore_value: no
    initial_value: '0'
  - id: t_encher_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: t_misturar_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: t_molho_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: t_lavar_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: t_drenar_ms
    type: int
    restore_value: no
    initial_value: '0'
  - id: ciclo_atual
    type: int
    restore_value: no
    initial_value: '0'
  - id: ciclos_total
    type: int
    restore_value: no
    initial_value: '0'

select:
  - platform: template
    name: "Nivel"
    id: nivel
    icon: mdi:waves-arrow-up
    options:
      - "Baixo"
      - "Medio"
      - "Alto"
    initial_option: "Medio"
    optimistic: true
    restore_value: true

number:
  - platform: template
    optimistic: true
    name: "Enchendo Baixo (min)"
    id: enchendo_baixo
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 2.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Enchendo Medio (min)"
    id: enchendo_medio
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 3.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Enchendo Alto (min)"
    id: enchendo_alto
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-plus
    entity_category: config
    initial_value: 5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drenando Baixo (min)"
    id: drenando_baixo
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 3
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drenando Medio (min)"
    id: drenando_medio
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 4
    restore_value: true

  - platform: template
    optimistic: true
    name: "Drenando Alto (min)"
    id: drenando_alto
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:water-minus
    entity_category: config
    initial_value: 5.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Tempo Misturando (min)"
    id: tempo_misturando
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:rotate-right
    entity_category: config
    initial_value: 0.5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Tempo Molho (min)"
    id: tempo_molho
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:waves
    entity_category: config
    initial_value: 5
    restore_value: true

  - platform: template
    optimistic: true
    name: "Tempo Lavando (min)"
    id: tempo_lavando
    min_value: 0.5
    max_value: 30
    step: 0.5
    unit_of_measurement: "min"
    icon: mdi:rotate-3d
    entity_category: config
    initial_value: 15
    restore_value: true

  - platform: template
    optimistic: true
    name: "Ciclos"
    id: qtd_ciclos
    min_value: 1
    max_value: 5
    step: 1
    icon: mdi:rotate-3d-variant
    entity_category: config
    initial_value: 1
    restore_value: true

switch:
  - platform: gpio
    name: "Rele Entrada Agua"
    pin:
      number: GPIO26
      inverted: true
    id: rele_agua
    icon: mdi:water-plus
    restore_mode: ALWAYS_OFF

  - platform: gpio
    name: "Rele Motor"
    pin:
      number: GPIO27
      inverted: true
    id: rele_motor
    icon: mdi:engine
    restore_mode: ALWAYS_OFF

  - platform: gpio
    name: "Rele Bomba Drenagem"
    pin:
      number: GPIO14
      inverted: true
    id: rele_drenagem
    icon: mdi:water-minus
    restore_mode: ALWAYS_OFF

  - platform: gpio
    name: "Auxiliar"
    pin:
      number: GPIO12
      inverted: true
    id: rele_auxiliar
    restore_mode: ALWAYS_OFF

button:
  - platform: template
    name: "Iniciar Ciclo Completo"
    icon: mdi:play-circle
    on_press:
      - if:
          condition:
            lambda: 'return !id(ciclo_ativo);'
          then:
            - script.execute: ciclo_completo

  - platform: template
    name: "Iniciar Ciclo Rapido"
    icon: mdi:play-speed
    on_press:
      - if:
          condition:
            lambda: 'return !id(ciclo_ativo);'
          then:
            - script.execute: ciclo_rapido

  - platform: template
    name: "PARAR TUDO"
    icon: mdi:stop-circle
    on_press:
      - script.execute: estado_desligado

binary_sensor:
  - platform: template
    name: "Em andamento"
    id: em_andamento
    icon: mdi:washing-machine
    lambda: 'return id(ciclo_ativo);'

text_sensor:
  - platform: template
    name: "Estado"
    id: tanquinho_estado
    icon: mdi:information
    lambda: 'return {"Desligado"};'
    update_interval: never

  - platform: template
    name: "Tempo Restante"
    id: tanquinho_tempo_restante
    icon: mdi:timer
    lambda: 'return {"00:00:00"};'
    update_interval: never

  - platform: template
    name: "Etapa"
    id: tanquinho_etapa
    icon: mdi:counter
    lambda: 'return {""};'
    update_interval: never

script:
  - id: estado_desligado
    then:
      - script.stop: ciclo_completo
      - script.stop: ciclo_rapido
      - script.stop: executar_ciclos
      - switch.turn_off: rele_agua
      - switch.turn_off: rele_motor
      - switch.turn_off: rele_drenagem
      - globals.set:
          id: ciclo_ativo
          value: 'false'
      - globals.set:
          id: start_time
          value: '0'
      - globals.set:
          id: total_time
          value: '0'
      - globals.set:
          id: ciclo_atual
          value: '0'
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Desligado"
      - text_sensor.template.publish:
          id: tanquinho_tempo_restante
          state: "00:00:00"
      - text_sensor.template.publish:
          id: tanquinho_etapa
          state: ""

  - id: estado_enchendo
    then:
      - switch.turn_off: rele_motor
      - switch.turn_off: rele_drenagem
      - switch.turn_on: rele_agua
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Enchendo"

  - id: estado_misturando
    then:
      - switch.turn_off: rele_agua
      - switch.turn_off: rele_drenagem
      - switch.turn_on: rele_motor
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Misturando"

  - id: estado_molho
    then:
      - switch.turn_off: rele_agua
      - switch.turn_off: rele_motor
      - switch.turn_off: rele_drenagem
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Molho"

  - id: estado_lavando
    then:
      - switch.turn_off: rele_agua
      - switch.turn_off: rele_drenagem
      - switch.turn_on: rele_motor
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Lavando"

  - id: estado_drenando
    then:
      - switch.turn_off: rele_agua
      - switch.turn_off: rele_motor
      - switch.turn_on: rele_drenagem
      - text_sensor.template.publish:
          id: tanquinho_estado
          state: "Drenando"

  # Congela os tempos do nível ativo para o ciclo que vai começar.
  - id: preparar_ciclo
    parameters:
      rapido: bool
    then:
      - lambda: |-
          auto idx = id(nivel).active_index();
          size_t n = idx.has_value() ? *idx : 1;
          float encher[] = {id(enchendo_baixo).state, id(enchendo_medio).state, id(enchendo_alto).state};
          float drenar[] = {id(drenando_baixo).state, id(drenando_medio).state, id(drenando_alto).state};
          float fator = rapido ? 0.5f : 1.0f;

          id(t_encher_ms) = (int) (encher[n] * 60000);
          id(t_drenar_ms) = (int) (drenar[n] * 60000);
          id(t_misturar_ms) = (int) (id(tempo_misturando).state * 60000 * fator);
          id(t_lavar_ms) = (int) (id(tempo_lavando).state * 60000 * fator);
          id(t_molho_ms) = rapido ? 0 : (int) (id(tempo_molho).state * 60000);

          id(ciclos_total) = (int) id(qtd_ciclos).state;
          id(ciclo_atual) = 0;
          int por_ciclo_ms = id(t_encher_ms) + id(t_misturar_ms) + id(t_molho_ms) +
                             id(t_lavar_ms) + id(t_drenar_ms);
          id(total_time) = (por_ciclo_ms / 1000) * id(ciclos_total);
          id(start_time) = millis();
          id(ciclo_ativo) = true;

  - id: executar_ciclos
    then:
      - repeat:
          count: !lambda 'return id(ciclos_total);'
          then:
            - lambda: |-
                id(ciclo_atual) += 1;
                id(tanquinho_etapa).publish_state(
                  "Ciclo " + std::to_string(id(ciclo_atual)) + " de " + std::to_string(id(ciclos_total)));
            - script.execute: estado_enchendo
            - delay: !lambda 'return id(t_encher_ms);'
            - script.execute: estado_misturando
            - delay: !lambda 'return id(t_misturar_ms);'
            - if:
                condition:
                  lambda: 'return id(t_molho_ms) > 0;'
                then:
                  - script.execute: estado_molho
                  - delay: !lambda 'return id(t_molho_ms);'
            - script.execute: estado_lavando
            - delay: !lambda 'return id(t_lavar_ms);'
            - script.execute: estado_drenando
            - delay: !lambda 'return id(t_drenar_ms);'
      - script.execute: estado_desligado

  - id: ciclo_completo
    then:
      - script.execute:
          id: preparar_ciclo
          rapido: false
      - script.execute: executar_ciclos

  - id: ciclo_rapido
    then:
      - script.execute:
          id: preparar_ciclo
          rapido: true
      - script.execute: executar_ciclos

interval:
  - interval: 1s
    then:
      - lambda: |-
          if (id(ciclo_ativo)) {
            int elapsed = (millis() - id(start_time)) / 1000;
            int remaining = id(total_time) - elapsed;
            if (remaining < 0) remaining = 0;

            int hours = remaining / 3600;
            int minutes = (remaining % 3600) / 60;
            int seconds = remaining % 60;

            std::string tempo =
              std::to_string(hours) + ":" +
              (minutes < 10 ? "0" : "") + std::to_string(minutes) + ":" +
              (seconds < 10 ? "0" : "") + std::to_string(seconds);

            id(tanquinho_tempo_restante).publish_state(tempo);
          }
```

- [ ] **Step 2: Validar**

Run: `cd projects/tanquinho && esphome config tanquinho.yaml > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 3: Conferir os nomes da interface**

Run: `cd projects/tanquinho && esphome config tanquinho.yaml | grep -E '^\s+name: ' | sort`
Expected: contém exatamente os nomes listados em **Produces** acima (mais nenhum `Tempo Enchendo`/`Tempo Drenando`).

- [ ] **Step 4: Commit**

```bash
git add projects/tanquinho/tanquinho.yaml
git commit -m "feat(tanquinho): nível de água, ciclo rápido com ciclos, Etapa e Em andamento"
```

---

### Task 3: Lógica pura da tela (TDD em Node)

**Files:**
- Create: `projects/tanquinho/test/ui-logic.test.js`
- Create: `projects/tanquinho/tanquinho-ui.js` (só a parte de lógica + export; DOM vem na Task 4)

**Interfaces:**
- Consumes: nomes de entidade da Task 2.
- Produces (exportado em Node via `module.exports`; no navegador ficam no escopo do IIFE):
  - `E` — mapa de `name_id`s (objeto abaixo)
  - `commandUrl(nameId: string, action: string, params?: object) → string`
  - `parseEvent(data: string) → {key: string, value: any} | null`
  - `estimateSeconds(states: object, rapido: boolean) → number`
  - `formatDuration(seconds: number) → string`
  - `parseHms(text: string) → number`
  - `progressPct(remaining: number, total: number) → number` (0–100, inteiro)

- [ ] **Step 1: Escrever os testes**

`projects/tanquinho/test/ui-logic.test.js`:

```js
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

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\ntodos passaram');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node projects/tanquinho/test/ui-logic.test.js`
Expected: erro `Cannot find module '../tanquinho-ui.js'`.

- [ ] **Step 3: Implementar a lógica**

`projects/tanquinho/tanquinho-ui.js`:

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node projects/tanquinho/test/ui-logic.test.js`
Expected: todas as linhas `ok`, última linha `todos passaram`.

- [ ] **Step 5: Commit**

```bash
git add projects/tanquinho/tanquinho-ui.js projects/tanquinho/test/ui-logic.test.js
git commit -m "feat(tanquinho): lógica da tela amigável com testes"
```

---

### Task 4: Tela no navegador + servidor de mentira + js_include

**Files:**
- Create: `projects/tanquinho/dev/mock_server.py`
- Modify: `projects/tanquinho/tanquinho-ui.js` (acrescentar a parte de DOM antes do bloco `module.exports`)
- Modify: `projects/tanquinho/tanquinho.yaml` (`web_server:`)

**Interfaces:**
- Consumes: tudo que a Task 3 produz; nomes da Task 2.
- Produces: `GET /`, `GET /0.js`, `GET /events`, `POST /<domínio>/<nome>/<ação>` no mock, com o mesmo formato do ESP.

- [ ] **Step 1: Servidor de mentira**

`projects/tanquinho/dev/mock_server.py`:

```python
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
    sim["restante"] = 0
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
```

- [ ] **Step 2: Acrescentar a parte de DOM ao `tanquinho-ui.js`**

Inserir este bloco logo antes de `if (typeof module !== 'undefined' && module.exports) {` e trocar esse `if` final por `if ... { module.exports = api; } else { iniciarTela(); }`:

```js
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
    'border:0;background:#1677ff;color:#fff;font:15px system-ui,sans-serif}',
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

    function campoTempo(rotulo, nameId) {
      var input = el('input', { type: 'number', min: '0.5', max: '30', step: '0.5', inputmode: 'decimal' });
      input.addEventListener('change', function () {
        var v = parseFloat(String(input.value).replace(',', '.'));
        if (isNaN(v)) return;
        v = Math.min(30, Math.max(0.5, Math.round(v * 2) / 2));
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
        el('button', { type: 'button', 'aria-label': 'Menos ciclos', text: '−', onclick: function () { mudarCiclos(-1); } }),
        ui.ciclosValor,
        el('button', { type: 'button', 'aria-label': 'Mais ciclos', text: '+', onclick: function () { mudarCiclos(1); } })
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
      campoTempo('Encher no Baixo', E.encher.Baixo),
      campoTempo('Encher no Médio', E.encher.Medio),
      campoTempo('Encher no Alto', E.encher.Alto),
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

    ui.raiz = el('div', { id: 'tq' }, [
      el('div', { 'class': 'faixa', text: 'Sem conexão com o tanquinho. Tentando de novo…' }),
      el('h1', { text: '🧺 Tanquinho' }),
      ui.parado, ui.rodando, ajustes,
      el('div', { 'class': 'rodape' }, [el('a', { href: '#', text: 'Avançado', onclick: function (ev) {
        ev.preventDefault(); document.body.classList.remove('tq-amigavel');
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

```

O fim do arquivo fica:

```js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    iniciarTela();
  }
})();
```

- [ ] **Step 3: Testes de lógica continuam passando**

Run: `node projects/tanquinho/test/ui-logic.test.js`
Expected: `todos passaram`.

- [ ] **Step 4: Ligar o js_include no firmware**

Em `projects/tanquinho/tanquinho.yaml`, trocar `web_server:` por:

```yaml
web_server:
  js_include: tanquinho-ui.js
```

Run: `cd projects/tanquinho && esphome config tanquinho.yaml > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 5: Testar no navegador com o mock**

Run (em segundo plano): `python3 projects/tanquinho/dev/mock_server.py 8099`
Abrir `http://localhost:8099` no navegador embutido e conferir, em largura de celular (375×812) e nos temas claro e escuro:
1. Tela "parado": nível Médio destacado, Ciclos = 1, "Lavagem completa ≈ 28 min", "Lavagem rápida ≈ 15 min".
2. Tocar em "Alto": destaque muda e as estimativas viram ≈ 31 min / ≈ 18 min.
3. `+` duas vezes: Ciclos = 3 e estimativas triplicam.
4. "Lavagem rápida": aparece a tela "rodando" com estado, "Ciclo 1 de 3", tempo descendo e barra crescendo.
5. "Parar" → confirmar → volta para "parado".
6. Ajustes: mudar "Encher no Alto" para 6 → estimativa sobe 3 min (3 ciclos); relé "Motor" acende ao tocar.
7. "Avançado" mostra a interface padrão do mock; "🧺 Tela simples" volta.
8. Parar o mock: faixa "Sem conexão…" aparece e botões de iniciar ficam desativados; subir o mock de novo: faixa some sozinha.
9. Console sem erros.

- [ ] **Step 6: Commit**

```bash
git add projects/tanquinho/tanquinho-ui.js projects/tanquinho/dev/mock_server.py projects/tanquinho/tanquinho.yaml
git commit -m "feat(tanquinho): tela amigável embutida no ESP e servidor de teste"
```

---

### Task 5: Compilar o firmware

**Files:** nenhum.

- [ ] **Step 1: Compilar**

Run (em segundo plano, pode levar vários minutos): `cd projects/tanquinho && esphome compile tanquinho.yaml`
Expected: termina com `SUCCESS`. Anotar uso de flash/RAM do resumo.

- [ ] **Step 2: Conferir que o JS entrou**

Run: `grep -c ESPHOME_WEBSERVER_JS_INCLUDE -r projects/tanquinho/.esphome/build/esphome-web-807b1c/src/ | head -1`
Expected: número maior que 0.

---

### Task 6: Gravar no ESP (somente com OK explícito do usuário)

**Files:**
- Modify: `projects/tanquinho/secrets.yaml` (pelo usuário: Wi-Fi da Kati-PLUS)
- Modify temporário: `projects/tanquinho/tanquinho.yaml` (`ota` com `id` e troca de senha no boot)

- [ ] **Step 1: Pré-requisito do usuário**

Pedir ao usuário para colocar em `projects/tanquinho/secrets.yaml` o `wifi_ssid`/`wifi_password` da Kati-PLUS (a rede onde o ESP está hoje). Não pedir a senha no chat.

- [ ] **Step 2: Gerar segredos novos**

```bash
openssl rand -base64 32   # nova api_key
openssl rand -hex 16      # nova ota_password
openssl rand -hex 8       # nova ap_password
```

Gravar em `secrets.yaml`: `api_key` e `ap_password` novas; `ota_password` continua a antiga e a nova vai em `ota_password_nova`.

- [ ] **Step 3: Gravação 1 (senha OTA antiga, já trocando para a nova no boot)**

Alterar temporariamente:

```yaml
ota:
  - platform: esphome
    id: ota_esphome
    password: !secret ota_password
```

e no `esphome: on_boot: then:` acrescentar, antes do `script.execute`:

```yaml
      - lambda: id(ota_esphome).set_auth_password("${ota_nova}");
```

com no topo:

```yaml
substitutions:
  ota_nova: !secret ota_password_nova
```

Run: `cd projects/tanquinho && esphome upload tanquinho.yaml --device 192.168.2.125`
Expected: `OTA successful`. Depois `dns-sd -L esphome-web-807b1c _esphomelib._tcp local.` responde e `http://192.168.2.125` mostra a tela amigável.

- [ ] **Step 4: Gravação 2 (senha nova definitiva)**

Desfazer as mudanças temporárias do Step 3; em `secrets.yaml`, `ota_password` passa a ser a nova e `ota_password_nova` sai.

Run: `cd projects/tanquinho && esphome upload tanquinho.yaml --device 192.168.2.125`
Expected: `OTA successful`.

- [ ] **Step 5: Teste real**

No celular: abrir `http://192.168.2.125`, nível Baixo, Ciclos 1, "Lavagem rápida"; acompanhar Enchendo → Misturando → Lavando → Drenando → Desligado; tocar "Parar" num segundo teste e conferir que todos os relés desligam.

- [ ] **Step 6: Commit**

```bash
git add projects/tanquinho/tanquinho.yaml
git commit -m "chore(tanquinho): firmware gravado no ESP"
```
(Só se o YAML final diferir do último commit.)

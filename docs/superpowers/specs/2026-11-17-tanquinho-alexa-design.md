# Tanquinho: integração com a Alexa (Sinric Pro)

Data: 2026-11-17
Status: desenho aprovado em conversa, aguardando revisão da spec

## Objetivo

Operar o tanquinho por voz numa Echo, sem Home Assistant:

- "Alexa, ligar o tanquinho" começa a lavagem.
- "Alexa, desligar o tanquinho" desliga tudo.
- A Alexa avisa quando a lavagem termina sozinha.

Fora do escopo: escolher quantidade de roupa, tipo ou número de lavagens por
voz; aviso quando a lavagem é interrompida; Home Assistant.

## Por que Sinric Pro

O aviso de fim exige um evento pela nuvem da Alexa, então algum serviço na
internet é inevitável. O Sinric Pro (gratuito até 3 aparelhos, skill da Alexa
pronta) resolve ligar, desligar e aviso com uma peça só e conversa direto com
o ESP32. Descartados: imitar lâmpada Hue localmente (ocupa a porta 80 da tela
e o aviso ainda precisaria de outra conta) e Home Assistant (exige um
computador ligado o tempo todo).

## Arquitetura

```
"Alexa, ligar o tanquinho" ─> nuvem Alexa ─> Sinric Pro ─(WebSocket)─> ESP32
ESP32 ─(lavagem terminou)─> Sinric Pro ─> rotina da Alexa: anunciar
```

A tela local (`tanquinho.local`) continua igual e independente da internet.

### Aparelhos no Sinric Pro

| Aparelho | Tipo | Comportamento |
|---|---|---|
| Tanquinho | Switch | Ligar = botão `Iniciar`. Desligar = `PARAR TUDO`. O estado espelha `Em andamento`, inclusive quando a lavagem começa ou para pela tela. |
| Tanquinho terminou | Contact Sensor | "Abre" quando a lavagem termina sozinha e "fecha" 5 s depois. A pessoa cria no app Alexa a rotina "quando abrir, anunciar 'A roupa está pronta'". |

Ligar com uma lavagem em andamento não faz nada (trava `ciclo_ativo` já
existente). Lavagem parada por `PARAR TUDO` não gera aviso.

## Firmware

### Componente `sinric` (`projects/tanquinho/components/sinric/`)

Componente externo em C++ (`external_components: source: type: local`) que
usa a biblioteca oficial `SinricPro` (Arduino, ESP32).

Configuração (valores vêm de `secrets.yaml`):

```yaml
sinric:
  app_key: !secret sinric_app_key
  app_secret: !secret sinric_app_secret
  switch_id: !secret sinric_switch_id
  contact_id: !secret sinric_contact_id
  on_turn_on: [...]    # pedido de ligar vindo da Alexa
  on_turn_off: [...]   # pedido de desligar vindo da Alexa
```

Ações para o YAML:

- `sinric.publicar_ligado: <bool lambda>`: envia o estado do Switch.
- `sinric.avisar_fim`: abre o Contact Sensor e o fecha 5 s depois.

Regras:
- Sem conexão com o Sinric, as ações são descartadas em silêncio e a
  biblioteca reconecta sozinha. Nada reinicia o ESP por falta de conexão.
- O componente não mexe em relés: só dispara os gatilhos; o YAML decide.

### Mudanças no `tanquinho.yaml`

- `select` template **Tipo**: `Normal` / `Rapida`, inicial `Normal`,
  `optimistic`, `restore_value: true`.
- `button` **Iniciar**: executa `ciclo_completo` ou `ciclo_rapido` conforme o
  `Tipo`, com a mesma trava `!ciclo_ativo`. Os botões `Iniciar Ciclo Completo`
  e `Iniciar Ciclo Rapido` continuam.
- `sinric.on_turn_on` → `button.press: Iniciar`; `on_turn_off` →
  `button.press: PARAR TUDO`.
- `binary_sensor` `Em andamento` ganha `on_state` → `sinric.publicar_ligado`.
- `executar_ciclos`: ao terminar todos os ciclos (fim natural), chama
  `sinric.avisar_fim` antes de `estado_desligado`. `PARAR TUDO` não passa por
  esse ponto, então não avisa.
- `secrets.yaml` ganha `sinric_app_key`, `sinric_app_secret`,
  `sinric_switch_id`, `sinric_contact_id`; `secrets.example.yaml` ganha os
  mesmos com valores de exemplo.

## Tela (`tanquinho-ui.js`)

- "Tipo de lavagem" lê e grava `select/Tipo` (`set?option=Normal|Rapida`);
  sai o `localStorage` `tq-tipo`.
- "▶ Começar" aperta `button/Iniciar`.
- Estimativa, "termina às" e linha do tempo usam o `Tipo` vindo do ESP; se ele
  ainda não chegou, assume `Normal`.
- `dev/mock_server.py` ganha `select/Tipo` e `button/Iniciar`.

## Testes

1. **Prova de compilação primeiro**: firmware atual + componente `sinric`
   mínimo (conecta, sem ações). Se a biblioteca não compilar com o ESPHome
   2026.4.1, parar e trazer alternativas antes de seguir.
2. Testes da tela (`node test/ui-logic.test.js`): os 15 atuais + novos para o
   Tipo (estimativa e linha do tempo a partir de `select/Tipo`).
3. Tela no navegador com o mock: escolher Tipo, Começar, Parar.
4. `esphome config` e `esphome compile` sem erros.
5. Gravação OTA **somente com OK explícito**.
6. Depois que a pessoa criar a conta, os dois aparelhos e as chaves no
   `secrets.yaml` (passo a passo escrito em
   `projects/tanquinho/ALEXA.md`): testar ligar, desligar e o aviso com uma
   lavagem rápida, nível Baixo, 1 vez.

## Segurança e contas

- Chaves e IDs do Sinric só no `secrets.yaml` (gitignored).
- Criar conta no Sinric, vincular a skill no app Alexa e copiar as chaves é
  feito pela própria pessoa; o Claude não digita senhas nem chaves em sites.
- A Alexa só consegue o que a tela já consegue (começar e desligar tudo); os
  relés manuais não são expostos por voz.

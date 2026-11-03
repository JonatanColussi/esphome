# Tanquinho: tela amigável + níveis de água

Data: 2026-11-03
Status: aprovado em conversa, aguardando revisão da spec

## Objetivo

Permitir que qualquer pessoa da casa opere o tanquinho pelo celular, sem conhecer
ESPHome, com todas as funções atuais disponíveis, e adicionar um "nível de água"
(Baixo / Médio / Alto) que ajusta os tempos de enchimento e drenagem.

Fora do escopo desta entrega: Alexa, Home Assistant, troca do nome de rede
(`esphome-web-807b1c`), unificação das redes Kati / Kati-PLUS.

## Ponto de partida

- Firmware de referência: a versão que está gravada no ESP hoje (ESP32 `esp32dev`,
  ESPHome 2026.4.1, relés em GPIO26/27/14/12 invertidos). Ela será salva como
  `projects/tanquinho/tanquinho.yaml`, substituindo a cópia local que difere só
  nos GPIOs (32/33/25/13).
- O `tanquinho.yml` da raiz (versão ESP8266 antiga, com uma alteração não
  commitada) não é tocado.
- Credenciais (chave da API, senha OTA, senha do AP de fallback) saem do YAML e
  vão para `secrets.yaml`, que já está no `.gitignore`. As chaves atuais estão
  publicadas no GitHub, então são geradas novas na gravação.

## Arquitetura

Tudo roda no ESP32. Não há servidor extra.

```
celular (navegador) ──HTTP──> ESP32 web_server :80
   │  GET /            página padrão do ESPHome + /0.js (nosso script)
   │  GET /events      SSE com o estado de todas as entidades
   │  POST /<domínio>/<nome>/<ação>   comandos (REST nativo do web_server)
```

### 1. Firmware (`projects/tanquinho/tanquinho.yaml`)

**Nível**
- `select` template `Nivel`, opções `Baixo`, `Medio`, `Alto`, `optimistic`,
  `restore_value: true`, inicial `Medio`. Nomes de entidade e opções ficam sem
  acento porque entram na URL da API REST; a tela mostra "Nível" e "Médio".
- Seis `number` template (`entity_category: config`, 0,5–30 min, passo 0,5,
  `restore_value: true`):

  | Entidade | Inicial |
  |---|---|
  | Enchendo Baixo (min) | 2,5 |
  | Enchendo Medio (min) | 3,5 |
  | Enchendo Alto (min) | 5 |
  | Drenando Baixo (min) | 3 |
  | Drenando Medio (min) | 4 |
  | Drenando Alto (min) | 5,5 |

- Removidos: `Tempo Enchendo (min)` e `Tempo Drenando (min)`.
- Mantidos: `Tempo Misturando`, `Tempo Molho`, `Tempo Lavando`, `Ciclos`.
- Ao iniciar um ciclo, os tempos de enchimento e drenagem do nível ativo são
  copiados para globals (`t_encher_ms`, `t_drenar_ms`). Trocar o nível durante
  um ciclo não altera o ciclo em andamento.

**Ciclos**
- Completo: para cada ciclo → Enchendo (nível) → Misturando → Molho → Lavando →
  Drenando (nível). Igual a hoje, com tempos do nível.
- Rápido: respeita `Ciclos`; Enchendo e Drenando com tempo cheio do nível;
  Misturando e Lavando pela metade; sem Molho.
- O tempo total é calculado com as mesmas regras, para o Tempo Restante bater.

**Novas entidades de leitura**
- `text_sensor` `Etapa`: `"Ciclo N de M"` durante o ciclo, vazio quando parado.
- `binary_sensor` template `Em andamento`: espelha `ciclo_ativo`.
- `Tempo Restante` passa a ser publicado a cada 1 s (antes 10 s).

**Página**
- `web_server: js_include: tanquinho-ui.js`, `js_url` vazio. O ESPHome 2026.4
  gera o índice com `<script type=module src=/0.js>`; a tela amigável vem do
  ESP e funciona sem internet. A interface padrão (`www.js` da internet) só é
  carregada quando a pessoa toca em "Avançado", para não abrir uma segunda
  conexão `/events` por celular. `local: true` não é usado: o índice embutido
  por ele não carrega `/0.js`.

**Sem mudança**: relés manuais, `on_boot` desligando tudo, trava
`ciclo_ativo` contra ciclo duplo, nome de rede.

### 2. Tela (`projects/tanquinho/tanquinho-ui.js`)

Um único arquivo JS, sem dependências externas (funciona sem internet). Ao
carregar, esconde a interface padrão do ESPHome e monta a tela amigável. Um
link "Avançado" no rodapé alterna de volta para a interface padrão.

**Parado**
- Seletor de nível: 3 botões grandes (Baixo / Médio / Alto), o atual destacado.
- Ciclos: `−` / `+` de 1 a 5.
- Botões "Lavagem completa" e "Lavagem rápida", cada um com o tempo total
  estimado calculado no navegador a partir dos tempos atuais.

**Rodando** (quando `Em andamento` = ON)
- Estado atual grande com ícone animado, `Etapa` ("Ciclo 2 de 3"), Tempo
  Restante e barra de progresso (restante / total no início).
- Botão vermelho "Parar" com confirmação → `PARAR TUDO`.
- Nível e botões de iniciar ficam ocultos.

**⚙️ Ajustes** (recolhido)
- Os 6 tempos de nível, Misturando, Molho, Lavando.
- Relés manuais (Água, Motor, Bomba, Auxiliar) com aviso "uso manual"; ficam desativados enquanto um ciclo roda.

**Conexão**
- Lê `/events` com `EventSource`; estado em memória indexado pelo `id` da
  entidade.
- Comandos via `fetch(POST)` nas rotas REST do `web_server`.
- Sem conexão: faixa "Sem conexão com o tanquinho", controles desativados;
  `EventSource` reconecta sozinho.

**Visual**: mobile first, botões ≥ 48 px, textos em português, tema
claro/escuro por `prefers-color-scheme`. O script injeta `meta viewport`,
`theme-color` e as metas `apple-mobile-web-app-*` (o índice gerado não tem),
para a página caber no celular e funcionar bem em "Adicionar à tela inicial".
Não há manifest: o ESP só serve `/` e `/0.js`.

## Erros e segurança

- Um comando que falha (HTTP ≠ 200) mostra um aviso curto e não muda o estado
  local; o estado só muda pelo que chega em `/events`.
- Iniciar com ciclo ativo continua bloqueado no firmware, não só na tela.
- `Parar` sempre visível durante o ciclo e sempre pede confirmação.
- A válvula de água desliga sozinha após 10 min ligada.
- Água e bomba nunca ligadas juntas; motor e bomba nunca ligados juntos
  (intertravamento no firmware).
- `PARAR TUDO` desliga também o Auxiliar.
- `api` e `wifi` com `reboot_timeout: 0s` para uma lavagem longa não ser
  abortada por reinício.

## Testes

1. `esphome config projects/tanquinho/tanquinho.yaml` sem erros.
2. `esphome compile` sem erros.
3. Tela testada no navegador com um servidor local que simula `/events` e as
   rotas REST (dados de mentira), nos dois estados (parado/rodando), sem conexão,
   em largura de celular e nos dois temas.
4. Gravação OTA no ESP **somente com OK explícito**, seguida de um ciclo rápido
   com nível Baixo acompanhado pela tela.

## Pré-requisitos para gravar

- `secrets.yaml` precisa ter o SSID/senha da rede onde o ESP está hoje
  (Kati-PLUS); a cópia local aponta para outra rede. Se estiver errado, o ESP
  sobe o AP de fallback "tanquinho-v2 Fallback".
- Troca da senha OTA em duas gravações: a primeira ainda com a senha atual
  (já com o firmware novo), a segunda com a senha nova. A chave da API pode
  trocar direto, pois nenhum cliente (Home Assistant) usa a antiga.

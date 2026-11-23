# Tanquinho: tela em TypeScript, código em inglês e build por npm

Data: 2026-11-21
Status: desenho aprovado em conversa, aguardando revisão da spec

## Objetivo

- Reescrever `tanquinho-ui.js` em TypeScript de alto nível e boa
  legibilidade.
- Todo o código em inglês (TS, YAML do firmware, servidor de teste,
  testes), inclusive os nomes das entidades do ESPHome.
- Textos que a pessoa lê nas telas continuam em português.
- Build da tela e do firmware juntos, por npm.
- Usar `@colussi/eslint-config`, `@colussi/prettier-config` e
  `@colussi/tsconfig`.

Comportamento para quem usa: igual ao de hoje (mesmas telas, textos,
segurança e lógica de lavagem). Fora do escopo: Alexa (só a spec dela é
atualizada para os nomes novos), mudanças de lógica no firmware.

## Estrutura

```
projects/tanquinho/
├─ package.json        scripts npm, "prettier": "@colussi/prettier-config"
├─ package-lock.json
├─ .nvmrc              22
├─ .eslintrc.js        extends '@colussi/eslint-config'
├─ tsconfig.json       extends '@colussi/tsconfig'
├─ jest.config.js      ts-jest
├─ scripts/build-ui.mjs  esbuild → dist/ui.js
├─ src/
│  ├─ main.ts          entrada: monta a tela
│  ├─ copy.ts          todos os textos em português + tradução dos códigos do ESP
│  ├─ domain/          regras puras, sem DOM
│  │  ├─ entities.ts   chaves tipadas das entidades
│  │  ├─ wash.ts       estimativa, linha do tempo, resultado da lavagem
│  │  └─ time.ts       duração, H:MM:SS, horário de término, progresso
│  ├─ device/
│  │  ├─ client.ts     DeviceClient: /events (EventSource) + comandos REST
│  │  └─ store.ts      StateStore: estado por entidade + assinatura de mudanças
│  └─ ui/
│     ├─ dom.ts        helper h() para criar elementos
│     ├─ styles.ts     CSS de hoje
│     ├─ app.ts        topo, faixa sem conexão, troca de telas
│     ├─ components/   sheet (confirmação), choice-group, button
│     └─ screens/      ready, washing, finished, settings
├─ test/               Jest (domain, device, copy, montagem das telas)
├─ dev/mock-server.ts  servidor de mentira em TS (substitui o .py)
├─ tanquinho.yaml      firmware em inglês; js_include: dist/ui.js
└─ dist/ui.js          gerado, fora do git
```

Removidos: `tanquinho-ui.js`, `test/ui-logic.test.js`, `dev/mock_server.py`.

## Ferramentas

- Node 22 (`.nvmrc`); a versão padrão do Mac (10) não roda TS 5.
- **TypeScript**: `tsconfig.json` estende `@colussi/tsconfig` (strict,
  noUnused*, noImplicitReturns) e sobrescreve `lib: ["ES2017", "DOM"]`,
  `noEmit: true`, `module/moduleResolution` compatíveis com esbuild e Jest,
  `types: ["jest", "node"]`.
- **esbuild** gera um único `dist/ui.js`, formato IIFE, `target: es2017`,
  minificado (cabe no flash do ESP e roda em celulares antigos).
- **ESLint 8** com `.eslintrc.js` estendendo `@colussi/eslint-config`
  (airbnb-base, typescript-eslint com type-checking, unicorn, sonarjs,
  simple-import-sort, jest, prettier).
- **Prettier** via `"prettier": "@colussi/prettier-config"`.
- **Jest** com `ts-jest` (exigido pelo eslint-config); testes de tela com
  `jest-environment-jsdom`.
- **tsx** para rodar o `dev/mock-server.ts`.

## Scripts npm

| Script | Faz |
|---|---|
| `build:ui` | esbuild → `dist/ui.js` |
| `build` | `typecheck` + `build:ui` + `esphome compile tanquinho.yaml` |
| `flash` | `build` + `esphome upload tanquinho.yaml --device ${TANQUINHO_HOST:-tanquinho.local}` |
| `dev` | `build:ui` em modo watch + `dev/mock-server.ts` |
| `typecheck` | `tsc --noEmit` |
| `lint` / `format` | ESLint / Prettier (`format:check` no CI) |
| `test` | Jest |
| `check` | `typecheck` + `lint` + `format:check` + `test` |

`esphome` continua instalado via pip; os scripts só o chamam. Gravar no ESP
segue exigindo OK explícito.

## Firmware em inglês

Ids, scripts, globals e comentários em inglês (`water_valve`, `state_filling`,
`prepare_cycle`, `cycle_active`, `h_started`...). `friendly_name`:
`Tanquinho`; AP de fallback: "Tanquinho Fallback". `name: tanquinho` não
muda (`tanquinho.local` continua).

| Hoje | Novo |
|---|---|
| Rele Entrada Agua | Water Valve |
| Rele Motor | Motor |
| Rele Bomba Drenagem | Drain Pump |
| Auxiliar | Auxiliary |
| Iniciar Ciclo Completo | Start Full Cycle |
| Iniciar Ciclo Rapido | Start Quick Cycle |
| PARAR TUDO | Stop All |
| Nivel (Baixo / Medio / Alto) | Water Level (Low / Medium / High) |
| Enchendo Baixo / Medio / Alto (min) | Fill Low / Medium / High (min) |
| Drenando Baixo / Medio / Alto (min) | Drain Low / Medium / High (min) |
| Tempo Misturando (min) | Mix Time (min) |
| Tempo Molho (min) | Soak Time (min) |
| Tempo Lavando (min) | Wash Time (min) |
| Ciclos | Cycles |
| Estado (Desligado, Enchendo, Misturando, Molho, Lavando, Drenando) | Stage (Off, Filling, Mixing, Soaking, Washing, Draining) |
| Tempo Restante | Time Remaining |
| Etapa ("Ciclo 1 de 2", vazio parado) | Cycle Progress ("1/2", vazio parado) |
| Em andamento | Running |
| Motivo do Reinicio | Reset Reason |
| Sinal Wi-Fi | Wi-Fi Signal |
| Historico de Lavagens ("Iniciadas … ultima em Enchendo, ciclo 1") | Wash History ("Started 1 \| Completed 0 \| Stopped 0 \| Interrupted 1 (last at Filling, cycle 1)") |

Lógica, tempos padrão, limites, intertravamento e `reboot_timeout` não
mudam. Comentários dizendo o porquê das travas são mantidos, em inglês.

Efeito aceito: como as preferências do ESP são indexadas pelo nome, ajustes
e histórico voltam ao padrão na primeira gravação. Mitigação: antes de
gravar, ler pela API REST nível, tempos e ciclos; depois de gravar,
reaplicar nos nomes novos (Baixo→Low, Medio→Medium, Alto→High). O histórico
de lavagens volta a zero.

## Tela

- Mesmas telas e textos de hoje (Pronta, Lavando, Fim, Ajustes, topo com
  "Desligar tudo", aviso de modo manual, faixa sem conexão, Avançado
  carregando o `www.js`).
- `copy.ts` concentra os textos em português e traduz os códigos do ESP:
  `Filling` → "Enchendo de água", `1/2` → "Lavagem 1 de 2", níveis
  `Low/Medium/High` → "Pouca/Média/Muita".
- O tipo de lavagem (Normal/Rápida) continua no `localStorage`; ir para o
  ESP faz parte da spec da Alexa, não desta.
- `DeviceClient` não muda estado local por conta própria: o estado só muda
  pelo que chega em `/events` (igual a hoje). Comando que falha mostra o
  aviso curto de hoje.
- Bundle sem framework; tamanho alvo do `dist/ui.js` minificado ≤ 40 KB.

## Testes

1. Jest:
   - os 15 testes atuais convertidos (URL de comando, parse de evento,
     estimativa, formatação, progresso, horário, relés ligados, resultado,
     linha do tempo), com os nomes novos;
   - novos: tradução de `Stage` e de `Cycle Progress` para português;
   - montagem de cada tela com jsdom e um `StateStore` de mentira,
     conferindo os textos principais.
2. `npm run check` limpo (tipos, ESLint sem erros, Prettier, Jest).
3. Tela no navegador contra `npm run dev`: parado, lavando, sem conexão,
   largura de celular, claro e escuro.
4. `npm run build` (config + compile) sem erros.
5. CI: `npm ci`, `npm run check`, `npm run build` (com segredos de mentira
   como hoje).
6. Gravação **somente com OK explícito**: ler ajustes → `npm run flash` →
   reaplicar ajustes → conferir a tela no ESP.

## Outros arquivos

- `.github/workflows/tanquinho.yml`: passa a usar Node 22 + `npm ci` +
  `npm run check` e `npm run build`.
- `docs/superpowers/specs/2026-11-17-tanquinho-alexa-design.md`: nomes de
  entidades atualizados para os novos.
- `.gitignore` do projeto: `node_modules/`, `dist/`.

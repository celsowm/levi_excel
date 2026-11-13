# World 01 em três fases: planilha viva (v4)

O World 01 deixou de ser um saguão único. Agora são **três fases**, cada uma com
GLB, lightmap e JSON próprios, carregadas sob demanda. A planilha deixou de ser um
modal que "valida e libera": cada terminal abre um **painel lateral** com uma
planilha de verdade, e cada mudança mexe no mundo **ao vivo**.

| Fase | Nome | Missões | O que a planilha controla | Par (ouro, contra o relógio) |
| --- | --- | --- | --- | --- |
| 1-1 | Jardim e Recepção | M00 · M01 | M00: selecionar a linha ATD-104 solta o drone-entregador. M01: a altura em C4 sobe a passarela sobre o poço de luz. | 1:30 |
| 1-2 | Galeria da Fila | M02 | Classificar por altura move os quatro elevadores e forma uma escada até a galeria (y 9). Classificar só uma coluna mistura os registros e **trava** os elevadores (anel vermelho). | 0:50 |
| 1-3 | Átrio de Dados | M03 · SOMA · M04 | O filtro liga as plataformas de dados das linhas visíveis (limite do gerador: 3). `=SOMA(C2:C5)` alimenta o ventilador; um 32 digitado à mão não liga nada. | 1:10 |

A ordem dos objetivos de cada fase está em `src/campaign.js` (`STAGES`). A saída só
abre quando o objetivo atual é a saída, então pular plataformas nunca pula missão.

## Layout das fases

- **1-1 Jardim e Recepção.** Jardim com lago e pedras (killzone na água), pérgula com
  jump pad, labirinto de sebes, chafariz que lança para o telhado da marquise (segredo),
  saguão com balcão (M00), sala do dash, circuito de plataformas até a sacada (M01),
  passarela vinculada à célula C4 e mezanino com a porta da Galeria.
- **1-2 Galeria da Fila.** Duas esteiras em sentidos opostos com um drone-sentinela
  entre elas, scanner de piso, divisória de vidro com barreira de dash, terminal da
  fila e quatro elevadores. Sacadas laterais (deck oscilante à esquerda com nicho
  secreto atrás de uma barreira; jump pad à direita) e, no topo, scanners em vaivém
  antes da saída.
- **1-3 Átrio de Dados.** Corredor de vidro com duas barreiras e scanner, blocos
  laterais com jump pads e cubos, borda do vão com o terminal do filtro, seis
  plataformas de dados (J1–J3 cruzam o vão; A1–A3 levam à baia lacrada e à Sala do
  Mestre com a M04 opcional e o segredo), racks de servidores com drone e scanner,
  terminal de energia, coluna de ar e o balcão do elevador central (y 9,6).

## Arquitetura do runtime

```
src/campaign.js    missões (planilha, preview ao vivo, validação) e fases (objetivos, par)
src/sheet.js       motor de planilha: fórmulas pt-BR, SOMA, classificar, filtrar, desfazer
src/progress.js    createRun (objetivos, flags, checkpoint, tempo) e createSave (localStorage)
src/entities.js    entidades puras: plataformas vinculadas, jump pads, ventilador, esteiras,
                   barreiras, scanners, drones, entregador, cubos, segredos, checkpoints
src/player.js      controlador do Levi: carrega em decks, esteiras, pads, coluna de ar,
                   empurrão de drone, scanner/queda -> checkpoint, coleta de cubos/segredos
src/stage.js       carrega a fase (GLB + lightmap + props.glb) e espelha as entidades no Three.js
src/sheet-ui.js    painel da planilha: grade, barra de fórmulas, classificar, filtro,
                   desfazer, dicas, validação automática; teclado, mouse e toque
src/main.js        menu de fases, HUD (objetivo, marcador, tempo, cubos, segredos),
                   pausa, resultados e contra o relógio
```

A planilha nunca "chama" o mundo diretamente. Cada missão publica **flags**
(`walkway`, `lifts`, `dataPlatforms`, `fanPower`, `courier`) a cada alteração, e as
entidades com `bind: {flag, key}` reagem a elas. O mesmo mecanismo serve para o
estado inicial (planilha intocada = elevadores embaralhados, ventilador desligado) e
para o contra o relógio (flags das missões já resolvidas).

## Painel da planilha

- Clique numa célula ou no número da linha; setas, Tab, Enter/F2 para editar,
  Delete para limpar, Ctrl+Z para desfazer. Digitar já começa a editar.
- Classificar usa a coluna selecionada; "Expandir seleção" desmarcado reproduz o erro
  clássico de ordenar uma coluna só.
- Filtro: coluna, condição (=, ≠, <, ≤, >, ≥) e valor. Linhas ocultas somem da grade e
  os números de linha ficam azuis, como no Excel.
- A mensagem de validação muda a cada alteração; "Concluir" só acende quando a
  resposta está certa. Até três dicas progressivas por missão.
- Com o painel aberto, a câmera vai para a vista do terminal (`view` no JSON), que
  enquadra o que a planilha controla. No celular o painel vira uma folha inferior.

## Ritmo

Rota direta entre objetivos (spawn → terminais → saída, em planta): 97 m na 1-1,
37 m na 1-2 (mais 9 m de subida pelos elevadores) e 68 m na 1-3. Correndo com desvios,
isso dá 20 a 40 s; os pars do contra o relógio (1:30, 0:50, 1:10) deixam folga para
os saltos, scanners e barreiras. O tempo da primeira jogada, com as planilhas,
ainda precisa ser medido com jogadores reais.

## Extras

- **Contra o relógio:** liberado depois de concluir a fase. As missões começam
  resolvidas; medalha de ouro dentro do par, prata até 1,5× o par, bronze acima.
- **Cubos e segredos:** 10 / 9 / 10 cubos e um segredo por fase (telhado da marquise,
  nicho da galeria, Sala do Mestre). O save guarda recorde, cubos e segredos por fase.
- **Drones-sentinela** empurram o Levi; **scanners** mandam de volta ao checkpoint.
- QA: `?stage=1-2` abre uma fase direto; `&trial` abre no contra o relógio.

## Pipeline Blender

```
art/blender/levi_kit.py     kit compartilhado: materiais, primitivas, colisão, bake, export
art/blender/props.py        prefabs comuns -> public/stages/props.glb
art/blender/stage_1_1.py    fase 1-1 \
art/blender/stage_1_2.py    fase 1-2  > public/stages/<id>/world.glb, lightmap.webp
art/blender/stage_1_3.py    fase 1-3 /  e src/data/stages/<id>.json
art/blender/build.py        driver: build.py -- [props] [1-1 1-2 1-3] [--no-bake] [--no-export]
```

```bash
npm run world                       # tudo: props + 3 fases, bake Cycles, meshopt
npm run world -- 1-2                # só uma fase
npm run world -- 1-3 --no-bake      # geometria/JSON sem refazer o bake (mantém a exposição)
npm run world -- --optimize-only    # só reaplica o meshopt
```

Cada alvo roda num processo do Blender separado: reconstruir uma cena já baked na
mesma sessão derrubava o Blender 5.2 (SIGSEGV).

| Fase | Triângulos | world.glb | lightmap |
| --- | --- | --- | --- |
| 1-1 | ~126k | 2,3 MB | 0,7 MB |
| 1-2 | ~59k | 1,3 MB | 0,6 MB |
| 1-3 | ~106k | 1,9 MB | 0,6 MB |
| props (todas) | | 0,4 MB | |

## Testes

`tests/stages.test.js` monta um **grafo de saltos** a partir do JSON exportado
(pisos, tampos, decks na posição definida pelas flags, jump pads e a coluna de ar),
usando a física real do Levi (subida máxima do salto duplo) e bloqueando arestas por
colliders altos demais. Ele garante que:

- saída, terminais, cubos e segredos são alcançáveis com as missões resolvidas;
- 1-1: o mezanino não é alcançável com a passarela recolhida ou baixa demais;
- 1-2: registros misturados travam os elevadores e o topo fica fora de alcance;
- 1-3: o vão não se cruza sem o filtro Judicial, o caminho Administrativo leva só à
  Sala do Mestre e o balcão final exige o ventilador.

Também há uma simulação curta do controlador: o dash quebra a barreira e o Levi
desce junto com o elevador.

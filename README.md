# LEVI — Operação Planilha · POC 0.6

> **Roadmap v2:** o protótipo evoluiu para a POC 0.4; o redesign completo permanece em desenvolvimento. O redesign está especificado, mas **ainda não foi implementado**. O objetivo é uma aventura 3D mais polida e uma trilha gradual de Excel até PROCV.  
> Consulte [Game Design v2](docs/GAME_DESIGN_V2.md), [Trilha Excel](docs/EXCEL_CURRICULUM_V2.md), [World 01 / Vertical Slice](docs/VERTICAL_SLICE_V2.md) e [Plano técnico para Codex](docs/IMPLEMENTATION_PLAN_V2.md) e [Ação e Plataforma 3D](docs/ACTION_PLATFORM_V2.md).

Jogo educativo de **ação e plataforma 3D** com o robô **Levi** para ensinar Excel aos jovens da FIA da PGE-RJ. O World 01 tem três fases de plataforma em que a planilha mexe no mundo ao vivo: editar uma célula, classificar, filtrar e escrever `=SOMA(...)` abrem caminho para o Levi.

![Conceito do saguão](art/concepts/concept-01.jpg)

## 🎮 Jogue online

**https://celsowm.github.io/levi_excel/** (disponível após habilitar e concluir o GitHub Pages)

### Primeira configuração do GitHub Pages

Acesse **Settings → Pages → Build and deployment → Source: GitHub Actions**. O workflow `.github/workflows/pages.yml` será executado em cada push na branch `main` e também pode ser iniciado manualmente em Actions.

O pipeline instala as dependências, roda `npm test`, restaura o modelo 3D original, executa `vite build` com `base=/levi_excel/` e publica o diretório `dist` com `actions/deploy-pages@v4`.

## Desenvolvimento local

Requer Node.js 22+ e npm:

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. O modelo `public/levi.glb` é reconstruído automaticamente antes de executar Vite, a partir de blocos Brotli versionados em `assets/model/`. A reconstrução verifica o SHA-256 e produz **exatamente os bytes do GLB versionado**. Os clipes de locomoção (`Andar`, `Correr`, `Pular`, `Salto`, `Aterrissar`) são gerados por `art/blender/levi_anim.py` sobre o rig original; depois de regerar, `node scripts/pack-model.mjs` atualiza os blocos e o hash. Essa organização evita falhas no transporte de um blob binário grande e não degrada o personagem.

```bash
npm test          # testes unitários
npm run build     # compila para dist/
npm run preview   # prévia do build
```

## Controles

| Tecla | Ação |
| --- | --- |
| WASD ou setas | Mover |
| Espaço (duas vezes) | Pular / salto duplo |
| J ou X | Dash (recarrega após uso) |
| Arrastar sobre o cenário | Orbitar a câmera |
| H | Mostrar/ocultar dicas de controles |
| Shift | Correr |
| E | Abrir terminal |
| Esc | Pausa / fechar terminal |
| R | Voltar ao checkpoint |
| M | Ligar/desligar a música (também no menu de pausa) |

No celular, use os controles na tela, incluindo o botão **DASH**, e arraste sobre o cenário para girar a câmera.

### World 01 em três fases, planilha viva (v0.6)
O World 01 agora tem três fases maiores: **1-1 Jardim e Recepção**, **1-2 Galeria da Fila** e **1-3 Átrio de Dados**. Cada terminal abre um painel lateral com uma planilha de verdade, e cada alteração mexe no mundo ao vivo: a célula C4 sobe a passarela, classificar move os elevadores, o filtro liga as plataformas de dados e `=SOMA(C2:C5)` liga o ventilador. Há contra o relógio com medalhas, cubos, segredos e drones-sentinela. Detalhes em [docs/WORLD01_STAGES_V4.md](docs/WORLD01_STAGES_V4.md).

A trilha sonora (`public/audio/`: menu e uma faixa instrumental por fase) foi gerada com o modo de música do Gemini e normalizada com ffmpeg (MP3 96 kbps, −18 LUFS). `src/music.js` faz a troca suave entre faixas e abaixa o volume na planilha e na pausa.

As fases são modeladas no **Blender** (`art/blender/stage_1_*.py` sobre o kit `levi_kit.py`), com bake de iluminação no Cycles. Convenções em [docs/BLENDER_PIPELINE_V3.md](docs/BLENDER_PIPELINE_V3.md).

```bash
npm run world   # requer Blender 4.2+; reconstrói as três fases e os props, com bake
```

## Missões

| Fase | Missão | Habilidade |
| --- | --- | --- |
| 1-1 | M00 · Uma entrega para o Levi | Linhas, colunas e registros |
| 1-1 | M01 · A passarela do mezanino | Selecionar e editar uma célula |
| 1-2 | M02 · Fila dos elevadores | Classificar linhas inteiras |
| 1-3 | M03 · Plataformas de dados | Filtrar registros |
| 1-3 | SOMA · Energia dos ventiladores | Fórmula SOMA |
| 1-3 | M04 · Sala do Mestre (opcional, secreta) | Filtrar + classificar |

## Estrutura

- `src/`: motor de planilha, missões, entidades, controlador do Levi, painel da planilha e HUD. `src/data/stages/*.json` é exportado pelo Blender.
- `art/blender/`: kit, fases, prefabs, texturas e folhagem (fonte da verdade do World 01).
- `public/stages/`: GLB e lightmap de cada fase, mais `props.glb`.
- `scripts/build-world.mjs`: Blender headless + compressão meshopt.
- `public/`: assets públicos gerados para o build e imagem de capa.
- `assets/model/`: modelo `levi.glb` (com os ciclos de andar/correr novos) compactado em blocos Brotli.
- `scripts/restore-model.mjs`: remontagem e validação de SHA-256.
- `art/concepts/`: três conceitos visuais das fases.
- `tests/`: planilha, missões, progresso, física e um grafo de saltos que verifica cada fase exportada.
- `.github/workflows/pages.yml`: build + deploy automático de `main` para GitHub Pages.

Projeto experimental de aprendizagem e prototipagem. O avaliador de fórmulas é didático, não um motor completo do Microsoft Excel.

### POC 0.4 — colisão e limpeza de cena
- `src/collisions.js` contém volumes AABB com cápsula horizontal aproximada, varredura em passos curtos e deslizamento nas bordas; o dash não ignora mesas e pilares.
- Os elementos da recepção, bancos, vasos, pilares, terminais, suportes de plataforma e porta do elevador possuem volumes físicos explícitos; o balcão pode receber pousos na superfície.
- A câmera utiliza os mesmos volumes para encurtar o braço quando uma estrutura está no caminho.
- Banners duplicados, letreiros gigantes e partículas quadradas sem função foram removidos. A iluminação foi suavizada e Levi aparece maior na câmera.
- A colisão ainda é um **controlador customizado leve**, não um motor de física geral. Detecção de teto e superfícies curvas exigirá aprofundamento.

O pipeline valida lógica e build; ainda é necessária avaliação visual e de feeling em Safari real.

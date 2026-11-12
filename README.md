# LEVI — Operação Planilha · POC 0.1

> **Roadmap v2:** o protótipo público ainda é a POC 0.1. O redesign está especificado, mas **ainda não foi implementado**. O objetivo é uma aventura 3D mais polida e uma trilha gradual de Excel até PROCV.  
> Consulte [Game Design v2](docs/GAME_DESIGN_V2.md), [Trilha Excel](docs/EXCEL_CURRICULUM_V2.md), [World 01 / Vertical Slice](docs/VERTICAL_SLICE_V2.md) e [Plano técnico para Codex](docs/IMPLEMENTATION_PLAN_V2.md).

Jogo educativo 3D com o robô **Levi** para ensinar Excel aos jovens da FIA da PGE-RJ. O saguão futurista tem plataformas, coletáveis e dois desafios: filtrar uma planilha para construir uma ponte e usar `SOMA` para ligar o elevador.

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

Abra `http://localhost:5173`. O modelo `public/levi.glb` é reconstruído automaticamente antes de executar Vite, a partir de blocos Brotli versionados em `assets/model/`. A reconstrução verifica o SHA-256 e produz **exatamente os bytes do GLB original**. Essa organização evita falhas no transporte de um blob binário grande e não degrada o personagem.

```bash
npm test          # testes unitários
npm run build     # compila para dist/
npm run preview   # prévia do build
```

## Controles

| Tecla | Ação |
| --- | --- |
| WASD ou setas | Mover |
| Espaço | Pular |
| Shift | Correr |
| E | Interagir com terminais e elevador |
| Esc | Fechar terminal |
| R | Voltar ao checkpoint |

No celular, use os controles na tela.

## Missões

1. Encontre o terminal **Filtro** e mostre apenas processos com prazos inferiores a cinco dias.
2. Atravesse a ponte que foi ativada.
3. No terminal **Soma**, escreva uma fórmula como `=SOMA(C2:C5)` para recuperar energia.
4. Chegue ao elevador; opcionalmente, colete os oito cubos de dados.

## Estrutura

- `src/`: cena, movimento do Levi, missões e HUD.
- `public/`: assets públicos gerados para o build e imagem de capa.
- `assets/model/`: modelo `levi.glb` original compactado em blocos Brotli.
- `scripts/restore-model.mjs`: remontagem e validação de SHA-256.
- `art/concepts/`: três conceitos visuais das fases.
- `tests/`: testes das fórmulas didáticas.
- `.github/workflows/pages.yml`: build + deploy automático de `main` para GitHub Pages.

Projeto experimental de aprendizagem e prototipagem. O avaliador de fórmulas é didático, não um motor completo do Microsoft Excel.

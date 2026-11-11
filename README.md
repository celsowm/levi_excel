# LEVI — Operação Planilha · POC 0.1

Protótipo de jogo educativo 3D para navegador, construído ao redor do **modelo GLB original do Levi** (`public/levi.glb`). A aventura utiliza planilhas como **mecânicas do cenário**, não como quiz: filtrar uma tabela faz nascer uma ponte; aplicar `SOMA` ativa o elevador.

![Conceito do saguão](art/concepts/concept-01.jpg)

## Jogar online (GitHub Pages)

Após ativar **Settings → Pages → Build and deployment → Source: GitHub Actions**, o workflow `.github/workflows/pages.yml` instala as dependências, executa os testes, gera o build Vite com `base=/levi_excel/` e publica em:

**https://celsowm.github.io/levi_excel/**

Todo push na branch `main` disparará uma atualização automática. É possível também executar `Deploy LEVI to GitHub Pages` manualmente em Actions → Run workflow. O deploy só entra no ar após o workflow concluir com sucesso.

## Rodar localmente

Pré-requisito: [Node.js](https://nodejs.org/) 20.19+ ou 22.12+ e npm. Recomenda-se uma versão LTS atual.

```bash
npm install
npm run dev
```

Abra a URL indicada pelo Vite, em geral **http://localhost:5173**. O jogo funciona em navegador com WebGL; abra pelo servidor, **não** dando duplo clique em `index.html`.

Para gerar um build estático de publicação:

```bash
npm run build
npm run preview
```

O build de produção fica em `dist/`. É possível servir essa pasta em um servidor HTTPS estático.

Para os testes da miniavaliação de fórmulas:

```bash
npm test
```

## Controles

| Entrada | Ação |
|---|---|
| W, A, S, D ou setas | Andar |
| Espaço | Pular |
| Shift | Correr |
| E | Interagir com terminal/elevador |
| Esc | Fechar terminal |
| R | Voltar ao checkpoint |
| Celular/tablet | Direcional e botões na tela |

## A primeira missão

1. Você aparece no saguão da Central de Dados da PGE-RJ.
2. Encontre o terminal **FILTRO**, próximo ao vão entre dois setores.
3. Na planilha fictícia `prazos_de_atendimento.xlsx`, exiba apenas os registros com prazo **inferior a 5 dias**. A ponte surge no cenário.
4. Cruze a passagem, procure o terminal **SOMA** e digite uma fórmula que some `C2:C5`, por exemplo `=SOMA(C2:C5)`.
5. Vá ao elevador principal e finalize o percurso. Colete até 8 cubos de dados como objetivo opcional.

## O que já está implementado

- Cena 3D com dois setores, saguão, recepção, vidraças, plantas, plataformas, consoles, iluminação, efeitos de dados e elevador.
- Levi original (`levi.glb`) com **Parado**, **Andar**, **Pular**, **Acenar**, **Dancar** e **Comemorar** disponíveis. O POC usa as animações de locomoção e comemoração.
- Câmera de acompanhamento em terceira pessoa, corrida e salto; física básica de gravidade/queda.
- Ponte física ativada após conclusão da filtragem.
- Desafio de `SOMA` com validador didático e ativação do elevador.
- HUD, feedback, checkpoint, oito coletáveis, tela inicial e tela de vitória.
- Controles de teclado e controles virtuais em dispositivos de toque.
- Testes unitários do avaliador didático de fórmulas.

## Estrutura do projeto

```text
levi-operacao-planilha/
├── art/concepts/           # Três imagens de direção de arte (não representam a cena final)
├── public/
│   ├── levi.glb            # Modelo 3D original fornecido pelo usuário
│   └── arte-conceito.jpg   # Splash screen
├── src/
│   ├── main.js             # Loop principal, controles, progresso e câmera
│   ├── world.js            # Criação procedural do cenário, ponte e elevador
│   ├── character.js        # GLB + AnimationMixer
│   ├── missions.js         # Filtragem e fórmula didática
│   └── style.css           # Interface, HUD e responsividade
├── tests/missions.test.js  # Testes de fórmulas
├── index.html
└── package.json
```

## Limitações honestas deste POC

- **Ainda não é um editor de Excel completo.** A experiência de planilha é uma simulação didática: ela ensina filtros e um subconjunto de fórmulas. Não importa `.xlsx` nem implementa todas as funções do Excel.
- A movimentação utiliza física simples implementada em JavaScript, sem motor de colisão detalhada para móveis e decoração. O foco é verificar o *game loop*.
- A direção de arte das três imagens inspira o cenário, mas a cena 3D em tempo real é uma versão procedural simplificada, construída com formas nativas do Three.js.
- Não há áudio, missões persistentes, inimigos, sistema de progresso por usuário ou backend institucional.
- O pacote foi validado sintaticamente e os testes de fórmulas passaram, mas não foi possível fazer o teste visual completo do jogo em navegador neste ambiente, pois as dependências npm não estavam disponíveis para instalação. Recomenda-se o primeiro teste local antes de divulgar aos FIAs.

## Próximas prioridades

1. Testar no Safari e Chrome reais e ajustar escala/orientação do GLB, câmera e perfis de desempenho para celular.
2. Substituir a física simplificada por colisores (Rapier, por exemplo) e finalizar o level design do saguão.
3. Tornar as tarefas mais reais: limpar cadastros, classificar demandas e montar uma tabela real com upload/exportação `.xlsx`.
4. Implementar dicas graduais do Levi sem depender de modelo de IA para validar o resultado.
5. Adicionar áudio, partículas, cutscenes e uma segunda fase ambientada no Arquivo Inteligente.

**Observação:** `prazos_de_atendimento.xlsx` e `energia_setores.xlsx` são nomes ilustrativos das planilhas fictícias exibidas na interface. Não são arquivos reais distribuídos no projeto.

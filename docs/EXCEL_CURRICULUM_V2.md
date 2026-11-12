# LEVI v2 — Trilha de aprendizagem de Excel (até PROCV)
**Target learners:** jovens FIA, incluindo iniciantes absolutos.  
**Localidade:** Excel em português do Brasil; exemplos usam `;` como separador de argumentos.  
**Princípio:** resolver problemas simples com dados sintéticos e depois repetir a operação em uma planilha reconhecível.

## Skill progression
| Ordem | Habilidade | Missão contextualizada | Prova observável |
|---|---|---|---|
| 0 | Navegar: linha, coluna, célula, cabeçalho, registro | Levi encontra a ficha de atendimento correta em 4 cartões | Seleciona `B3`, reconhece o cabeçalho e encontra o registro |
| 1 | Selecionar intervalo, digitar e corrigir | Corrigir etiqueta de um item em uma lista curta | Edita célula, desfaz e seleciona `A2:C5` |
| 2 | Organizar e classificar | Ordenar a fila de visitantes por horário | Classifica linhas completas, sem misturar valores de colunas |
| 3 | Filtrar registros | Exibir somente atendimentos da categoria indicada | Aplica filtro, limpa filtro e explica diferença entre ocultar e apagar |
| 4 | SOMA e intervalos | Somar o consumo de quatro estações | Digita `=SOMA(C2:C5)` e confere resultado 32 |
| 5 | Referências e cópia | Calcular subtotal em múltiplas linhas | Usa `=B2*C2`, preenche abaixo, observa referência relativa |
| 6 | MÉDIA, CONT.NÚM, porcentagem | Resumo dos atendimentos de uma semana | Calcula média e percentual de registros concluídos |
| 7 | SE e CONT.SE | Sinalizar tarefas urgentes e contar sua quantidade | Usa `=SE(C2<5;"Urgente";"No prazo")` e `=CONT.SE(D2:D10;"Urgente")` |
| 8 | Tabelas com chaves/IDs | Relacionar solicitações a setores responsáveis | Identifica chave estável, duplicatas e códigos ausentes |
| 9 | **PROCV** | Encontrar setor responsável pelo código em tabela auxiliar | Usa correspondência exata `=PROCV(E2;A2:C6;3;FALSO)` |
| 10 (bônus) | PROCX + revisão | Resolver o mesmo problema com uma busca moderna | Usa `=PROCX(E2;A2:A6;C2:C6;"Não encontrado")` |

### Guardrails de progressão
- A primeira cena não pede nenhuma fórmula e não exibe o termo "PROCV".
- Cada conceito aparece primeiro com 3–6 registros e uma necessidade que faça sentido no mundo.
- Introduza no máximo uma operação nova por microdesafio; revisite-a em outro contexto antes de evoluir.
- Não exigir digitação rápida: prioridade para raciocínio, operação e compreensão.
- Praticar em dois modos: **assistido** e **planilha realista**. No avançado, ocultar as dicas passo a passo.
- Nunca afirmar que o editor do jogo é o Microsoft Excel; o simulador tem subconjunto de funcionalidades e deve comunicar essa limitação.
- Todos os dados são sintéticos; nunca usar informações pessoais de bolsistas ou dados de processos reais.

## World 01: Recepção Inteligente (primeiro vertical slice)
Objetivo: os jogadores saem da fase capazes de ler registros, corrigir informação, ordenar e aplicar filtros simples.

### M00 — "Por onde começo?" (sem terminal/modal)
Levi encontra um drone com um cartão: `ATD-104`. No balcão há uma pequena lista com **ID / Setor / Andar**. O jogador aproxima a câmera, encontra a **linha** correspondente e aciona o terminal apontado. O mundo responde: o drone percorre o caminho até o setor certo.

**Avaliação:** identifica o campo e seleciona o registro correspondente; assistência destaca primeiro a coluna `ID`, depois o registro.

### M01 — "Uma etiqueta fora do lugar" (primeiro contato com células)
Um crachá digital tem o campo de destino vazio. O jogador seleciona a célula indicada, escolhe ou digita o destino correto, pode usar desfazer e vê o holograma da etiqueta se atualizar.

**Avaliação:** seleção da célula correta, atualização e persistência do valor; não é um quiz.

### M02 — "Fila organizada" (sort)
Quatro atendimentos estão embaralhados em uma tela. O jogador arrasta linhas inteiras ou usa **Dados → Classificar por horário (crescente)**. Após a ordenação, o sistema organiza uma fileira física de robôs auxiliares.

**Avaliação:** ordenação por campo correto e **integridade dos registros** (ID/Setor/Horário continuam na mesma linha).

### M03 — "Quem precisa deste balcão?" (filter)
Há duas categorias de atendimento; mostre apenas a categoria pedida pelo funcionário. O filtro ilumina os caminhos correspondentes no saguão e destrava a galeria.

**Avaliação:** número e IDs corretos, sem eliminar registros originais; capaz de limpar filtro.

### Reforço M04 — Livre / opcional
Uma nova tabela com outros dados pede ordenar e filtrar sem setas de ajuda. Completar libera a placa de domínio da Recepção. O jogador pode seguir pela história com assistência, mas a **competência** só aparece como dominada quando a tarefa independente é resolvida.

## World 02: Primeiro contato com fórmulas
Só agora introduzir `SOMA`, `=`, intervalo `A2:A6`, referência `C2` e preenchimento.

### Exemplo calculável
| Célula | Unidade | Carga |
|---|---|---:|
| C2 | Arquivo | 8 |
| C3 | Atendimento | 12 |
| C4 | Documentação | 5 |
| C5 | Tecnologia | 7 |

`=SOMA(C2:C5)` deve resultar **32**. Não validar somente pelo texto exato: validadores devem aceitar expressões semanticamente corretas no subconjunto permitido.

## World 05: PROCV — culminância didática
Criar duas tabelas (sem dados reais):

**Tabela de consulta A2:C6**

| Código | Item | Setor |
|---|---|---|
| R101 | Scanner | Arquivo |
| R102 | Impressora | Administrativo |
| R103 | Monitor | Tecnologia |
| R104 | Envelope | Protocolo |
| R105 | Teclado | Tecnologia |

**Pedido E2:** `R104`.

O jogador deve retornar **Protocolo** com:
```excel
=PROCV(E2;A2:C6;3;FALSO)
```

Conceitos antes da sintaxe: chave pesquisada, tabela, coluna de retorno e correspondência exata. Explicar que PROCV procura a chave na **primeira coluna** do intervalo escolhido; não usar correspondência aproximada aqui.

Ensinar falha segura: se `E2 = R999`, resultado de busca sem correspondência deve aparecer como `#N/D` (ou mensagem pedagógica vinculada ao erro, sem fingir que achou algo).

**Bônus com PROCX:**
```excel
=PROCX(E2;A2:A6;C2:C6;"Não encontrado")
```
Ensinar que o intervalo de busca e o intervalo de retorno são independentes, com uma verificação adicional de compatibilidade de versões do Excel usado pela instituição.

### Avaliação da competência PROCV
1. Acha uma chave presente com correspondência exata.
2. Explica a necessidade de `FALSO` no quarto argumento do exemplo.
3. Ajusta a coluna de retorno sem alterar os dados originais.
4. Identifica um código ausente e interpreta o erro.
5. Faz a mesma busca em um exercício diferente sem copiar passo a passo.

## Concretização fora do jogo
Opcionalmente exportar `.xlsx` sem metadados pessoais e com aba "Exercício" e aba "Instruções", com instruções de replicação no Excel. Permitir importação **apenas de arquivos didáticos explicitamente suportados** em iteração posterior; não prometer compatibilidade geral com arquivos externos.

## Rubrica de acompanhamento (privada)
Quatro estados por habilidade: `not_started`, `guided`, `independent`, `mastered`. Estado `mastered` exige aplicação independente em dataset não visto. O progresso é local por padrão e não exibe ranking público.

## Validação com educadores
Antes de adicionar funções mais avançadas, validar terminologia do Excel pt-BR e se a sequência corresponde à turma real. Evitar começar por sintaxe complexa quando o estudante ainda confunde registro, linha e coluna.

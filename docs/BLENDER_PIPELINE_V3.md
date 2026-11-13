# World 01 no Blender: pipeline de arte v3

O cenário do World 01 (Recepção Inteligente) deixou de ser montado com primitivas
do Three.js. A **fonte da verdade** do nível agora é `art/blender/build_world01.py`.
Esse script monta a cena inteira no Blender, faz o bake da iluminação no Cycles e
exporta tudo o que o jogo carrega.

```
art/blender/build_world01.py ──► public/world/world01.glb          arquitetura estática
            (Blender 5.2)    ├─► public/world/props01.glb          prefabs animados/interativos
                             ├─► public/world/world01-lightmap.webp  luz baked (Cycles)
                             └─► src/data/world01.level.json        colisão, pisos, spawns, circuito
```

## Como reconstruir

```bash
npm run world                      # Blender headless + bake + meshopt (~10 min no M5)
npm run world -- --optimize-only   # só reaplica o meshopt em public/world
LEVI_BAKE_SAMPLES=32 npm run world # bake rápido para iterar
```

Também dá para iterar ao vivo pelo **MCP for Blender**, sem bake:

```python
p = '/caminho/levi_excel/art/blender/build_world01.py'
g = {'__file__': p, '__name__': 'levi_build'}
exec(compile(open(p).read(), p, 'exec'), g)
g['build'](do_bake=False, do_export=False)
```

## Convenções

- **Coordenadas do script = coordenadas do jogo** (Y para cima, +Z em direção à
  entrada). A função `bl()` converte para o Z-up do Blender, e o exportador glTF
  converte de volta.
- **Prefixos de malha** definem o shading em runtime (`src/world-assets.js`):
  - `LM_`: arquitetura com lightmap; `MeshBasicMaterial` + lightmap, sem custo de luz.
    Piso e metais ganham reflexo de um cubemap capturado uma vez do próprio saguão.
  - `EM_`: faixas de LED, telas e placas luminosas; sem iluminação, alimentam o bloom.
  - `GL_`: vidro.
  - `RT_`: vegetação e área externa, iluminadas pela luz em tempo real.
- **Prefabs** (`PF_<nome>` em `props01.glb`) ficam na origem. O JS cria um holder
  para cada um e clona o prefab quando o GLB termina de carregar: drones, plataformas,
  jump pad, barreira, scanner, segmentos da ponte, cubos de dados e móbile.
- **Colisão** não é inferida de malhas visuais. O script registra `collider()` e
  `walkable()` junto da geometria correspondente e exporta para o JSON. No Blender,
  a coleção `COLLISION` mostra esses volumes como empties para conferência.
- Faces que ninguém vê (topo do telhado, fundo das lajes) são descartadas antes do
  bake para não desperdiçar texels.

## Orçamento atual

| Item | Alvo | Atual |
| --- | --- | --- |
| Draw calls do mundo estático | ≤ 40 | 29 malhas (1 por material) |
| Triângulos do mundo | ≤ 300k | ~175k (a maior parte é folhagem) |
| Lightmap | 2048² | 1 atlas WebP |
| Download do mundo (GLB + lightmap) | ≤ 8 MB | veja `npm run world` |

## Assets de terceiros (todos CC0, Poly Haven)

- Texturas: `floor_tiles_04`, `black_walnut_veneer_02`, `concrete_wall_009`
  (só o difuso, em `art/blender/textures/`).
- Modelos: folhagem de `potted_plant_01` e `potted_plant_02`, dizimada e guardada em
  `art/blender/models/plants.blend`, com o alpha embutido em PNG RGBA.

## Gameplay preservado

O layout jogável da v0.2 continua idêntico: ilhas, vão da ponte, balcão andável,
terminais, circuito, spawns e coletáveis. `tests/level.test.js` garante isso com
colliders críticos, spawns livres e um flood fill que percorre a rota das missões
(com e sem a ponte). O teste encontrou um bug real: o checkpoint pós-filtro
nascia dentro do terminal e foi movido para `z = -0.6`.

## Próximos passos possíveis

- Robôs da fila para a missão M02 (prefabs no mesmo arquivo).
- KTX2 para as texturas, quando o pipeline tiver o `toktx` disponível.
- Lightmap direcional ou light probes para que o Levi receba a cor do ambiente.

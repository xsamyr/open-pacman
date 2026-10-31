# SPEC 02 — Power pellets y fantasmas asustados

> **Estado:** Draft
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-30
> **Objetivo:** Añadir 4 power pellets de una sola aparición por partida que vuelven vulnerables a los fantasmas durante 6 s, permiten comerlos por puntos y los hacen reaparecer en la pen a los 10 s.

## Por qué existe esta spec

SPEC 01 dejó explícitamente fuera los power pellets y el modo asustado. Esta spec añade el bucle clásico de riesgo/recompensa: una celda especial que cambia temporalmente las reglas de colisión, invierte la IA de los fantasmas y da una segunda forma de puntuar.

## Alcance

**In:**

- Tile nuevo `4` (`'o'` en `MAZE_STR`) para power pellets.
- Cuatro pellets en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`, presentes una sola vez por partida.
- Comer un pellet da `50` puntos, descuenta de `dotsRemaining` y reinicia el modo asustado a `360` frames.
- Modo asustado: todos los fantasmas activos huyen de Pac-Man a `0.05` celda/frame y se dibujan azules.
- Comer un fantasma asustado da `200`, `400`, `800` y `1600` según el combo de la ventana.
- El fantasma comido desaparece `600` frames y reaparece en su celda inicial de la pen, ya normal.
- Un segundo pellet reinicia el temporizador y el combo.
- Perder una vida no restaura pellets comidos; devuelve a todos los fantasmas a la pen y cancela el modo asustado.

**Fuera de alcance (para specs futuras):**

- Fantasmas comidos volviendo a la pen dibujados como ojos.
- Pellets que reaparezcan dentro de la misma partida.
- Ciclos scatter/chase, delta-time y sonido.
- Indicador textual del tiempo asustado en el HUD.
- Cambios de vidas, velocidad de Pac-Man, laberinto, canvas o `TILE`.
- Cambios en `src/js/main.js` o `src/index.html`.

## Modelo de datos

```js
// maze.js — 'o' se parsea como tile 4
'#o####.#####.##.#####.####o#', // fila 3: pellets en x=1 y x=26
'#o..##................##..o#', // fila 23: pellets en x=1 y x=26
```

```js
// game.js
const POWER_PELLET_POINTS = 50;
const FRIGHTENED_FRAMES = 360;        // 6 s a 60 fps
const FRIGHTENED_GHOST_SPEED = 0.05;  // la mitad de la velocidad normal
const FLASH_FRAMES = 60;              // últimos ~1 s parpadeando
const GHOST_RESPAWN_FRAMES = 600;     // 10 s a 60 fps
const GHOST_EAT_POINTS = [ 200, 400, 800, 1600 ];

// Estado nuevo del juego
game.frightenedUntil = 0; // frame absoluto global, para el combo
game.ghostCombo = 0;

// Estado nuevo de cada fantasma
{
  home: { x, y },        // copia de GHOST_STARTS[ i ]
  state: 'active',       // 'active' | 'eaten'
  frightenedUntil: 0,    // frame absoluto propio
  respawnAt: 0,          // frame absoluto; solo con state 'eaten'
}
```

```js
// render.js
const POWER_PELLET_RADIUS = 5;
const FRIGHTENED_COLOR = '#3b3bff';
const FRIGHTENED_FLASH_COLOR = '#ffffff';
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- `game.frame` solo avanza mientras `state === 'playing'`.
- Un pellet es un dot especial: cuenta para `dotsRemaining` igual que el tile `2`.
- `isFrightened( game, g )` es `g.state === 'active' && game.frame < g.frightenedUntil`.

### Comportamientos

| Estado del fantasma | Velocidad | Movimiento | Dibujo |
| --- | --- | --- | --- |
| `active` normal | `0.1` | IA de SPEC 01 sin cambios | color de su `kind` |
| `active` asustado | `0.05` | huye maximizando distancia Manhattan a Pac-Man, desempate `DIR_ORDER` | azul; blanco intermitente en los últimos `60` frames |
| `eaten` | — | oculto, sin colisión, quieto hasta `respawnAt` | no se dibuja |

- Comer un pellet aplica `frightenedUntil` a todos los fantasmas con `state === 'active'`, incluidos los que esperan en la pen.
- Al comer un fantasma: `GHOST_EAT_POINTS[ Math.min( game.ghostCombo, 3 ) ]`, `ghostCombo++`, `state = 'eaten'`, `respawnAt = frame + 600`.
- Al cumplirse `respawnAt`: vuelve a `active`, `x/y = home`, `dir = 'up'`, `releaseAt = game.frame`, `frightenedUntil = 0`.
- `ghostCombo` vuelve a `0` al comer un pellet y cuando expira `game.frightenedUntil`.
- La pen se sigue atravesando solo al salir; un fantasma asustado dentro de la pen sale a `0.05` y luego huye.

## Plan de implementación

1. En `src/js/maze.js`, añadir `'o' → 4` en `parseTile` y cambiar las filas 3 y 23. En `src/js/render.js`, dibujar el tile `4` como pellet grande y pulsante (pasar `frame` a `drawDots`). Test manual: se ven 4 pellets grandes; Pac-Man pasa por encima y no ocurre nada.
2. En `src/js/game.js`, contar tiles `2` y `4` en `dotsRemaining` y comer el tile `4` por `50` puntos. Test manual: el pellet desaparece, el marcador sube 50 y no se gana la partida si quedan pellets.
3. En `src/js/game.js`, añadir `frightenedUntil`, `ghostCombo`, `frightenedUntil` por fantasma y la activación al comer pellet. Test manual: comer un pellet mantiene la partida funcional y el estado se puede comprobar en la consola.
4. En `src/js/game.js`, aplicar velocidad `0.05` y la huida por máxima distancia Manhattan en `decideGhost` mientras `isFrightened`. Test manual: los fantasmas se mueven más lento y se alejan de Pac-Man.
5. En `src/js/render.js`, pintar de azul a los fantasmas asustados y hacerlos parpadear en blanco los últimos `60` frames. Test manual: el cambio de color y el aviso final son visibles.
6. En `src/js/game.js` y `src/js/render.js`, comer fantasmas: puntos por combo, `state = 'eaten'`, ocultación y no colisión; `render.js` omite los `eaten`. Test manual: el fantasma desaparece y suma 200/400/800/1600.
7. En `src/js/game.js`, reaparecer a los `600` frames y limpiar todo en `resetPositions`: fantasmas a `home`, `state = 'active'`, `frightenedUntil = 0`, `respawnAt = 0`. Test manual: reaparece a los ~10 s; al perder una vida todos vuelven a la pen y los pellets siguen comidos.

`src/js/main.js` y `src/index.html` no cambian.

## Criterios de aceptación

- [ ] Al iniciar una partida hay exactamente 4 power pellets visibles en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Comer un power pellet suma exactamente 50 puntos y lo elimina del `game.grid`.
- [ ] Comer un power pellet descuenta 1 de `dotsRemaining`.
- [ ] La partida solo se gana después de comer los dots normales y los 4 power pellets.
- [ ] Comer un pellet vuelve azules a los 4 fantasmas activos durante 360 frames.
- [ ] Durante el modo asustado los fantasmas se mueven a 0.05 celda/frame.
- [ ] Durante el modo asustado cada fantasma elige la dirección que maximiza la distancia Manhattan a Pac-Man, con desempate `DIR_ORDER`.
- [ ] En los últimos 60 frames del modo asustado los fantasmas parpadean en blanco.
- [ ] Comer fantasmas en una misma ventana suma 200, 400, 800 y 1600 en ese orden.
- [ ] Un fantasma comido desaparece y no puede colisionar con Pac-Man mientras está oculto.
- [ ] Un fantasma comido reaparece a los 600 frames en su celda inicial de la pen, ya sin estado asustado.
- [ ] Comer un segundo pellet reinicia el temporizador a 360 frames y el combo a 200.
- [ ] Al expirar el modo asustado los fantasmas recuperan su color y la IA de SPEC 01.
- [ ] Perder una vida no restaura los pellets ya comidos.
- [ ] Perder una vida devuelve a los 4 fantasmas a la pen y cancela el modo asustado y cualquier reaparición pendiente.
- [ ] Se sigue perdiendo con la tercera colisión y no se pierde vida al comer un fantasma asustado.
- [ ] No aparecen errores en la consola del navegador.

## Decisiones tomadas y descartadas

- **Sí:** pellet como tile `4` en `game.grid`. Reutiliza el flujo de comer, dibujar y contar dots sin una lista paralela.
- **Sí:** pellets en las esquinas clásicas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`. Coinciden con el arcade y ya eran celdas transitables.
- **Sí:** los pellets cuentan para la victoria. Evita que Pac-Man gane dejando 200 puntos sin comer.
- **Sí:** una sola aparición por partida. El usuario lo pidió explícitamente y no se restauran al perder una vida.
- **Sí:** 360 frames de modo asustado. Ventana clásica, suficiente para 1-2 fantasmas.
- **Sí:** `0.05` celda/frame para los asustados. Pac-Man (`0.125`) los alcanza y se siente fiel al arcade.
- **Sí:** huida maximizando distancia Manhattan con desempate `DIR_ORDER`. Reutiliza la elección de dirección actual.
- **Sí:** temporizador por fantasma además del global. Permite que un fantasma recién reaparecido no herede el estado asustado.
- **Sí:** ocultar 600 frames y reaparecer en la pen. Es simple y cumple el respawn de 10 s pedido.
- **Sí:** combo 200/400/800/1600 que reinicia con cada pellet. Premia comerse varios en una sola ventana.
- **Sí:** azul `#3b3bff` en lugar del `#2121ff` de las paredes. Evita que el fantasma se confunda con el laberinto.
- **No:** ojos caminando a la pen. Más fiel, pero añade una IA de regreso que no aporta al objetivo.
- **No:** HUD con segundos restantes. El parpadeo final ya comunica el estado.
- **No:** pellets que reaparezcan por tiempo o por vida. Contradice "solo aparecen de nuevo por partida".
- **No:** delta-time. La simulación del proyecto es por frames y cambiarla excede esta spec.
- **No:** scatter/chase, sonido o cambios de laberinto. Cada uno va en su propia spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Las duraciones están en frames: a 144 Hz, 600 frames son ~4 s reales, no 10 s. | Se acepta la convención del proyecto; delta-time queda fuera de alcance y se abordaría en otra spec. |
| Olvidar contar el tile `4` en `dotsRemaining` provoca victoria con pellets sin comer. | Criterio de aceptación explícito y conteo `v === 2 \|\| v === 4` en `createGame`. |
| Un fantasma podría reaparecer todavía asustado si se usa solo el temporizador global. | Cada fantasma tiene su `frightenedUntil`; al reaparecer se fuerza a `0`. |
| Un fantasma oculto durante 10 s reduce la dificultad. | Se mantienen 3 vidas; el balance se ajusta en otra spec si hace falta. |
| Comer varios fantasmas en el mismo frame puede desordenar el combo. | Se recorre `game.ghosts` en orden estable y cada fantasma comido incrementa `ghostCombo` una sola vez. |
| Cambiar la velocidad a mitad de celda puede desalinear al fantasma. | `aligned()` sigue corrigiendo en cada centro de celda; `0.05` alinea cada 20 frames. |

## Lo que **no** está en esta spec

- Animación de ojos volviendo a la pen.
- Power pellets que reaparezcan durante la partida.
- Temporizador asustado visible en el HUD.
- Ciclos scatter/chase, delta-time y sonido.
- Cambios de vidas, velocidad de Pac-Man, laberinto, canvas o `TILE`.
- Cambios en `src/js/main.js` o `src/index.html`.

Cada uno de esos, si llega, va en su propia spec.

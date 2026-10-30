# SPEC 01 — Cuatro fantasmas con personalidades propias

> **Estado:** Approved
> **Depende de:** Ninguna
> **Fecha:** 2026-10-30
> **Objetivo:** Reemplazar los 2 fantasmas actuales por 4 con IA distinta y salida escalonada, donde uno persigue agresivamente a Pac-Man.

## Por qué existe esta spec

Hoy el juego tiene 2 fantasmas (`hunter` y `random`) que se sienten planos: uno siempre persigue y el otro deambula. El objetivo es que el jugador pueda reconocer a cada fantasma por su forma de moverse, sin añadir power-ups ni modos clásicos de scatter/chase. La complejidad se concentra en `decideGhost` y en la salida de la pen, no en el resto del juego.

## Alcance

**In:**

- Cuatro fantasmas definidos en `GHOST_STARTS` con `kind`: `chaser`, `ambusher`, `flanker`, `shy`.
- Posiciones iniciales en bloque 2x2 dentro de la pen: `(13,14)`, `(14,14)`, `(13,13)`, `(14,13)`.
- Salida escalonada por frames: `0`, `120`, `240`, `360` (≈0/2/4/6 s a 60 fps).
- IA por objetivo (target) con desempate determinista.
- Prohibición de reentrada a la pen tras salir.
- Colores clásicos por rol en `render.js`.
- Reinicio de posiciones y de retardos al perder una vida.
- Eliminación de los `kind` `hunter` y `random`.

**Fuera de alcance (para specs futuras):**

- Power pellets y modo asustado (fantasmas comestibles).
- Ciclos scatter/chase alternados.
- Animación de rebote dentro de la pen.
- Cambios de vidas, puntuación o velocidad de Pac-Man.
- Cambios de laberinto, canvas o `TILE`.
- Sonido, móvil o multijugador.

## Modelo de datos

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'chaser' },
  { x: 14, y: 14, kind: 'ambusher' },
  { x: 13, y: 13, kind: 'flanker' },
  { x: 14, y: 13, kind: 'shy' },
];
```

```js
// game.js
const RELEASE_DELAYS = [ 0, 120, 240, 360 ]; // frames, mismo orden que GHOST_STARTS
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ];
const PEN = { x0: 11, x1: 16, y0: 12, y1: 15 };
const SHY_DISTANCE = 8;
const SHY_CORNER = { x: 1, y: 29 };

// Estado nuevo del juego
game.frame = 0;

// Estado nuevo de cada fantasma
{
  x, y, dir: 'up', speed: 0.1, kind, releaseAt,
}
```

```js
// render.js
const GHOST_COLORS = {
  chaser: '#ff0000',   // rojo
  ambusher: '#ffb8ff', // rosa
  flanker: '#00ffff',  // cian
  shy: '#ffb852',      // naranja
};
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- `game.frame` avanza solo mientras `state === 'playing'`.
- `releaseAt` se calcula como `game.frame + RELEASE_DELAYS[i]` al crear la partida y al reiniciar posiciones.

### Comportamientos

Todos eligen entre las direcciones válidas que no sean la opuesta a la actual. Si no hay ninguna, revierten 180° (comportamiento actual). La distancia es Manhattan desde la celda candidata hasta el objetivo.

| `kind` | Objetivo |
| --- | --- |
| `chaser` | Celda actual de Pac-Man. Perseguidor agresivo: siempre la ruta más corta, a la misma velocidad que los demás. |
| `ambusher` | Celda de Pac-Man más 4 veces su dirección actual. |
| `flanker` | `pivot = pacman + 2 * dirPacman`; `target = 2 * pivot - posicionDelChaser`. Usa la posición del primer fantasma (`chaser`). |
| `shy` | Si la distancia Manhattan al Pac-Man es mayor que `8`, persigue a Pac-Man; si es `<= 8`, huye a `(1,29)` (abajo-izquierda). |

Desempate: se recorre `DIR_ORDER` y gana la primera dirección con la distancia mínima.

## Plan de implementación

1. En `src/js/maze.js`, sustituir los 2 `GHOST_STARTS` por los 4 del modelo de datos. Test manual: el juego sigue arrancando; los 4 fantasmas usan temporalmente la rama aleatoria porque sus `kind` aún no están implementados.
2. En `src/js/game.js`, añadir las constantes `RELEASE_DELAYS`, `DIR_ORDER`, `PEN`, `SHY_DISTANCE` y `SHY_CORNER`, más `frame: 0` en `createGame()` y `releaseAt` en cada fantasma. Test manual: la partida funciona igual que antes.
3. En `src/js/game.js`, implementar la salida de la pen: un fantasma espera inmóvil hasta `game.frame >= releaseAt` y, mientras esté en `PEN`, avanza forzado hacia arriba. Tratar la puerta (`tile 3`) como muro para fantasmas ya fuera, salvo durante la salida. Test manual: los 4 salen escalonados y ninguno vuelve a entrar.
4. En `src/js/game.js`, reemplazar `decideGhost` por una función de objetivo por `kind` y una elección de dirección con desempate `DIR_ORDER`. Test manual: cada fantasma muestra un patrón reconocible.
5. En `src/js/game.js`, incrementar `game.frame` al inicio de `update()` y recalcular `releaseAt` en `resetPositions()` usando el frame actual. Test manual: al perder una vida, los 4 reaparecen en la pen con los retardos reaplicados.
6. En `src/js/render.js`, convertir `GHOST_COLORS` en un objeto indexado por `kind` y dibujar con `GHOST_COLORS[ g.kind ]`. Test manual: rojo, rosa, cian y naranja según el rol.

`src/js/main.js` e `index.html` no cambian.

## Criterios de aceptación

- [ ] Al iniciar una partida hay exactamente 4 fantasmas en pantalla.
- [ ] Los fantasmas aparecen en `(13,14)`, `(14,14)`, `(13,13)` y `(14,13)`.
- [ ] Salen de la pen en el orden `chaser`, `ambusher`, `flanker`, `shy` con retardos aproximados de 0, 2, 4 y 6 segundos.
- [ ] Ningún fantasma se queda atascado dentro de la pen.
- [ ] En una celda con varias salidas, el `chaser` elige la que deja menor distancia Manhattan a Pac-Man; con empate gana arriba, izquierda, abajo y luego derecha.
- [ ] El `ambusher` apunta a la celda que está 4 posiciones delante de Pac-Man según su dirección.
- [ ] El `flanker` calcula su objetivo usando la posición del `chaser`.
- [ ] El `shy` persigue cuando está a más de 8 celdas y se retira a `(1,29)` cuando está a 8 o menos.
- [ ] Ningún fantasma vuelve a entrar a la pen después de salir.
- [ ] Los colores son rojo (`chaser`), rosa (`ambusher`), cian (`flanker`) y naranja (`shy`).
- [ ] Al perder una vida, los 4 fantasmas vuelven a sus posiciones iniciales y se reaplican los retardos.
- [ ] Se sigue perdiendo con la tercera colisión y se sigue ganando al comer todos los dots.
- [ ] No aparecen errores en la consola del navegador.

## Decisiones tomadas y descartadas

- **Sí:** personalidades fijas por fantasma. Es predecible y suficiente para que se sientan distintos.
- **No:** ciclos scatter/chase. Añaden estado temporal y quedan para otra spec.
- **Sí:** los 4 empiezan dentro de la pen con salida escalonada. Evita que se apilen y da tiempo de reacción.
- **Sí:** el `chaser` usa la misma velocidad (`0.1` celda/frame) y la ruta más corta. La agresividad viene de la IA, no de una ventaja de velocidad injusta.
- **Sí:** prohibir la reentrada a la pen. La puerta solo sirve para salir; así la IA no se encierra persiguiendo objetivos inalcanzables.
- **Sí:** desempate en orden arriba, izquierda, abajo, derecha. Hace el movimiento determinista y fiel al arcade.
- **Sí:** nombres de `kind` por comportamiento (`chaser`, `ambusher`, `flanker`, `shy`). Describen la IA sin depender del color.
- **Sí:** colores clásicos por rol. El jugador identifica al perseguidor de un vistazo.
- **Sí:** mantener 3 vidas. El aumento de dificultad es parte del objetivo y se puede ajustar en otra spec.
- **No:** power pellets, modo asustado, delta-time y animación de rebote en la pen. Cada uno merece su propia spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La IA puede quedar en bucle en callejones sin salida. | Se conserva el fallback actual: si no hay direcciones válidas, gira 180°. |
| Cuatro fantasmas con 3 vidas pueden hacer la partida demasiado difícil. | Se mantiene el alcance; si hace falta, se ajusta en una spec de balance. |
| Las constantes de `PEN` dependen de la geometría actual del laberinto. | Si cambia el laberinto, actualizar `PEN` en el mismo cambio. |
| El `flanker` depende del `chaser`; si se reordena `GHOST_STARTS`, cambia la referencia. | La spec fija `chaser` como primer elemento y la implementación lo busca por `kind`, no por índice. |

## Lo que **no** está en esta spec

- Power pellets y fantasmas asustados/comestibles.
- Alternancia scatter/chase.
- Rebote o animación dentro de la pen.
- Cambios de laberinto, dimensiones del canvas, vidas o puntuación.
- Sonido, móvil o multijugador.

Cada uno de esos, si llega, va en su propia spec.

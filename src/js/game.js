// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const POWER_PELLET_POINTS = 50;
const FRIGHTENED_FRAMES = 360;        // 6 s a 60 fps
const FRIGHTENED_GHOST_SPEED = 0.05;  // la mitad de la velocidad normal
const GHOST_RESPAWN_FRAMES = 600;     // 10 s a 60 fps
const GHOST_EAT_POINTS = [ 200, 400, 800, 1600 ];

// Salida escalonada de la pen: frames de espera, en el mismo orden que GHOST_STARTS.
const RELEASE_DELAYS = [ 0, 120, 240, 360 ];
// Orden de desempate al elegir direccion: arriba, izquierda, abajo, derecha.
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ];
// Caja de la pen (interior transitable) para forzar la salida hacia arriba.
const PEN = { x0: 11, x1: 16, y0: 12, y1: 15 };
// El shy persigue a mas de SHY_DISTANCE celdas y huye a SHY_CORNER si esta cerca.
const SHY_DISTANCE = 8;
const SHY_CORNER = { x: 1, y: 29 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    frame: 0,
    dotsRemaining: dots,
    frightenedUntil: 0,
    ghostCombo: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: RELEASE_DELAYS[ i ],
      home: { x: g.x, y: g.y },
      state: 'active',
      frightenedUntil: 0,
      respawnAt: 0,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta (3) solo se cruza al salir de la pen
function isWall( grid, x, y, actor, allowDoor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && ( actor === 'pacman' || !allowDoor ) ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor, allowDoor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor, allowDoor );
}

// Esta el fantasma dentro de la caja de la pen?
function inPen( g ) {
  return g.x >= PEN.x0 && g.x <= PEN.x1 && g.y >= PEN.y0 && g.y <= PEN.y1;
}

function isFrightened( game, g ) {
  return g.state === 'active' && game.frame < g.frightenedUntil;
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 || tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += tile === 4 ? POWER_PELLET_POINTS : 10;
      game.dotsRemaining--;
      if ( tile === 4 ) {
        game.frightenedUntil = game.frame + FRIGHTENED_FRAMES;
        game.ghostCombo = 0;
        for ( const g of game.ghosts ) {
          if ( g.state === 'active' ) g.frightenedUntil = game.frightenedUntil;
        }
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo (target) de cada fantasma segun su kind.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || { x: 0, y: 0 };

  if ( g.kind === 'chaser' ) {
    return { x: px, y: py };
  }
  if ( g.kind === 'ambusher' ) {
    return { x: px + 4 * pd.x, y: py + 4 * pd.y };
  }
  if ( g.kind === 'flanker' ) {
    const chaser = game.ghosts.find( ( h ) => h.kind === 'chaser' );
    const pivot = { x: px + 2 * pd.x, y: py + 2 * pd.y };
    const cx = chaser ? Math.round( chaser.x ) : px;
    const cy = chaser ? Math.round( chaser.y ) : py;
    return { x: 2 * pivot.x - cx, y: 2 * pivot.y - cy };
  }
  // shy: persigue de lejos, huye a la esquina cuando esta cerca.
  const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
  if ( dist > SHY_DISTANCE ) return { x: px, y: py };
  return { x: SHY_CORNER.x, y: SHY_CORNER.y };
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const frightened = isFrightened( game, g );
  const target = frightened
    ? { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) }
    : ghostTarget( game, g );

  const options = DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost', false )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  // DIR_ORDER ya fija el desempate: gana la primera direccion con distancia extrema.
  let best = choices[ 0 ];
  let bestDist = frightened ? -Infinity : Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( frightened ? dist > bestDist : dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  if ( g.state === 'eaten' ) return;

  const grid = game.grid;
  const width = grid[ 0 ].length;
  const speed = isFrightened( game, g ) ? FRIGHTENED_GHOST_SPEED : g.speed;

  // Dentro de la pen: espera su turno y sale forzado hacia arriba.
  if ( inPen( g ) ) {
    if ( game.frame < g.releaseAt ) return; // inmóvil hasta su releaseAt
    if ( aligned( g.x ) && aligned( g.y ) ) {
      g.x = Math.round( g.x );
      g.y = Math.round( g.y );
      g.dir = 'up';
      // La puerta se cruza solo en este tramo (allowDoor).
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', true ) ) return;
    }
    const d = DIRS[ g.dir ];
    g.x += d.x * speed;
    g.y += d.y * speed;
    wrapTunnel( g, width );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', false ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frightenedUntil = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = g.home.x;
    g.y = g.home.y;
    g.dir = 'up';
    g.releaseAt = game.frame + RELEASE_DELAYS[ i ];
    g.state = 'active';
    g.frightenedUntil = 0;
    g.respawnAt = 0;
  } );
}

function respawnGhost( game, g ) {
  g.state = 'active';
  g.x = g.home.x;
  g.y = g.home.y;
  g.dir = 'up';
  g.releaseAt = game.frame;
  g.frightenedUntil = 0;
  g.respawnAt = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;

  if ( game.frightenedUntil > 0 && game.frame >= game.frightenedUntil ) {
    game.frightenedUntil = 0;
    game.ghostCombo = 0;
  }

  for ( const g of game.ghosts ) {
    if ( g.state === 'eaten' && game.frame >= g.respawnAt ) respawnGhost( game, g );
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( g.state === 'eaten' || !collides( game.pacman, g ) ) continue;

    if ( isFrightened( game, g ) ) {
      game.score += GHOST_EAT_POINTS[ Math.min( game.ghostCombo, 3 ) ];
      game.ghostCombo++;
      g.state = 'eaten';
      g.respawnAt = game.frame + GHOST_RESPAWN_FRAMES;
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;

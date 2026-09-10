import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Game2048.css';

/* ============================================================
   CORRECT 2048 LOGIC — Based on Gabriele Cirulli's original
   Rules:
   - 4×4 grid (also 5×5, 6×6 selectable)
   - Tiles slide in one direction, compressing to that edge
   - Adjacent equal tiles MERGE into their sum (once per move)
   - After each valid move, a new tile (2 or 4) spawns
     at a RANDOM empty cell anywhere on the board
   - Win = 2048 tile created
   - Game Over = no valid moves remain
   ============================================================ */

const TILE_COLORS = {
  2:    { bg: '#1a2b3c', border: '#38bdf8', text: '#38bdf8' },
  4:    { bg: '#1a2c2e', border: '#22d3ee', text: '#22d3ee' },
  8:    { bg: '#1a2c20', border: '#34d399', text: '#34d399' },
  16:   { bg: '#2c2a10', border: '#fbbf24', text: '#fbbf24' },
  32:   { bg: '#2c1f10', border: '#fb923c', text: '#fb923c' },
  64:   { bg: '#2c1212', border: '#f87171', text: '#f87171' },
  128:  { bg: '#2a1020', border: '#f472b6', text: '#f472b6' },
  256:  { bg: '#260c28', border: '#e879f9', text: '#e879f9' },
  512:  { bg: '#1e1040', border: '#a78bfa', text: '#a78bfa' },
  1024: { bg: '#111840', border: '#818cf8', text: '#c7d2fe' },
  2048: { bg: '#3d3000', border: '#fde047', text: '#fef08a' },
};

/* ── Core Engine ── */

function createGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function getEmptyCells(grid, size) {
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

/* Add a random tile (90% = 2, 10% = 4) at a random empty cell */
function addRandomTile(grid, size) {
  const empties = getEmptyCells(grid, size);
  if (empties.length === 0) return { grid, pos: null };
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const val = Math.random() < 0.9 ? 2 : 4;
  const newGrid = cloneGrid(grid);
  newGrid[r][c] = val;
  return { grid: newGrid, pos: [r, c] };
}

/*
  Slide a single row LEFT:
  1) Remove all zeros
  2) Merge adjacent equal pairs (left-to-right, each tile merges at most once)
  3) Pad with zeros on the right
  Returns { row, score, changed }
*/
function slideLeft(row) {
  const size = row.length;
  // Step 1: compact
  let arr = row.filter(v => v !== 0);
  let score = 0;

  // Step 2: merge
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      score += arr[i];
      arr[i + 1] = 0;
      i++; // skip merged tile so it won't merge again
    }
  }

  // Step 3: compact again
  arr = arr.filter(v => v !== 0);

  // Pad zeros
  while (arr.length < size) arr.push(0);

  const changed = arr.some((v, i) => v !== row[i]);
  return { row: arr, score, changed };
}

/*
  Execute a move in any of the 4 directions by rotating/transposing the grid
  so we always slide LEFT, then rotating back.
*/
function executeMove(grid, direction, size) {
  let g = cloneGrid(grid);
  let totalScore = 0;
  let moved = false;

  // Helpers
  const transpose = (m) => m[0].map((_, c) => m.map(row => row[c]));
  const reverseRows = (m) => m.map(row => [...row].reverse());

  // Transform to slide-left orientation
  if (direction === 'RIGHT') g = reverseRows(g);
  else if (direction === 'UP') g = transpose(g);
  else if (direction === 'DOWN') { g = transpose(g); g = reverseRows(g); }

  // Slide every row left
  g = g.map(row => {
    const { row: newRow, score, changed } = slideLeft(row);
    totalScore += score;
    if (changed) moved = true;
    return newRow;
  });

  // Transform back
  if (direction === 'RIGHT') g = reverseRows(g);
  else if (direction === 'UP') g = transpose(g);
  else if (direction === 'DOWN') { g = reverseRows(g); g = transpose(g); }

  return { grid: g, score: totalScore, moved };
}

function hasValidMoves(grid, size) {
  // Any empty cell?
  if (getEmptyCells(grid, size).length > 0) return true;
  // Any adjacent equal tiles?
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (r + 1 < size && grid[r + 1][c] === v) return true;
      if (c + 1 < size && grid[r][c + 1] === v) return true;
    }
  }
  return false;
}

function getMaxTile(grid, size) {
  let max = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] > max) max = grid[r][c];
  return max;
}

/* ── AI: Simple greedy + expectimax-lite ── */
function evaluate(grid, size) {
  const empties = getEmptyCells(grid, size).length;
  let monotonicity = 0;
  let merges = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 1; c++) {
      if (grid[r][c] === grid[r][c + 1]) merges++;
      if (grid[r][c] >= grid[r][c + 1]) monotonicity++;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size - 1; r++) {
      if (grid[r][c] === grid[r + 1][c]) merges++;
      if (grid[r][c] >= grid[r + 1][c]) monotonicity++;
    }
  }

  // Weight top-left corner heavily (snake strategy)
  const cornerBonus = grid[0][0] === getMaxTile(grid, size) ? grid[0][0] * 3 : 0;

  return empties * 100 + merges * 50 + monotonicity * 20 + cornerBonus;
}

function getBestMove(grid, size) {
  const DIRS = ['UP', 'LEFT', 'RIGHT', 'DOWN'];
  let best = null;
  let bestScore = -Infinity;

  for (const dir of DIRS) {
    const res = executeMove(grid, dir, size);
    if (!res.moved) continue;
    // One-level lookahead: add random tile, evaluate
    const empties = getEmptyCells(res.grid, size);
    let lookahead = 0;
    if (empties.length > 0) {
      const sample = empties.slice(0, Math.min(4, empties.length));
      for (const [r, c] of sample) {
        const g2 = cloneGrid(res.grid);
        g2[r][c] = 2;
        lookahead += evaluate(g2, size);
      }
      lookahead /= sample.length;
    }
    const total = evaluate(res.grid, size) + lookahead * 0.5 + res.score * 2;
    if (total > bestScore) { bestScore = total; best = dir; }
  }
  return best;
}

/* ── React Component ── */
export default function Game2048() {
  const SIZE_OPTIONS = [4, 5, 6];
  const [gridSize, setGridSize] = useState(4);

  const makeInitialState = (size) => {
    let { grid } = addRandomTile(createGrid(size), size);
    const r2 = addRandomTile(grid, size);
    return r2.grid;
  };

  const [grid, setGrid] = useState(() => makeInitialState(4));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() =>
    parseInt(localStorage.getItem('g2048_best') || '0', 10)
  );
  const [history, setHistory] = useState([]); // [{grid, score}]
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const [newTilePos, setNewTilePos] = useState(null);   // [r,c] for spawn animation
  const [mergedCells, setMergedCells] = useState([]);   // [[r,c],...] for merge pulse
  const [aiHint, setAiHint] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(300);
  const [hintPulse, setHintPulse] = useState(false);

  const autoRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ dragging: false, x: 0, y: 0 });
  const processingRef = useRef(false);

  // Persist best
  useEffect(() => {
    if (score > best) {
      setBest(score);
      localStorage.setItem('g2048_best', String(score));
    }
  }, [score, best]);

  // Compute AI hint
  useEffect(() => {
    if (gameOver) { setAiHint(null); return; }
    setAiHint(getBestMove(grid, gridSize));
  }, [grid, gameOver, gridSize]);

  // ── Core move handler ──
  const doMove = useCallback((dir) => {
    if (processingRef.current || gameOver) return;

    setGrid(prev => {
      const res = executeMove(prev, dir, gridSize);
      if (!res.moved) return prev;

      processingRef.current = true;

      // Track merged positions for animation
      const mergedPositions = [];
      for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
          if (res.grid[r][c] > prev[r][c] && prev[r][c] !== 0)
            mergedPositions.push([r, c]);
      setMergedCells(mergedPositions);
      setTimeout(() => setMergedCells([]), 200);

      // Save undo state
      setHistory(h => [...h.slice(-8), { grid: prev, score }]);

      // Update score
      setScore(s => s + res.score);

      // Spawn new tile
      const { grid: nextGrid, pos } = addRandomTile(res.grid, gridSize);
      setNewTilePos(pos);
      setTimeout(() => { setNewTilePos(null); processingRef.current = false; }, 180);

      // Check win
      if (!keepGoing && getMaxTile(nextGrid, gridSize) >= 2048) {
        setWon(true);
      }
      // Check game over
      if (!hasValidMoves(nextGrid, gridSize)) {
        setGameOver(true);
        setAutoPlay(false);
      }

      return nextGrid;
    });
  }, [gameOver, gridSize, keepGoing, score]);

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
        W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT',
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  // ── Touch Swipe ──
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const dir = resolveSwipe(dx, dy);
    if (dir) doMove(dir);
  };

  // ── Mouse Drag Swipe ──
  const onMouseDown = (e) => {
    e.preventDefault();
    mouseRef.current = { dragging: true, x: e.clientX, y: e.clientY };
  };
  const onMouseUp = (e) => {
    if (!mouseRef.current.dragging) return;
    const dx = e.clientX - mouseRef.current.x;
    const dy = e.clientY - mouseRef.current.y;
    mouseRef.current.dragging = false;
    const dir = resolveSwipe(dx, dy);
    if (dir) doMove(dir);
  };
  const onMouseLeave = (e) => {
    if (!mouseRef.current.dragging) return;
    const dx = e.clientX - mouseRef.current.x;
    const dy = e.clientY - mouseRef.current.y;
    mouseRef.current.dragging = false;
    const dir = resolveSwipe(dx, dy);
    if (dir) doMove(dir);
  };

  function resolveSwipe(dx, dy) {
    const MIN = 28;
    if (Math.hypot(dx, dy) < MIN) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'RIGHT' : 'LEFT';
    return dy > 0 ? 'DOWN' : 'UP';
  }

  // ── Auto-Play ──
  useEffect(() => {
    if (autoPlay && !gameOver) {
      autoRef.current = setInterval(() => {
        const dir = getBestMove(grid, gridSize);
        if (dir) doMove(dir);
        else { setAutoPlay(false); }
      }, autoSpeed);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoPlay, autoSpeed, gameOver, grid, gridSize, doMove]);

  // ── Actions ──
  const newGame = (size = gridSize) => {
    setGrid(makeInitialState(size));
    setScore(0);
    setHistory([]);
    setGameOver(false);
    setWon(false);
    setKeepGoing(false);
    setAutoPlay(false);
    setNewTilePos(null);
    processingRef.current = false;
  };

  const changeSize = (size) => {
    setGridSize(size);
    newGame(size);
  };

  const undo = () => {
    if (history.length === 0 || autoPlay) return;
    const last = history[history.length - 1];
    setGrid(last.grid);
    setScore(last.score);
    setHistory(h => h.slice(0, -1));
    setGameOver(false);
    processingRef.current = false;
  };

  const applyHint = () => {
    if (!aiHint || gameOver) return;
    setHintPulse(true);
    setTimeout(() => setHintPulse(false), 350);
    doMove(aiHint);
  };

  const highestTile = getMaxTile(grid, gridSize);

  const DIR_ICON = { UP: '⬆', DOWN: '⬇', LEFT: '⬅', RIGHT: '➡' };

  return (
    <div className="g2048-page">
      <div className="g2048-blob g2048-blob-1" />
      <div className="g2048-blob g2048-blob-2" />

      <div className="g2048-nav">
        <Link to="/" className="back-btn" id="btn-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dashboard
        </Link>
      </div>

      <div className="g2048-layout">
        {/* ── Sidebar ── */}
        <aside className="g2048-sidebar">
          <div className="sidebar-card">
            <h1 className="sidebar-title"><span>🧩</span> 2048</h1>
            <p className="sidebar-desc">
              Swipe or drag the board to slide all tiles. Equal tiles merge into their sum. Reach the <strong>2048</strong> tile to win!
            </p>

            {/* Grid Size */}
            <div className="section-block">
              <div className="section-block-label">GRID SIZE</div>
              <div className="size-buttons">
                {SIZE_OPTIONS.map(s => (
                  <button
                    key={s}
                    id={`btn-size-${s}`}
                    className={`size-btn ${gridSize === s ? 'active' : ''}`}
                    onClick={() => changeSize(s)}
                  >
                    {s}×{s}
                  </button>
                ))}
              </div>
            </div>

            {/* Scores */}
            <div className="score-boxes">
              <div className="score-box score-current">
                <span className="score-lbl">SCORE</span>
                <span className="score-val" id="current-score">{score.toLocaleString()}</span>
              </div>
              <div className="score-box score-best">
                <span className="score-lbl">BEST</span>
                <span className="score-val" id="best-score">{best.toLocaleString()}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <div className="stat-pill"><span className="sp-label">MOVES</span><span className="sp-val">{history.length}</span></div>
              <div className="stat-pill"><span className="sp-label">HIGHEST</span><span className="sp-val sp-high">{highestTile}</span></div>
            </div>

            {/* AI Next Move */}
            <div className="ai-box">
              <div className="ai-box-top">
                <span className="ai-label">✨ AI Suggestion</span>
                <span className="ai-engine">Lookahead AI</span>
              </div>
              <div className="ai-box-body">
                <div className="ai-dir">
                  <span className="ai-arrow">{aiHint ? DIR_ICON[aiHint] : '—'}</span>
                  <span className="ai-name">{aiHint || 'Computing...'}</span>
                </div>
                <button
                  id="btn-ai-hint"
                  className={`btn-hint ${hintPulse ? 'hint-pulse' : ''}`}
                  onClick={applyHint}
                  disabled={!aiHint || gameOver}
                >
                  ⚡ Play
                </button>
              </div>
            </div>

            {/* Auto-play */}
            <div className="auto-box">
              <div className="auto-row">
                <div>
                  <div className="autoplay-title">🤖 Auto-Play</div>
                  <div className="autoplay-sub">{autoPlay ? 'AI is playing…' : 'AI solves automatically'}</div>
                </div>
                <button
                  id="btn-autoplay"
                  className={`btn-autoplay ${autoPlay ? 'active' : ''}`}
                  onClick={() => setAutoPlay(a => !a)}
                >
                  {autoPlay ? '⏹ Stop' : '▶ Start'}
                </button>
              </div>
              {autoPlay && (
                <div className="speed-row">
                  <span className="speed-lbl">Speed:</span>
                  {[['Slow', 500], ['Fast', 200], ['Turbo', 60]].map(([label, ms]) => (
                    <button
                      key={label}
                      className={`speed-btn ${autoSpeed === ms ? 'active' : ''}`}
                      onClick={() => setAutoSpeed(ms)}
                    >{label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            {/* Actions */}
            <div className="action-row">
              <button id="btn-new-game" className="btn-primary" onClick={() => newGame(gridSize)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                </svg>
                New Game
              </button>
              <button
                id="btn-undo"
                className="btn-secondary"
                onClick={undo}
                disabled={history.length === 0 || autoPlay}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="15" height="15">
                  <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
                Undo ({history.length})
              </button>
            </div>
          </div>
        </aside>

        {/* ── Board ── */}
        <main className="g2048-main">
          <div className="g2048-board-topbar">
            <div className="g2048-board-badge">
              <span className="badge-target">Target: <strong>2048</strong></span>
              <span className="badge-size">{gridSize}×{gridSize}</span>
            </div>
            <div className="g2048-board-hint-text">
              🖐️ Swipe / Drag &nbsp;·&nbsp; ⌨️ Arrow Keys / WASD
            </div>
          </div>

          {/* Game Board */}
          <div
            className="g2048-board"
            style={{ '--n': gridSize }}
            id="g2048-board"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
          >
            {/* Background cells */}
            {Array(gridSize * gridSize).fill(0).map((_, i) => (
              <div key={i} className="g2048-cell-bg" />
            ))}

            {/* Tiles */}
            {grid.map((row, r) =>
              row.map((val, c) => {
                if (val === 0) return null;
                const isNew = newTilePos && newTilePos[0] === r && newTilePos[1] === c;
                const isMerged = mergedCells.some(([mr, mc]) => mr === r && mc === c);
                return (
                  <div
                    key={`tile-${r}-${c}`}
                    className={`g2048-tile ${isNew ? 'g2048-tile-new' : ''} ${isMerged ? 'g2048-tile-merged' : ''}`}
                    style={{
                      '--r': r,
                      '--c': c,
                      '--n': gridSize,
                      background: TILE_COLORS[val]?.bg ?? '#1a1a3a',
                      borderColor: TILE_COLORS[val]?.border ?? '#7c3aed',
                      color: TILE_COLORS[val]?.text ?? '#f1f5f9',
                      boxShadow: val >= 512
                        ? `0 0 20px ${TILE_COLORS[val]?.border ?? '#7c3aed'}80, 0 0 6px ${TILE_COLORS[val]?.border ?? '#7c3aed'}40`
                        : `0 2px 8px rgba(0,0,0,0.35)`,
                      fontSize: val >= 1024
                        ? `calc((1.4rem - (var(--n) - 4) * 0.15rem) * 0.75)`
                        : val >= 128
                          ? `calc(1.5rem - (var(--n) - 4) * 0.18rem)`
                          : `calc(1.9rem - (var(--n) - 4) * 0.22rem)`,
                    }}
                  >
                    {val}
                  </div>
                );
              })
            )}

            {/* Win Overlay */}
            {won && !keepGoing && (
              <div className="g2048-board-overlay overlay-win">
                <div className="overlay-card">
                  <div className="overlay-badge win-badge">🎉 YOU WIN!</div>
                  <h2 className="overlay-heading">You reached 2048!</h2>
                  <p className="overlay-sub">Keep going for a higher score or start over.</p>
                  <div className="overlay-btns">
                    <button className="btn-overlay-primary" onClick={() => { setWon(false); setKeepGoing(true); }}>🚀 Keep Going</button>
                    <button className="btn-overlay-secondary" onClick={() => newGame(gridSize)}>🔄 New Game</button>
                  </div>
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && (
              <div className="g2048-board-overlay overlay-over">
                <div className="overlay-card">
                  <div className="overlay-badge over-badge">💀 GAME OVER</div>
                  <h2 className="overlay-heading">No more moves!</h2>
                  <p className="overlay-sub">Score: <strong>{score.toLocaleString()}</strong> · Best Tile: <strong>{highestTile}</strong></p>
                  <div className="overlay-btns">
                    <button className="btn-overlay-primary" onClick={() => newGame(gridSize)}>🔄 Play Again</button>
                    {history.length > 0 && (
                      <button className="btn-overlay-secondary" onClick={undo}>↩ Undo</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="g2048-board-footer">
            <span>Swipe any direction to slide all tiles &nbsp;·&nbsp; Equal tiles merge &nbsp;·&nbsp; Reach <strong>2048</strong>!</span>
          </div>
        </main>
      </div>
    </div>
  );
}

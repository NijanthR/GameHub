import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LEVEL_PACKS,
  FLOW_COLORS,
  COLOR_MAP,
  solveFlowPuzzle,
  generateRandomFlowPuzzle,
  getFlowProgress,
  saveFlowLevelProgress
} from '../utils/flowPuzzles';
import {
  playFlowDrawSound,
  playFlowConnectSound,
  playFlowDisconnectSound,
  playLevelCompleteSound
} from '../utils/soundEffects';
import { recordFlowOutcome } from '../utils/statsService';
import './FlowPuzzle.css';

export default function FlowPuzzle() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';

  // Pack & Level Selection
  const [currentPackIndex, setCurrentPackIndex] = useState(0);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [randomPuzzle, setRandomPuzzle] = useState(null);

  // Active level data
  const currentPack = LEVEL_PACKS[currentPackIndex];
  const activeLevel = isRandomMode && randomPuzzle
    ? randomPuzzle
    : (currentPack.levels[currentLevelIndex] || currentPack.levels[0]);

  const gridSize = activeLevel.size;
  const pairs = activeLevel.pairs;

  // Board State
  // paths: { [colorId]: [{ r, c }, ...] }
  const [paths, setPaths] = useState({});
  const [history, setHistory] = useState([]); // for undo
  const [movesCount, setMovesCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);

  // Drawing state
  const [activeDrawingColor, setActiveDrawingColor] = useState(null);
  const isPointerDownRef = useRef(false);
  const boardRef = useRef(null);

  // Modals & Options
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [victoryStats, setVictoryStats] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hintPath, setHintPath] = useState(null); // { color, path }
  const [progressData, setProgressData] = useState(getFlowProgress());

  // Confetti particles for victory
  const [confetti, setConfetti] = useState([]);

  // ── Helper: Map endpoints for quick lookup ──
  const endpointMap = useRef(new Map());
  useEffect(() => {
    const map = new Map();
    pairs.forEach((p) => {
      map.set(`${p.p1.r},${p.p1.c}`, { color: p.color, isEndpoint: true, pair: p });
      map.set(`${p.p2.r},${p.p2.c}`, { color: p.color, isEndpoint: true, pair: p });
    });
    endpointMap.current = map;
  }, [pairs]);

  // ── Helper: Find which color owns a cell ──
  const getCellOccupant = useCallback((r, c) => {
    for (const [color, path] of Object.entries(paths)) {
      if (path && path.some((pt) => pt.r === r && pt.c === c)) {
        return color;
      }
    }
    return null;
  }, [paths]);

  // ── Calculate Flows & Coverage ──
  const completedFlows = pairs.filter((p) => {
    const path = paths[p.color];
    if (!path || path.length < 2) return false;
    const start = path[0];
    const end = path[path.length - 1];
    const match1 = (start.r === p.p1.r && start.c === p.p1.c && end.r === p.p2.r && end.c === p.p2.c);
    const match2 = (start.r === p.p2.r && start.c === p.p2.c && end.r === p.p1.r && end.c === p.p1.c);
    return match1 || match2;
  });

  const flowsConnectedCount = completedFlows.length;
  const totalFlowsCount = pairs.length;

  const allFilledCells = new Set();
  Object.values(paths).forEach((p) => {
    if (p) {
      p.forEach((pt) => allFilledCells.add(`${pt.r},${pt.c}`));
    }
  });
  const cellsCoveredCount = allFilledCells.size;
  const totalCellsCount = gridSize * gridSize;
  const coveragePercent = Math.round((cellsCoveredCount / totalCellsCount) * 100);

  // ── Reset Board on Level Switch ──
  const resetLevel = useCallback((packIdx = currentPackIndex, lvlIdx = currentLevelIndex, random = isRandomMode, customPuz = null) => {
    setPaths({});
    setHistory([]);
    setMovesCount(0);
    setElapsedTime(0);
    setIsTimerActive(true);
    setShowVictory(false);
    setActiveDrawingColor(null);
    setHintPath(null);
    isPointerDownRef.current = false;

    if (random) {
      setIsRandomMode(true);
      if (customPuz) setRandomPuzzle(customPuz);
      else {
        const generated = generateRandomFlowPuzzle(currentPack.size, Math.min(currentPack.size, 6));
        setRandomPuzzle(generated);
      }
    } else {
      setIsRandomMode(false);
      setCurrentPackIndex(packIdx);
      setCurrentLevelIndex(lvlIdx);
    }
  }, [currentPackIndex, currentLevelIndex, isRandomMode, currentPack.size]);

  // ── Timer Effect ──
  useEffect(() => {
    if (!isTimerActive || showVictory) return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive, showVictory]);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Check Win Condition ──
  useEffect(() => {
    if (flowsConnectedCount === totalFlowsCount && totalFlowsCount > 0 && !showVictory) {
      setIsTimerActive(false);
      if (soundEnabled) playLevelCompleteSound();

      // Calculate Stars: 3 stars for full 100% coverage, 2 stars for connecting all flows
      const isPerfectCoverage = cellsCoveredCount === totalCellsCount;
      const optimalMoves = totalFlowsCount;
      let stars = 2;
      if (isPerfectCoverage && movesCount <= optimalMoves + 3) {
        stars = 3;
      } else if (!isPerfectCoverage && movesCount > optimalMoves + 5) {
        stars = 1;
      }

      const packKey = isRandomMode ? 'random' : currentPack.id;
      const lvlId = isRandomMode ? (randomPuzzle?.id || 1) : (currentLevelIndex + 1);
      const updatedProg = saveFlowLevelProgress(packKey, lvlId, {
        stars,
        moves: movesCount,
        time: elapsedTime
      });
      setProgressData(updatedProg);

      // Record in Global Stats
      recordFlowOutcome(userId, {
        packTitle: isRandomMode ? 'Daily Random' : currentPack.title,
        levelId: lvlId,
        moves: movesCount,
        stars,
        timeStr: formatTime(elapsedTime)
      });

      // Trigger Confetti
      const confArr = Array.from({ length: 45 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: Math.random() * 10 + 6,
        color: FLOW_COLORS[i % FLOW_COLORS.length].hex,
        rot: Math.random() * 360,
        dur: Math.random() * 2 + 2,
        delay: Math.random() * 0.5
      }));
      setConfetti(confArr);

      setVictoryStats({
        stars,
        moves: movesCount,
        time: formatTime(elapsedTime),
        optimal: optimalMoves,
        coverage: coveragePercent,
        isPerfect: isPerfectCoverage
      });
      setShowVictory(true);
    }
  }, [flowsConnectedCount, totalFlowsCount, cellsCoveredCount, totalCellsCount, showVictory, movesCount, elapsedTime, isRandomMode, currentPack, currentLevelIndex, randomPuzzle, soundEnabled, userId, coveragePercent]);

  // ── Coordinates Helper for Touch/Mouse on Board ──
  const getCellFromEvent = (e) => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const c = Math.floor((relX / rect.width) * gridSize);
    const r = Math.floor((relY / rect.height) * gridSize);

    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      return { r, c };
    }
    return null;
  };

  // ── Pointer Down / Start Flow ──
  const handlePointerStart = (r, c) => {
    isPointerDownRef.current = true;
    setHintPath(null);

    const ep = endpointMap.current.get(`${r},${c}`);
    const existingOccupant = getCellOccupant(r, c);

    if (ep) {
      // Clicked on an endpoint!
      const color = ep.color;
      setActiveDrawingColor(color);

      // Save history for undo
      setHistory((prev) => [...prev, { ...paths }]);
      setMovesCount((m) => m + 1);

      // Start fresh path from this endpoint
      setPaths((prev) => ({
        ...prev,
        [color]: [{ r, c }]
      }));

      if (soundEnabled) playFlowDrawSound();
    } else if (existingOccupant) {
      // Clicked on an existing line
      const color = existingOccupant;
      const currentPath = paths[color] || [];
      const cellIdx = currentPath.findIndex((pt) => pt.r === r && pt.c === c);

      if (cellIdx !== -1) {
        setActiveDrawingColor(color);
        setHistory((prev) => [...prev, { ...paths }]);
        setMovesCount((m) => m + 1);

        // Truncate path up to clicked cell
        const truncated = currentPath.slice(0, cellIdx + 1);
        setPaths((prev) => ({
          ...prev,
          [color]: truncated
        }));

        if (soundEnabled) playFlowDrawSound();
      }
    }
  };

  // ── Pointer Move / Extend Flow ──
  const handlePointerMoveCell = (r, c) => {
    if (!isPointerDownRef.current || !activeDrawingColor) return;

    const color = activeDrawingColor;
    const curPath = paths[color] || [];
    if (curPath.length === 0) return;

    const head = curPath[curPath.length - 1];

    // Check if cell is the same as current head
    if (head.r === r && head.c === c) return;

    // Check orthogonal adjacency (only 1 step up/down/left/right)
    const dr = Math.abs(head.r - r);
    const dc = Math.abs(head.c - c);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      // Check if backing up (moving to second to last cell)
      if (curPath.length >= 2) {
        const prevCell = curPath[curPath.length - 2];
        if (prevCell.r === r && prevCell.c === c) {
          // Backtrack! Pop the last cell
          setPaths((prev) => ({
            ...prev,
            [color]: curPath.slice(0, curPath.length - 1)
          }));
          if (soundEnabled) playFlowDrawSound();
          return;
        }
      }

      // Check if hitting another endpoint
      const ep = endpointMap.current.get(`${r},${c}`);
      if (ep && ep.color !== color) {
        // Blocked! Cannot cross another color's endpoint
        return;
      }

      // Check if self-intersecting earlier in the path
      const selfIdx = curPath.findIndex((pt) => pt.r === r && pt.c === c);
      if (selfIdx !== -1) {
        // Truncate self
        setPaths((prev) => ({
          ...prev,
          [color]: curPath.slice(0, selfIdx + 1)
        }));
        if (soundEnabled) playFlowDrawSound();
        return;
      }

      // If cell belongs to another color's path, cut that other path
      const nextPaths = { ...paths };
      let severedOther = false;

      for (const [otherColor, oPath] of Object.entries(nextPaths)) {
        if (otherColor !== color && oPath) {
          const cutIdx = oPath.findIndex((pt) => pt.r === r && pt.c === c);
          if (cutIdx !== -1) {
            nextPaths[otherColor] = oPath.slice(0, cutIdx);
            severedOther = true;
          }
        }
      }

      if (severedOther && soundEnabled) {
        playFlowDisconnectSound();
      }

      // Add to current path
      const newPath = [...curPath, { r, c }];
      nextPaths[color] = newPath;
      setPaths(nextPaths);

      // Check if reached the destination endpoint!
      const pair = pairs.find((p) => p.color === color);
      if (pair) {
        const startPt = curPath[0];
        const isStartP1 = (startPt.r === pair.p1.r && startPt.c === pair.p1.c);
        const targetPt = isStartP1 ? pair.p2 : pair.p1;
        const reachedDestination = (r === targetPt.r && c === targetPt.c);

        if (reachedDestination) {
          const colorIdx = FLOW_COLORS.findIndex((fc) => fc.id === color);
          if (soundEnabled) playFlowConnectSound(colorIdx >= 0 ? colorIdx : 0);
          isPointerDownRef.current = false;
          setActiveDrawingColor(null);
        } else {
          if (soundEnabled) playFlowDrawSound();
        }
      }
    }
  };

  // ── Global Pointer Event Listeners ──
  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    setActiveDrawingColor(null);
  }, []);

  useEffect(() => {
    const onWindowPointerUp = () => handlePointerUp();
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('touchend', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('touchend', onWindowPointerUp);
    };
  }, [handlePointerUp]);

  // ── Container Pointer Drag Handlers (Works on Mouse & Touch) ──
  const handleBoardPointerDown = (e) => {
    const cell = getCellFromEvent(e);
    if (cell) {
      handlePointerStart(cell.r, cell.c);
    }
  };

  const handleBoardPointerMove = (e) => {
    if (!isPointerDownRef.current || !activeDrawingColor) return;
    const cell = getCellFromEvent(e);
    if (cell) {
      handlePointerMoveCell(cell.r, cell.c);
    }
  };

  // ── Touch Movement Handler ──
  const handleTouchMove = (e) => {
    if (!isPointerDownRef.current) return;
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (cell) {
      handlePointerMoveCell(cell.r, cell.c);
    }
  };

  // ── Undo Action ──
  const handleUndo = () => {
    if (history.length === 0) return;
    const prevPaths = history[history.length - 1];
    setPaths(prevPaths);
    setHistory((h) => h.slice(0, h.length - 1));
    setActiveDrawingColor(null);
    setHintPath(null);
  };

  // ── AI Tactical Hint ──
  const handleAIHint = () => {
    let sol = activeLevel.solution;
    if (!sol) {
      sol = solveFlowPuzzle(gridSize, pairs);
    }

    if (sol && sol.length > 0) {
      const incomplete = sol.find((s) => {
        const cur = paths[s.color];
        if (!cur || cur.length < 2) return true;
        const pair = pairs.find((p) => p.color === s.color);
        const start = cur[0];
        const end = cur[cur.length - 1];
        const isConn = (start?.r === pair?.p1.r && start?.c === pair?.p1.c && end?.r === pair?.p2.r && end?.c === pair?.p2.c) ||
                       (start?.r === pair?.p2.r && start?.c === pair?.p2.c && end?.r === pair?.p1.r && end?.c === pair?.p1.c);
        return !isConn;
      });

      if (incomplete) {
        setHintPath(incomplete);
        setMovesCount((m) => m + 1);
        setHistory((prev) => [...prev, { ...paths }]);
        setPaths((prev) => ({
          ...prev,
          [incomplete.color]: incomplete.path
        }));
        const colorIdx = FLOW_COLORS.findIndex((fc) => fc.id === incomplete.color);
        if (soundEnabled) playFlowConnectSound(colorIdx >= 0 ? colorIdx : 0);
      }
    }
  };

  // ── Level Navigation ──
  const handleNextLevel = () => {
    setShowVictory(false);
    if (isRandomMode) {
      const nextPuz = generateRandomFlowPuzzle(currentPack.size, Math.min(currentPack.size, 6));
      resetLevel(currentPackIndex, 0, true, nextPuz);
    } else if (currentLevelIndex < currentPack.levels.length - 1) {
      resetLevel(currentPackIndex, currentLevelIndex + 1, false);
    } else if (currentPackIndex < LEVEL_PACKS.length - 1) {
      resetLevel(currentPackIndex + 1, 0, false);
    } else {
      resetLevel(0, 0, false);
    }
  };

  const handlePrevLevel = () => {
    if (currentLevelIndex > 0) {
      resetLevel(currentPackIndex, currentLevelIndex - 1, false);
    }
  };

  // ── Render SVG Pipe Paths ──
  const renderSvgPipes = () => {
    const cellSize = 100 / gridSize;
    const halfCell = cellSize / 2;

    return (
      <svg className="flow-svg-overlay" viewBox="0 0 100 100">
        <defs>
          <filter id="pipe-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Completed and Active Pipes */}
        {Object.entries(paths).map(([colorId, path]) => {
          if (!path || path.length < 1) return null;
          const colorMeta = COLOR_MAP[colorId] || FLOW_COLORS[0];
          const isCompleted = completedFlows.some((p) => p.color === colorId);

          let d = `M ${path[0].c * cellSize + halfCell} ${path[0].r * cellSize + halfCell}`;
          for (let i = 1; i < path.length; i++) {
            d += ` L ${path[i].c * cellSize + halfCell} ${path[i].r * cellSize + halfCell}`;
          }

          return (
            <g key={colorId} className={`flow-pipe-group ${isCompleted ? 'pipe-completed' : ''}`}>
              {/* Outer glow aura */}
              <path
                d={d}
                fill="none"
                stroke={colorMeta.glow}
                strokeWidth={cellSize * 0.58}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flow-pipe-halo"
              />
              {/* Core radiant pipe */}
              <path
                d={d}
                fill="none"
                stroke={colorMeta.hex}
                strokeWidth={cellSize * 0.44}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flow-pipe-core"
              />
              {/* Inner luminous highlight beam */}
              <path
                d={d}
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth={cellSize * 0.14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* Hint Path Highlight */}
        {hintPath && (
          <path
            d={hintPath.path.reduce((acc, pt, idx) => {
              const x = pt.c * cellSize + halfCell;
              const y = pt.r * cellSize + halfCell;
              return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
            }, '')}
            fill="none"
            stroke="#fde047"
            strokeWidth={cellSize * 0.25}
            strokeDasharray="2 3"
            strokeLinecap="round"
            className="hint-sparkle-path"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="flow-viewport">
      {/* Wallpaper Background */}
      <div className="flow-page-wallpaper" />
      <div className="flow-blob-1" />
      <div className="flow-blob-2" />

      {/* Confetti Container on Victory */}
      {showVictory && (
        <div className="confetti-container">
          {confetti.map((c) => (
            <div
              key={c.id}
              className="confetti-piece"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: `${c.size}px`,
                height: `${c.size * 0.6}px`,
                backgroundColor: c.color,
                transform: `rotate(${c.rot}deg)`,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Header Bar */}
      <header className="flow-header">
        <div className="flow-header-left">
          <Link to="/" className="flow-btn-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Hub</span>
          </Link>
          <div className="flow-title-badge">
            <span className="flow-title-icon">⚡</span>
            <div>
              <h1 className="flow-title-text">COLOR FLOW</h1>
              <span className="flow-subtitle-text">
                {isRandomMode ? 'Daily Procedural Challenge' : `${currentPack.title} · Level ${currentLevelIndex + 1}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flow-header-right">
          <button
            className={`flow-ctrl-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            className="flow-ctrl-btn pack-btn"
            onClick={() => setShowLevelSelect(true)}
            title="Browse Packs & Levels"
          >
            📋 Levels
          </button>
          <button
            className="flow-ctrl-btn hint-btn"
            onClick={handleAIHint}
            title="Get AI Solution Hint"
          >
            💡 Hint
          </button>
          <button
            className="flow-ctrl-btn undo-btn"
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Undo Last Connection"
          >
            ↩️ Undo
          </button>
          <button
            className="flow-ctrl-btn reset-btn"
            onClick={() => resetLevel()}
            title="Reset Level"
          >
            🔄 Reset
          </button>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flow-arena-layout">
        {/* Left Side: Game Board & Stats */}
        <section className="flow-board-column">
          {/* Top Status HUD */}
          <div className="flow-hud-bar">
            <div className="hud-metric-pill">
              <span className="hud-lbl">FLOWS</span>
              <span className={`hud-val ${flowsConnectedCount === totalFlowsCount ? 'hud-val-complete' : ''}`}>
                {flowsConnectedCount} / {totalFlowsCount}
              </span>
            </div>

            <div className="hud-metric-pill">
              <span className="hud-lbl">PIPE COVERAGE</span>
              <span className={`hud-val ${coveragePercent === 100 ? 'hud-val-complete' : ''}`}>
                {coveragePercent}% <span className="hud-sub">({cellsCoveredCount}/{totalCellsCount})</span>
              </span>
            </div>

            <div className="hud-metric-pill">
              <span className="hud-lbl">MOVES</span>
              <span className="hud-val">{movesCount}</span>
            </div>

            <div className="hud-metric-pill">
              <span className="hud-lbl">TIME</span>
              <span className="hud-val">{formatTime(elapsedTime)}</span>
            </div>
          </div>

          {/* Dual Progress Bars */}
          <div className="flow-progress-dual">
            <div className="flow-progress-track">
              <div
                className="flow-progress-fill flows-fill"
                style={{ width: `${(flowsConnectedCount / totalFlowsCount) * 100}%` }}
                title={`Flows: ${flowsConnectedCount}/${totalFlowsCount}`}
              />
            </div>
            <div className="flow-progress-track">
              <div
                className="flow-progress-fill coverage-fill"
                style={{ width: `${coveragePercent}%` }}
                title={`Coverage: ${coveragePercent}%`}
              />
            </div>
          </div>

          {/* Interactive Flow Grid Board */}
          <div className="flow-board-wrapper">
            <div
              ref={boardRef}
              className={`flow-board-grid grid-${gridSize}`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`
              }}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onTouchMove={handleTouchMove}
            >
              {/* SVG Pipe Overlay */}
              {renderSvgPipes()}

              {/* Grid Cells */}
              {Array.from({ length: gridSize }).map((_, r) =>
                Array.from({ length: gridSize }).map((_, c) => {
                  const ep = endpointMap.current.get(`${r},${c}`);
                  const colorMeta = ep ? COLOR_MAP[ep.color] : null;
                  const isOccupied = getCellOccupant(r, c);
                  const isCompleted = ep && completedFlows.some((p) => p.color === ep.color);

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`flow-cell ${ep ? 'cell-has-endpoint' : ''} ${isOccupied ? 'cell-occupied' : ''}`}
                    >
                      {/* Pulsing Endpoint Circle */}
                      {ep && colorMeta && (
                        <div
                          className={`flow-dot-node ${isCompleted ? 'node-completed' : ''}`}
                          style={{
                            backgroundColor: colorMeta.hex,
                            boxShadow: `0 0 14px ${colorMeta.glow}, inset 0 2px 4px rgba(255,255,255,0.6)`
                          }}
                        >
                          <div className="flow-dot-inner-shine" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Level Navigation Footer */}
          <div className="flow-nav-bar">
            <button
              className="flow-nav-btn"
              onClick={handlePrevLevel}
              disabled={currentLevelIndex === 0 || isRandomMode}
            >
              ◀ Previous
            </button>
            <div className="flow-level-title-chip">
              <span className="chip-pack">{currentPack.title}</span>
              <span className="chip-num">Level {currentLevelIndex + 1} of {currentPack.levels.length}</span>
            </div>
            <button
              className="flow-nav-btn flow-nav-btn-next"
              onClick={handleNextLevel}
            >
              Next Level ▶
            </button>
          </div>
        </section>

        {/* Right Side: Quick Packs & Info Card */}
        <aside className="flow-sidebar-column">
          {/* Level Packs Overview Card */}
          <div className="sidebar-card flow-packs-card">
            <h3 className="sidebar-heading">Difficulty Packs</h3>
            <div className="pack-select-list">
              {LEVEL_PACKS.map((pack, pIdx) => {
                const isSelected = !isRandomMode && currentPackIndex === pIdx;
                return (
                  <button
                    key={pack.id}
                    className={`pack-card-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => resetLevel(pIdx, 0, false)}
                  >
                    <div className="pack-btn-icon" style={{ borderColor: pack.color }}>{pack.icon}</div>
                    <div className="pack-btn-meta">
                      <span className="pack-btn-title">{pack.title}</span>
                      <span className="pack-btn-sub">{pack.tag} · {pack.levels.length} Puzzles</span>
                    </div>
                    {isSelected && <span className="pack-active-dot" style={{ backgroundColor: pack.color }} />}
                  </button>
                );
              })}

              {/* Procedural Random Generator Button */}
              <button
                className={`pack-card-btn random-pack-btn ${isRandomMode ? 'active' : ''}`}
                onClick={() => resetLevel(currentPackIndex, 0, true)}
              >
                <div className="pack-btn-icon" style={{ borderColor: '#ec4899' }}>🎲</div>
                <div className="pack-btn-meta">
                  <span className="pack-btn-title">Daily Challenge</span>
                  <span className="pack-btn-sub">Infinite Solvable {currentPack.size}×{currentPack.size} Puzzles</span>
                </div>
                {isRandomMode && <span className="pack-active-dot" style={{ backgroundColor: '#ec4899' }} />}
              </button>
            </div>
          </div>

          {/* Rules & Guide Card */}
          <div className="sidebar-card rules-card">
            <h3 className="sidebar-heading">How to Play</h3>
            <ul className="flow-rules-list">
              <li>
                <span className="rule-bullet">1</span>
                <span><strong>Connect pairs:</strong> Drag between matching colored dots to draw continuous pipes.</span>
              </li>
              <li>
                <span className="rule-bullet">2</span>
                <span><strong>No overlapping:</strong> Pipes cannot cross each other or cut across dots.</span>
              </li>
              <li>
                <span className="rule-bullet">3</span>
                <span><strong>Fill the board:</strong> Connect all pairs AND cover <strong>100% of cells</strong> for 3 Stars!</span>
              </li>
            </ul>
          </div>
        </aside>
      </main>

      {/* ── Level Selector Modal ── */}
      {showLevelSelect && (
        <div className="flow-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLevelSelect(false)}>
          <div className="level-select-modal">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Select Level</h2>
                <p className="modal-subtitle">Choose a difficulty pack and puzzle level</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowLevelSelect(false)}>✕</button>
            </div>

            {/* Pack Tabs */}
            <div className="modal-pack-tabs">
              {LEVEL_PACKS.map((pack, idx) => (
                <button
                  key={pack.id}
                  className={`modal-tab-btn ${currentPackIndex === idx && !isRandomMode ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentPackIndex(idx);
                    setIsRandomMode(false);
                  }}
                >
                  <span>{pack.icon} {pack.size}×{pack.size}</span>
                </button>
              ))}
            </div>

            {/* Level Grid */}
            <div className="modal-levels-grid">
              {LEVEL_PACKS[currentPackIndex].levels.map((lvl, lIdx) => {
                const packKey = LEVEL_PACKS[currentPackIndex].id;
                const prog = progressData[`${packKey}_${lvl.id}`];
                const isCurrent = !isRandomMode && currentLevelIndex === lIdx;
                const isCompleted = prog?.completed;
                const stars = prog?.stars || 0;

                return (
                  <button
                    key={lvl.id}
                    className={`level-grid-cell ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => {
                      resetLevel(currentPackIndex, lIdx, false);
                      setShowLevelSelect(false);
                    }}
                  >
                    <span className="lvl-num">{lvl.id}</span>
                    <div className="lvl-stars">
                      <span className={`star ${stars >= 1 ? 'filled' : ''}`}>★</span>
                      <span className={`star ${stars >= 2 ? 'filled' : ''}`}>★</span>
                      <span className={`star ${stars >= 3 ? 'filled' : ''}`}>★</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Level Victory Modal ── */}
      {showVictory && victoryStats && (
        <div className="flow-modal-overlay">
          <div className="victory-modal-card">
            <div className="victory-crown-icon">👑</div>
            <h2 className="victory-title">
              {victoryStats.isPerfect ? 'PERFECT SOLVE!' : 'LEVEL SOLVED!'}
            </h2>
            <p className="victory-subtitle">
              {victoryStats.isPerfect
                ? 'All color flows connected with 100% board coverage!'
                : `All flows connected! (${victoryStats.coverage}% board coverage)`}
            </p>

            {/* 3-Star Rating Burst */}
            <div className="victory-stars-burst">
              <span className={`burst-star star-1 ${victoryStats.stars >= 1 ? 'active' : ''}`}>★</span>
              <span className={`burst-star star-2 ${victoryStats.stars >= 2 ? 'active' : ''}`}>★</span>
              <span className={`burst-star star-3 ${victoryStats.stars >= 3 ? 'active' : ''}`}>★</span>
            </div>

            {/* Stats Summary */}
            <div className="victory-stats-row">
              <div className="v-stat-box">
                <span className="v-stat-val">{victoryStats.moves}</span>
                <span className="v-stat-lbl">MOVES TAKEN</span>
              </div>
              <div className="v-stat-box">
                <span className="v-stat-val">{victoryStats.optimal}</span>
                <span className="v-stat-lbl">OPTIMAL MOVES</span>
              </div>
              <div className="v-stat-box">
                <span className="v-stat-val">{victoryStats.time}</span>
                <span className="v-stat-lbl">TIME ELAPSED</span>
              </div>
            </div>

            {/* Actions */}
            <div className="victory-actions">
              <button className="v-btn-primary" onClick={handleNextLevel}>
                Next Level 🚀
              </button>
              <button className="v-btn-secondary" onClick={() => resetLevel()}>
                🔄 Replay
              </button>
              <Link to="/" className="v-btn-home">
                🏠 Hub
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

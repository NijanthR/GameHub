import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  WATER_COLORS,
  BOTTLE_CAPACITY,
  LEVEL_PACKS,
  getTopColor,
  getTopColorCount,
  isBottleComplete,
  isLevelSolved,
  canPour,
  calcPourAmount,
  executePour,
  solveWaterSort,
  generateSolvableWaterSort,
  getWaterSortProgress,
  saveWaterSortLevelProgress
} from '../utils/waterSortUtils';
import {
  playBottleSelectSound,
  playPourSound,
  playSplashSound,
  playBottleCompleteSound,
  playWaterSortVictorySound,
  playWaterSortUndoSound
} from '../utils/soundEffects';
import { recordWaterSortOutcome } from '../utils/statsService';
import { trackGameStart, trackAiUsage } from '../utils/activityTracker';
import './WaterSort.css';

const THEMES = [
  { id: 'alchemist', name: 'Alchemist Lab', icon: '🧪', className: 'theme-alchemist' },
  { id: 'brick', name: 'Brick Wall Night', icon: '🧱', className: 'theme-brick' },
  { id: 'cyber', name: 'Cyberpunk Lab', icon: '⚡', className: 'theme-cyber' },
  { id: 'cosmic', name: 'Cosmic Nebula', icon: '🌌', className: 'theme-cosmic' },
  { id: 'sunset', name: 'Sunset Horizon', icon: '🌅', className: 'theme-sunset' },
  { id: 'midnight', name: 'Midnight Glass', icon: '💎', className: 'theme-midnight' }
];

export default function WaterSort() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';

  // Pack & Level State
  const [currentPackIdx, setCurrentPackIdx] = useState(0);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [randomConfig, setRandomConfig] = useState({ colors: 6, empty: 2 });
  const [customBottles, setCustomBottles] = useState(null);

  // Active level data
  const currentPack = LEVEL_PACKS[currentPackIdx] || LEVEL_PACKS[0];
  const activeLevel = isRandomMode
    ? { id: 'rnd', title: `Random ${randomConfig.colors} Colors`, bottles: customBottles || [], parMoves: randomConfig.colors * 4 }
    : (currentPack.levels[currentLevelIdx] || currentPack.levels[0]);

  // Game Board State
  const [bottles, setBottles] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [history, setHistory] = useState([]);
  const [movesCount, setMovesCount] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [extraTubesCount, setExtraTubesCount] = useState(0);

  // Animation & Pouring State
  const [isPouring, setIsPouring] = useState(false);
  const [pourState, setPourState] = useState(null);
  const [completedTubes, setCompletedTubes] = useState(new Set());
  const [justCompletedIdx, setJustCompletedIdx] = useState(null);

  // AI Hint & Auto-Solver State
  const [hint, setHint] = useState(null); // { from, to }
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const autoSolveQueueRef = useRef([]);
  const pourTimersRef = useRef([]);

  // UI Modals & Settings
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [victoryStats, setVictoryStats] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('brick');
  const [confetti, setConfetti] = useState([]);
  const [progressData, setProgressData] = useState(getWaterSortProgress());

  const bottleRefs = useRef([]);
  const boardRef = useRef(null);

  // Clear any active animation timers
  const clearPourTimers = useCallback(() => {
    pourTimersRef.current.forEach((t) => clearTimeout(t));
    pourTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearPourTimers();
  }, [clearPourTimers]);

  // ── Initialize Level ──
  const initLevel = useCallback((levelData) => {
    if (!levelData || !levelData.bottles) return;
    clearPourTimers();

    const initialBottles = levelData.bottles.map((b) => [...b]);
    setBottles(initialBottles);
    setSelectedIdx(null);
    setHistory([]);
    setMovesCount(0);
    setElapsedTime(0);
    setIsTimerActive(true);
    setIsPouring(false);
    setPourState(null);
    setHint(null);
    setIsAutoSolving(false);
    setExtraTubesCount(0);
    setShowVictory(false);
    autoSolveQueueRef.current = [];

    // Check pre-completed tubes
    const initialCompleted = new Set();
    initialBottles.forEach((b, idx) => {
      if (isBottleComplete(b)) initialCompleted.add(idx);
    });
    setCompletedTubes(initialCompleted);

    trackGameStart('Water Sort', `Level #${levelData.id || 1} · ${levelData.title || 'Laboratory'}`);
  }, [clearPourTimers]);

  // Load level on index/pack change
  useEffect(() => {
    if (!isRandomMode) {
      const lvl = currentPack.levels[currentLevelIdx] || currentPack.levels[0];
      initLevel(lvl);
    }
  }, [currentPackIdx, currentLevelIdx, isRandomMode, initLevel, currentPack]);

  // Load procedural random level
  const handleGenerateRandom = useCallback((colors = 6, empty = 2) => {
    const generated = generateSolvableWaterSort(colors, empty, colors * 3);
    setCustomBottles(generated);
    setIsRandomMode(true);
    initLevel({ id: 'rnd', title: `Procedural Lab (${colors} Colors)`, bottles: generated, parMoves: colors * 4 });
  }, [initLevel]);

  // ── Timer Effect ──
  useEffect(() => {
    if (!isTimerActive || showVictory) return;
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimerActive, showVictory]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Check Level Solved & Celebrate ──
  const handleVictory = useCallback((finalMoves, finalTime) => {
    setIsTimerActive(false);
    if (soundEnabled) playWaterSortVictorySound();

    const par = activeLevel.parMoves || 15;
    const { stars, totalStars } = saveWaterSortLevelProgress(activeLevel.id, finalMoves, par);
    setProgressData(getWaterSortProgress());

    // Record verified stats
    recordWaterSortOutcome(userId, {
      levelId: activeLevel.id,
      packTitle: isRandomMode ? 'Random Mode' : currentPack.title,
      moves: finalMoves,
      stars,
      timeStr: formatTime(finalTime),
      won: true
    });

    setVictoryStats({
      moves: finalMoves,
      parMoves: par,
      time: formatTime(finalTime),
      stars,
      totalStars
    });

    // Generate confetti explosion
    const particles = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      size: Math.random() * 12 + 6,
      color: Object.values(WATER_COLORS)[i % Object.keys(WATER_COLORS).length].primary,
      rotation: Math.random() * 360,
      speedX: (Math.random() - 0.5) * 8,
      speedY: Math.random() * 6 + 4,
      animDuration: Math.random() * 1.5 + 2
    }));
    setConfetti(particles);
    setShowVictory(true);
  }, [activeLevel, currentPack, isRandomMode, soundEnabled, userId]);

  // ── Execute Animated Pour ──
  const performPour = useCallback((fromIdx, toIdx) => {
    if (isPouring) return;
    if (!canPour(bottles, fromIdx, toIdx)) {
      setSelectedIdx(null);
      return;
    }

    const fromEl = bottleRefs.current[fromIdx];
    const toEl = bottleRefs.current[toIdx];
    const boardEl = boardRef.current;

    if (!fromEl || !toEl || !boardEl) {
      // Fallback instant pour if refs missing
      const { nextBottles } = executePour(bottles, fromIdx, toIdx);
      setHistory((prev) => [...prev, bottles]);
      setBottles(nextBottles);
      setMovesCount((m) => m + 1);
      setSelectedIdx(null);
      setHint(null);
      return;
    }

    const boardRect = boardEl.getBoundingClientRect();
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Source and Destination Coordinates relative to Board Container
    const isSourceOnLeft = fromRect.left < toRect.left;
    const tiltAngle = isSourceOnLeft ? 65 : -65;

    // Center of destination bottle mouth
    const dstMouthX = toRect.left + toRect.width / 2 - boardRect.left;
    const dstMouthY = toRect.top - boardRect.top + 8;

    // Center of source bottle
    const srcCenterX = fromRect.left + fromRect.width / 2 - boardRect.left;
    const srcTopY = fromRect.top - boardRect.top;

    // Delta translations so tilted spout hovers precisely above destination opening
    const deltaX = (dstMouthX - srcCenterX) + (isSourceOnLeft ? -46 : 46);
    const deltaY = (dstMouthY - srcTopY) - 96;

    // Stream start (from tilted bottle mouth) and end (into destination rim)
    const streamStartX = isSourceOnLeft ? dstMouthX - 10 : dstMouthX + 10;
    const streamStartY = dstMouthY - 14;
    const streamEndX = dstMouthX;
    const streamEndY = dstMouthY + 28;
    const ctrlX = isSourceOnLeft ? dstMouthX - 3 : dstMouthX + 3;
    const ctrlY = (streamStartY + streamEndY) / 2;

    const pourAmount = calcPourAmount(bottles, fromIdx, toIdx);
    const pourColor = getTopColor(bottles[fromIdx]);

    setIsPouring(true);
    setHint(null);
    clearPourTimers();

    // Save history snapshot before move
    setHistory((prev) => [...prev, bottles.map((b) => [...b])]);

    // Set initial tilting pose
    setPourState({
      fromIdx,
      toIdx,
      deltaX,
      deltaY,
      angle: tiltAngle,
      color: pourColor,
      amount: pourAmount,
      isSourceOnLeft,
      streamStartX,
      streamStartY,
      streamEndX,
      streamEndY,
      ctrlX,
      ctrlY,
      streamVisible: false,
      returning: false
    });

    // Step 1 (180ms): Bottle reaches position and tilts -> stream activates & sound plays
    const t1 = setTimeout(() => {
      setPourState((prev) => (prev ? { ...prev, streamVisible: true } : null));
      if (soundEnabled) {
        playPourSound(0.45);
      }
    }, 180);
    pourTimersRef.current.push(t1);

    // Step 2 (440ms): Fluid transfers in state
    const t2 = setTimeout(() => {
      const { nextBottles } = executePour(bottles, fromIdx, toIdx);
      setBottles(nextBottles);
      setMovesCount((m) => m + 1);

      // Step 3 (620ms): Stream ends with splash droplet burst
      const t3 = setTimeout(() => {
        setPourState((prev) => (prev ? { ...prev, streamVisible: false } : null));
        if (soundEnabled) {
          playSplashSound();
        }

        // Check if destination bottle is completed
        if (isBottleComplete(nextBottles[toIdx])) {
          setCompletedTubes((prev) => new Set(prev).add(toIdx));
          setJustCompletedIdx(toIdx);
          if (soundEnabled) {
            setTimeout(() => playBottleCompleteSound(), 80);
          }
          setTimeout(() => setJustCompletedIdx(null), 1200);
        }

        // Step 4 (660ms): Source bottle returns upright to rack
        const t4 = setTimeout(() => {
          setPourState((prev) => (prev ? { ...prev, angle: 0, returning: true } : null));

          // Step 5 (880ms): Pour finished
          const t5 = setTimeout(() => {
            setIsPouring(false);
            setPourState(null);
            setSelectedIdx(null);

            // Check level solved
            if (isLevelSolved(nextBottles)) {
              setTimeout(() => {
                handleVictory(movesCount + 1, elapsedTime);
              }, 300);
            }
          }, 220);
          pourTimersRef.current.push(t5);
        }, 40);
        pourTimersRef.current.push(t4);
      }, 180);
      pourTimersRef.current.push(t3);
    }, 440);
    pourTimersRef.current.push(t2);
  }, [bottles, isPouring, soundEnabled, movesCount, elapsedTime, handleVictory, clearPourTimers]);

  // ── Bottle Click Handler ──
  const handleBottleClick = (idx) => {
    if (isPouring || showVictory || isAutoSolving) return;

    if (selectedIdx === null) {
      // Cannot select empty bottle or completed bottle as source
      if (bottles[idx].length === 0) return;
      if (isBottleComplete(bottles[idx])) return;

      setSelectedIdx(idx);
      if (soundEnabled) playBottleSelectSound();
    } else if (selectedIdx === idx) {
      // Deselect
      setSelectedIdx(null);
    } else {
      // Attempt Pour from selectedIdx into idx
      if (canPour(bottles, selectedIdx, idx)) {
        performPour(selectedIdx, idx);
      } else {
        // Switch selection to new bottle if valid source
        if (bottles[idx].length > 0 && !isBottleComplete(bottles[idx])) {
          setSelectedIdx(idx);
          if (soundEnabled) playBottleSelectSound();
        } else {
          setSelectedIdx(null);
        }
      }
    }
  };

  // ── Powerup: Undo Move ──
  const handleUndo = () => {
    if (isPouring || history.length === 0 || isAutoSolving) return;
    clearPourTimers();
    const prevBottles = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setBottles(prevBottles);
    setSelectedIdx(null);
    setHint(null);
    setMovesCount((m) => Math.max(0, m - 1));

    // Recalculate completed bottles
    const newCompleted = new Set();
    prevBottles.forEach((b, idx) => {
      if (isBottleComplete(b)) newCompleted.add(idx);
    });
    setCompletedTubes(newCompleted);

    if (soundEnabled) playWaterSortUndoSound();
  };

  // ── Powerup: Add Extra Empty Tube (+1) ──
  const handleAddExtraTube = () => {
    if (isPouring || isAutoSolving || extraTubesCount >= 2) return;
    setBottles((prev) => [...prev, []]);
    setExtraTubesCount((c) => c + 1);
    if (soundEnabled) playBottleSelectSound();
  };

  // ── AI Hint System ──
  const handleGetHint = () => {
    if (isPouring || isAutoSolving) return;
    const solution = solveWaterSort(bottles, 45);
    if (solution && solution.length > 0) {
      const nextMove = solution[0];
      setHint(nextMove);
      if (soundEnabled) playBottleSelectSound();
      trackAiUsage('Water Sort', 'AI Hint', `Suggested pour: Bottle #${nextMove.from + 1} → #${nextMove.to + 1}`);
    }
  };

  // ── Auto-Solve Playback ──
  const handleAutoSolve = () => {
    if (isPouring || isAutoSolving) return;
    const solution = solveWaterSort(bottles, 55);
    if (!solution || solution.length === 0) return;

    setIsAutoSolving(true);
    autoSolveQueueRef.current = [...solution];
    trackAiUsage('Water Sort', 'A* Auto-Solver', `Initiated auto-solve sequence (${solution.length} moves)`);
  };

  // Process auto-solve queue step-by-step
  useEffect(() => {
    if (!isAutoSolving || isPouring || autoSolveQueueRef.current.length === 0) {
      if (isAutoSolving && autoSolveQueueRef.current.length === 0 && !isPouring) {
        setIsAutoSolving(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      const nextMove = autoSolveQueueRef.current.shift();
      if (nextMove) {
        performPour(nextMove.from, nextMove.to);
      }
    }, 950);

    return () => clearTimeout(timer);
  }, [isAutoSolving, isPouring, performPour]);

  // ── Restart Current Level ──
  const handleRestart = () => {
    if (isPouring) return;
    initLevel(activeLevel);
  };

  // ── Next Level Progression ──
  const handleNextLevel = () => {
    setShowVictory(false);
    if (isRandomMode) {
      handleGenerateRandom(randomConfig.colors, randomConfig.empty);
    } else if (currentLevelIdx < currentPack.levels.length - 1) {
      setCurrentLevelIdx((prev) => prev + 1);
    } else if (currentPackIdx < LEVEL_PACKS.length - 1) {
      setCurrentPackIdx((prev) => prev + 1);
      setCurrentLevelIdx(0);
    } else {
      // Reached end of packs -> start random endless mode
      handleGenerateRandom(8, 2);
    }
  };

  const selectedThemeObj = THEMES.find((t) => t.id === currentTheme) || THEMES[0];
  const streamColorObj = pourState ? (WATER_COLORS[pourState.color] || WATER_COLORS.blue) : null;

  return (
    <div className={`watersort-app ${selectedThemeObj.className}`}>
      {/* Background Ambience Elements */}
      <div className="ws-bg-glow glow-1" />
      <div className="ws-bg-glow glow-2" />
      <div className="ws-brick-overlay" />

      {/* ── Top Header Navigation ── */}
      <header className="ws-header">
        <div className="ws-header-left">
          <Link to="/" className="ws-back-link" title="Return to Game Hub">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Hub</span>
          </Link>

          <div className="ws-title-group">
            <div className="ws-title-row">
              <span className="ws-logo-flask">🧪</span>
              <h1 className="ws-main-title">Water Sort</h1>
              <span className="ws-level-tag">
                {isRandomMode ? 'Endless Lab' : `${currentPack.title} · #${activeLevel.id}`}
              </span>
            </div>
          </div>
        </div>

        {/* Stats & Quick Actions */}
        <div className="ws-header-right">
          <div className="ws-stat-pill">
            <span className="ws-stat-lbl">MOVES</span>
            <span className="ws-stat-val">{movesCount}</span>
          </div>

          <div className="ws-stat-pill">
            <span className="ws-stat-lbl">TIME</span>
            <span className="ws-stat-val">{formatTime(elapsedTime)}</span>
          </div>

          <button
            className="ws-icon-btn"
            onClick={() => setSoundEnabled((s) => !s)}
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            className="ws-level-btn"
            onClick={() => setShowLevelSelect(true)}
            title="Browse Level Packs"
          >
            📂 Levels
          </button>
        </div>
      </header>

      {/* ── Controls & Powerups Bar ── */}
      <div className="ws-toolbar">
        <button
          className="ws-tool-btn"
          onClick={handleUndo}
          disabled={history.length === 0 || isPouring || isAutoSolving}
          title="Undo last pour"
        >
          <span className="tool-icon">↩️</span>
          <span className="tool-text">Undo</span>
        </button>

        <button
          className="ws-tool-btn ws-powerup-btn"
          onClick={handleAddExtraTube}
          disabled={extraTubesCount >= 2 || isPouring || isAutoSolving}
          title="Add an empty bottle to rack"
        >
          <span className="tool-icon">➕🧪</span>
          <span className="tool-text">+1 Tube ({2 - extraTubesCount} left)</span>
        </button>

        <button
          className="ws-tool-btn ws-hint-btn"
          onClick={handleGetHint}
          disabled={isPouring || isAutoSolving}
          title="Get AI move hint"
        >
          <span className="tool-icon">💡</span>
          <span className="tool-text">Hint</span>
        </button>

        <button
          className="ws-tool-btn ws-solve-btn"
          onClick={handleAutoSolve}
          disabled={isPouring || isAutoSolving}
          title="Auto-solve puzzle step by step"
        >
          <span className="tool-icon">🤖</span>
          <span className="tool-text">{isAutoSolving ? 'Solving...' : 'Auto Solve'}</span>
        </button>

        <button
          className="ws-tool-btn"
          onClick={handleRestart}
          disabled={isPouring}
          title="Restart current level"
        >
          <span className="tool-icon">🔄</span>
          <span className="tool-text">Reset</span>
        </button>

        {/* Theme Picker Dropdown */}
        <div className="ws-theme-picker">
          <select
            value={currentTheme}
            onChange={(e) => setCurrentTheme(e.target.value)}
            className="ws-theme-select"
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── AI Hint Guidance Banner ── */}
      {hint && (
        <div className="ws-hint-banner">
          <span className="hint-icon">💡</span>
          <span>
            Suggested Move: Pour from <strong>Tube #{hint.from + 1}</strong> into <strong>Tube #{hint.to + 1}</strong>
          </span>
          <button className="hint-close" onClick={() => setHint(null)}>✕</button>
        </div>
      )}

      {/* ── Main Rack / Game Board ── */}
      <main className="ws-board-container" ref={boardRef}>
        <div className={`ws-rack ${bottles.length > 8 ? 'rack-multi-row' : 'rack-single-row'}`}>
          {bottles.map((bottle, idx) => {
            const isSelected = selectedIdx === idx;
            const isCompleted = completedTubes.has(idx) || isBottleComplete(bottle);
            const isJustFinished = justCompletedIdx === idx;
            const isHintSource = hint && hint.from === idx;
            const isHintTarget = hint && hint.to === idx;

            // Is this bottle currently pouring?
            const isPouringSource = pourState && pourState.fromIdx === idx;
            const isPouringTarget = pourState && pourState.toIdx === idx;

            let bottleTransform = '';
            if (isPouringSource) {
              bottleTransform = `translate(${pourState.deltaX}px, ${pourState.deltaY}px) rotate(${pourState.angle}deg)`;
            } else if (isSelected) {
              bottleTransform = 'translateY(-24px) scale(1.04)';
            }

            return (
              <div
                key={idx}
                ref={(el) => (bottleRefs.current[idx] = el)}
                className={`ws-bottle-wrap ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isJustFinished ? 'just-completed' : ''} ${isHintSource ? 'hint-source' : ''} ${isHintTarget ? 'hint-target' : ''} ${isPouringSource ? 'is-pouring-src' : ''}`}
                style={{
                  transform: bottleTransform,
                  transformOrigin: '50% 15%',
                  transition: isPouringSource && !pourState.returning
                    ? 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.05)'
                    : isPouringSource && pourState.returning
                    ? 'transform 0.22s ease-out'
                    : 'transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  zIndex: isPouringSource ? 99 : isSelected ? 40 : 10
                }}
                onClick={() => handleBottleClick(idx)}
              >
                {/* Cork Stopper when Completed */}
                {isCompleted && (
                  <div className="bottle-cork">
                    <div className="cork-wood" />
                    <span className="cork-sparkle">✨</span>
                  </div>
                )}

                {/* Selection Pointer / Hint Badge */}
                {isSelected && <div className="selection-badge">TAP TARGET</div>}
                {isHintSource && <div className="hint-badge src-badge">POUR FROM</div>}
                {isHintTarget && <div className="hint-badge dst-badge">POUR HERE</div>}

                {/* Glass Bottle Structure */}
                <div className="glass-bottle">
                  {/* Top Lip & Rim */}
                  <div className="bottle-rim" />
                  <div className="bottle-neck" />

                  {/* Glass Highlights */}
                  <div className="glass-shine-left" />
                  <div className="glass-shine-right" />

                  {/* Liquid Reservoir */}
                  <div className="liquid-reservoir">
                    {/* Render Stacked Liquid Layers (Bottom to Top) */}
                    {bottle.map((colorKey, segIdx) => {
                      const colObj = WATER_COLORS[colorKey] || WATER_COLORS.blue;
                      const isTopSegment = segIdx === bottle.length - 1;

                      return (
                        <div
                          key={segIdx}
                          className={`liquid-segment ${isTopSegment ? 'top-segment' : ''} ${segIdx === 0 ? 'bottom-segment' : ''}`}
                          style={{
                            background: colObj.gradient,
                            boxShadow: `inset 0 0 10px ${colObj.glow}, 0 0 8px ${colObj.glow}`
                          }}
                        >
                          {/* Liquid Surface Meniscus Wave for Top Layer */}
                          {isTopSegment && (
                            <div
                              className="liquid-meniscus"
                              style={{ background: colObj.surface }}
                            />
                          )}
                          {/* Floating Micro-Bubbles */}
                          <span className="liquid-bubble b-1" />
                          <span className="liquid-bubble b-2" />
                        </div>
                      );
                    })}

                    {/* Splash droplet effect inside target bottle while being filled */}
                    {isPouringTarget && pourState && (
                      <div
                        className="liquid-splash-target"
                        style={{
                          background: streamColorObj?.surface || '#fff'
                        }}
                      />
                    )}
                  </div>

                  {/* Bottle Base */}
                  <div className="bottle-bottom" />
                </div>

                {/* Tube Number Label */}
                <div className="bottle-number">
                  <span>{idx + 1}</span>
                  {isCompleted && <span className="bottle-check">✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Dynamic Liquid Pour Stream SVG Overlay ── */}
        {isPouring && pourState && (
          <svg
            className="ws-pour-stream-svg"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 85
            }}
          >
            <defs>
              <linearGradient id="streamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={streamColorObj?.surface || '#fff'} />
                <stop offset="40%" stopColor={streamColorObj?.primary || '#2563eb'} />
                <stop offset="100%" stopColor={streamColorObj?.primary || '#1d4ed8'} />
              </linearGradient>
              <filter id="streamGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {pourState.streamVisible && (
              <>
                {/* Glow Outer Layer */}
                <path
                  d={`M ${pourState.streamStartX} ${pourState.streamStartY} Q ${pourState.ctrlX} ${pourState.ctrlY}, ${pourState.streamEndX} ${pourState.streamEndY}`}
                  stroke={streamColorObj?.glow || 'rgba(37, 99, 235, 0.8)'}
                  strokeWidth="14"
                  strokeLinecap="round"
                  fill="none"
                  filter="url(#streamGlowFilter)"
                  className="stream-arc-glow"
                />

                {/* Core Fluid Layer */}
                <path
                  d={`M ${pourState.streamStartX} ${pourState.streamStartY} Q ${pourState.ctrlX} ${pourState.ctrlY}, ${pourState.streamEndX} ${pourState.streamEndY}`}
                  stroke="url(#streamGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  className="stream-arc-core"
                />

                {/* Dynamic Splash Droplet Particles at Target Rim */}
                <circle
                  cx={pourState.streamEndX - 7}
                  cy={pourState.streamEndY - 6}
                  r="3"
                  fill={streamColorObj?.surface || '#fff'}
                  className="splash-droplet d1"
                />
                <circle
                  cx={pourState.streamEndX + 7}
                  cy={pourState.streamEndY - 8}
                  r="2.5"
                  fill={streamColorObj?.surface || '#fff'}
                  className="splash-droplet d2"
                />
                <circle
                  cx={pourState.streamEndX}
                  cy={pourState.streamEndY + 2}
                  r="4"
                  fill={streamColorObj?.primary || '#2563eb'}
                  className="splash-droplet d3"
                />
              </>
            )}
          </svg>
        )}
      </main>

      {/* ── Level Pack Selection Drawer / Modal ── */}
      {showLevelSelect && (
        <div className="ws-modal-backdrop" onClick={() => setShowLevelSelect(false)}>
          <div className="ws-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal-header">
              <h2>Select Level Pack</h2>
              <button className="ws-modal-close" onClick={() => setShowLevelSelect(false)}>✕</button>
            </div>

            {/* Pack Selector Tabs */}
            <div className="ws-pack-tabs">
              {LEVEL_PACKS.map((pack, pIdx) => (
                <button
                  key={pack.id}
                  className={`pack-tab-btn ${!isRandomMode && currentPackIdx === pIdx ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentPackIdx(pIdx);
                    setIsRandomMode(false);
                  }}
                  style={{ borderColor: pack.color }}
                >
                  <span className="pack-icon">{pack.icon}</span>
                  <span className="pack-name">{pack.title}</span>
                </button>
              ))}

              <button
                className={`pack-tab-btn ${isRandomMode ? 'active' : ''}`}
                onClick={() => setIsRandomMode(true)}
                style={{ borderColor: '#f59e0b' }}
              >
                <span className="pack-icon">🎲</span>
                <span className="pack-name">Endless Random</span>
              </button>
            </div>

            {/* Pack Levels Grid */}
            {!isRandomMode ? (
              <div className="ws-levels-grid">
                {currentPack.levels.map((lvl, lIdx) => {
                  const progress = progressData.completedLevels[lvl.id];
                  const isDone = Boolean(progress);
                  const stars = progress?.stars || 0;
                  const isCurrent = currentLevelIdx === lIdx;

                  return (
                    <button
                      key={lvl.id}
                      className={`level-tile ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => {
                        setCurrentLevelIdx(lIdx);
                        setShowLevelSelect(false);
                      }}
                    >
                      <span className="tile-num">{lvl.id}</span>
                      <span className="tile-title">{lvl.title}</span>
                      <div className="tile-stars">
                        {'★'.repeat(stars) + '☆'.repeat(3 - stars)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ws-random-config-box">
                <h3>Procedural Solvable Level Generator</h3>
                <p>Generate guaranteed-solvable fluid sort puzzles with custom parameters.</p>
                <div className="random-sliders">
                  <label>
                    Number of Colors: <strong>{randomConfig.colors}</strong>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      value={randomConfig.colors}
                      onChange={(e) => setRandomConfig((c) => ({ ...c, colors: parseInt(e.target.value, 10) }))}
                    />
                  </label>
                  <label>
                    Empty Buffer Tubes: <strong>{randomConfig.empty}</strong>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={randomConfig.empty}
                      onChange={(e) => setRandomConfig((c) => ({ ...c, empty: parseInt(e.target.value, 10) }))}
                    />
                  </label>
                </div>
                <button
                  className="ws-generate-btn"
                  onClick={() => {
                    handleGenerateRandom(randomConfig.colors, randomConfig.empty);
                    setShowLevelSelect(false);
                  }}
                >
                  🚀 Generate & Play Puzzle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Victory Complete Dialog Modal ── */}
      {showVictory && victoryStats && (
        <div className="ws-modal-backdrop victory-backdrop">
          {/* Confetti Animation Elements */}
          <div className="confetti-container">
            {confetti.map((c) => (
              <div
                key={c.id}
                className="confetti-piece"
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  width: `${c.size}px`,
                  height: `${c.size * 0.5}px`,
                  backgroundColor: c.color,
                  transform: `rotate(${c.rotation}deg)`,
                  animationDuration: `${c.animDuration}s`
                }}
              />
            ))}
          </div>

          <div className="ws-modal-card victory-card">
            <div className="vic-flask-icon">🧪✨</div>
            <h2 className="vic-title">PERFECT SORT!</h2>
            <p className="vic-sub">All chemical layers separated and sealed.</p>

            {/* Star Rating */}
            <div className="vic-stars-row">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`vic-star ${s <= victoryStats.stars ? 'earned' : 'empty'}`}
                >
                  ★
                </span>
              ))}
            </div>

            {/* Victory Statistics */}
            <div className="vic-stats-grid">
              <div className="vic-stat-box">
                <span className="vic-s-lbl">TOTAL MOVES</span>
                <span className="vic-s-val">{victoryStats.moves}</span>
                <span className="vic-s-sub">Par: {victoryStats.parMoves}</span>
              </div>
              <div className="vic-stat-box">
                <span className="vic-s-lbl">COMPLETION TIME</span>
                <span className="vic-s-val">{victoryStats.time}</span>
                <span className="vic-s-sub">Fast & Precise</span>
              </div>
              <div className="vic-stat-box">
                <span className="vic-s-lbl">TOTAL STARS</span>
                <span className="vic-s-val">⭐ {victoryStats.totalStars}</span>
                <span className="vic-s-sub">Mastery Progress</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="vic-actions">
              <button className="vic-btn vic-replay-btn" onClick={handleRestart}>
                🔄 Replay
              </button>
              <button className="vic-btn vic-next-btn" onClick={handleNextLevel}>
                Next Level ➔
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


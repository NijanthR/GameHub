import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  generatePuzzle,
  cloneBoard,
  getAllCandidates,
  findBoardConflicts,
  getDigitCounts,
  findSmartHint
} from '../utils/sudokuEngine';
import {
  playSudokuPlaceSound,
  playSudokuNoteSound,
  playSudokuEraseSound,
  playSudokuErrorSound,
  playSudokuHintSound,
  playSudokuBlockCompleteSound,
  playSudokuVictorySound
} from '../utils/soundEffects';
import { recordSudokuOutcome } from '../utils/statsService';
import './Sudoku.css';

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', multiplier: 1, baseScore: 1000, color: '#10b981' },
  medium: { label: 'Medium', multiplier: 1.5, baseScore: 2000, color: '#06b6d4' },
  hard: { label: 'Hard', multiplier: 2.2, baseScore: 3500, color: '#f59e0b' },
  expert: { label: 'Expert', multiplier: 3.5, baseScore: 5000, color: '#ec4899' }
};

export default function Sudoku() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';
  const navigate = useNavigate();

  // Settings & Toggles
  const [difficulty, setDifficulty] = useState('easy');
  const [relaxedMode, setRelaxedMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highlightSame, setHighlightSame] = useState(true);
  const [highlightConflicts, setHighlightConflicts] = useState(true);
  const [autoRemoveNotes, setAutoRemoveNotes] = useState(true);

  // Game Board State
  const [board, setBoard] = useState(Array.from({ length: 9 }, () => Array(9).fill(0)));
  const [initialClues, setInitialClues] = useState(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [solution, setSolution] = useState(null);
  const [notes, setNotes] = useState(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => [])));
  
  // Selection & Tools
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const maxMistakes = 3;
  const [hintsUsed, setHintsUsed] = useState(0);
  const [score, setScore] = useState(0);

  // Undo / Redo History Stack
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Timer & Game States
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(null); // 'WON' | 'LOST' | null
  const [activeHint, setActiveHint] = useState(null);
  const [showHintModal, setShowHintModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showDefeatModal, setShowDefeatModal] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [shakeCell, setShakeCell] = useState(null);

  const boardRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Format Time MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Initialize New Puzzle ──
  const startNewGame = useCallback((diff = difficulty) => {
    const puzData = generatePuzzle(diff);
    const initialClueMatrix = Array.from({ length: 9 }, () => Array(9).fill(false));
    
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzData.puzzle[r][c] !== 0) {
          initialClueMatrix[r][c] = true;
        }
      }
    }

    const emptyNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));

    setDifficulty(diff);
    setBoard(puzData.puzzle);
    setInitialClues(initialClueMatrix);
    setSolution(puzData.solution);
    setNotes(emptyNotes);
    setSelectedCell({ r: 4, c: 4 });
    setMistakes(0);
    setHintsUsed(0);
    setScore(DIFFICULTY_CONFIG[diff].baseScore);
    setTimerSeconds(0);
    setIsPaused(false);
    setGameOver(null);
    setActiveHint(null);
    setShowHintModal(false);
    setShowVictoryModal(false);
    setShowDefeatModal(false);
    setConfetti([]);

    const initialSnapshot = {
      board: cloneBoard(puzData.puzzle),
      notes: emptyNotes.map(row => row.map(cell => [...cell]))
    };
    setHistory([initialSnapshot]);
    setHistoryIdx(0);
  }, [difficulty]);

  // Initial load
  useEffect(() => {
    startNewGame(difficulty);
  }, []);

  // ── Timer Effect ──
  useEffect(() => {
    if (isPaused || gameOver) {
      clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [isPaused, gameOver]);

  // ── Push State to Undo/Redo Stack ──
  const pushHistory = (newBoard, newNotes) => {
    const snapshot = {
      board: cloneBoard(newBoard),
      notes: newNotes.map(row => row.map(cell => [...cell]))
    };
    const updated = history.slice(0, historyIdx + 1);
    updated.push(snapshot);
    if (updated.length > 50) updated.shift(); // Max 50 undos
    setHistory(updated);
    setHistoryIdx(updated.length - 1);
  };

  // ── Check Board Completion ──
  const checkVictory = (currentBoard) => {
    if (!solution) return false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  };

  // ── Handle Victory Trigger ──
  const triggerVictory = (finalScore) => {
    setGameOver('WON');
    setShowVictoryModal(true);
    if (soundEnabled) playSudokuVictorySound();

    // Record Stats
    recordSudokuOutcome(userId, {
      difficulty,
      timeSeconds: timerSeconds,
      timeStr: formatTime(timerSeconds),
      mistakes,
      hintsUsed,
      won: true,
      score: finalScore
    });

    // Generate vibrant confetti particles
    const confettiColors = ['#22d3ee', '#ec4899', '#f59e0b', '#10b981', '#a855f7', '#3b82f6'];
    const particles = Array.from({ length: 65 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      size: Math.random() * 8 + 6,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      rotate: Math.random() * 360
    }));
    setConfetti(particles);
  };

  // ── Check if a block/row/col was just finished ──
  const checkIfSectorCompleted = (currBoard, r, c) => {
    // Check Row
    let rowDone = true;
    for (let col = 0; col < 9; col++) {
      if (currBoard[r][col] !== solution[r][col]) { rowDone = false; break; }
    }
    // Check Col
    let colDone = true;
    for (let row = 0; row < 9; row++) {
      if (currBoard[row][c] !== solution[row][c]) { colDone = false; break; }
    }
    // Check Box
    let boxDone = true;
    const startR = Math.floor(r / 3) * 3;
    const startC = Math.floor(c / 3) * 3;
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        if (currBoard[startR + br][startC + bc] !== solution[startR + br][startC + bc]) {
          boxDone = false;
          break;
        }
      }
    }

    if (rowDone || colDone || boxDone) {
      if (soundEnabled) playSudokuBlockCompleteSound();
    }
  };

  // ── Input Number into Cell ──
  const handleInputNumber = (num) => {
    if (!selectedCell || isPaused || gameOver) return;
    const { r, c } = selectedCell;
    if (initialClues[r][c]) return; // Cannot edit original clue

    // Notes Mode
    if (notesMode) {
      const cellNotes = notes[r][c];
      const newCellNotes = cellNotes.includes(num)
        ? cellNotes.filter(n => n !== num)
        : [...cellNotes, num].sort();

      const newNotes = notes.map((rowArr, rowIdx) =>
        rowArr.map((cellArr, colIdx) => (rowIdx === r && colIdx === c ? newCellNotes : [...cellArr]))
      );

      setNotes(newNotes);
      pushHistory(board, newNotes);
      if (soundEnabled) playSudokuNoteSound();
      return;
    }

    // Normal Placement Mode
    if (board[r][c] === num) {
      // Toggle off / erase if pressing identical number
      handleErase();
      return;
    }

    const isCorrect = solution && solution[r][c] === num;
    const newBoard = cloneBoard(board);
    newBoard[r][c] = num;

    // Clear notes in this cell
    const newNotes = notes.map((rowArr, rowIdx) =>
      rowArr.map((cellArr, colIdx) => {
        if (rowIdx === r && colIdx === c) return [];
        // Auto remove notes in same row, column, or 3x3 box
        if (autoRemoveNotes && isCorrect) {
          const inSameRow = rowIdx === r;
          const inSameCol = colIdx === c;
          const inSameBox = Math.floor(rowIdx / 3) === Math.floor(r / 3) && Math.floor(colIdx / 3) === Math.floor(c / 3);
          if (inSameRow || inSameCol || inSameBox) {
            return cellArr.filter(n => n !== num);
          }
        }
        return [...cellArr];
      })
    );

    setBoard(newBoard);
    setNotes(newNotes);
    pushHistory(newBoard, newNotes);

    if (isCorrect) {
      if (soundEnabled) playSudokuPlaceSound();
      // Add points
      setScore(prev => prev + Math.max(20, Math.floor(100 * DIFFICULTY_CONFIG[difficulty].multiplier - timerSeconds * 0.1)));
      checkIfSectorCompleted(newBoard, r, c);

      // Check for Game Victory
      if (checkVictory(newBoard)) {
        const finalScore = score + 500;
        setScore(finalScore);
        triggerVictory(finalScore);
      }
    } else {
      // Incorrect Placement
      if (soundEnabled) playSudokuErrorSound();
      setShakeCell({ r, c });
      setTimeout(() => setShakeCell(null), 500);

      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      setScore(prev => Math.max(0, prev - 150));

      if (!relaxedMode && nextMistakes >= maxMistakes) {
        setGameOver('LOST');
        setShowDefeatModal(true);
        recordSudokuOutcome(userId, {
          difficulty,
          timeSeconds: timerSeconds,
          timeStr: formatTime(timerSeconds),
          mistakes: nextMistakes,
          hintsUsed,
          won: false,
          score: 0
        });
      }
    }
  };

  // ── Erase Current Cell ──
  const handleErase = () => {
    if (!selectedCell || isPaused || gameOver) return;
    const { r, c } = selectedCell;
    if (initialClues[r][c]) return;
    if (board[r][c] === 0 && notes[r][c].length === 0) return;

    const newBoard = cloneBoard(board);
    newBoard[r][c] = 0;

    const newNotes = notes.map((rowArr, rowIdx) =>
      rowArr.map((cellArr, colIdx) => (rowIdx === r && colIdx === c ? [] : [...cellArr]))
    );

    setBoard(newBoard);
    setNotes(newNotes);
    pushHistory(newBoard, newNotes);
    if (soundEnabled) playSudokuEraseSound();
  };

  // ── Undo & Redo ──
  const handleUndo = () => {
    if (historyIdx <= 0 || isPaused || gameOver) return;
    const nextIdx = historyIdx - 1;
    const snapshot = history[nextIdx];
    setBoard(cloneBoard(snapshot.board));
    setNotes(snapshot.notes.map(r => r.map(c => [...c])));
    setHistoryIdx(nextIdx);
    if (soundEnabled) playSudokuNoteSound();
  };

  const handleRedo = () => {
    if (historyIdx >= history.length - 1 || isPaused || gameOver) return;
    const nextIdx = historyIdx + 1;
    const snapshot = history[nextIdx];
    setBoard(cloneBoard(snapshot.board));
    setNotes(snapshot.notes.map(r => r.map(c => [...c])));
    setHistoryIdx(nextIdx);
    if (soundEnabled) playSudokuNoteSound();
  };

  // ── Auto Fill Candidates / Pencil Notes ──
  const handleAutoNotes = () => {
    if (isPaused || gameOver) return;
    const candidates = getAllCandidates(board);
    const newNotes = notes.map((rowArr, r) =>
      rowArr.map((cellArr, c) => {
        if (board[r][c] !== 0) return [];
        return candidates[r][c];
      })
    );
    setNotes(newNotes);
    pushHistory(board, newNotes);
    if (soundEnabled) playSudokuHintSound();
  };

  // ── AI Smart Hint ──
  const handleRequestHint = () => {
    if (isPaused || gameOver) return;
    const hint = findSmartHint(board, solution, initialClues);
    if (hint) {
      setActiveHint(hint);
      setShowHintModal(true);
      setSelectedCell({ r: hint.r, c: hint.c });
      setHintsUsed(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 200));
      if (soundEnabled) playSudokuHintSound();
    }
  };

  const handleApplyHint = () => {
    if (!activeHint) return;
    const { r, c, val } = activeHint;
    setSelectedCell({ r, c });

    const newBoard = cloneBoard(board);
    newBoard[r][c] = val;

    const newNotes = notes.map((rowArr, rowIdx) =>
      rowArr.map((cellArr, colIdx) => {
        if (rowIdx === r && colIdx === c) return [];
        if (autoRemoveNotes) {
          const inSameRow = rowIdx === r;
          const inSameCol = colIdx === c;
          const inSameBox = Math.floor(rowIdx / 3) === Math.floor(r / 3) && Math.floor(colIdx / 3) === Math.floor(c / 3);
          if (inSameRow || inSameCol || inSameBox) return cellArr.filter(n => n !== val);
        }
        return [...cellArr];
      })
    );

    setBoard(newBoard);
    setNotes(newNotes);
    pushHistory(newBoard, newNotes);
    setShowHintModal(false);
    setActiveHint(null);
    if (soundEnabled) playSudokuPlaceSound();

    if (checkVictory(newBoard)) {
      triggerVictory(score);
    }
  };

  // ── Restart Current Puzzle ──
  const handleRestart = () => {
    const resetBoard = cloneBoard(board);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!initialClues[r][c]) resetBoard[r][c] = 0;
      }
    }
    const emptyNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    setBoard(resetBoard);
    setNotes(emptyNotes);
    setMistakes(0);
    setTimerSeconds(0);
    setGameOver(null);
    setShowDefeatModal(false);
    setShowVictoryModal(false);
    const initialSnap = {
      board: cloneBoard(resetBoard),
      notes: emptyNotes
    };
    setHistory([initialSnap]);
    setHistoryIdx(0);
  };

  // ── Global Keyboard Navigation ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showSettingsModal || showVictoryModal || showDefeatModal) return;

      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
        return;
      }

      if (isPaused || gameOver) return;

      // Digits 1-9
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleInputNumber(parseInt(e.key, 10));
        return;
      }

      // Erase
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleErase();
        return;
      }

      // Notes Toggle
      if (e.key === 'n' || e.key === 'N' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setNotesMode(prev => !prev);
        return;
      }

      // Hint
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleRequestHint();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Arrow Key Navigation
      if (!selectedCell) return;
      let { r, c } = selectedCell;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setSelectedCell({ r: (r + 8) % 9, c });
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSelectedCell({ r: (r + 1) % 9, c });
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setSelectedCell({ r, c: (c + 8) % 9 });
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setSelectedCell({ r, c: (c + 1) % 9 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, notesMode, isPaused, gameOver, showSettingsModal, showVictoryModal, showDefeatModal, board, notes, historyIdx]);

  // Calculations for UI highlight states
  const selectedNum = selectedCell ? board[selectedCell.r][selectedCell.c] : null;
  const conflicts = highlightConflicts ? findBoardConflicts(board) : new Set();
  const digitCounts = getDigitCounts(board);

  return (
    <div className="sudoku-container">
      {/* Dynamic Background Gradients */}
      <div className="sdk-blob sdk-blob-1" />
      <div className="sdk-blob sdk-blob-2" />
      <div className="sdk-grid-pattern" />

      {/* ── Top Header Navigation ── */}
      <header className="sudoku-header">
        <div className="header-left">
          <Link to="/" className="btn-back-hub" title="Return to Game Hub">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Hub</span>
          </Link>

          <div className="game-brand">
            <div className="sudoku-badge-icon">
              <span>9</span>
            </div>
            <div className="brand-text">
              <h1>Sudoku AI</h1>
              <span className="brand-sub">Neural Matrix Puzzle</span>
            </div>
          </div>
        </div>

        {/* Difficulty Selector Tabs */}
        <div className="difficulty-pills">
          {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              className={`pill-btn ${difficulty === key ? 'active' : ''}`}
              onClick={() => startNewGame(key)}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Action / Setting Buttons */}
        <div className="header-right">
          <button
            className="btn-icon-hud"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            className="btn-icon-hud"
            onClick={() => setShowSettingsModal(true)}
            title="Game Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Main Game Arena ── */}
      <main className="sudoku-main">
        {/* HUD Info Bar */}
        <div className="sudoku-hud">
          {/* Mistakes Counter */}
          <div className="hud-card hud-mistakes">
            <span className="hud-label">Mistakes</span>
            <span className={`hud-val ${mistakes > 0 ? 'has-mistakes' : ''}`}>
              {relaxedMode ? `${mistakes} (Relaxed)` : `${mistakes} / ${maxMistakes}`}
            </span>
          </div>

          {/* Live Timer */}
          <div className="hud-card hud-timer">
            <span className="hud-label">Timer</span>
            <div className="timer-display">
              <span className="timer-digits">{formatTime(timerSeconds)}</span>
              <button
                className="btn-pause-toggle"
                onClick={() => setIsPaused(!isPaused)}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            </div>
          </div>

          {/* Score Counter */}
          <div className="hud-card hud-score">
            <span className="hud-label">Score</span>
            <span className="hud-val score-glow">{score.toLocaleString()}</span>
          </div>
        </div>

        {/* ── 9x9 Sudoku Board ── */}
        <div className="board-wrapper">
          <div
            className={`sudoku-board ${isPaused ? 'blurred' : ''}`}
            ref={boardRef}
          >
            {board.map((row, r) => (
              <div key={`row-${r}`} className="board-row">
                {row.map((val, c) => {
                  const isGiven = initialClues[r][c];
                  const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                  const inSameRow = selectedCell?.r === r;
                  const inSameCol = selectedCell?.c === c;
                  const inSameBox = selectedCell &&
                    Math.floor(selectedCell.r / 3) === Math.floor(r / 3) &&
                    Math.floor(selectedCell.c / 3) === Math.floor(c / 3);
                  const isCrosshair = inSameRow || inSameCol || inSameBox;
                  const isSameNumber = highlightSame && selectedNum && selectedNum !== 0 && val === selectedNum;
                  const isError = conflicts.has(`${r},${c}`) || (val !== 0 && !isGiven && solution && val !== solution[r][c]);
                  const isHintTarget = activeHint && activeHint.r === r && activeHint.c === c;
                  const isShaking = shakeCell && shakeCell.r === r && shakeCell.c === c;

                  // 3x3 Border styling
                  const borderClasses = [
                    r % 3 === 2 && r !== 8 ? 'border-b-thick' : '',
                    c % 3 === 2 && c !== 8 ? 'border-r-thick' : ''
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={`cell-${r}-${c}`}
                      className={`sudoku-cell ${borderClasses} ${isGiven ? 'clue-given' : 'user-placed'} ${isSelected ? 'cell-selected' : ''} ${isCrosshair && !isSelected ? 'cell-crosshair' : ''} ${isSameNumber && !isSelected ? 'cell-same-num' : ''} ${isError ? 'cell-conflict' : ''} ${isHintTarget ? 'cell-hint-glow' : ''} ${isShaking ? 'cell-shake' : ''}`}
                      onClick={() => {
                        if (!isPaused && !gameOver) {
                          setSelectedCell({ r, c });
                          if (soundEnabled && !isSelected) playSudokuNoteSound();
                        }
                      }}
                    >
                      {/* Cell Value */}
                      {val !== 0 ? (
                        <span className="cell-digit">{val}</span>
                      ) : (
                        /* Pencil Marks / Notes 3x3 Mini Grid */
                        notes[r][c]?.length > 0 && (
                          <div className="cell-notes-grid">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                              <span
                                key={`note-${n}`}
                                className={`note-num ${notes[r][c].includes(n) ? 'visible' : ''} ${selectedNum === n ? 'note-highlight' : ''}`}
                              >
                                {notes[r][c].includes(n) ? n : ''}
                              </span>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Pause Screen Overlay */}
          {isPaused && (
            <div className="pause-overlay">
              <div className="pause-card">
                <span className="pause-icon">⏸️</span>
                <h2>Game Paused</h2>
                <p>Time elapsed: {formatTime(timerSeconds)}</p>
                <button className="btn-resume" onClick={() => setIsPaused(false)}>
                  Resume Puzzle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Action Control Toolbar ── */}
        <div className="action-toolbar">
          <button
            className="tool-btn"
            onClick={handleUndo}
            disabled={historyIdx <= 0 || isPaused || gameOver}
            title="Undo (Ctrl+Z)"
          >
            <span className="tool-icon">↩️</span>
            <span className="tool-name">Undo</span>
          </button>

          <button
            className="tool-btn"
            onClick={handleRedo}
            disabled={historyIdx >= history.length - 1 || isPaused || gameOver}
            title="Redo (Ctrl+Y)"
          >
            <span className="tool-icon">↪️</span>
            <span className="tool-name">Redo</span>
          </button>

          <button
            className="tool-btn"
            onClick={handleErase}
            disabled={isPaused || gameOver}
            title="Erase (Backspace/Delete)"
          >
            <span className="tool-icon">⌫</span>
            <span className="tool-name">Erase</span>
          </button>

          <button
            className={`tool-btn ${notesMode ? 'tool-active' : ''}`}
            onClick={() => setNotesMode(!notesMode)}
            disabled={isPaused || gameOver}
            title="Toggle Notes / Pencil (N)"
          >
            <span className="tool-icon">✏️</span>
            <span className="tool-name">Notes {notesMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            className="tool-btn btn-hint-glow"
            onClick={handleRequestHint}
            disabled={isPaused || gameOver}
            title="AI Smart Hint (H)"
          >
            <span className="tool-icon">💡</span>
            <span className="tool-name">AI Hint</span>
          </button>

          <button
            className="tool-btn"
            onClick={handleAutoNotes}
            disabled={isPaused || gameOver}
            title="Auto Candidate Notes"
          >
            <span className="tool-icon">⚡</span>
            <span className="tool-name">Auto Notes</span>
          </button>
        </div>

        {/* ── 1-9 Number Pad ── */}
        <div className="numpad-container">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const count = digitCounts[num] || 0;
            const isCompleted = count >= 9;

            return (
              <button
                key={`numpad-${num}`}
                className={`num-btn ${isCompleted ? 'num-completed' : ''} ${selectedNum === num ? 'num-selected' : ''}`}
                onClick={() => handleInputNumber(num)}
                disabled={isPaused || gameOver}
              >
                <span className="num-digit">{num}</span>
                <span className="num-count">
                  {isCompleted ? '✓' : `${9 - count} left`}
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {/* ── AI Hint Modal ── */}
      {showHintModal && activeHint && (
        <div className="modal-backdrop">
          <div className="modal-card hint-modal">
            <div className="modal-header">
              <span className="modal-badge">{activeHint.title}</span>
              <button className="modal-close" onClick={() => setShowHintModal(false)}>✕</button>
            </div>
            <div className="hint-body">
              <p className="hint-text">{activeHint.message}</p>
              <div className="hint-value-card">
                <span>Recommended Value:</span>
                <span className="hint-big-num">{activeHint.val}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-sub" onClick={() => setShowHintModal(false)}>
                Dismiss
              </button>
              <button className="btn-modal-pri" onClick={handleApplyHint}>
                Apply AI Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettingsModal && (
        <div className="modal-backdrop">
          <div className="modal-card settings-modal">
            <div className="modal-header">
              <h2>⚙️ Sudoku Settings</h2>
              <button className="modal-close" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <div className="settings-list">
              <label className="setting-item">
                <div className="setting-info">
                  <span className="setting-title">Sound Effects</span>
                  <span className="setting-desc">Tactile clicks and celebration audio</span>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              </label>

              <label className="setting-item">
                <div className="setting-info">
                  <span className="setting-title">Relaxed Mode (Infinite Mistakes)</span>
                  <span className="setting-desc">Disable the 3-strikes game over limit</span>
                </div>
                <input
                  type="checkbox"
                  checked={relaxedMode}
                  onChange={(e) => setRelaxedMode(e.target.checked)}
                />
              </label>

              <label className="setting-item">
                <div className="setting-info">
                  <span className="setting-title">Highlight Matching Numbers</span>
                  <span className="setting-desc">Glow all instances of the selected digit</span>
                </div>
                <input
                  type="checkbox"
                  checked={highlightSame}
                  onChange={(e) => setHighlightSame(e.target.checked)}
                />
              </label>

              <label className="setting-item">
                <div className="setting-info">
                  <span className="setting-title">Highlight Conflicts</span>
                  <span className="setting-desc">Mark duplicate row/column/box errors</span>
                </div>
                <input
                  type="checkbox"
                  checked={highlightConflicts}
                  onChange={(e) => setHighlightConflicts(e.target.checked)}
                />
              </label>

              <label className="setting-item">
                <div className="setting-info">
                  <span className="setting-title">Auto-Remove Notes</span>
                  <span className="setting-desc">Remove candidate pencil marks when number is placed</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoRemoveNotes}
                  onChange={(e) => setAutoRemoveNotes(e.target.checked)}
                />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-pri" onClick={() => setShowSettingsModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Victory Celebration Modal ── */}
      {showVictoryModal && (
        <div className="modal-backdrop">
          <div className="modal-card victory-modal">
            {/* Confetti Animation Elements */}
            {confetti.map((p) => (
              <div
                key={p.id}
                className="confetti-particle"
                style={{
                  left: `${p.x}%`,
                  animationDelay: `${p.delay}s`,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: p.color,
                  transform: `rotate(${p.rotate}deg)`
                }}
              />
            ))}

            <div className="victory-icon-wrap">
              <span className="victory-trophy">🏆</span>
            </div>
            <h2 className="victory-title">Puzzle Completed!</h2>
            <p className="victory-sub">Exceptional logic and deductive skills!</p>

            <div className="victory-stats-grid">
              <div className="v-stat-card">
                <span className="v-stat-label">Difficulty</span>
                <span className="v-stat-val diff-tag">{DIFFICULTY_CONFIG[difficulty].label}</span>
              </div>
              <div className="v-stat-card">
                <span className="v-stat-label">Time</span>
                <span className="v-stat-val">{formatTime(timerSeconds)}</span>
              </div>
              <div className="v-stat-card">
                <span className="v-stat-label">Mistakes</span>
                <span className="v-stat-val">{mistakes}</span>
              </div>
              <div className="v-stat-card">
                <span className="v-stat-label">Hints Used</span>
                <span className="v-stat-val">{hintsUsed}</span>
              </div>
            </div>

            <div className="v-score-banner">
              <span>Final Score</span>
              <strong>{score.toLocaleString()} PTS</strong>
            </div>

            <div className="modal-footer victory-actions">
              <button className="btn-modal-sub" onClick={() => navigate('/')}>
                Hub
              </button>
              <button className="btn-modal-pri" onClick={() => startNewGame(difficulty)}>
                Next Puzzle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Defeat Modal ── */}
      {showDefeatModal && (
        <div className="modal-backdrop">
          <div className="modal-card defeat-modal">
            <span className="defeat-icon">💥</span>
            <h2 className="defeat-title">3 Mistakes Made</h2>
            <p className="defeat-sub">You exceeded the mistake limit for this challenge.</p>
            <div className="modal-footer">
              <button className="btn-modal-sub" onClick={() => navigate('/')}>
                Exit to Hub
              </button>
              <button className="btn-modal-sub" onClick={handleRestart}>
                Restart
              </button>
              <button className="btn-modal-pri" onClick={() => startNewGame(difficulty)}>
                New Puzzle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recordTttOutcome } from '../utils/statsService';
import './TicTacToe.css';

/* ── helpers ── */
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function calcWinner(squares) {
  for (const [a, b, c] of WINNING_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  return null;
}

function bestMove(squares) {
  // minimax AI
  function minimax(sq, isMaximizing) {
    const w = calcWinner(sq);
    if (w) return w.winner === 'O' ? 10 : -10;
    if (sq.every(Boolean)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      sq.forEach((v, i) => {
        if (!v) {
          sq[i] = 'O';
          best = Math.max(best, minimax(sq, false));
          sq[i] = null;
        }
      });
      return best;
    } else {
      let best = Infinity;
      sq.forEach((v, i) => {
        if (!v) {
          sq[i] = 'X';
          best = Math.min(best, minimax(sq, true));
          sq[i] = null;
        }
      });
      return best;
    }
  }

  let bestVal = -Infinity, move = -1;
  squares.forEach((v, i) => {
    if (!v) {
      const copy = [...squares];
      copy[i] = 'O';
      const val = minimax(copy, false);
      if (val > bestVal) { bestVal = val; move = i; }
    }
  });
  return move;
}

/* ── Easy AI: random empty cell ── */
function easyMove(squares) {
  const empty = squares.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)] ?? -1;
}

/* ── Medium AI: tactical (win/block) but no strategic depth ── */
function mediumMove(squares) {
  // 1. Take a winning move if available
  for (let i = 0; i < 9; i++) {
    if (!squares[i]) {
      const copy = [...squares]; copy[i] = 'O';
      if (calcWinner(copy)) return i;
    }
  }
  // 2. Block player's immediate win
  for (let i = 0; i < 9; i++) {
    if (!squares[i]) {
      const copy = [...squares]; copy[i] = 'X';
      if (calcWinner(copy)) return i;
    }
  }
  // 3. No threat — pick randomly (no fork/corner strategy)
  return easyMove(squares);
}

/* ── Win Probability Calculator ── */
// Enumerate ALL possible future game continuations and count outcomes
function calcWinProbabilities(squares, xIsNext) {
  let xWins = 0, oWins = 0, draws = 0;

  function explore(sq, isX) {
    const w = calcWinner(sq);
    if (w) { w.winner === 'X' ? xWins++ : oWins++; return; }
    if (sq.every(Boolean)) { draws++; return; }
    sq.forEach((v, i) => {
      if (!v) {
        sq[i] = isX ? 'X' : 'O';
        explore(sq, !isX);
        sq[i] = null;
      }
    });
  }

  const copy = [...squares];
  explore(copy, xIsNext);
  const total = xWins + oWins + draws || 1;
  return {
    x: Math.round((xWins / total) * 100),
    o: Math.round((oWins / total) * 100),
    draw: Math.round((draws / total) * 100),
  };
}

/* ── Cell ── */
function Cell({ value, index, onClick, winning, disabled }) {
  return (
    <button
      id={`cell-${index}`}
      className={`cell ${value ? 'filled' : ''} ${winning ? 'winning' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Cell ${index + 1}: ${value || 'empty'}`}
    >
      {value && (
        <span className={`cell-mark ${value === 'X' ? 'x-mark' : 'o-mark'}`}>
          {value === 'X' ? (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="12" y1="12" x2="48" y2="48" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round"/>
              <line x1="48" y1="12" x2="12" y2="48" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="18" stroke="#ec4899" strokeWidth="5"/>
            </svg>
          )}
        </span>
      )}
    </button>
  );
}

/* ── Mode Selector ── */
function ModeSelector({ mode, onSelect }) {
  return (
    <div className="mode-selector" role="group" aria-label="Game mode">
      <button
        id="mode-ai"
        className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
        onClick={() => onSelect('ai')}
      >
        🤖 vs AI
      </button>
      <button
        id="mode-pvp"
        className={`mode-btn ${mode === 'pvp' ? 'active' : ''}`}
        onClick={() => onSelect('pvp')}
      >
        👤 vs Player
      </button>
    </div>
  );
}

/* ── Difficulty Selector ── */
function DifficultySelector({ difficulty, onSelect }) {
  return (
    <div className="diff-selector" role="group" aria-label="AI difficulty">
      <div className="diff-label">AI Difficulty</div>
      <div className="diff-btns">
        <button
          id="diff-easy"
          className={`diff-btn ${difficulty === 'easy' ? 'active-easy' : ''}`}
          onClick={() => onSelect('easy')}
        >
          <span className="diff-icon">😊</span>
          Easy
        </button>
        <button
          id="diff-medium"
          className={`diff-btn ${difficulty === 'medium' ? 'active-medium' : ''}`}
          onClick={() => onSelect('medium')}
        >
          <span className="diff-icon">⚡</span>
          Medium
        </button>
        <button
          id="diff-hard"
          className={`diff-btn ${difficulty === 'hard' ? 'active-hard' : ''}`}
          onClick={() => onSelect('hard')}
        >
          <span className="diff-icon">🧠</span>
          Hard
        </button>
      </div>
    </div>
  );
}

/* ── Score Board ── */
function ScoreBoard({ scores, mode }) {
  return (
    <div className="scoreboard">
      <div className="score-item">
        <span className="score-label x-label">You (X)</span>
        <span className="score-val">{scores.X}</span>
      </div>
      <div className="score-item draw-item">
        <span className="score-label">Draw</span>
        <span className="score-val">{scores.draw}</span>
      </div>
      <div className="score-item">
        <span className="score-label o-label">{mode === 'ai' ? 'AI (O)' : 'P2 (O)'}</span>
        <span className="score-val">{scores.O}</span>
      </div>
    </div>
  );
}

/* ── Status Banner ── */
function StatusBanner({ status, mode }) {
  const icons = { X: '🎉', O: mode === 'ai' ? '🤖' : '🎉', draw: '🤝' };
  const labels = {
    X: "You win!",
    O: mode === 'ai' ? "AI wins!" : "Player 2 wins!",
    draw: "It's a draw!",
    playing_X: "Your turn (X)",
    playing_O: mode === 'ai' ? "AI is thinking…" : "Player 2's turn (O)",
  };
  const key = status.winner ? status.winner : status.draw ? 'draw' : `playing_${status.turn}`;
  return (
    <div className={`status-banner ${status.winner ? 'status-win' : ''} ${status.draw ? 'status-draw' : ''}`}>
      <span className="status-icon">{icons[key] ?? '🎮'}</span>
      <span className="status-text">{labels[key]}</span>
    </div>
  );
}

/* ── Thinking Indicator ── */
function ThinkingDots() {
  return (
    <div className="thinking" aria-live="polite" aria-label="AI is thinking">
      <span className="think-dot" /><span className="think-dot" /><span className="think-dot" />
      <span className="think-label">AI reasoning…</span>
    </div>
  );
}

/* ── Win Probability Bar ── */
function WinProbabilityBar({ probs, mode, isDraw, isEmpty }) {
  // Empty board or draw → always 50/50
  const xPct = (isEmpty || isDraw) ? 50 : Math.round((probs.x / (probs.x + probs.o || 1)) * 100);
  const oPct = 100 - xPct;
  return (
    <div className="prob-container">
      <div className="prob-bar" role="img" aria-label={`X: ${xPct}%, O: ${oPct}%`}>
        <div className="prob-seg prob-x" style={{ width: `${xPct}%` }} title={`X: ${xPct}%`} />
        <div className="prob-seg prob-o" style={{ width: `${oPct}%` }} title={`O: ${oPct}%`} />
      </div>
      <div className="prob-labels">
        <span className="prob-pct x-pct">X &nbsp;{xPct}%</span>
        <span className="prob-mid-label">Win Probability</span>
        <span className="prob-pct o-pct">{oPct}%&nbsp; {mode === 'ai' ? 'AI' : 'O'}</span>
      </div>
    </div>
  );
}

/* ── Dice faces (dots layout) ── */
const DICE_DOTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DiceFace({ value, glowing }) {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  return (
    <svg className={`dice-svg ${glowing ? 'dice-glow' : ''}`} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="96" height="96" rx="18"
        fill="#111111" stroke={glowing ? '#ffffff' : '#444444'} strokeWidth="2"/>
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8"
          fill={glowing ? '#ffffff' : '#e2e2e2'}
          style={{ filter: glowing ? 'drop-shadow(0 0 5px #fff)' : 'none' }}
        />
      ))}
    </svg>
  );
}

/* ── Dice Roll Modal ── */
function DiceRollModal({ onClose, onResult }) {
  const [rolling, setRolling] = useState(false);
  const [diceVal, setDiceVal] = useState(1);
  const [result, setResult] = useState(null); // 'X' | 'O'
  const [phase, setPhase] = useState('idle'); // idle | rolling | reveal

  useEffect(() => {
    let interval;
    if (rolling) {
      interval = setInterval(() => {
        setDiceVal(Math.ceil(Math.random() * 6));
      }, 80);
    }
    return () => clearInterval(interval);
  }, [rolling]);

  const handleRoll = () => {
    if (phase !== 'idle') return;
    setPhase('rolling');
    setRolling(true);
    setResult(null);

    setTimeout(() => {
      setRolling(false);
      const finalVal = Math.ceil(Math.random() * 6);
      setDiceVal(finalVal);
      const winner = finalVal % 2 === 1 ? 'X' : 'O'; // odd → X, even → O
      setResult(winner);
      setPhase('reveal');
    }, 2000);
  };

  const handleStart = () => {
    onResult(result);
    onClose();
  };

  return (
    <div className="dice-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dice-modal">
        <button className="dice-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="dice-title">
          <span className="dice-title-icon">🎲</span>
          Roll to Decide
        </div>
        <p className="dice-subtitle">
          {phase === 'idle' && 'Roll the dice to randomly pick who goes first!'}
          {phase === 'rolling' && 'Rolling…'}
          {phase === 'reveal' && (
            result === 'X'
              ? '🎉 Odd number — You go first! (X)'
              : '🤖 Even number — AI goes first! (O)'
          )}
        </p>

        <div className={`dice-wrap ${phase === 'rolling' ? 'dice-rolling' : ''} ${phase === 'reveal' ? 'dice-landed' : ''}`}>
          <DiceFace value={diceVal} glowing={phase === 'reveal'} />
        </div>

        {phase === 'idle' && (
          <button id="btn-roll-dice" className="btn-roll" onClick={handleRoll}>
            🎲 Roll Dice
          </button>
        )}
        {phase === 'rolling' && (
          <div className="roll-loading">
            <span className="think-dot" /><span className="think-dot" /><span className="think-dot" />
          </div>
        )}
        {phase === 'reveal' && (
          <div className="dice-reveal-actions">
            <div className={`reveal-badge ${result === 'X' ? 'badge-x' : 'badge-o'}`}>
              {result} goes first!
            </div>
            <button id="btn-start-rolled" className="btn-roll" onClick={handleStart}>
              ✅ Start Game
            </button>
          </div>
        )}

        <p className="dice-rule">Odd = X (You) · Even = O ({`${result === 'O' ? 'AI' : 'AI/P2'}`})</p>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function TicTacToe() {
  const [mode, setMode] = useState('ai');
  const [difficulty, setDifficulty] = useState('hard');
  const [squares, setSquares] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0, draw: 0 });
  const [thinking, setThinking] = useState(false);
  const [history, setHistory] = useState([]);
  const [showDice, setShowDice] = useState(false);

  const result = calcWinner(squares);
  const isDraw = !result && squares.every(Boolean);
  const winningCells = result?.line ?? [];
  const gameOver = !!result || isDraw;
  const probs = calcWinProbabilities(squares, xIsNext);

  const statusObj = {
    winner: result?.winner ?? null,
    draw: isDraw,
    turn: xIsNext ? 'X' : 'O',
  };

  const { user } = useAuth();
  const userId = user?.id || user?.email || 'default';

  const handleClick = useCallback((idx) => {
    if (squares[idx] || result || isDraw || thinking) return;
    if (mode === 'ai' && !xIsNext) return; // AI turn

    const next = squares.slice();
    next[idx] = xIsNext ? 'X' : 'O';
    setSquares(next);
    setHistory(h => [...h, { player: xIsNext ? 'X' : 'O', cell: idx }]);

    const newResult = calcWinner(next);
    if (newResult) {
      setScores(s => ({ ...s, [newResult.winner]: s[newResult.winner] + 1 }));
      setXIsNext(!xIsNext);
      recordTttOutcome(userId, {
        outcome: newResult.winner === 'X' ? 'WIN' : 'LOSS',
        mode,
        difficulty
      });
      return;
    }
    if (next.every(Boolean)) {
      setScores(s => ({ ...s, draw: s.draw + 1 }));
      setXIsNext(!xIsNext);
      recordTttOutcome(userId, {
        outcome: 'DRAW',
        mode,
        difficulty
      });
      return;
    }

    if (mode === 'ai') {
      // AI plays O
      setXIsNext(false);
      setThinking(true);
      setTimeout(() => {
      const move = difficulty === 'easy'
        ? easyMove(next)
        : difficulty === 'medium'
        ? mediumMove(next)
        : bestMove(next);
        if (move !== -1) {
          const afterAI = next.slice();
          afterAI[move] = 'O';
          setSquares(afterAI);
          setHistory(h => [...h, { player: 'O', cell: move }]);
          const aiResult = calcWinner(afterAI);
          if (aiResult) {
            setScores(s => ({ ...s, O: s.O + 1 }));
            recordTttOutcome(userId, {
              outcome: 'LOSS',
              mode,
              difficulty
            });
          } else if (afterAI.every(Boolean)) {
            setScores(s => ({ ...s, draw: s.draw + 1 }));
            recordTttOutcome(userId, {
              outcome: 'DRAW',
              mode,
              difficulty
            });
          }
        }
        setThinking(false);
        setXIsNext(true);
      }, 600 + Math.random() * 400);
    } else {
      setXIsNext(!xIsNext);
    }
  }, [squares, result, isDraw, thinking, xIsNext, mode, difficulty, userId]);

  const reset = (firstPlayer = 'X') => {
    setSquares(Array(9).fill(null));
    setXIsNext(firstPlayer === 'X');
    setThinking(false);
    setHistory([]);
  };

  const changeMode = (m) => {
    setMode(m);
    reset();
    setScores({ X: 0, O: 0, draw: 0 });
  };

  const changeDifficulty = (d) => {
    setDifficulty(d);
    reset();
    setScores({ X: 0, O: 0, draw: 0 });
  };

  const handleDiceResult = (first) => {
    reset(first);
    // If AI mode and O goes first, trigger AI move immediately
    if (mode === 'ai' && first === 'O') {
      setThinking(true);
      setTimeout(() => {
      const move = difficulty === 'easy'
        ? easyMove(Array(9).fill(null))
        : difficulty === 'medium'
        ? mediumMove(Array(9).fill(null))
        : bestMove(Array(9).fill(null));
        if (move !== -1) {
          const afterAI = Array(9).fill(null);
          afterAI[move] = 'O';
          setSquares(afterAI);
          setHistory([{ player: 'O', cell: move }]);
        }
        setThinking(false);
        setXIsNext(true);
      }, 600);
    }
  };

  const cellLabels = ['TL', 'TC', 'TR', 'ML', 'C', 'MR', 'BL', 'BC', 'BR'];

  return (
    <div className="ttt-page">
      {/* bg blobs */}
      <div className="ttt-blob ttt-blob-1" />
      <div className="ttt-blob ttt-blob-2" />

      {/* Back button */}
      <Link to="/" className="back-btn" id="btn-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Dashboard
      </Link>

      <div className="ttt-layout">
        {/* ── Left Panel ── */}
        <aside className="ttt-sidebar">
          <div className="sidebar-card">
            <h2 className="sidebar-title">
              <span className="sidebar-icon">🎮</span>
              Tic Tac Toe
            </h2>
            <p className="sidebar-desc">
              Play against the minimax AI or challenge a friend. The AI reasons through every possible move!
            </p>

            <ModeSelector mode={mode} onSelect={changeMode} />
            {mode === 'ai' && (
              <DifficultySelector difficulty={difficulty} onSelect={changeDifficulty} />
            )}
            <ScoreBoard scores={scores} mode={mode} />

            <div className="divider" />

            {/* Move history */}
            <div className="history-panel">
              <div className="history-title">Move History</div>
              {history.length === 0 ? (
                <div className="history-empty">No moves yet</div>
              ) : (
                <div className="history-list">
                  {history.map((m, i) => (
                    <div key={i} className={`history-item ${m.player === 'X' ? 'hx' : 'ho'}`}>
                      <span className="h-num">{i + 1}</span>
                      <span className={`h-mark ${m.player === 'X' ? 'x-mark' : 'o-mark'}`}>{m.player}</span>
                      <span className="h-cell">→ {cellLabels[m.cell]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Board ── */}
        <main className="ttt-main">
          <StatusBanner status={statusObj} mode={mode} />
          {thinking && <ThinkingDots />}

          <div className="ttt-board" id="ttt-board" role="grid" aria-label="Tic Tac Toe board">
            {squares.map((val, i) => (
              <Cell
                key={i}
                index={i}
                value={val}
                winning={winningCells.includes(i)}
                disabled={!!val || !!result || isDraw || thinking || (mode === 'ai' && !xIsNext)}
                onClick={() => handleClick(i)}
              />
            ))}
          </div>

          {/* Win Probability Bar — right below the grid */}
          <WinProbabilityBar
            probs={probs}
            mode={mode}
            isDraw={isDraw}
            isEmpty={squares.every(s => s === null)}
          />

          <div className="board-controls">
            <button id="btn-new-game" className="ctrl-btn primary" onClick={() => reset()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              New Game
            </button>
            <button
              id="btn-random-start"
              className="ctrl-btn dice-btn"
              onClick={() => { reset(); setShowDice(true); }}
            >
              🎲 Random Start
            </button>
            <button
              id="btn-reset-scores"
              className="ctrl-btn secondary"
              onClick={() => { setScores({ X: 0, O: 0, draw: 0 }); reset(); }}
            >
              Reset Scores
            </button>
          </div>

        </main>
      </div>

      {showDice && (
        <DiceRollModal
          onClose={() => setShowDice(false)}
          onResult={handleDiceResult}
        />
      )}
    </div>
  );
}

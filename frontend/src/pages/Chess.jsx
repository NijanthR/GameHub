import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChessPiece from '../components/ChessPiece';
import {
  getInitialBoard,
  cloneBoard,
  getLegalMoves,
  makeMove,
  getGameState,
  formatMoveNotation,
  getMaterialDifference,
  findBestMove,
  getTacticalHint,
  coordsToSquare,
  isKingInCheck,
  evaluateBoard,
  PIECE_SYMBOLS
} from '../utils/chessEngine';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playVictorySound
} from '../utils/soundEffects';
import { recordChessOutcome } from '../utils/statsService';
import './Chess.css';

const TIME_CONTROLS = [
  { label: '1 min', seconds: 60, icon: '⚡', subtitle: 'Bullet' },
  { label: '3 min', seconds: 180, icon: '🔥', subtitle: 'Blitz' },
  { label: '5 min', seconds: 300, icon: '⏱️', subtitle: 'Rapid' },
  { label: '10 min', seconds: 600, icon: '⏳', subtitle: 'Standard' },
  { label: '15 min', seconds: 900, icon: '🏆', subtitle: 'Classical' },
  { label: 'Unlimited', seconds: null, icon: '♾️', subtitle: 'Casual' }
];

/* ════════════════════════════════════════
   CHESS DICE MODAL
   Rolls to assign Black / White colors.
   Shows animated probability bar.
   ════════════════════════════════════════ */
const DICE_DOTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

function ChessDiceFace({ value, glowing }) {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  const color = glowing ? '#a5b4fc' : '#64748b';
  return (
    <svg
      className={`chess-dice-svg ${glowing ? 'chess-dice-glow' : ''}`}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="diceFaceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={glowing ? '#1e1b4b' : '#0f172a'} />
          <stop offset="100%" stopColor={glowing ? '#312e81' : '#1e293b'} />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="20"
        fill="url(#diceFaceGrad)"
        stroke={glowing ? '#6366f1' : '#334155'}
        strokeWidth="2.5"
      />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8"
          fill={color}
          style={{ filter: glowing ? 'drop-shadow(0 0 6px #818cf8)' : 'none' }}
        />
      ))}
    </svg>
  );
}

function ChessDiceModal({ gameMode, onClose, onResult }) {
  const [phase, setPhase] = useState('idle'); // idle | rolling | reveal
  const [diceVal, setDiceVal] = useState(1);
  const [barPct, setBarPct] = useState(50); // probability bar 0-100 (white side)
  const [resultColor, setResultColor] = useState(null); // 'w' | 'b'
  const intervalRef = useState(null);

  // Shuffle dice face + bar during roll
  useEffect(() => {
    if (phase !== 'rolling') return;
    const iv = setInterval(() => {
      setDiceVal(Math.ceil(Math.random() * 6));
      setBarPct(Math.random() * 100);
    }, 80);
    return () => clearInterval(iv);
  }, [phase]);

  const handleRoll = () => {
    if (phase !== 'idle') return;
    setPhase('rolling');

    setTimeout(() => {
      const finalVal  = Math.ceil(Math.random() * 6);
      // Odd → player gets White, Even → player gets Black
      const playerGetsWhite = finalVal % 2 === 1;
      const finalPct  = playerGetsWhite ? Math.floor(Math.random() * 30) + 60 : Math.floor(Math.random() * 30) + 10;
      setDiceVal(finalVal);
      setBarPct(finalPct);
      setResultColor(playerGetsWhite ? 'w' : 'b');
      setPhase('reveal');
    }, 2200);
  };

  const handleStart = () => {
    onResult(resultColor);
    onClose();
  };

  const playerLabel = gameMode === 'pvp' ? 'Player 1' : 'You';
  const opponentLabel = gameMode === 'pvp' ? 'Player 2' : 'AI';

  return (
    <div className="chess-dice-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="chess-dice-modal">
        <button className="chess-dice-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Title */}
        <div className="chess-dice-header">
          <span className="chess-dice-icon">🎲</span>
          <div>
            <h2 className="chess-dice-title">Roll for Color</h2>
            <p className="chess-dice-sub">
              {phase === 'idle'   && 'Roll the dice to decide who commands which pieces!'}
              {phase === 'rolling' && 'Rolling…'}
              {phase === 'reveal' && (
                resultColor === 'w'
                  ? `♔ Odd! ${playerLabel} plays White`
                  : `♚ Even! ${playerLabel} plays Black`
              )}
            </p>
          </div>
        </div>

        {/* Dice */}
        <div className={`chess-dice-wrap ${
          phase === 'rolling' ? 'chess-dice-rolling' : ''
        } ${phase === 'reveal' ? 'chess-dice-landed' : ''}`}>
          <ChessDiceFace value={diceVal} glowing={phase === 'reveal'} />
        </div>

        {/* Probability Bar */}
        <div className="chess-prob-section">
          <div className="chess-prob-labels">
            <span className="chess-prob-lbl white-lbl">
              ♔ {playerLabel} — White
            </span>
            <span className="chess-prob-lbl black-lbl">
              ♚ {opponentLabel} — Black
            </span>
          </div>
          <div className="chess-prob-bar-track">
            <div
              className={`chess-prob-bar-fill ${
                phase === 'rolling' ? 'bar-animating' : ''
              } ${phase === 'reveal' && resultColor === 'w' ? 'bar-white-win' : ''}
              ${phase === 'reveal' && resultColor === 'b' ? 'bar-black-win' : ''}`}
              style={{ width: `${barPct}%` }}
            />
            <div className="chess-prob-center-line" />
          </div>
          <div className="chess-prob-pct-row">
            <span style={{ color: '#f8f4ee' }}>{Math.round(barPct)}%</span>
            <span style={{ color: '#a78bfa' }}>{100 - Math.round(barPct)}%</span>
          </div>
        </div>

        {/* Side Choice Preview */}
        {phase === 'reveal' && (
          <div className="chess-dice-reveal-row">
            <div className={`chess-color-badge ${resultColor === 'w' ? 'badge-white' : 'badge-black-dim'}`}>
              <span className="badge-piece">♔</span>
              <span className="badge-label">{playerLabel}</span>
              <span className="badge-color-name">{resultColor === 'w' ? 'WHITE' : 'BLACK'}</span>
            </div>
            <div className="badge-vs">VS</div>
            <div className={`chess-color-badge ${resultColor === 'b' ? 'badge-white' : 'badge-black-dim'}`}>
              <span className="badge-piece">♚</span>
              <span className="badge-label">{opponentLabel}</span>
              <span className="badge-color-name">{resultColor === 'b' ? 'WHITE' : 'BLACK'}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="chess-dice-actions">
          {phase === 'idle' && (
            <button id="btn-chess-roll-dice" className="chess-btn-roll" onClick={handleRoll}>
              🎲 Roll Dice
            </button>
          )}
          {phase === 'rolling' && (
            <div className="chess-roll-dots">
              <span /><span /><span />
            </div>
          )}
          {phase === 'reveal' && (
            <button className="chess-btn-roll chess-btn-start" onClick={handleStart}>
              ✅ Start Game
            </button>
          )}
        </div>

        <p className="chess-dice-rule">Odd = {playerLabel} gets ♔ White · Even = {playerLabel} gets ♚ Black</p>
      </div>
    </div>
  );
}

export default function Chess() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';

  // Game configuration
  const [gameMode, setGameMode] = useState('ai'); // 'ai' | 'pvp'
  const [aiDifficulty, setAiDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [playerColor, setPlayerColor] = useState('w'); // 'w' | 'b'
  const [isFlipped, setIsFlipped] = useState(false);
  const [timeControl, setTimeControl] = useState(TIME_CONTROLS[2]); // 5 min default

  // Board & Game State
  const [board, setBoard] = useState(getInitialBoard);
  const [turn, setTurn] = useState('w'); // 'w' | 'b'
  const [selectedSquare, setSelectedSquare] = useState(null); // { r, c }
  const [legalMoves, setLegalMoves] = useState([]); // array of moves
  const [enPassantTarget, setEnPassantTarget] = useState(null);
  const [lastMove, setLastMove] = useState(null); // { from, to }
  const [moveHistory, setMoveHistory] = useState([]); // [{ white: 'e4', black: 'e5' }]
  const [historyBoards, setHistoryBoards] = useState([]); // for undo

  // Promotion state
  const [pendingPromotion, setPendingPromotion] = useState(null); // { move }

  // Game status: 'active' | 'check' | 'checkmate' | 'stalemate' | 'timeout' | 'resigned'
  const [status, setStatus] = useState('active');
  const [winner, setWinner] = useState(null); // 'w' | 'b' | 'draw'
  const [inCheckKing, setInCheckKing] = useState(null); // { r, c } or null

  // Clocks (seconds remaining)
  const [whiteTime, setWhiteTime] = useState(300);
  const [blackTime, setBlackTime] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // AI Thinking state & Hints
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [activeHint, setActiveHint] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Dice modal state
  const [showDice, setShowDice] = useState(false);

  // Handle dice result: assign playerColor, then start game
  const handleDiceResult = (assignedColor) => {
    startNewGame(gameMode, aiDifficulty, timeControl, assignedColor);
  };

  // ── Live Win Probability (sigmoid of board score) ──
  // Returns white win % 0–100. Recomputed on every board/status change.
  const rawEval = evaluateBoard(board); // centipawns, +white
  // Clamp extreme terminal states
  const clampedEval = Math.max(-3000, Math.min(3000, rawEval));
  // Sigmoid: k=400 gives a smooth curve (±400cp ≈ ±55%)
  const whitePct = Math.round(100 / (1 + Math.exp(-clampedEval / 400)));
  const blackPct = 100 - whitePct;

  // Material evaluation
  const material = getMaterialDifference(board);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (secs === null || (timeControl && timeControl.seconds === null)) return '∞';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Clock Tick ──
  useEffect(() => {
    if (!isTimerRunning || !timeControl || timeControl.seconds === null || status === 'checkmate' || status === 'stalemate' || status === 'timeout' || status === 'resigned') {
      return;
    }

    const timer = setInterval(() => {
      if (turn === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            handleTimeOut('w');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            handleTimeOut('b');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, turn, status, timeControl]);

  const handleTimeOut = (flagColor) => {
    const winColor = flagColor === 'w' ? 'b' : 'w';
    setStatus('timeout');
    setWinner(winColor);
    if (soundEnabled) playVictorySound();
    recordGameEnd(winColor === playerColor ? 'WIN' : 'LOSS');
  };

  // Record outcome in stats
  const recordGameEnd = useCallback((outcome) => {
    recordChessOutcome(userId, {
      outcome, // 'WIN' | 'LOSS' | 'DRAW'
      mode: gameMode === 'ai' ? `VS AI (${aiDifficulty})` : '2-Player Local',
      difficulty: aiDifficulty,
      totalMoves: moveHistory.length
    });
  }, [userId, gameMode, aiDifficulty, moveHistory.length]);

  // ── Start New Game ──
  const startNewGame = useCallback((newMode = gameMode, newDiff = aiDifficulty, newTime = timeControl, newColor = playerColor) => {
    const freshBoard = getInitialBoard();
    setBoard(freshBoard);
    setTurn('w');
    setSelectedSquare(null);
    setLegalMoves([]);
    setEnPassantTarget(null);
    setLastMove(null);
    setMoveHistory([]);
    setHistoryBoards([]);
    setPendingPromotion(null);
    setStatus('active');
    setWinner(null);
    setInCheckKing(null);
    setActiveHint(null);
    setIsAiThinking(false);

    setGameMode(newMode);
    setAiDifficulty(newDiff);
    setTimeControl(newTime);
    setPlayerColor(newColor);
    setIsFlipped(newColor === 'b');

    if (newTime && newTime.seconds !== null) {
      setWhiteTime(newTime.seconds);
      setBlackTime(newTime.seconds);
      setIsTimerRunning(true);
    } else {
      setWhiteTime(null);
      setBlackTime(null);
      setIsTimerRunning(false);
    }
  }, [gameMode, aiDifficulty, timeControl, playerColor]);

  // Execute a verified legal move
  const executeMove = useCallback((move, promoPiece = 'q') => {
    setActiveHint(null);

    // Save history for undo
    setHistoryBoards((prev) => [
      ...prev,
      {
        board: cloneBoard(board),
        turn,
        enPassantTarget,
        lastMove,
        whiteTime,
        blackTime,
        status,
        inCheckKing
      }
    ]);

    const sanNotation = formatMoveNotation(board, move, promoPiece);
    const isCap = move.isCapture || move.isEnPassant;
    const nextBoard = makeMove(board, move, promoPiece);
    const nextTurn = turn === 'w' ? 'b' : 'w';

    // Check for double pawn push (for en passant on next turn)
    let nextEp = null;
    if (move.isDoublePawn) {
      nextEp = {
        r: (move.from.r + move.to.r) / 2,
        c: move.to.c
      };
    }

    setBoard(nextBoard);
    setTurn(nextTurn);
    setEnPassantTarget(nextEp);
    setLastMove({ from: move.from, to: move.to });
    setSelectedSquare(null);
    setLegalMoves([]);

    // Update move history notation list
    setMoveHistory((prev) => {
      if (turn === 'w') {
        return [...prev, { num: prev.length + 1, white: sanNotation, black: '' }];
      } else {
        const last = [...prev];
        if (last.length > 0) {
          last[last.length - 1].black = sanNotation;
        }
        return last;
      }
    });

    // Evaluate Game State for Next Player
    const state = getGameState(nextBoard, nextTurn, nextEp);

    if (state.status === 'checkmate') {
      setStatus('checkmate');
      setWinner(turn); // current player won
      if (soundEnabled) playVictorySound();
      const userWon = (gameMode === 'ai' && turn === playerColor) || gameMode === 'pvp';
      recordGameEnd(userWon ? 'WIN' : 'LOSS');
    } else if (state.status === 'stalemate') {
      setStatus('stalemate');
      setWinner('draw');
      if (soundEnabled) playVictorySound();
      recordGameEnd('DRAW');
    } else if (state.status === 'check') {
      setStatus('check');
      if (soundEnabled) playCheckSound();
      // Find king position to glow red
      const kPos = state.inCheckColor;
      setInCheckKing(kPos);
    } else {
      setStatus('active');
      setInCheckKing(null);
      if (soundEnabled) {
        if (isCap) playCaptureSound();
        else playMoveSound();
      }
    }
  }, [board, turn, enPassantTarget, lastMove, whiteTime, blackTime, status, inCheckKing, soundEnabled, gameMode, playerColor, recordGameEnd]);

  // ── Handle Square Click ──
  const handleSquareClick = (r, c) => {
    if (status === 'checkmate' || status === 'stalemate' || status === 'timeout' || isAiThinking) {
      return;
    }

    // In AI mode, prevent human from moving AI's pieces
    if (gameMode === 'ai' && turn !== playerColor) {
      return;
    }

    const clickedPiece = board[r][c];

    // If square already selected and clicking another square:
    if (selectedSquare) {
      // Check if clicking a destination square in legalMoves
      const matchingMove = legalMoves.find(
        (m) => m.to.r === r && m.to.c === c
      );

      if (matchingMove) {
        // Check for promotion
        if (matchingMove.isPromotion) {
          setPendingPromotion({ move: matchingMove });
          return;
        }
        executeMove(matchingMove);
        return;
      }

      // If clicking own piece of same color, reselect that piece
      if (clickedPiece && clickedPiece.color === turn) {
        setSelectedSquare({ r, c });
        const moves = getLegalMoves(board, r, c, enPassantTarget);
        setLegalMoves(moves);
        return;
      }

      // Clicking empty or invalid square deselects
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Selecting a piece
    if (clickedPiece && clickedPiece.color === turn) {
      setSelectedSquare({ r, c });
      const moves = getLegalMoves(board, r, c, enPassantTarget);
      setLegalMoves(moves);
    }
  };

  // ── AI Move Effect ──
  useEffect(() => {
    if (gameMode === 'ai' && turn !== playerColor && status !== 'checkmate' && status !== 'stalemate' && status !== 'timeout') {
      setIsAiThinking(true);
      const thinkDelay = aiDifficulty === 'hard' ? 600 : aiDifficulty === 'medium' ? 400 : 250;

      const timer = setTimeout(() => {
        const aiMove = findBestMove(board, turn, aiDifficulty, enPassantTarget);
        setIsAiThinking(false);

        if (aiMove) {
          executeMove(aiMove, 'q');
        }
      }, thinkDelay);

      return () => clearTimeout(timer);
    }
  }, [turn, gameMode, playerColor, board, aiDifficulty, enPassantTarget, status, executeMove]);

  // ── Undo Move ──
  const handleUndo = () => {
    if (historyBoards.length === 0 || isAiThinking) return;

    // In AI mode, undo 2 moves (AI move + human move)
    const undoSteps = gameMode === 'ai' && historyBoards.length >= 2 ? 2 : 1;
    const targetStateIndex = historyBoards.length - undoSteps;
    const targetState = historyBoards[targetStateIndex];

    if (targetState) {
      setBoard(targetState.board);
      setTurn(targetState.turn);
      setEnPassantTarget(targetState.enPassantTarget);
      setLastMove(targetState.lastMove);
      setWhiteTime(targetState.whiteTime);
      setBlackTime(targetState.blackTime);
      setStatus(targetState.status);
      setInCheckKing(targetState.inCheckKing);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
      setActiveHint(null);
      setHistoryBoards((prev) => prev.slice(0, targetStateIndex));
      setMoveHistory((prev) => prev.slice(0, Math.ceil(targetStateIndex / 2)));
    }
  };

  // ── AI Tactical Hint ──
  const handleRequestHint = () => {
    if (isAiThinking || status === 'checkmate' || status === 'stalemate') return;
    const hint = getTacticalHint(board, turn, enPassantTarget);
    if (hint) {
      setActiveHint(hint);
      setSelectedSquare({ r: hint.move.from.r, c: hint.move.from.c });
      const moves = getLegalMoves(board, hint.move.from.r, hint.move.from.c, enPassantTarget);
      setLegalMoves(moves);
    }
  };

  // Resign match
  const handleResign = () => {
    if (status === 'checkmate' || status === 'stalemate') return;
    const resigningColor = gameMode === 'ai' ? playerColor : turn;
    const winColor = resigningColor === 'w' ? 'b' : 'w';
    setStatus('resigned');
    setWinner(winColor);
    recordGameEnd('LOSS');
  };

  return (
    <div className="chess-viewport">
      {/* Wallpaper Background */}
      <div className="chess-page-wallpaper" />

      {/* Dynamic Background Atmosphere */}
      <div className="chess-blob-1" />
      <div className="chess-blob-2" />

      {/* Top Header */}
      <header className="chess-header">
        <div className="chess-header-left">
          <Link to="/" className="chess-btn-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Hub</span>
          </Link>
          <div className="chess-title-badge">
            <span className="chess-title-icon">⚔️</span>
            <div>
              <h1 className="chess-title-text">CHESS ARENA</h1>
              <span className="chess-subtitle-text">Master Minimax AI & Dual-Player</span>
            </div>
          </div>
        </div>

        <div className="chess-header-right">
          <button
            className={`chess-ctrl-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            className="chess-ctrl-btn"
            onClick={() => setIsFlipped(!isFlipped)}
            title="Flip Board View"
          >
            🔄 Flip
          </button>
          <button
            className="chess-ctrl-btn hint-btn"
            onClick={handleRequestHint}
            disabled={isAiThinking || status === 'checkmate' || status === 'stalemate'}
            title="Get AI Move Recommendation"
          >
            💡 AI Hint
          </button>
          <button
            className="chess-ctrl-btn dice-ctrl-btn"
            onClick={() => setShowDice(true)}
            title="Roll dice to randomly assign colors"
          >
            🎲 Roll Color
          </button>
          <button
            className="chess-ctrl-btn new-game-btn"
            onClick={() => startNewGame()}
          >
            ➕ New Game
          </button>
        </div>
      </header>

      {/* Main Game Arena */}
      <main className="chess-arena-layout">
        {/* Left Side: Game Board & Player Info */}
        <section className="chess-board-column">
          {/* Top Player Card */}
          <div className={`player-card-bar ${(!isFlipped && turn === 'b') || (isFlipped && turn === 'w') ? 'active-turn' : ''}`}>
            <div className="player-meta">
              <div className="player-avatar-badge">
                {!isFlipped ? (gameMode === 'ai' ? '🤖' : '♟️') : '👤'}
              </div>
              <div className="player-details">
                <span className="player-name">
                  {!isFlipped ? (gameMode === 'ai' ? `Minimax Bot (${aiDifficulty.toUpperCase()})` : 'Black Player') : (user?.name || 'White Player')}
                </span>
                <div className="captured-tray">
                  {(!isFlipped ? material.capturedByBlack : material.capturedByWhite).map((pType, i) => (
                    <span key={i} className="captured-piece-sym">
                      {PIECE_SYMBOLS[!isFlipped ? 'w' : 'b'][pType]}
                    </span>
                  ))}
                  {(!isFlipped ? material.diff < 0 : material.diff > 0) && (
                    <span className="material-diff-badge">+{Math.abs(material.diff / 100)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className={`player-clock ${(!isFlipped ? blackTime : whiteTime) <= 30 && timeControl.seconds !== null ? 'low-time' : ''}`}>
              <span className="clock-icon">⏱️</span>
              <span className="clock-digits">{formatTime(!isFlipped ? blackTime : whiteTime)}</span>
            </div>
          </div>

          {/* ── 8x8 Chess Board ── */}
          <div className={`chessboard-frame ${isFlipped ? 'flipped' : ''}`}>
            <div className="chessboard-grid">
              {(isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]).map((r) =>
                (isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7]).map((c) => {
                  const piece = board[r][c];
                  const isLight = (r + c) % 2 === 0;
                  const isSelected = selectedSquare && selectedSquare.r === r && selectedSquare.c === c;
                  const isLegalTarget = legalMoves.some((m) => m.to.r === r && m.to.c === c);
                  const isCaptureTarget = isLegalTarget && (board[r][c] || (enPassantTarget && enPassantTarget.r === r && enPassantTarget.c === c));
                  const isLastMoveSquare = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));
                  const isKingCheckSquare = inCheckKing && piece && piece.type === 'k' && piece.color === inCheckKing;
                  const isHintFrom = activeHint && activeHint.move.from.r === r && activeHint.move.from.c === c;
                  const isHintTo = activeHint && activeHint.move.to.r === r && activeHint.move.to.c === c;

                  // Rank & File labels on border
                  const showFileLabel = isFlipped ? r === 0 : r === 7;
                  const showRankLabel = isFlipped ? c === 7 : c === 0;

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`chess-square ${isLight ? 'light-square' : 'dark-square'} 
                        ${isSelected ? 'square-selected' : ''} 
                        ${isLastMoveSquare ? 'square-last-move' : ''}
                        ${isKingCheckSquare ? 'square-king-check' : ''}
                        ${isHintFrom ? 'square-hint-from' : ''}
                        ${isHintTo ? 'square-hint-to' : ''}`}
                      onClick={() => handleSquareClick(r, c)}
                    >
                      {/* Rank Label */}
                      {showRankLabel && (
                        <span className="coord-label rank-label">{8 - r}</span>
                      )}

                      {/* File Label */}
                      {showFileLabel && (
                        <span className="coord-label file-label">{String.fromCharCode(97 + c)}</span>
                      )}

                      {/* Piece Icon */}
                      {piece && (
                        <ChessPiece
                          key={`piece-${r}-${c}-${piece.color}-${piece.type}`}
                          type={piece.type}
                          color={piece.color}
                          className={isSelected ? 'piece-selected-anim' : ''}
                        />
                      )}

                      {/* Move Indicator Dots / Capture Rings */}
                      {isLegalTarget && !isCaptureTarget && (
                        <div className="move-dot-indicator" />
                      )}
                      {isCaptureTarget && (
                        <div className="capture-ring-indicator" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Win Probability Bar (below board, TicTacToe style) ── */}
          <div className="chess-prob-container">
            <div
              className="chess-prob-bar"
              role="img"
              aria-label={`White: ${whitePct}%, Black: ${blackPct}%`}
            >
              <div
                className="chess-prob-seg chess-prob-white"
                style={{ width: `${whitePct}%` }}
                title={`White ${whitePct}%`}
              />
              <div
                className="chess-prob-seg chess-prob-black"
                style={{ width: `${blackPct}%` }}
                title={`Black ${blackPct}%`}
              />
            </div>
            <div className="chess-prob-labels">
              <span className="chess-prob-pct chess-pct-white">
                ♔&nbsp;{whitePct}%
              </span>
              <span className="chess-prob-mid-label">Win Probability</span>
              <span className="chess-prob-pct chess-pct-black">
                {blackPct}%&nbsp;♚
              </span>
            </div>
          </div>

          {/* Bottom Player Card */}
          <div className={`player-card-bar ${(isFlipped && turn === 'b') || (!isFlipped && turn === 'w') ? 'active-turn' : ''}`}>
            <div className="player-meta">
              <div className="player-avatar-badge player-you">
                {isFlipped ? (gameMode === 'ai' ? '🤖' : '♟️') : '👤'}
              </div>
              <div className="player-details">
                <span className="player-name">
                  {isFlipped ? (gameMode === 'ai' ? `Minimax Bot (${aiDifficulty.toUpperCase()})` : 'Black Player') : (user?.name || 'White Player')}
                  <span className="you-tag"> (You)</span>
                </span>
                <div className="captured-tray">
                  {(isFlipped ? material.capturedByBlack : material.capturedByWhite).map((pType, i) => (
                    <span key={i} className="captured-piece-sym">
                      {PIECE_SYMBOLS[isFlipped ? 'w' : 'b'][pType]}
                    </span>
                  ))}
                  {(isFlipped ? material.diff < 0 : material.diff > 0) && (
                    <span className="material-diff-badge">+{Math.abs(material.diff / 100)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className={`player-clock ${(isFlipped ? blackTime : whiteTime) <= 30 && timeControl.seconds !== null ? 'low-time' : ''}`}>
              <span className="clock-icon">⏱️</span>
              <span className="clock-digits">{formatTime(isFlipped ? blackTime : whiteTime)}</span>
            </div>
          </div>
        </section>

        {/* Right Side: Control Dashboard & Move Log */}
        <aside className="chess-sidebar-column">
          {/* Game Mode Selector Card */}
          <div className="sidebar-card mode-card">
            <h3 className="sidebar-heading">Mode & Opponent</h3>
            <div className="mode-toggle-group">
              <button
                className={`mode-btn ${gameMode === 'ai' ? 'selected' : ''}`}
                onClick={() => startNewGame('ai', aiDifficulty, timeControl)}
              >
                🤖 VS AI
              </button>
              <button
                className={`mode-btn ${gameMode === 'pvp' ? 'selected' : ''}`}
                onClick={() => startNewGame('pvp', aiDifficulty, timeControl)}
              >
                👥 2-Player Pass
              </button>
            </div>

            {gameMode === 'ai' && (
              <div className="difficulty-picker-row">
                {['easy', 'medium', 'hard'].map((diff) => (
                  <button
                    key={diff}
                    className={`diff-pill ${aiDifficulty === diff ? 'active' : ''}`}
                    onClick={() => startNewGame('ai', diff, timeControl)}
                  >
                    {diff === 'easy' ? '🟢 Novice' : diff === 'medium' ? '🟡 Tactical' : '🟣 Master'}
                  </button>
                ))}
              </div>
            )}

            {/* Time Control Options */}
            <div className="time-control-section">
              <div className="time-control-header">
                <span className="time-control-title">⏱️ Time Control</span>
                <span className="time-control-selected-badge">{timeControl.label}</span>
              </div>
              <div className="time-control-grid">
                {TIME_CONTROLS.map((tc) => (
                  <button
                    key={tc.label}
                    className={`time-pill ${timeControl.label === tc.label ? 'active' : ''}`}
                    onClick={() => startNewGame(gameMode, aiDifficulty, tc)}
                    title={`${tc.label} (${tc.subtitle})`}
                  >
                    <span className="time-pill-icon">{tc.icon}</span>
                    <span className="time-pill-text">{tc.label}</span>
                    <span className="time-pill-sub">{tc.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tactical AI Hint Card (when requested) */}
          {activeHint && (
            <div className="sidebar-card hint-card">
              <div className="hint-header">
                <span className="hint-sparkle">💡 AI Recommendation</span>
                <button className="hint-close-btn" onClick={() => setActiveHint(null)}>✕</button>
              </div>
              <div className="hint-move-callout">
                <span className="hint-san-badge">{activeHint.san}</span>
                <span className="hint-arrow-text">{activeHint.fromSq} → {activeHint.toSq}</span>
              </div>
              <p className="hint-reason-text">{activeHint.reason}</p>
            </div>
          )}


          {/* Move History Log */}
          <div className="sidebar-card moves-card">
            <div className="moves-card-header">
              <h3 className="sidebar-heading">Move Notation (SAN)</h3>
              <span className="total-turns-badge">{moveHistory.length} Turns</span>
            </div>

            <div className="moves-scroll-list">
              {moveHistory.length === 0 ? (
                <div className="empty-moves-text">Game started. Make the first move!</div>
              ) : (
                moveHistory.map((entry) => (
                  <div key={entry.num} className="move-history-row">
                    <span className="move-num">{entry.num}.</span>
                    <span className="move-san white-san">{entry.white}</span>
                    <span className="move-san black-san">{entry.black || '...'}</span>
                  </div>
                ))
              )}
            </div>

            <div className="moves-action-bar">
              <button
                className="btn-undo-move"
                onClick={handleUndo}
                disabled={historyBoards.length === 0 || isAiThinking}
              >
                ↩️ Undo Move
              </button>
              <button
                className="btn-resign-match"
                onClick={handleResign}
                disabled={status === 'checkmate' || status === 'stalemate' || status === 'resigned'}
              >
                🏳️ Resign
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* ── Pawn Promotion Modal ── */}
      {pendingPromotion && (
        <div className="chess-modal-overlay">
          <div className="promotion-modal-card">
            <h3 className="promotion-title">Promote Pawn</h3>
            <p className="promotion-subtitle">Select a royal piece for your advancing pawn:</p>
            <div className="promotion-options-row">
              {[
                { type: 'q', name: 'Queen', icon: '♕' },
                { type: 'r', name: 'Rook', icon: '♖' },
                { type: 'b', name: 'Bishop', icon: '♗' },
                { type: 'n', name: 'Knight', icon: '♘' }
              ].map((opt) => (
                <button
                  key={opt.type}
                  className="promotion-piece-btn"
                  onClick={() => {
                    executeMove(pendingPromotion.move, opt.type);
                    setPendingPromotion(null);
                  }}
                >
                  <span className="promo-icon">{opt.icon}</span>
                  <span className="promo-name">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Game Over / Checkmate Modal ── */}
      {(status === 'checkmate' || status === 'stalemate' || status === 'timeout' || status === 'resigned') && (
        <div className="chess-modal-overlay">
          <div className="game-over-modal-card">
            <div className="go-crown-icon">
              {status === 'checkmate' ? '👑' : status === 'stalemate' ? '🤝' : '⏱️'}
            </div>
            <h2 className="go-title">
              {status === 'checkmate' && 'CHECKMATE!'}
              {status === 'stalemate' && 'STALEMATE (DRAW)'}
              {status === 'timeout' && 'TIME OUT!'}
              {status === 'resigned' && 'RESIGNATION!'}
            </h2>
            <p className="go-subtitle">
              {status === 'checkmate' && (winner === 'w' ? 'White delivers checkmate!' : 'Black delivers checkmate!')}
              {status === 'stalemate' && 'No legal moves remaining. The game is a draw.'}
              {status === 'timeout' && (winner === 'w' ? 'Black ran out of time. White wins!' : 'White ran out of time. Black wins!')}
              {status === 'resigned' && (winner === 'w' ? 'Black resigned. White is victorious!' : 'White resigned. Black is victorious!')}
            </p>

            <div className="go-stats-row">
              <div className="go-stat-box">
                <span className="go-stat-val">{moveHistory.length}</span>
                <span className="go-stat-lbl">TURNS</span>
              </div>
              <div className="go-stat-box">
                <span className="go-stat-val">{aiDifficulty.toUpperCase()}</span>
                <span className="go-stat-lbl">DIFFICULTY</span>
              </div>
            </div>

            <div className="go-actions">
              <button className="go-btn-primary" onClick={() => startNewGame()}>
                🎮 Play Again
              </button>
              <Link to="/" className="go-btn-secondary">
                🏠 Back to Hub
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Chess Dice Modal */}
      {showDice && (
        <ChessDiceModal
          gameMode={gameMode}
          onClose={() => setShowDice(false)}
          onResult={handleDiceResult}
        />
      )}
    </div>
  );
}

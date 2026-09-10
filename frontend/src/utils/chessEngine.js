// Comprehensive Chess Engine with Full Rules & Minimax AI

export const PIECE_SYMBOLS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export const PIECE_NAMES = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

export const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Positional Piece-Square Tables (from White's perspective, inverted for Black)
const PST = {
  p: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  r: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
  ]
};

export function getInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  // Back row pieces
  const backRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  // Black pieces (ranks 8 & 7 -> indices 0 & 1)
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRow[c], color: 'b', hasMoved: false };
    board[1][c] = { type: 'p', color: 'b', hasMoved: false };
  }

  // White pieces (ranks 2 & 1 -> indices 6 & 7)
  for (let c = 0; c < 8; c++) {
    board[6][c] = { type: 'p', color: 'w', hasMoved: false };
    board[7][c] = { type: backRow[c], color: 'w', hasMoved: false };
  }

  return board;
}

export function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

export function squareToCoords(squareStr) {
  // e.g. "e4" -> r: 4, c: 4
  const c = squareStr.charCodeAt(0) - 97;
  const r = 8 - parseInt(squareStr[1], 10);
  return { r, c };
}

export function coordsToSquare(r, c) {
  // e.g. r: 4, c: 4 -> "e4"
  return String.fromCharCode(97 + c) + (8 - r);
}

export function isInsideBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// ── Check if a square is attacked by a given color ──
export function isSquareAttacked(board, targetR, targetC, attackingColor) {
  const pawnDir = attackingColor === 'w' ? -1 : 1;
  const pawnR = targetR - pawnDir;

  // 1. Pawn attacks
  if (pawnR >= 0 && pawnR < 8) {
    if (targetC - 1 >= 0) {
      const p = board[pawnR][targetC - 1];
      if (p && p.color === attackingColor && p.type === 'p') return true;
    }
    if (targetC + 1 < 8) {
      const p = board[pawnR][targetC + 1];
      if (p && p.color === attackingColor && p.type === 'p') return true;
    }
  }

  // 2. Knight attacks
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightOffsets) {
    const nr = targetR + dr, nc = targetC + dc;
    if (isInsideBoard(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === attackingColor && p.type === 'n') return true;
    }
  }

  // 3. King attacks (adjacent)
  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [dr, dc] of kingOffsets) {
    const nr = targetR + dr, nc = targetC + dc;
    if (isInsideBoard(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.color === attackingColor && p.type === 'k') return true;
    }
  }

  // 4. Sliding pieces: Orthogonal (Rook, Queen)
  const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of orthoDirs) {
    let nr = targetR + dr, nc = targetC + dc;
    while (isInsideBoard(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === attackingColor && (p.type === 'r' || p.type === 'q')) {
          return true;
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  // 5. Sliding pieces: Diagonal (Bishop, Queen)
  const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diagDirs) {
    let nr = targetR + dr, nc = targetC + dc;
    while (isInsideBoard(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === attackingColor && (p.type === 'b' || p.type === 'q')) {
          return true;
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

// ── Find King Position ──
export function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        return { r, c };
      }
    }
  }
  return null;
}

// ── Check if King is in Check ──
export function isKingInCheck(board, color) {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const oppColor = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingPos.r, kingPos.c, oppColor);
}

// ── Generate Pseudo-legal Moves for a piece ──
export function getPseudoLegalMoves(board, r, c, enPassantTarget = null) {
  const piece = board[r][c];
  if (!piece) return [];

  const moves = [];
  const { type, color, hasMoved } = piece;
  const oppColor = color === 'w' ? 'b' : 'w';
  const forward = color === 'w' ? -1 : 1;
  const startRank = color === 'w' ? 6 : 1;

  // ── PAWN ──
  if (type === 'p') {
    // 1-square forward
    const f1R = r + forward;
    if (isInsideBoard(f1R, c) && !board[f1R][c]) {
      moves.push({ from: { r, c }, to: { r: f1R, c }, isPromotion: f1R === 0 || f1R === 7 });

      // 2-squares forward from starting rank
      const f2R = r + 2 * forward;
      if (r === startRank && !board[f2R][c]) {
        moves.push({ from: { r, c }, to: { r: f2R, c }, isDoublePawn: true });
      }
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
      const capR = r + forward, capC = c + dc;
      if (isInsideBoard(capR, capC)) {
        const target = board[capR][capC];
        if (target && target.color === oppColor) {
          moves.push({
            from: { r, c },
            to: { r: capR, c: capC },
            isCapture: true,
            isPromotion: capR === 0 || capR === 7
          });
        } else if (
          enPassantTarget &&
          enPassantTarget.r === capR &&
          enPassantTarget.c === capC
        ) {
          // En passant capture
          moves.push({
            from: { r, c },
            to: { r: capR, c: capC },
            isCapture: true,
            isEnPassant: true
          });
        }
      }
    }
  }

  // ── KNIGHT ──
  else if (type === 'n') {
    const offsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of offsets) {
      const nr = r + dr, nc = c + dc;
      if (isInsideBoard(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else if (target.color === oppColor) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
        }
      }
    }
  }

  // ── BISHOP ──
  else if (type === 'b') {
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (isInsideBoard(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else {
          if (target.color === oppColor) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  // ── ROOK ──
  else if (type === 'r') {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (isInsideBoard(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else {
          if (target.color === oppColor) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  // ── QUEEN ──
  else if (type === 'q') {
    const dirs = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (isInsideBoard(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else {
          if (target.color === oppColor) {
            moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  // ── KING ──
  else if (type === 'k') {
    const dirs = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (isInsideBoard(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc } });
        } else if (target.color === oppColor) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, isCapture: true });
        }
      }
    }

    // Castling moves
    if (!hasMoved && !isKingInCheck(board, color)) {
      const rank = color === 'w' ? 7 : 0;
      if (r === rank && c === 4) {
        // Kingside Castling (O-O)
        const krRook = board[rank][7];
        if (
          krRook &&
          krRook.type === 'r' &&
          krRook.color === color &&
          !krRook.hasMoved &&
          !board[rank][5] &&
          !board[rank][6] &&
          !isSquareAttacked(board, rank, 5, oppColor) &&
          !isSquareAttacked(board, rank, 6, oppColor)
        ) {
          moves.push({
            from: { r, c },
            to: { r: rank, c: 6 },
            isCastling: true,
            castlingSide: 'k'
          });
        }

        // Queenside Castling (O-O-O)
        const qrRook = board[rank][0];
        if (
          qrRook &&
          qrRook.type === 'r' &&
          qrRook.color === color &&
          !qrRook.hasMoved &&
          !board[rank][1] &&
          !board[rank][2] &&
          !board[rank][3] &&
          !isSquareAttacked(board, rank, 2, oppColor) &&
          !isSquareAttacked(board, rank, 3, oppColor)
        ) {
          moves.push({
            from: { r, c },
            to: { r: rank, c: 2 },
            isCastling: true,
            castlingSide: 'q'
          });
        }
      }
    }
  }

  return moves;
}

// ── Execute Move on a Board (simulation or real) ──
export function makeMove(board, move, promotionPiece = 'q') {
  const newBoard = cloneBoard(board);
  const { from, to, isCastling, castlingSide, isEnPassant, isPromotion } = move;
  const piece = { ...newBoard[from.r][from.c], hasMoved: true };

  newBoard[from.r][from.c] = null;

  if (isPromotion) {
    piece.type = promotionPiece;
  }

  if (isEnPassant) {
    // Clear captured pawn
    const capturedPawnR = from.r;
    const capturedPawnC = to.c;
    newBoard[capturedPawnR][capturedPawnC] = null;
  }

  if (isCastling) {
    const rank = from.r;
    if (castlingSide === 'k') {
      const rook = { ...newBoard[rank][7], hasMoved: true };
      newBoard[rank][7] = null;
      newBoard[rank][5] = rook;
    } else if (castlingSide === 'q') {
      const rook = { ...newBoard[rank][0], hasMoved: true };
      newBoard[rank][0] = null;
      newBoard[rank][3] = rook;
    }
  }

  newBoard[to.r][to.c] = piece;
  return newBoard;
}

// ── Get All Legal Moves for a specific square ──
export function getLegalMoves(board, r, c, enPassantTarget = null) {
  const piece = board[r][c];
  if (!piece) return [];

  const pseudoMoves = getPseudoLegalMoves(board, r, c, enPassantTarget);
  const legalMoves = [];

  for (const move of pseudoMoves) {
    const testBoard = makeMove(board, move);
    if (!isKingInCheck(testBoard, piece.color)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}

// ── Get ALL Legal Moves for a player ──
export function getAllLegalMoves(board, color, enPassantTarget = null) {
  const allMoves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const moves = getLegalMoves(board, r, c, enPassantTarget);
        allMoves.push(...moves);
      }
    }
  }
  return allMoves;
}

// ── Game State Evaluation: Checkmate / Stalemate / Active ──
export function getGameState(board, turn, enPassantTarget = null) {
  const legalMoves = getAllLegalMoves(board, turn, enPassantTarget);
  const inCheck = isKingInCheck(board, turn);

  if (legalMoves.length === 0) {
    if (inCheck) {
      return { status: 'checkmate', winner: turn === 'w' ? 'b' : 'w' };
    }
    return { status: 'stalemate', winner: null };
  }

  if (inCheck) {
    return { status: 'check', inCheckColor: turn };
  }

  return { status: 'active' };
}

// ── Standard Algebraic Notation (SAN) move formatter ──
export function formatMoveNotation(board, move, promotionPiece = 'q') {
  const { from, to, isCastling, castlingSide, isCapture, isEnPassant, isPromotion } = move;
  const piece = board[from.r][from.c];
  if (!piece) return '';

  if (isCastling) {
    return castlingSide === 'k' ? 'O-O' : 'O-O-O';
  }

  const toSquare = coordsToSquare(to.r, to.c);
  let notation = '';

  if (piece.type === 'p') {
    if (isCapture || isEnPassant) {
      notation += String.fromCharCode(97 + from.c) + 'x';
    }
    notation += toSquare;
    if (isPromotion) {
      notation += '=' + promotionPiece.toUpperCase();
    }
  } else {
    notation += piece.type.toUpperCase();
    if (isCapture) {
      notation += 'x';
    }
    notation += toSquare;
  }

  // Check / checkmate suffix
  const nextBoard = makeMove(board, move, promotionPiece);
  const oppColor = piece.color === 'w' ? 'b' : 'w';
  const oppMoves = getAllLegalMoves(nextBoard, oppColor);
  const oppInCheck = isKingInCheck(nextBoard, oppColor);

  if (oppMoves.length === 0 && oppInCheck) {
    notation += '#';
  } else if (oppInCheck) {
    notation += '+';
  }

  return notation;
}

// ── Calculate Material Advantage ──
export function getMaterialDifference(board) {
  let whiteMaterial = 0;
  let blackMaterial = 0;
  const capturedByWhite = [];
  const capturedByBlack = [];

  const initialCounts = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
  };

  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        currentCounts[p.color][p.type]++;
        if (p.color === 'w') {
          whiteMaterial += PIECE_VALUES[p.type];
        } else {
          blackMaterial += PIECE_VALUES[p.type];
        }
      }
    }
  }

  // Determine captured pieces
  for (const type of ['p', 'n', 'b', 'r', 'q']) {
    // White lost:
    const whiteLost = initialCounts.w[type] - currentCounts.w[type];
    for (let i = 0; i < whiteLost; i++) capturedByBlack.push(type);

    // Black lost:
    const blackLost = initialCounts.b[type] - currentCounts.b[type];
    for (let i = 0; i < blackLost; i++) capturedByWhite.push(type);
  }

  return {
    diff: whiteMaterial - blackMaterial, // > 0 => White leading, < 0 => Black leading
    capturedByWhite,
    capturedByBlack
  };
}

// ── AI Evaluation Function (Material + Positional Piece-Square Tables) ──
export function evaluateBoard(board) {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseVal = PIECE_VALUES[piece.type];
      const table = PST[piece.type];
      const posVal = table ? (piece.color === 'w' ? table[r][c] : table[7 - r][c]) : 0;
      const totalVal = baseVal + posVal;

      if (piece.color === 'w') {
        score += totalVal;
      } else {
        score -= totalVal;
      }
    }
  }

  return score;
}

// ── Minimax with Alpha-Beta Pruning ──
function minimax(board, depth, alpha, beta, isMaximizing, enPassantTarget) {
  const turn = isMaximizing ? 'w' : 'b';
  const legalMoves = getAllLegalMoves(board, turn, enPassantTarget);

  if (legalMoves.length === 0) {
    if (isKingInCheck(board, turn)) {
      // Checkmate
      return isMaximizing ? -50000 + depth : 50000 - depth;
    }
    // Stalemate
    return 0;
  }

  if (depth === 0) {
    return evaluateBoard(board);
  }

  // Move ordering: Prioritize captures to maximize pruning speed
  legalMoves.sort((a, b) => {
    const aCap = a.isCapture ? 1 : 0;
    const bCap = b.isCapture ? 1 : 0;
    return bCap - aCap;
  });

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const nextBoard = makeMove(board, move);
      const nextEp = move.isDoublePawn ? { r: (move.from.r + move.to.r) / 2, c: move.to.c } : null;
      const evalScore = minimax(nextBoard, depth - 1, alpha, beta, false, nextEp);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Beta cut-off
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const nextBoard = makeMove(board, move);
      const nextEp = move.isDoublePawn ? { r: (move.from.r + move.to.r) / 2, c: move.to.c } : null;
      const evalScore = minimax(nextBoard, depth - 1, alpha, beta, true, nextEp);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Alpha cut-off
    }
    return minEval;
  }
}

// ── Best Move Finder for AI & Hints ──
export function findBestMove(board, color, difficulty = 'medium', enPassantTarget = null) {
  const legalMoves = getAllLegalMoves(board, color, enPassantTarget);
  if (legalMoves.length === 0) return null;

  // 1. Novice / Easy: Random with occasional tactical capture
  if (difficulty === 'easy') {
    const captures = legalMoves.filter(m => m.isCapture);
    if (captures.length > 0 && Math.random() < 0.6) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  // 2. Medium: Minimax depth 2
  // 3. Master / Hard: Minimax depth 3
  const depth = difficulty === 'hard' || difficulty === 'master' ? 3 : 2;
  const isMaximizing = color === 'w';

  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMoves = [];

  for (const move of legalMoves) {
    const nextBoard = makeMove(board, move);
    const nextEp = move.isDoublePawn ? { r: (move.from.r + move.to.r) / 2, c: move.to.c } : null;
    const score = minimax(nextBoard, depth - 1, -Infinity, Infinity, !isMaximizing, nextEp);

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
  }

  // Pick randomly among best equally-ranked moves for variety
  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || legalMoves[0];
}

// ── Tactical Hint Explainer ──
export function getTacticalHint(board, color, enPassantTarget = null) {
  const move = findBestMove(board, color, 'master', enPassantTarget);
  if (!move) return null;

  const fromSq = coordsToSquare(move.from.r, move.from.c);
  const toSq = coordsToSquare(move.to.r, move.to.c);
  const piece = board[move.from.r][move.from.c];
  const pieceName = PIECE_NAMES[piece.type];

  let reason = '';
  if (move.isCastling) {
    reason = 'Castle king for safety and connect your rooks.';
  } else if (move.isCapture) {
    const target = board[move.to.r][move.to.c];
    reason = `Capture ${target ? PIECE_NAMES[target.type] : 'piece'} on ${toSq} to gain tactical advantage.`;
  } else if (piece.type === 'p') {
    reason = `Push pawn to ${toSq} to control key center territory.`;
  } else if (piece.type === 'n' || piece.type === 'b') {
    reason = `Develop ${pieceName} to ${toSq} to influence key diagonals and files.`;
  } else {
    reason = `Reposition ${pieceName} to ${toSq} for optimal board pressure.`;
  }

  return {
    move,
    fromSq,
    toSq,
    pieceName,
    reason,
    san: formatMoveNotation(board, move)
  };
}

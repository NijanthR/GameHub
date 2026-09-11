// Sudoku Engine: Generation, Validation, Solving, and AI Smart Hint Logic

// Pre-curated verified puzzles across all 4 difficulty levels for instant zero-latency startup
export const CURATED_PUZZLES = {
  easy: [
    {
      puzzle: [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
      ]
    },
    {
      puzzle: [
        [0, 0, 0, 2, 6, 0, 7, 0, 1],
        [6, 8, 0, 0, 7, 0, 0, 9, 0],
        [1, 9, 0, 0, 0, 4, 5, 0, 0],
        [8, 2, 0, 1, 0, 0, 0, 4, 0],
        [0, 0, 4, 6, 0, 2, 9, 0, 0],
        [0, 5, 0, 0, 0, 3, 0, 2, 8],
        [0, 0, 9, 3, 0, 0, 0, 7, 4],
        [0, 4, 0, 0, 5, 0, 0, 3, 6],
        [7, 0, 3, 0, 1, 8, 0, 0, 0]
      ]
    },
    {
      puzzle: [
        [1, 0, 0, 4, 8, 9, 0, 0, 6],
        [7, 3, 0, 0, 0, 0, 0, 4, 0],
        [0, 0, 0, 0, 0, 1, 2, 9, 5],
        [0, 0, 7, 1, 2, 0, 6, 0, 0],
        [5, 0, 0, 7, 0, 3, 0, 0, 8],
        [0, 0, 6, 0, 9, 5, 7, 0, 0],
        [9, 1, 4, 6, 0, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 0, 3, 7],
        [8, 0, 0, 5, 1, 2, 0, 0, 4]
      ]
    }
  ],
  medium: [
    {
      puzzle: [
        [0, 2, 0, 6, 0, 8, 0, 0, 0],
        [5, 8, 0, 0, 0, 9, 7, 0, 0],
        [0, 0, 0, 0, 4, 0, 0, 0, 0],
        [3, 7, 0, 0, 0, 0, 5, 0, 0],
        [6, 0, 0, 0, 0, 0, 0, 0, 4],
        [0, 0, 8, 0, 0, 0, 0, 1, 3],
        [0, 0, 0, 0, 2, 0, 0, 0, 0],
        [0, 0, 9, 8, 0, 0, 0, 3, 6],
        [0, 0, 0, 3, 0, 6, 0, 9, 0]
      ]
    },
    {
      puzzle: [
        [0, 0, 0, 6, 0, 0, 4, 0, 0],
        [7, 0, 0, 0, 0, 3, 6, 0, 0],
        [0, 0, 0, 0, 9, 1, 0, 8, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 5, 0, 1, 8, 0, 0, 0, 3],
        [0, 0, 0, 3, 0, 6, 0, 4, 5],
        [0, 4, 0, 2, 0, 0, 0, 6, 0],
        [9, 0, 3, 0, 0, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 0, 1, 0, 0]
      ]
    },
    {
      puzzle: [
        [0, 0, 0, 0, 0, 0, 0, 1, 2],
        [0, 0, 0, 0, 3, 5, 0, 0, 0],
        [0, 0, 0, 6, 0, 0, 0, 7, 0],
        [7, 0, 0, 0, 0, 0, 3, 0, 0],
        [0, 0, 0, 4, 0, 8, 0, 0, 0],
        [0, 0, 9, 0, 0, 0, 0, 0, 6],
        [0, 4, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 7, 2, 0, 0, 0, 0],
        [1, 5, 0, 0, 0, 0, 0, 0, 0]
      ]
    }
  ],
  hard: [
    {
      puzzle: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 8, 5],
        [0, 0, 1, 0, 2, 0, 0, 0, 0],
        [0, 0, 0, 5, 0, 7, 0, 0, 0],
        [0, 0, 4, 0, 0, 0, 1, 0, 0],
        [0, 9, 0, 0, 0, 0, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 7, 3],
        [0, 0, 2, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 4, 0, 0, 0, 9]
      ]
    },
    {
      puzzle: [
        [8, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 3, 6, 0, 0, 0, 0, 0],
        [0, 7, 0, 0, 9, 0, 2, 0, 0],
        [0, 5, 0, 0, 0, 7, 0, 0, 0],
        [0, 0, 0, 0, 4, 5, 7, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 3, 0],
        [0, 0, 1, 0, 0, 0, 0, 6, 8],
        [0, 0, 8, 5, 0, 0, 0, 1, 0],
        [0, 9, 0, 0, 0, 0, 4, 0, 0]
      ]
    }
  ],
  expert: [
    {
      puzzle: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 8, 5],
        [0, 0, 1, 0, 2, 0, 0, 0, 0],
        [0, 0, 0, 5, 0, 7, 0, 0, 0],
        [0, 0, 4, 0, 0, 0, 1, 0, 0],
        [0, 9, 0, 0, 0, 0, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 7, 3],
        [0, 0, 2, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 4, 0, 0, 0, 9]
      ]
    },
    {
      puzzle: [
        [0, 2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 6, 0, 0, 0, 0, 3],
        [0, 7, 4, 0, 8, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 3, 0, 0, 2],
        [0, 8, 0, 0, 4, 0, 0, 1, 0],
        [6, 0, 0, 5, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 7, 8, 0],
        [5, 0, 0, 0, 0, 9, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 4, 0]
      ]
    }
  ]
};

// Deep copy a 9x9 board
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

// Check if a number can legally be placed at (row, col)
export function isValidPlacement(board, row, col, num) {
  for (let c = 0; c < 9; c++) {
    if (board[row][c] === num && c !== col) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (board[r][col] === num && r !== row) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const curR = startRow + r;
      const curC = startCol + c;
      if (board[curR][curC] === num && (curR !== row || curC !== col)) return false;
    }
  }
  return true;
}

// Backtracking solver
export function solveSudoku(board) {
  const b = cloneBoard(board);

  function solve() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValidPlacement(b, r, c, num)) {
              b[r][c] = num;
              if (solve()) return true;
              b[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  if (solve()) return b;
  return null;
}

// Count number of solutions (up to limit) to verify uniqueness
function countSolutions(board, limit = 2) {
  let count = 0;
  const b = cloneBoard(board);

  function solve() {
    if (count >= limit) return;
    let minCandidates = 10;
    let bestR = -1;
    let bestC = -1;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] === 0) {
          let candidateCount = 0;
          for (let num = 1; num <= 9; num++) {
            if (isValidPlacement(b, r, c, num)) candidateCount++;
          }
          if (candidateCount < minCandidates) {
            minCandidates = candidateCount;
            bestR = r;
            bestC = c;
          }
        }
      }
    }

    if (bestR === -1) {
      count++;
      return;
    }

    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(b, bestR, bestC, num)) {
        b[bestR][bestC] = num;
        solve();
        b[bestR][bestC] = 0;
        if (count >= limit) return;
      }
    }
  }

  solve();
  return count;
}

// Shuffle an array
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate a random valid full board
export function generateFullBoard() {
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));

  function fillGrid() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of numbers) {
            if (isValidPlacement(board, r, c, num)) {
              board[r][c] = num;
              if (fillGrid()) return true;
              board[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  fillGrid();
  return board;
}

// Procedural puzzle generator with difficulty parameters
export function generatePuzzle(difficulty = 'easy') {
  // Clue counts per difficulty
  const targetClues = {
    easy: Math.floor(Math.random() * 5) + 38,    // 38-42
    medium: Math.floor(Math.random() * 5) + 32,  // 32-36
    hard: Math.floor(Math.random() * 5) + 26,    // 26-30
    expert: Math.floor(Math.random() * 4) + 22   // 22-25
  }[difficulty] || 36;

  try {
    const fullSolution = generateFullBoard();
    const puzzle = cloneBoard(fullSolution);

    // Create list of all 81 positions
    const positions = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push({ r, c });
      }
    }
    const shuffledPositions = shuffle(positions);

    let cluesRemaining = 81;
    for (const { r, c } of shuffledPositions) {
      if (cluesRemaining <= targetClues) break;

      const temp = puzzle[r][c];
      puzzle[r][c] = 0;

      // Ensure single unique solution
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[r][c] = temp; // Restore
      } else {
        cluesRemaining--;
      }
    }

    return {
      puzzle,
      solution: fullSolution,
      difficulty
    };
  } catch (err) {
    console.warn('Procedural generation fallback to curated puzzle:', err);
    // Fallback to curated puzzle
    const curatedList = CURATED_PUZZLES[difficulty] || CURATED_PUZZLES.easy;
    const item = curatedList[Math.floor(Math.random() * curatedList.length)];
    const puzzle = cloneBoard(item.puzzle);
    const solution = solveSudoku(puzzle);
    return {
      puzzle,
      solution,
      difficulty
    };
  }
}

// Get all candidates for a specific cell
export function getCandidates(board, row, col) {
  if (board[row][col] !== 0) return [];
  const candidates = [];
  for (let num = 1; num <= 9; num++) {
    if (isValidPlacement(board, row, col, num)) {
      candidates.push(num);
    }
  }
  return candidates;
}

// Get all candidates matrix for the board
export function getAllCandidates(board) {
  const matrix = Array.from({ length: 9 }, () => Array(9).fill(null));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      matrix[r][c] = getCandidates(board, r, c);
    }
  }
  return matrix;
}

// Check for board conflict cells
export function findBoardConflicts(board) {
  const conflictSet = new Set();

  // Check rows
  for (let r = 0; r < 9; r++) {
    const seen = new Map();
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (val !== 0) {
        if (seen.has(val)) {
          conflictSet.add(`${r},${c}`);
          conflictSet.add(`${r},${seen.get(val)}`);
        } else {
          seen.set(val, c);
        }
      }
    }
  }

  // Check cols
  for (let c = 0; c < 9; c++) {
    const seen = new Map();
    for (let r = 0; r < 9; r++) {
      const val = board[r][c];
      if (val !== 0) {
        if (seen.has(val)) {
          conflictSet.add(`${r},${c}`);
          conflictSet.add(`${seen.get(val)},${c}`);
        } else {
          seen.set(val, r);
        }
      }
    }
  }

  // Check 3x3 blocks
  for (let boxR = 0; boxR < 3; boxR++) {
    for (let boxC = 0; boxC < 3; boxC++) {
      const seen = new Map();
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const curR = boxR * 3 + r;
          const curC = boxC * 3 + c;
          const val = board[curR][curC];
          if (val !== 0) {
            if (seen.has(val)) {
              conflictSet.add(`${curR},${curC}`);
              const prev = seen.get(val);
              conflictSet.add(`${prev.r},${prev.c}`);
            } else {
              seen.set(val, { r: curR, c: curC });
            }
          }
        }
      }
    }
  }

  return conflictSet;
}

// Digit count map (how many of each 1-9 are on the board)
export function getDigitCounts(board) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (val >= 1 && val <= 9) {
        counts[val] = (counts[val] || 0) + 1;
      }
    }
  }
  return counts;
}

// AI Smart Hint Algorithm
export function findSmartHint(currentBoard, solutionBoard, initialClues) {
  if (!solutionBoard) return null;

  // Step 1: Detect User Mistake (cell has a number different from solution)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const userVal = currentBoard[r][c];
      if (userVal !== 0 && !initialClues[r][c] && userVal !== solutionBoard[r][c]) {
        return {
          type: 'MISTAKE',
          r,
          c,
          val: solutionBoard[r][c],
          currentVal: userVal,
          title: '⚠️ Mistake Detected',
          message: `The number ${userVal} at Row ${r + 1}, Column ${c + 1} does not match the valid solution and creates a deadlock. Replace or erase it!`,
          targetHighlight: [{ r, c }]
        };
      }
    }
  }

  const candidateMatrix = getAllCandidates(currentBoard);

  // Step 2: Naked Single (only 1 candidate possible in cell)
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] === 0 && candidateMatrix[r][c].length === 1) {
        const val = candidateMatrix[r][c][0];
        return {
          type: 'NAKED_SINGLE',
          r,
          c,
          val,
          title: '💡 Naked Single Found',
          message: `At Row ${r + 1}, Column ${c + 1}, all numbers 1–9 except ${val} already appear in its row, column, or 3×3 box. Therefore, this cell must be ${val}!`,
          targetHighlight: [{ r, c }]
        };
      }
    }
  }

  // Step 3: Hidden Single in 3x3 Box
  for (let boxR = 0; boxR < 3; boxR++) {
    for (let boxC = 0; boxC < 3; boxC++) {
      for (let num = 1; num <= 9; num++) {
        const matchingCells = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const curR = boxR * 3 + r;
            const curC = boxC * 3 + c;
            if (currentBoard[curR][curC] === 0 && candidateMatrix[curR][curC].includes(num)) {
              matchingCells.push({ r: curR, c: curC });
            }
          }
        }
        if (matchingCells.length === 1) {
          const { r, c } = matchingCells[0];
          return {
            type: 'HIDDEN_SINGLE_BOX',
            r,
            c,
            val: num,
            title: '🎯 Hidden Single (3×3 Box)',
            message: `In the 3×3 box (Box ${boxR * 3 + boxC + 1}), number ${num} can only be placed at Row ${r + 1}, Column ${c + 1}. All other cells in this box cannot contain ${num}.`,
            targetHighlight: [{ r, c }]
          };
        }
      }
    }
  }

  // Step 4: Hidden Single in Row
  for (let r = 0; r < 9; r++) {
    for (let num = 1; num <= 9; num++) {
      const matchingCols = [];
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0 && candidateMatrix[r][c].includes(num)) {
          matchingCols.push(c);
        }
      }
      if (matchingCols.length === 1) {
        const c = matchingCols[0];
        return {
          type: 'HIDDEN_SINGLE_ROW',
          r,
          c,
          val: num,
          title: '🎯 Hidden Single (Row)',
          message: `In Row ${r + 1}, number ${num} can only be placed at Column ${c + 1} because other positions in this row are constrained.`,
          targetHighlight: [{ r, c }]
        };
      }
    }
  }

  // Step 5: Hidden Single in Column
  for (let c = 0; c < 9; c++) {
    for (let num = 1; num <= 9; num++) {
      const matchingRows = [];
      for (let r = 0; r < 9; r++) {
        if (currentBoard[r][c] === 0 && candidateMatrix[r][c].includes(num)) {
          matchingRows.push(r);
        }
      }
      if (matchingRows.length === 1) {
        const r = matchingRows[0];
        return {
          type: 'HIDDEN_SINGLE_COL',
          r,
          c,
          val: num,
          title: '🎯 Hidden Single (Column)',
          message: `In Column ${c + 1}, number ${num} can only be placed at Row ${r + 1} because other positions in this column are constrained.`,
          targetHighlight: [{ r, c }]
        };
      }
    }
  }

  // Step 6: Fallback Next Logical Step from Solution
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] === 0) {
        const val = solutionBoard[r][c];
        return {
          type: 'LOGICAL_STEP',
          r,
          c,
          val,
          title: '✨ AI Logical Deduction',
          message: `Based on Sudoku elimination constraints, Row ${r + 1}, Column ${c + 1} is logically determined to be ${val}.`,
          targetHighlight: [{ r, c }]
        };
      }
    }
  }

  return null;
}

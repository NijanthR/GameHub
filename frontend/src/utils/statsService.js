// Centralized Real-time Gameplay Stats Service
// Tracks accurate player metrics and history across all games
import { trackGameEnd } from './activityTracker';

export function getPlayerStats(userId = 'default') {
  const key = `gamehub_stats_${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) {
    // Default 100% genuine zero stats
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tttGames: 0,
      tttWins: 0,
      tttLosses: 0,
      tttDraws: 0,
      g2048Games: 0,
      g2048BestScore: parseInt(localStorage.getItem('g2048_best') || '0', 10),
      g2048HighestTile: parseInt(localStorage.getItem('g2048_highest_tile') || '0', 10),
      g2048Wins: 0,
      chessGames: 0,
      chessWins: 0,
      chessLosses: 0,
      chessDraws: 0,
      sudokuGames: 0,
      sudokuWins: 0,
      sudokuBestTimes: { easy: null, medium: null, hard: null, expert: null },
      waterSortGames: 0,
      waterSortWins: 0,
      waterSortStars: 0,
      history: []
    };
  }
  try {
    const parsed = JSON.parse(raw);
    // Sync with standalone 2048 best if higher
    const local2048Best = parseInt(localStorage.getItem('g2048_best') || '0', 10);
    if (local2048Best > (parsed.g2048BestScore || 0)) {
      parsed.g2048BestScore = local2048Best;
    }
    if (!parsed.sudokuBestTimes) {
      parsed.sudokuBestTimes = { easy: null, medium: null, hard: null, expert: null };
    }
    return parsed;
  } catch {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tttGames: 0,
      tttWins: 0,
      tttLosses: 0,
      tttDraws: 0,
      g2048Games: 0,
      g2048BestScore: 0,
      g2048HighestTile: 0,
      g2048Wins: 0,
      sudokuGames: 0,
      sudokuWins: 0,
      sudokuBestTimes: { easy: null, medium: null, hard: null, expert: null },
      waterSortGames: 0,
      waterSortWins: 0,
      waterSortStars: 0,
      history: []
    };
  }
}

export function savePlayerStats(userId = 'default', stats) {
  const key = `gamehub_stats_${userId}`;
  localStorage.setItem(key, JSON.stringify(stats));
  if (stats.g2048BestScore) {
    localStorage.setItem('g2048_best', String(stats.g2048BestScore));
  }
  if (stats.g2048HighestTile) {
    localStorage.setItem('g2048_highest_tile', String(stats.g2048HighestTile));
  }
}

// Record a completed Tic Tac Toe game
export function recordTttOutcome(userId = 'default', { outcome, mode, difficulty }) {
  // outcome: 'WIN' | 'LOSS' | 'DRAW'
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.tttGames = (stats.tttGames || 0) + 1;

  if (outcome === 'WIN') {
    stats.wins = (stats.wins || 0) + 1;
    stats.tttWins = (stats.tttWins || 0) + 1;
  } else if (outcome === 'LOSS') {
    stats.losses = (stats.losses || 0) + 1;
    stats.tttLosses = (stats.tttLosses || 0) + 1;
  } else if (outcome === 'DRAW') {
    stats.draws = (stats.draws || 0) + 1;
    stats.tttDraws = (stats.tttDraws || 0) + 1;
  }

  const record = {
    game: 'Tic Tac Toe',
    outcome,
    details: `${mode.toUpperCase()} mode (${difficulty || 'Standard'})`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)]; // Keep latest 20
  savePlayerStats(userId, stats);
  trackGameEnd('Tic Tac Toe', { outcome, details: record.details });
  return stats;
}

// Record a completed 2048 match
export function record2048Outcome(userId = 'default', { score, highestTile, reached2048 }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.g2048Games = (stats.g2048Games || 0) + 1;

  if (score > (stats.g2048BestScore || 0)) {
    stats.g2048BestScore = score;
  }
  if (highestTile > (stats.g2048HighestTile || 0)) {
    stats.g2048HighestTile = highestTile;
  }
  if (reached2048) {
    stats.wins = (stats.wins || 0) + 1;
    stats.g2048Wins = (stats.g2048Wins || 0) + 1;
  }

  const record = {
    game: '2048',
    outcome: reached2048 ? 'WIN' : 'FINISHED',
    details: `Score: ${score.toLocaleString()} · Tile: ${highestTile}`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('2048', { outcome: record.outcome, score, details: record.details });
  return stats;
}

// Record a completed Chess match
export function recordChessOutcome(userId = 'default', { outcome, mode, difficulty, totalMoves }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.chessGames = (stats.chessGames || 0) + 1;

  if (outcome === 'WIN') {
    stats.wins = (stats.wins || 0) + 1;
    stats.chessWins = (stats.chessWins || 0) + 1;
  } else if (outcome === 'LOSS') {
    stats.losses = (stats.losses || 0) + 1;
    stats.chessLosses = (stats.chessLosses || 0) + 1;
  } else if (outcome === 'DRAW') {
    stats.draws = (stats.draws || 0) + 1;
    stats.chessDraws = (stats.chessDraws || 0) + 1;
  }

  const record = {
    game: 'Chess',
    outcome,
    details: `${mode || 'VS AI'} · ${totalMoves || 0} moves`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('Chess', { outcome, moves: totalMoves, details: record.details });
  return stats;
}

// Record a completed Flow Puzzle Level
export function recordFlowOutcome(userId = 'default', { packTitle, levelId, moves, stars, timeStr }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.flowGames = (stats.flowGames || 0) + 1;
  stats.wins = (stats.wins || 0) + 1;
  stats.flowWins = (stats.flowWins || 0) + 1;

  const record = {
    game: 'Flow Puzzle',
    outcome: 'WIN',
    details: `${packTitle} Lvl ${levelId} · ${stars}★ · ${moves} moves (${timeStr})`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('Color Flow', { outcome: 'WIN', moves, stars, details: record.details });
  return stats;
}

// Record a Flappy Bird round
export function recordFlappyOutcome(userId = 'default', { score, bestScore, coins, mode }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.flappyGames = (stats.flappyGames || 0) + 1;
  stats.flappyBest = Math.max(stats.flappyBest || 0, score, bestScore || 0);
  stats.flappyCoins = (stats.flappyCoins || 0) + (coins || 0);

  if (score >= 10) {
    stats.wins = (stats.wins || 0) + 1;
    stats.flappyWins = (stats.flappyWins || 0) + 1;
  }

  const record = {
    game: 'Flappy Bird',
    outcome: score >= 10 ? 'WIN' : 'FINISHED',
    details: `${mode || 'Classic'} · Score: ${score} (Best: ${stats.flappyBest})`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('Floppy Bird', { outcome: record.outcome, score, details: record.details });
  return stats;
}

// Record a completed Sudoku Game
export function recordSudokuOutcome(userId = 'default', { difficulty, timeSeconds, timeStr, mistakes, hintsUsed, won, score }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.sudokuGames = (stats.sudokuGames || 0) + 1;

  if (!stats.sudokuBestTimes) {
    stats.sudokuBestTimes = { easy: null, medium: null, hard: null, expert: null };
  }

  if (won) {
    stats.wins = (stats.wins || 0) + 1;
    stats.sudokuWins = (stats.sudokuWins || 0) + 1;

    // Update best time for this difficulty
    const prevBest = stats.sudokuBestTimes[difficulty];
    if (!prevBest || timeSeconds < prevBest) {
      stats.sudokuBestTimes[difficulty] = timeSeconds;
    }
  }

  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const record = {
    game: 'Sudoku',
    outcome: won ? 'WIN' : 'FINISHED',
    details: `${diffLabel} · Time: ${timeStr} · Mistakes: ${mistakes} · Score: ${score || 0}`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('Sudoku', { outcome: won ? 'WIN' : 'FINISHED', score, durationSeconds: timeSeconds, details: record.details });
  return stats;
}

// Record a completed Water Sort Puzzle round
export function recordWaterSortOutcome(userId = 'default', { levelId, packTitle, moves, stars, timeStr, won }) {
  const stats = getPlayerStats(userId);
  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.waterSortGames = (stats.waterSortGames || 0) + 1;

  if (won) {
    stats.wins = (stats.wins || 0) + 1;
    stats.waterSortWins = (stats.waterSortWins || 0) + 1;
    stats.waterSortStars = (stats.waterSortStars || 0) + (stars || 0);
  }

  const record = {
    game: 'Water Sort',
    outcome: won ? 'WIN' : 'FINISHED',
    details: `${packTitle || 'Level'} #${levelId} · ${stars || 1}★ · ${moves} moves (${timeStr})`,
    timestamp: new Date().toISOString()
  };

  stats.history = [record, ...(stats.history || []).slice(0, 19)];
  savePlayerStats(userId, stats);
  trackGameEnd('Water Sort', { outcome: won ? 'WIN' : 'FINISHED', moves, stars, details: record.details });
  return stats;
}


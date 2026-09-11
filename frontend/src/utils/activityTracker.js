// Real-time Platform Activity Telemetry & Tracking Service for GameHub

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('gamehub_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Low-level activity dispatcher (non-blocking)
 */
export async function logActivity(action, data = {}) {
  try {
    const user = data.user || getCurrentUser();
    const payload = {
      action,
      user,
      game: data.game || null,
      details: data.details || '',
      durationSeconds: data.durationSeconds || 0,
      score: data.score !== undefined ? data.score : null,
      outcome: data.outcome || null,
      extra: data.extra || {}
    };

    // Non-blocking fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch(`${API_URL}/api/activity/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId));
  } catch (err) {
    // Silent fail for telemetry so UI is never blocked
    console.debug('Telemetry dispatch note:', err);
  }
}

/**
 * Call when a user starts or enters any game
 */
export function trackGameStart(game, details = '') {
  try {
    const key = `gh_start_${game.toLowerCase().replace(/\s+/g, '_')}`;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}

  logActivity('GAME_START', {
    game,
    details: details || `Started playing ${game}`
  });
}

/**
 * Call when a user completes or finishes a game match
 */
export function trackGameEnd(game, { outcome = 'FINISHED', score = null, moves = null, stars = null, details = '' } = {}) {
  let durationSeconds = 0;
  try {
    const key = `gh_start_${game.toLowerCase().replace(/\s+/g, '_')}`;
    const startTs = sessionStorage.getItem(key);
    if (startTs) {
      durationSeconds = Math.max(1, Math.round((Date.now() - parseInt(startTs, 10)) / 1000));
      sessionStorage.removeItem(key);
    }
  } catch {}

  const extra = {};
  if (moves !== null) extra.moves = moves;
  if (stars !== null) extra.stars = stars;

  let finalDetails = details;
  if (!finalDetails) {
    const parts = [];
    if (outcome) parts.push(outcome);
    if (score !== null) parts.push(`Score: ${score}`);
    if (moves !== null) parts.push(`${moves} moves`);
    if (stars !== null) parts.push(`${stars}★`);
    if (durationSeconds > 0) parts.push(`${durationSeconds}s`);
    finalDetails = parts.join(' · ');
  }

  logActivity('GAME_COMPLETE', {
    game,
    outcome,
    score,
    durationSeconds,
    details: finalDetails,
    extra
  });
}

/**
 * Call when a user requests an AI move, deduction, or hint
 */
export function trackAiUsage(game, toolType = 'AI Hint', details = '') {
  logActivity('AI_HINT', {
    game,
    details: details || `Requested ${toolType} in ${game}`
  });
}

/**
 * Send presence heartbeat to backend
 */
export function sendHeartbeat(currentGame = null) {
  try {
    const user = getCurrentUser();
    if (!user) return;

    fetch(`${API_URL}/api/activity/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        name: user.name,
        provider: user.provider,
        game: currentGame
      })
    }).catch(() => {});
  } catch {}
}

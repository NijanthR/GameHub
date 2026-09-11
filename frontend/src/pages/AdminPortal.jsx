import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, ADMIN_EMAILS } from '../context/AuthContext';
import './AdminPortal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFAULT_ADMIN_SECRET = 'gamehub-admin-2026';

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Admin Auth Gate State
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (user?.email && ADMIN_EMAILS.includes(user.email)) return true;
    return !!sessionStorage.getItem('gamehub_admin_token');
  });
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Data States
  const [metrics, setMetrics] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Filter States
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'LOGIN' | 'GAME_COMPLETE' | 'WIN' | 'AI_HINT'
  const [gameFilter, setGameFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds (0 = off)

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // Helper to build admin headers
  const getAdminHeaders = useCallback(() => {
    const token = sessionStorage.getItem('gamehub_admin_token') || localStorage.getItem('gamehub_token');
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Key': DEFAULT_ADMIN_SECRET,
    };
    if (token && token !== 'admin_verified') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Fetch all admin data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isUnlocked) return;
    if (!isSilent) setLoading(true);
    setError(null);

    try {
      const headers = getAdminHeaders();
      const adminParam = `adminKey=${encodeURIComponent(DEFAULT_ADMIN_SECRET)}`;

      // Parallel fetch metrics, users, activities with resilient query param + headers fallback
      const [mRes, uRes, aRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/metrics?${adminParam}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(err => { console.warn('Admin metrics error:', err); return null; }),
        fetch(`${API_URL}/api/admin/users?${adminParam}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(err => { console.warn('Admin users error:', err); return null; }),
        fetch(`${API_URL}/api/admin/activities?limit=300&${adminParam}`, { headers })
          .then(r => r.ok ? r.json() : null)
          .catch(err => { console.warn('Admin activities error:', err); return null; })
      ]);

      if (mRes) setMetrics(mRes);
      if (uRes?.users) setUsersList(uRes.users);
      if (aRes?.activities) setActivities(aRes.activities);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Admin data fetch error:', err);
      setError('Failed to fetch real-time admin metrics from backend.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isUnlocked, getAdminHeaders]);

  // Handle PIN verification
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin, email: user?.email })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          sessionStorage.setItem('gamehub_admin_token', data.token);
        } else {
          sessionStorage.setItem('gamehub_admin_token', 'admin_verified');
        }
        setIsUnlocked(true);
      } else {
        // Fallback local check
        if (adminPin.trim() === DEFAULT_ADMIN_SECRET) {
          sessionStorage.setItem('gamehub_admin_token', 'admin_verified');
          setIsUnlocked(true);
        } else {
          setPinError('Invalid Admin Passcode. Please try again.');
        }
      }
    } catch {
      if (adminPin.trim() === DEFAULT_ADMIN_SECRET) {
        sessionStorage.setItem('gamehub_admin_token', 'admin_verified');
        setIsUnlocked(true);
      } else {
        setPinError('Invalid Admin Passcode.');
      }
    } finally {
      setPinLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isUnlocked) {
      fetchData();
    }
  }, [isUnlocked, fetchData]);

  // Periodic Auto-refresh
  useEffect(() => {
    if (!isUnlocked || refreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [isUnlocked, refreshInterval, fetchData]);

  // Export Data Handler
  const handleExport = async (format = 'json') => {
    try {
      const headers = getAdminHeaders();
      const adminParam = `adminKey=${encodeURIComponent(DEFAULT_ADMIN_SECRET)}`;
      if (format === 'csv') {
        const res = await fetch(`${API_URL}/api/admin/export?format=csv&${adminParam}`, { headers });
        if (!res.ok) throw new Error('CSV export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gamehub_activities_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const res = await fetch(`${API_URL}/api/admin/export?format=json&${adminParam}`, { headers });
        if (!res.ok) throw new Error('JSON export failed');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gamehub_full_dump_${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      setActionMessage(`Exported telemetry data as ${format.toUpperCase()}`);
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Export failed. Please check backend connection.');
    }
  };

  // Clear Logs Handler
  const handleClearLogs = async () => {
    try {
      const headers = getAdminHeaders();
      const adminParam = `adminKey=${encodeURIComponent(DEFAULT_ADMIN_SECRET)}`;
      const res = await fetch(`${API_URL}/api/admin/activities?${adminParam}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setActivities([]);
        setShowClearConfirm(false);
        setActionMessage('All historical activity logs cleared successfully.');
        setTimeout(() => setActionMessage(''), 4000);
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to clear logs.');
    }
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Tab filter
      if (activeTab === 'LOGIN' && act.action !== 'LOGIN') return false;
      if (activeTab === 'GAME_COMPLETE' && act.action !== 'GAME_COMPLETE') return false;
      if (activeTab === 'WIN' && act.outcome !== 'WIN') return false;
      if (activeTab === 'AI_HINT' && act.action !== 'AI_HINT') return false;

      // Game filter (only applies to game events, never hides logins unless searching)
      if (gameFilter !== 'ALL') {
        if (activeTab === 'LOGIN') {
          // Do not filter out logins when user switches to login tab
        } else if (act.game !== gameFilter) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = (act.userName || '').toLowerCase().includes(q) || (act.userEmail || '').toLowerCase().includes(q);
        const matchGame = (act.game || '').toLowerCase().includes(q);
        const matchDetails = (act.details || '').toLowerCase().includes(q);
        const matchAction = (act.action || '').toLowerCase().includes(q);
        if (!matchUser && !matchGame && !matchDetails && !matchAction) return false;
      }

      return true;
    });
  }, [activities, activeTab, gameFilter, searchQuery]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.provider || '').toLowerCase().includes(q)
    );
  }, [usersList, userSearch]);

  // Relative Time Formatter
  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 5) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return isoString;
    }
  };

  // Helper for Action Badge Styling
  const getActionBadge = (action, outcome) => {
    if (action === 'LOGIN') return <span className="act-badge badge-login">🔑 Login</span>;
    if (action === 'LOGOUT') return <span className="act-badge badge-logout">🚪 Logout</span>;
    if (action === 'AI_HINT') return <span className="act-badge badge-ai">🤖 AI Solver</span>;
    if (action === 'GAME_START') return <span className="act-badge badge-start">🎮 Game Start</span>;
    if (action === 'GAME_COMPLETE') {
      if (outcome === 'WIN') return <span className="act-badge badge-win">🏆 Victory</span>;
      if (outcome === 'LOSS') return <span className="act-badge badge-loss">❌ Defeat</span>;
      return <span className="act-badge badge-play">🏁 Match Done</span>;
    }
    return <span className="act-badge badge-info">{action}</span>;
  };

  // ── Render Admin Auth Passcode Gate ──
  if (!isUnlocked) {
    return (
      <div className="admin-lock-screen">
        <div className="admin-lock-card">
          <div className="admin-lock-icon-wrap">
            <span className="admin-lock-icon">🛡️</span>
            <div className="admin-lock-ring" />
          </div>
          <h1 className="admin-lock-title">Admin Access Required</h1>
          <p className="admin-lock-sub">
            This monitoring portal provides live access to player sessions, authentication logs, and game usage analytics.
          </p>

          <form onSubmit={handlePinSubmit} className="admin-pin-form">
            <div className="admin-pin-input-wrap">
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter Master Admin Passcode"
                className="admin-pin-input"
                autoFocus
                required
              />
            </div>

            {pinError && <div className="admin-pin-error">{pinError}</div>}

            <button type="submit" className="admin-unlock-btn" disabled={pinLoading}>
              {pinLoading ? 'Verifying...' : '⚡ Unlock Admin Portal'}
            </button>
          </form>

          <div className="admin-lock-footer">
            <Link to="/" className="admin-return-link">← Return to Player Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-root">
      {/* Background Ambience */}
      <div className="admin-bg-mesh" />
      <div className="admin-bg-glow-1" />
      <div className="admin-bg-glow-2" />

      {/* ── Top Header ── */}
      <header className="admin-header">
        <div className="admin-header-left">
          <Link to="/" className="admin-brand-link">
            <div className="admin-logo-mark">
              <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
                <rect width="32" height="32" rx="8" fill="url(#adminLogoGrad)" />
                <path d="M10 16L14 20L22 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="adminLogoGrad" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="admin-brand-text">
              <h1 className="admin-brand-title">GameHub <span>Admin Monitor</span></h1>
              <span className="admin-brand-sub">Platform Telemetry & User Activity</span>
            </div>
          </Link>

          <div className="admin-live-pulse-badge">
            <span className="live-dot" />
            <span>LIVE AUDIT STREAM</span>
          </div>
        </div>

        <div className="admin-header-right">
          {/* Refresh Controls */}
          <div className="admin-refresh-wrap">
            <span className="refresh-lbl">Auto-sync:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="admin-select-interval"
            >
              <option value="5">5s (Fast)</option>
              <option value="10">10s (Normal)</option>
              <option value="30">30s (Slow)</option>
              <option value="0">Off (Manual)</option>
            </select>
            <button
              className="admin-btn-icon"
              onClick={() => fetchData(false)}
              title="Refresh Now"
              disabled={loading}
            >
              <svg className={loading ? 'spin-icon' : ''} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>

          {/* Export Buttons */}
          <div className="admin-export-group">
            <button className="admin-btn-export" onClick={() => handleExport('csv')} title="Export CSV">
              📥 CSV
            </button>
            <button className="admin-btn-export" onClick={() => handleExport('json')} title="Export JSON">
              📄 JSON
            </button>
          </div>

          {/* Return link */}
          <Link to="/" className="admin-btn-return">
            🎮 Dashboard
          </Link>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="admin-toast-banner">
          <span>✨ {actionMessage}</span>
        </div>
      )}

      {/* ── Main Dashboard Content ── */}
      <main className="admin-content-container">
        {/* ── KPI Metrics Grid ── */}
        <section className="admin-kpi-grid">
          {/* Card 1: Total Players */}
          <div className="kpi-card kpi-card-users">
            <div className="kpi-icon-wrap">
              <span className="kpi-icon">👥</span>
            </div>
            <div className="kpi-body">
              <span className="kpi-label">TOTAL PLAYERS</span>
              <div className="kpi-value-row">
                <h2 className="kpi-val">{metrics?.overview?.totalUsers || usersList.length || 0}</h2>
                <div className="kpi-pill-group">
                  <span className="kpi-sub-pill google-pill">
                    {metrics?.overview?.googleUsers || 0} Google
                  </span>
                  <span className="kpi-sub-pill guest-pill">
                    {metrics?.overview?.guestUsers || 0} Guest
                  </span>
                </div>
              </div>
              <span className="kpi-footnote">Registered accounts in database</span>
            </div>
          </div>

          {/* Card 2: Active Online Users */}
          <div className="kpi-card kpi-card-active">
            <div className="kpi-icon-wrap active-pulse-icon">
              <span className="kpi-icon">🟢</span>
            </div>
            <div className="kpi-body">
              <span className="kpi-label">ACTIVE ONLINE NOW</span>
              <div className="kpi-value-row">
                <h2 className="kpi-val text-green">{metrics?.overview?.activeNow || 0}</h2>
                <span className="kpi-live-tag">Online (5m)</span>
              </div>
              <span className="kpi-footnote">Real-time active presence sessions</span>
            </div>
          </div>

          {/* Card 3: Total Games Played */}
          <div className="kpi-card kpi-card-games">
            <div className="kpi-icon-wrap">
              <span className="kpi-icon">🎮</span>
            </div>
            <div className="kpi-body">
              <span className="kpi-label">MATCHES PLAYED</span>
              <div className="kpi-value-row">
                <h2 className="kpi-val text-purple">{metrics?.overview?.totalGamesPlayed || 0}</h2>
                <span className="kpi-winrate-tag">
                  {metrics?.overview?.overallWinRate || 0}% Win Rate
                </span>
              </div>
              <span className="kpi-footnote">Completed game rounds across 7 titles</span>
            </div>
          </div>

          {/* Card 4: Playtime & AI Solvers */}
          <div className="kpi-card kpi-card-time">
            <div className="kpi-icon-wrap">
              <span className="kpi-icon">⏱️</span>
            </div>
            <div className="kpi-body">
              <span className="kpi-label">TOTAL PLAYTIME & AI</span>
              <div className="kpi-value-row">
                <h2 className="kpi-val text-amber">{metrics?.overview?.totalPlaytimeMinutes || 0}m</h2>
                <span className="kpi-ai-tag">
                  🤖 {metrics?.overview?.aiHintsUsed || 0} AI Solves
                </span>
              </div>
              <span className="kpi-footnote">Estimated total gameplay duration</span>
            </div>
          </div>
        </section>

        {/* ── Game Usage Analytics & Popularity ── */}
        <section className="admin-analytics-section">
          <div className="admin-section-header">
            <div className="sec-title-wrap">
              <span className="sec-icon">📊</span>
              <div>
                <h3 className="sec-title">Game Usage & Popularity Breakdown</h3>
                <span className="sec-sub">Telemetry play counts, wins, and popularity across all 7 games</span>
              </div>
            </div>
          </div>

          <div className="game-breakdown-grid">
            {Object.entries(metrics?.gameBreakdown || {
              'Water Sort': 0,
              'Sudoku': 0,
              'Chess': 0,
              'Floppy Bird': 0,
              '2048': 0,
              'Color Flow': 0,
              'Tic Tac Toe': 0
            }).map(([gName, count]) => {
              const wins = (metrics?.gameWins || {})[gName] || 0;
              const maxGames = Math.max(1, ...Object.values(metrics?.gameBreakdown || { a: 1 }));
              const pct = Math.min(100, Math.round((count / maxGames) * 100));
              const winPct = count > 0 ? Math.round((wins / count) * 100) : 0;

              return (
                <div key={gName} className="game-stat-card">
                  <div className="gcard-header">
                    <span className="gcard-name">{gName}</span>
                    <span className="gcard-count">{count} matches</span>
                  </div>
                  <div className="gcard-bar-track">
                    <div className="gcard-bar-fill" style={{ width: `${Math.max(8, pct)}%` }} />
                  </div>
                  <div className="gcard-footer">
                    <span className="gcard-wins">{wins} wins ({winPct}%)</span>
                    <button
                      className="gcard-filter-btn"
                      onClick={() => setGameFilter(gName === gameFilter ? 'ALL' : gName)}
                    >
                      {gameFilter === gName ? '✓ Filtered' : 'Filter Feed →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Live Activity Stream ── */}
        <section className="admin-activity-section">
          <div className="admin-section-header">
            <div className="sec-title-wrap">
              <span className="sec-icon">⚡</span>
              <div>
                <h3 className="sec-title">Real-Time Activity Audit Stream</h3>
                <span className="sec-sub">
                  Showing {filteredActivities.length} recent events · Auto-updates live
                </span>
              </div>
            </div>

            <div className="sec-actions">
              <button
                className="btn-clear-logs"
                onClick={() => setShowClearConfirm(true)}
                title="Clear Logs"
              >
                🗑️ Clear Event Stream
              </button>
            </div>
          </div>

          {/* Activity Filters & Tabs */}
          <div className="activity-controls-bar">
            {/* Action Tabs */}
            <div className="activity-tabs">
              <button
                className={`act-tab ${activeTab === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTab('ALL')}
              >
                All Events ({activities.length})
              </button>
              <button
                className={`act-tab ${activeTab === 'LOGIN' ? 'active' : ''}`}
                onClick={() => setActiveTab('LOGIN')}
              >
                🔑 Logins
              </button>
              <button
                className={`act-tab ${activeTab === 'GAME_COMPLETE' ? 'active' : ''}`}
                onClick={() => setActiveTab('GAME_COMPLETE')}
              >
                🎮 Matches
              </button>
              <button
                className={`act-tab ${activeTab === 'WIN' ? 'active' : ''}`}
                onClick={() => setActiveTab('WIN')}
              >
                🏆 Victories
              </button>
              <button
                className={`act-tab ${activeTab === 'AI_HINT' ? 'active' : ''}`}
                onClick={() => setActiveTab('AI_HINT')}
              >
                🤖 AI Solvers
              </button>
            </div>

            {/* Game Selector & Search */}
            <div className="activity-filter-inputs">
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                className="activity-game-select"
              >
                <option value="ALL">All Games</option>
                <option value="Water Sort">Water Sort</option>
                <option value="Sudoku">Sudoku</option>
                <option value="Chess">Chess</option>
                <option value="Floppy Bird">Floppy Bird</option>
                <option value="2048">2048</option>
                <option value="Color Flow">Color Flow</option>
                <option value="Tic Tac Toe">Tic Tac Toe</option>
              </select>

              <div className="activity-search-wrap">
                <input
                  type="text"
                  placeholder="Filter by user, game, details…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="activity-search-input"
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed List */}
          <div className="activity-stream-feed">
            {filteredActivities.length === 0 ? (
              <div className="activity-empty-state">
                <span className="empty-icon">🔍</span>
                <p>No activity events match your current filter criteria.</p>
                <button
                  className="btn-reset-filters"
                  onClick={() => { setActiveTab('ALL'); setGameFilter('ALL'); setSearchQuery(''); }}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div key={act.id} className={`activity-row-card action-${(act.action || '').toLowerCase()}`}>
                  {/* Left: User Avatar & Info */}
                  <div className="act-user-cell">
                    {act.userPicture ? (
                      <img src={act.userPicture} alt={act.userName} className="act-avatar-img" />
                    ) : (
                      <div className="act-avatar-fallback">
                        {act.userName ? act.userName.charAt(0).toUpperCase() : '👤'}
                      </div>
                    )}
                    <div className="act-user-info">
                      <span className="act-user-name">{act.userName || 'Anonymous Player'}</span>
                      <span className="act-user-email">{act.userEmail}</span>
                    </div>
                  </div>

                  {/* Middle: Event Type Badge & Details */}
                  <div className="act-event-cell">
                    <div className="act-badge-row">
                      {getActionBadge(act.action, act.outcome)}
                      {act.game && <span className="act-game-tag">🎮 {act.game}</span>}
                      {act.score !== null && act.score !== undefined && (
                        <span className="act-score-tag">Score: {act.score}</span>
                      )}
                      {act.durationSeconds > 0 && (
                        <span className="act-dur-tag">⏱️ {act.durationSeconds}s</span>
                      )}
                    </div>
                    <p className="act-details-text">{act.details || 'Event logged'}</p>
                  </div>

                  {/* Right: Device & Timestamp */}
                  <div className="act-meta-cell">
                    <span className="act-device-tag" title={`IP: ${act.ip || '127.0.0.1'}`}>
                      {act.device || 'Web Browser'}
                    </span>
                    <span className="act-time-tag" title={act.timestamp}>
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── User Management Directory ── */}
        <section className="admin-users-section">
          <div className="admin-section-header">
            <div className="sec-title-wrap">
              <span className="sec-icon">👤</span>
              <div>
                <h3 className="sec-title">Player Directory & Usage Profiles</h3>
                <span className="sec-sub">Track individual player logins, games, win rates, and last seen status</span>
              </div>
            </div>

            <div className="user-search-wrap">
              <input
                type="text"
                placeholder="Search players by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="user-search-input"
              />
            </div>
          </div>

          <div className="users-table-responsive">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>PLAYER</th>
                  <th>PROVIDER</th>
                  <th>STATUS</th>
                  <th>GAMES PLAYED</th>
                  <th>WINS (WIN RATE)</th>
                  <th>FAVORITE GAME</th>
                  <th>LAST ACTIVE</th>
                  <th>DEVICE / IP</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-6">
                      No players found matching "{userSearch}"
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id || u.email}>
                      <td>
                        <div className="table-user-cell">
                          {u.picture ? (
                            <img src={u.picture} alt={u.name} className="tuser-avatar" />
                          ) : (
                            <div className="tuser-fallback">
                              {u.name ? u.name.charAt(0).toUpperCase() : '👤'}
                            </div>
                          )}
                          <div>
                            <span className="tuser-name">{u.name}</span>
                            <span className="tuser-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`provider-badge ${u.provider}`}>
                          {u.provider === 'google' ? 'Google' : 'Guest'}
                        </span>
                      </td>
                      <td>
                        {u.isOnline ? (
                          <span className="status-badge status-online">🟢 Online</span>
                        ) : (
                          <span className="status-badge status-offline">⚪ Offline</span>
                        )}
                      </td>
                      <td>
                        <strong>{u.gamesPlayed || 0}</strong> matches
                      </td>
                      <td>
                        <span className="text-green font-bold">{u.wins || 0}</span> ({u.winRate || 0}%)
                      </td>
                      <td>
                        <span className="fav-game-pill">{u.favoriteGame || 'None'}</span>
                      </td>
                      <td>
                        <span title={u.lastActive}>{formatRelativeTime(u.lastActive)}</span>
                      </td>
                      <td>
                        <span className="device-ip-text" title={u.lastDevice}>
                          {u.lastIp || '127.0.0.1'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-inspect-user"
                          onClick={() => setSelectedUser(u)}
                        >
                          Inspect 🔍
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ── User Detail Modal ── */}
      {selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-user-hero">
                {selectedUser.picture ? (
                  <img src={selectedUser.picture} alt={selectedUser.name} className="modal-avatar-lg" />
                ) : (
                  <div className="modal-avatar-fallback-lg">
                    {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : '👤'}
                  </div>
                )}
                <div>
                  <h3 className="modal-user-name">{selectedUser.name}</h3>
                  <span className="modal-user-email">{selectedUser.email}</span>
                  <div className="modal-user-tags">
                    <span className={`provider-badge ${selectedUser.provider}`}>
                      {selectedUser.provider === 'google' ? 'Google Account' : 'Guest Player'}
                    </span>
                    {selectedUser.isOnline ? (
                      <span className="status-badge status-online">🟢 Active Now</span>
                    ) : (
                      <span className="status-badge status-offline">Last Seen {formatRelativeTime(selectedUser.lastActive)}</span>
                    )}
                  </div>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedUser(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Stat Cards */}
              <div className="modal-stats-grid">
                <div className="mstat-box">
                  <span className="mstat-lbl">MATCHES PLAYED</span>
                  <span className="mstat-val text-purple">{selectedUser.gamesPlayed || 0}</span>
                </div>
                <div className="mstat-box">
                  <span className="mstat-lbl">WINS</span>
                  <span className="mstat-val text-green">{selectedUser.wins || 0}</span>
                </div>
                <div className="mstat-box">
                  <span className="mstat-lbl">WIN RATE</span>
                  <span className="mstat-val text-gold">{selectedUser.winRate || 0}%</span>
                </div>
                <div className="mstat-box">
                  <span className="mstat-lbl">LOGINS</span>
                  <span className="mstat-val text-blue">{selectedUser.loginCount || 1}</span>
                </div>
              </div>

              {/* User Recent Events */}
              <h4 className="modal-sec-title">Recent Activity for this Player</h4>
              <div className="modal-activity-list">
                {activities
                  .filter((a) => a.userEmail === selectedUser.email)
                  .slice(0, 10)
                  .map((a) => (
                    <div key={a.id} className="modal-act-item">
                      <div className="mact-left">
                        {getActionBadge(a.action, a.outcome)}
                        <span className="mact-details">{a.details || a.game || 'Activity logged'}</span>
                      </div>
                      <span className="mact-time">{formatRelativeTime(a.timestamp)}</span>
                    </div>
                  ))}
                {activities.filter((a) => a.userEmail === selectedUser.email).length === 0 && (
                  <p className="modal-no-acts">No specific recent events recorded for this player yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Logs Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="admin-modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <span className="confirm-icon">⚠️</span>
            <h3>Clear All Activity Logs?</h3>
            <p>
              This will permanently delete the current activity event stream. Registered users and their high scores/stats will not be deleted.
            </p>
            <div className="confirm-btn-group">
              <button className="btn-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={handleClearLogs}>Yes, Clear All Logs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

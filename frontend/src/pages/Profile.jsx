import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPlayerStats } from '../utils/statsService';
import './Profile.css';

export default function Profile() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const userId = user?.email || user?.id || 'default';

  // Load verified player stats from service & storage
  const pStats = getPlayerStats(userId);
  const best2048 = pStats.g2048BestScore || parseInt(localStorage.getItem('g2048_best') || '0', 10);
  const [editingName, setEditingName] = useState(false);
  const [customName, setCustomName] = useState(user?.name || 'Player');

  // Fallback demo user if visiting directly without logging in
  const currentUser = user || {
    id: 'guest_demo',
    name: 'Guest Player',
    email: 'guest@gamehub.local',
    picture: null,
    provider: 'guest',
    createdAt: '2026-01-01',
    gamesPlayed: pStats.gamesPlayed || 0,
    wins: pStats.wins || 0
  };

  // Dynamic calculations for XP and rank
  const gamesPlayed = pStats.gamesPlayed || currentUser.gamesPlayed || 0;
  const wins = pStats.wins || currentUser.wins || 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  
  const xp = gamesPlayed * 120 + wins * 250 + Math.floor(best2048 / 10) + (pStats.sudokuWins || 0) * 300 + (pStats.waterSortWins || 0) * 350 + (pStats.waterSortStars || 0) * 50;
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  const xpProgressPercent = Math.min(100, Math.round((currentLevelXp / 500) * 100));

  const getRank = (lvl) => {
    if (lvl >= 10) return { title: 'Grandmaster', badge: '💎 Diamond', color: '#38bdf8' };
    if (lvl >= 7) return { title: 'Master', badge: '🔮 Platinum', color: '#c084fc' };
    if (lvl >= 4) return { title: 'Veteran', badge: '🥇 Gold', color: '#fbbf24' };
    if (lvl >= 2) return { title: 'Challenger', badge: '🥈 Silver', color: '#94a3b8' };
    return { title: 'Rookie', badge: '🥉 Bronze', color: '#f97316' };
  };

  const rank = getRank(level);

  // Achievements list
  const achievements = [
    {
      id: 'first_win',
      title: 'First Blood',
      desc: 'Win your first game in any mode',
      icon: '🏆',
      unlocked: wins > 0,
      reward: '+100 XP'
    },
    {
      id: 'reach_2048',
      title: '2048 Visionary',
      desc: 'Reach the legendary 2048 tile',
      icon: '🧩',
      unlocked: best2048 >= 2048,
      reward: '+500 XP'
    },
    {
      id: 'ai_challenger',
      title: 'AI Nemesis',
      desc: 'Play against the Minimax AI engine',
      icon: '🤖',
      unlocked: gamesPlayed >= 3,
      reward: '+200 XP'
    },
    {
      id: 'speed_demon',
      title: 'High Scorer',
      desc: 'Score over 1,000 points in 2048',
      icon: '🔥',
      unlocked: best2048 >= 1000,
      reward: '+300 XP'
    },
    {
      id: 'veteran_player',
      title: 'Dedicated Gamer',
      desc: 'Complete 10 or more matches',
      icon: '⚡',
      unlocked: gamesPlayed >= 10,
      reward: '+400 XP'
    },
    {
      id: 'master_tactician',
      title: 'Grand Tactician',
      desc: 'Reach Player Level 5',
      icon: '👑',
      unlocked: level >= 5,
      reward: '+1000 XP'
    },
    {
      id: 'chess_virtuoso',
      title: 'Checkmate Virtuoso',
      desc: 'Deliver checkmate in Chess Arena',
      icon: '♟️',
      unlocked: (pStats.chessWins || 0) > 0,
      reward: '+600 XP'
    },
    {
      id: 'flow_master',
      title: 'Flow Master',
      desc: 'Connect all flows with 100% board coverage in Color Flow',
      icon: '⚡',
      unlocked: (pStats.flowWins || 0) > 0,
      reward: '+500 XP'
    },
    {
      id: 'sky_aviator',
      title: 'Cyber Aviator',
      desc: 'Score 10 or more in Floppy Bird arcade',
      icon: '🐥',
      unlocked: (pStats.flappyBest || 0) >= 10,
      reward: '+500 XP'
    },
    {
      id: 'sudoku_prodigy',
      title: 'Sudoku Prodigy',
      desc: 'Complete a full 9x9 Sudoku puzzle',
      icon: '🧠',
      unlocked: (pStats.sudokuWins || 0) > 0,
      reward: '+600 XP'
    },
    {
      id: 'fluid_alchemist',
      title: 'Fluid Alchemist',
      desc: 'Complete your first Water Sort level',
      icon: '🧪',
      unlocked: (pStats.waterSortWins || 0) > 0,
      reward: '+500 XP'
    },
    {
      id: 'grand_sorter',
      title: 'Grand Sorter',
      desc: 'Earn 15 or more stars in Water Sort Puzzle',
      icon: '⭐',
      unlocked: (pStats.waterSortStars || 0) >= 15,
      reward: '+800 XP'
    }
  ];

  const handleSaveName = (e) => {
    e.preventDefault();
    if (customName.trim()) {
      const updated = { ...currentUser, name: customName.trim() };
      localStorage.setItem('gamehub_user', JSON.stringify(updated));
      setEditingName(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="profile-page">
      {/* Background blobs */}
      <div className="profile-blob profile-blob-1" />
      <div className="profile-blob profile-blob-2" />
      <div className="profile-blob profile-blob-3" />

      {/* Top navigation */}
      <header className="profile-nav">
        <Link to="/" className="profile-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Games
        </Link>
        <span className="profile-nav-title">Player Profile</span>
        {isAuthenticated ? (
          <button className="profile-logout-top-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        ) : (
          <Link to="/login" className="profile-login-top-btn">
            Sign In with Google
          </Link>
        )}
      </header>

      <main className="profile-content">
        {/* ── User Hero Card ── */}
        <section className="profile-hero-card">
          <div className="hero-avatar-wrap">
            {currentUser.picture ? (
              <img src={currentUser.picture} alt={currentUser.name} className="hero-avatar-img" />
            ) : (
              <div className="hero-avatar-placeholder">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '🎮'}
              </div>
            )}
            <div className="hero-avatar-badge" style={{ borderColor: rank.color }}>
              Lvl {level}
            </div>
          </div>

          <div className="hero-details">
            <div className="hero-name-row">
              {editingName ? (
                <form onSubmit={handleSaveName} className="name-edit-form">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    maxLength={20}
                    autoFocus
                    className="name-edit-input"
                  />
                  <button type="submit" className="name-save-btn">Save</button>
                  <button type="button" className="name-cancel-btn" onClick={() => setEditingName(false)}>Cancel</button>
                </form>
              ) : (
                <>
                  <h1 className="hero-user-name">{currentUser.name}</h1>
                  <button
                    className="hero-edit-icon-btn"
                    onClick={() => setEditingName(true)}
                    title="Edit Name"
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>

            <div className="hero-tags">
              <span className="hero-tag provider-tag">
                {currentUser.provider === 'google' ? '🌐 Google Verified' : '👤 Guest Account'}
              </span>
              <span className="hero-tag rank-tag" style={{ color: rank.color, borderColor: rank.color + '40' }}>
                {rank.badge} · {rank.title}
              </span>
              <span className="hero-tag email-tag">
                {currentUser.email}
              </span>
            </div>

            {/* XP Bar */}
            <div className="xp-container">
              <div className="xp-header">
                <span className="xp-label">EXPERIENCE PROGRESS</span>
                <span className="xp-count">{currentLevelXp} / 500 XP (Total: {xp.toLocaleString()} XP)</span>
              </div>
              <div className="xp-bar-track">
                <div
                  className="xp-bar-fill"
                  style={{ width: `${xpProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Key Stats Grid ── */}
        <section className="profile-stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon">🎮</div>
            <div className="stat-card-val">{gamesPlayed}</div>
            <div className="stat-card-lbl">GAMES PLAYED</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🏆</div>
            <div className="stat-card-val">{wins}</div>
            <div className="stat-card-lbl">TOTAL VICTORIES</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🎯</div>
            <div className="stat-card-val">{winRate}%</div>
            <div className="stat-card-lbl">WIN RATE</div>
          </div>
          <div className="stat-card highlight-card">
            <div className="stat-card-icon">🧩</div>
            <div className="stat-card-val">{best2048.toLocaleString()}</div>
            <div className="stat-card-lbl">2048 BEST SCORE</div>
          </div>
        </section>

        {/* ── Game Specific Cards ── */}
        <div className="profile-games-section">
          <h2 className="section-heading">Game Performance</h2>
          <div className="game-perf-grid">
            {/* 2048 Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">🧩</span>
                  <div>
                    <h3 className="gperf-title">2048 Puzzle</h3>
                    <span className="gperf-sub">Tactical Merge Game</span>
                  </div>
                </div>
                <Link to="/2048" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">HIGH SCORE</span>
                  <span className="gstat-val stat-gold">{best2048.toLocaleString()}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">BEST TILE</span>
                  <span className="gstat-val stat-purple">{best2048 >= 2048 ? '2048' : best2048 >= 1024 ? '1024' : best2048 >= 512 ? '512' : '256'}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">AI ASSIST</span>
                  <span className="gstat-val stat-green">Available</span>
                </div>
              </div>
            </div>

            {/* Tic-Tac-Toe Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">⚔️</span>
                  <div>
                    <h3 className="gperf-title">Tic Tac Toe</h3>
                    <span className="gperf-sub">Minimax AI & 2-Player</span>
                  </div>
                </div>
                <Link to="/tictactoe" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">AI ENGINE</span>
                  <span className="gstat-val stat-blue">Minimax</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">MATCHES</span>
                  <span className="gstat-val">{pStats.tttGames || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">WINS</span>
                  <span className="gstat-val stat-green">{pStats.tttWins || 0}</span>
                </div>
              </div>
            </div>

            {/* Chess Arena Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">♟️</span>
                  <div>
                    <h3 className="gperf-title">Chess Arena</h3>
                    <span className="gperf-sub">Minimax AI & Clocks</span>
                  </div>
                </div>
                <Link to="/chess" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">MATCHES</span>
                  <span className="gstat-val">{pStats.chessGames || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">VICTORIES</span>
                  <span className="gstat-val stat-gold">{pStats.chessWins || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">AI HINTS</span>
                  <span className="gstat-val stat-green">Active</span>
                </div>
              </div>
            </div>

            {/* Color Flow Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">⚡</span>
                  <div>
                    <h3 className="gperf-title">Color Flow</h3>
                    <span className="gperf-sub">Pipes & Pathfinding</span>
                  </div>
                </div>
                <Link to="/flow" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">SOLVED</span>
                  <span className="gstat-val stat-green">{pStats.flowWins || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">PACKS</span>
                  <span className="gstat-val stat-blue">5 Packs</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">AI SOLVER</span>
                  <span className="gstat-val stat-gold">Enabled</span>
                </div>
              </div>
            </div>

            {/* Floppy Bird Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">🐥</span>
                  <div>
                    <h3 className="gperf-title">Floppy Bird</h3>
                    <span className="gperf-sub">Arcade Physics Rush</span>
                  </div>
                </div>
                <Link to="/flappy" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">HIGH SCORE</span>
                  <span className="gstat-val stat-gold">{pStats.flappyBest || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">ROUNDS</span>
                  <span className="gstat-val">{pStats.flappyGames || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">COINS BANK</span>
                  <span className="gstat-val stat-amber">🪙 {pStats.flappyCoins || 0}</span>
                </div>
              </div>
            </div>

            {/* Sudoku AI Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">🧠</span>
                  <div>
                    <h3 className="gperf-title">Sudoku AI</h3>
                    <span className="gperf-sub">Neural Matrix Puzzle</span>
                  </div>
                </div>
                <Link to="/sudoku" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">SOLVED</span>
                  <span className="gstat-val stat-green">{pStats.sudokuWins || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">MATCHES</span>
                  <span className="gstat-val">{pStats.sudokuGames || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">AI ENGINE</span>
                  <span className="gstat-val stat-gold">Smart Hints</span>
                </div>
              </div>
            </div>

            {/* Water Sort Card */}
            <div className="game-perf-card">
              <div className="gperf-header">
                <div className="gperf-title-wrap">
                  <span className="gperf-icon">🧪</span>
                  <div>
                    <h3 className="gperf-title">Water Sort</h3>
                    <span className="gperf-sub">Fluid Layer Alchemy</span>
                  </div>
                </div>
                <Link to="/watersort" className="gperf-play-btn">Play →</Link>
              </div>
              <div className="gperf-stats">
                <div className="gstat-item">
                  <span className="gstat-lbl">SOLVED</span>
                  <span className="gstat-val stat-green">{pStats.waterSortWins || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">STARS</span>
                  <span className="gstat-val stat-gold">⭐ {pStats.waterSortStars || 0}</span>
                </div>
                <div className="gstat-item">
                  <span className="gstat-lbl">AI SOLVER</span>
                  <span className="gstat-val stat-blue">BFS Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Achievements Section ── */}
        <div className="profile-achievements-section">
          <div className="achieve-header-row">
            <h2 className="section-heading">Achievements & Medals</h2>
            <span className="achieve-count">
              {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
            </span>
          </div>

          <div className="achievements-grid">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`}
              >
                <div className="achieve-icon-wrap">
                  <span className="achieve-icon">{ach.icon}</span>
                  {ach.unlocked && <span className="achieve-check">✓</span>}
                </div>
                <div className="achieve-info">
                  <div className="achieve-title-row">
                    <h4 className="achieve-title">{ach.title}</h4>
                    <span className="achieve-reward">{ach.reward}</span>
                  </div>
                  <p className="achieve-desc">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const games = [
  {
    id: 'tictactoe',
    title: 'Tic Tac Toe',
    desc: 'Classic game, endless fun!',
    path: '/tictactoe',
    badge: 'VS AI',
    icon: (
      <div className="game-icon ttt-icon">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Grid lines */}
          <line x1="40" y1="10" x2="40" y2="110" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="80" y1="10" x2="80" y2="110" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="10" y1="40" x2="110" y2="40" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="10" y1="80" x2="110" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
          {/* X at top-left */}
          <line x1="18" y1="18" x2="32" y2="32" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <line x1="32" y1="18" x2="18" y2="32" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          {/* O at top-center */}
          <circle cx="60" cy="25" r="9" stroke="#ec4899" strokeWidth="3"/>
          {/* X at top-right */}
          <line x1="88" y1="18" x2="102" y2="32" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <line x1="102" y1="18" x2="88" y2="32" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          {/* O at middle-left */}
          <circle cx="20" cy="60" r="9" stroke="#ec4899" strokeWidth="3"/>
          {/* X at center */}
          <line x1="51" y1="51" x2="69" y2="69" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round"/>
          <line x1="69" y1="51" x2="51" y2="69" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round"/>
          {/* O at middle-right */}
          <circle cx="100" cy="60" r="9" stroke="#ec4899" strokeWidth="3"/>
          {/* empty bottom-left */}
          {/* O at bottom-center */}
          <circle cx="60" cy="100" r="9" stroke="#ec4899" strokeWidth="3"/>
          {/* Winning diagonal glow */}
          <line x1="20" y1="25" x2="100" y2="100" stroke="rgba(124,58,237,0.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4"/>
        </svg>
      </div>
    ),
  },
  {
    id: '2048',
    title: '2048',
    desc: 'Slide, merge & reach the 2048 tile with AI hints!',
    path: '/2048',
    badge: 'PUZZLE · AI HINT',
    icon: (
      <div className="game-icon g2048-icon">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gold2048" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="purpleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          {/* Board base */}
          <rect x="10" y="10" width="100" height="100" rx="16" fill="#0d0f28" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
          
          {/* Row 0 */}
          <rect x="17" y="17" width="18" height="18" rx="4" fill="rgba(56,189,248,0.2)" stroke="rgba(56,189,248,0.5)" strokeWidth="1"/>
          <text x="26" y="30" fill="#38bdf8" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">2</text>
          
          <rect x="39" y="17" width="18" height="18" rx="4" fill="rgba(34,211,238,0.25)" stroke="rgba(34,211,238,0.6)" strokeWidth="1"/>
          <text x="48" y="30" fill="#22d3ee" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">4</text>
          
          <rect x="61" y="17" width="18" height="18" rx="4" fill="rgba(255,255,255,0.03)"/>
          
          <rect x="83" y="17" width="18" height="18" rx="4" fill="rgba(16,185,129,0.25)" stroke="rgba(16,185,129,0.6)" strokeWidth="1"/>
          <text x="92" y="30" fill="#34d399" fontSize="10" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">8</text>

          {/* Row 1 */}
          <rect x="17" y="39" width="18" height="18" rx="4" fill="rgba(245,158,11,0.25)" stroke="rgba(245,158,11,0.6)" strokeWidth="1"/>
          <text x="26" y="52" fill="#fbbf24" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">16</text>
          
          <rect x="39" y="39" width="18" height="18" rx="4" fill="rgba(249,115,22,0.3)" stroke="rgba(249,115,22,0.7)" strokeWidth="1"/>
          <text x="48" y="52" fill="#fb923c" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">32</text>
          
          <rect x="61" y="39" width="18" height="18" rx="4" fill="rgba(239,68,68,0.3)" stroke="rgba(239,68,68,0.7)" strokeWidth="1"/>
          <text x="70" y="52" fill="#f87171" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">64</text>
          
          <rect x="83" y="39" width="18" height="18" rx="4" fill="rgba(255,255,255,0.03)"/>

          {/* Row 2 */}
          <rect x="17" y="61" width="18" height="18" rx="4" fill="rgba(255,255,255,0.03)"/>
          
          <rect x="39" y="61" width="18" height="18" rx="4" fill="rgba(236,72,153,0.35)" stroke="rgba(236,72,153,0.8)" strokeWidth="1"/>
          <text x="48" y="73.5" fill="#f472b6" fontSize="7.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">128</text>
          
          <rect x="61" y="61" width="18" height="18" rx="4" fill="rgba(139,92,246,0.45)" stroke="rgba(139,92,246,0.85)" strokeWidth="1"/>
          <text x="70" y="73.5" fill="#c084fc" fontSize="7.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">512</text>
          
          <rect x="83" y="61" width="18" height="18" rx="4" fill="rgba(99,102,241,0.5)" stroke="rgba(99,102,241,0.85)" strokeWidth="1"/>
          <text x="92" y="73.5" fill="#a5b4fc" fontSize="6.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">1024</text>

          {/* Row 3 */}
          <rect x="17" y="83" width="18" height="18" rx="4" fill="rgba(217,70,239,0.35)" stroke="rgba(217,70,239,0.8)" strokeWidth="1"/>
          <text x="26" y="95.5" fill="#e879f9" fontSize="7.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">256</text>
          
          <rect x="39" y="83" width="18" height="18" rx="4" fill="rgba(255,255,255,0.03)"/>
          
          {/* Big Legendary 2048 Tile spanning 2 columns */}
          <rect x="61" y="83" width="40" height="18" rx="5" fill="url(#gold2048)" stroke="#fef08a" strokeWidth="1.2"/>
          <text x="81" y="96" fill="#422006" fontSize="9.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">2048</text>
        </svg>
      </div>
    ),
  },
  {
    id: 'chess',
    title: 'Chess Arena',
    desc: 'Battle the Minimax AI or challenge a friend in classic & timed chess!',
    path: '/chess',
    badge: 'MINIMAX AI · TIMED',
    icon: (
      <div className="game-icon chess-icon chess-wallpaper-icon">
        <img
          src="/chess-wallpaper.jpg"
          alt="Chess Arena"
          className="chess-card-wallpaper"
        />
        <div className="chess-card-wallpaper-overlay">
          <span className="chess-card-piece">♛</span>
          <span className="chess-card-piece-b">♚</span>
        </div>
      </div>
    ),
  },
  {
    id: 'flow',
    title: 'Color Flow',
    desc: 'Connect matching color pairs & fill 100% of the grid with glowing pipes!',
    path: '/flow',
    badge: 'PUZZLE · 50+ LEVELS',
    icon: (
      <div className="game-icon flow-icon flow-wallpaper-icon">
        <img
          src="/flow-wallpaper.jpg"
          alt="Color Flow"
          className="flow-card-wallpaper"
        />
        <div className="flow-card-wallpaper-overlay">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="flow-card-svg">
            <line x1="20" y1="0" x2="20" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="40" y1="0" x2="40" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="60" y1="0" x2="60" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="80" y1="0" x2="80" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="0" y1="40" x2="100" y2="40" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="0" y1="60" x2="100" y2="60" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <line x1="0" y1="80" x2="100" y2="80" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            {/* Red Flow */}
            <path d="M 30 50 L 30 90 L 50 90" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="30" cy="50" r="7" fill="#ef4444"/>
            <circle cx="50" cy="90" r="7" fill="#ef4444"/>
            {/* Green Flow */}
            <path d="M 90 10 L 90 90 L 70 90" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="90" cy="10" r="7" fill="#10b981"/>
            <circle cx="70" cy="90" r="7" fill="#10b981"/>
            {/* Yellow Flow */}
            <path d="M 10 30 L 10 10 L 70 10 L 70 50" stroke="#eab308" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="30" r="7" fill="#eab308"/>
            <circle cx="70" cy="50" r="7" fill="#eab308"/>
            {/* Orange Flow */}
            <path d="M 30 30 L 50 30 L 50 70 L 70 70" stroke="#f97316" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="30" cy="30" r="7" fill="#f97316"/>
            <circle cx="70" cy="70" r="7" fill="#f97316"/>
            {/* Blue Flow */}
            <path d="M 10 50 L 10 90" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="50" r="7" fill="#3b82f6"/>
            <circle cx="10" cy="90" r="7" fill="#3b82f6"/>
          </svg>
        </div>
      </div>
    ),
  },
  {
    id: 'flappy',
    title: 'Floppy Bird',
    desc: 'Flap through glowing cyber pipes, collect golden coins & set new high scores!',
    path: '/flappy',
    badge: 'ARCADE · AI AUTOPILOT',
    icon: (
      <div className="game-icon flappy-icon flappy-wallpaper-icon">
        <img
          src="/flappy-wallpaper.jpg"
          alt="Floppy Bird"
          className="flappy-card-wallpaper"
        />
        <div className="flappy-card-wallpaper-overlay">
          <span className="flappy-card-bird">🐥</span>
          <span className="flappy-card-coin">🪙</span>
        </div>
      </div>
    ),
  },
];

const COMING_SOON = [
  { name: 'Connect Four', desc: 'LLM-powered AI — coming soon!' },
  { name: 'Minesweeper', desc: 'LLM-powered AI — coming soon!' },
  { name: 'Sudoku', desc: 'Number puzzle engine — coming soon!' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(null); // game title being loaded
  const navigate = useNavigate();

  const q = query.toLowerCase().trim();
  const filteredGames = games.filter(g => g.title.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  const filteredSoon  = COMING_SOON.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  const noResults = q && filteredGames.length === 0 && filteredSoon.length === 0;

  const handlePlay = (game) => {
    setLoading(game.title);
    setTimeout(() => navigate(game.path), 1400);
  };
  return (
    <div className="dashboard">
      {/* Background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="dots" />

      {/* Header */}
      <header className="dash-header">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#lg1)"/>
            <path d="M8 20c0-2 1-3 2.5-3s2.5 1 2.5 3v6h2v-6c0-4-2-6-4.5-6S6 16 6 20v6h2v-6z" fill="white"/>
            <path d="M22 14h-4v12h4c3.3 0 6-2.7 6-6s-2.7-6-6-6zm0 10h-2v-8h2c2.2 0 4 1.8 4 4s-1.8 4-4 4z" fill="white"/>
            <circle cx="32" cy="16" r="2" fill="#ec4899"/>
            <defs>
              <linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40">
                <stop offset="0%" stopColor="#7c3aed"/>
                <stop offset="100%" stopColor="#4f46e5"/>
              </linearGradient>
            </defs>
          </svg>
          <div>
            <span className="logo-name"><span>Game</span>Hub</span>
            <span className="logo-sub">Your Games, Your Space</span>
          </div>
        </div>

        {/* User Auth Info / Login CTA */}
        <div className="dash-auth-nav">
          {user ? (
            <div className="user-profile-badge">
              <Link to="/profile" className="user-profile-link" title="View Profile">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user.name ? user.name.charAt(0).toUpperCase() : '👤'}
                  </div>
                )}
                <div className="user-info-text">
                  <span className="user-display-name">{user.name}</span>
                  <span className="user-badge-tag">{user.provider === 'google' ? 'Google Account' : 'Guest'}</span>
                </div>
              </Link>
              <button className="user-logout-btn" onClick={logout} title="Sign Out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="dash-guest-nav-group">
              <Link to="/profile" className="btn-dash-profile-guest" title="View Profile">
                👤 Profile
              </Link>
              <Link to="/login" className="btn-dash-login">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
                <span>Sign In / Login</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Games Grid */}
      <section className="games-section">
        {/* Search Bar */}
        <div className="search-wrap">
          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35" strokeLinecap="round"/>
            </svg>
            <input
              id="game-search"
              className="search-input"
              type="text"
              placeholder="Search games…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="section-label">
          <span className="label-dot" />
          {q ? `Results for "${query}"` : 'Available Games'}
        </div>
        <div className="games-grid">
          {filteredGames.map((game) => (
            <div key={game.id} className="game-card">
              <div className="card-badge">{game.badge}</div>
              <div className="card-preview">{game.icon}</div>
              <div className="card-body">
                <h2 className="card-title">{game.title}</h2>
                <p className="card-desc">{game.desc}</p>
                <button
                  className="btn-play"
                  id={`play-${game.id}`}
                  onClick={() => handlePlay(game)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play Now
                </button>
              </div>
            </div>
          ))}

          {/* Coming soon cards */}
          {filteredSoon.map((g) => (
            <div key={g.name} className="game-card coming-soon">
              <div className="card-badge soon">Coming Soon</div>
              <div className="card-preview soon-preview">
                <span className="soon-icon">🔒</span>
              </div>
              <div className="card-body">
                <h2 className="card-title">{g.name}</h2>
                <p className="card-desc">{g.desc}</p>
                <button className="btn-play disabled" disabled>Locked</button>
              </div>
            </div>
          ))}

          {/* No results */}
          {noResults && (
            <div className="no-results">
              <span className="no-results-icon">🔍</span>
              <p>No games found for <strong>"{query}"</strong></p>
              <button className="no-results-clear" onClick={() => setQuery('')}>Clear search</button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="dash-footer">
        <p>© 2026 GameHub · Powered by AI decisions</p>
      </footer>

      {/* Loading Overlay */}
      {loading && (
        <div className="game-loading-overlay">
          <div className="game-loading-card">
            <div className="gl-spinner">
              <div className="gl-ring" />
              <div className="gl-ring gl-ring-2" />
              <div className="gl-dot" />
            </div>
            <div className="gl-title">Loading</div>
            <div className="gl-game-name">{loading}</div>
            <div className="gl-bar"><div className="gl-bar-fill" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

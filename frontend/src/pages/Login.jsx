import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const GAMER_TAG_PREFIXES = ['Neon', 'Cyber', 'Pixel', 'Shadow', 'Apex', 'Hyper', 'Nova', 'Vortex'];
const GAMER_TAG_SUFFIXES = ['Knight', 'Falcon', 'Runner', 'Striker', 'Titan', 'Viper', 'Ghost', 'Blaze'];

function generateGamerTag() {
  const p = GAMER_TAG_PREFIXES[Math.floor(Math.random() * GAMER_TAG_PREFIXES.length)];
  const s = GAMER_TAG_SUFFIXES[Math.floor(Math.random() * GAMER_TAG_SUFFIXES.length)];
  const n = Math.floor(10 + Math.random() * 90);
  return `${p}${s}_${n}`;
}

export default function Login() {
  const { user, loginWithGoogle, loginAsGuest, googleClientId, loading, error } = useAuth();
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'guest'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [guestTag, setGuestTag] = useState(() => generateGamerTag());
  const [selectedAvatar, setSelectedAvatar] = useState('🎮');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const googleBtnRef = useRef(null);
  const navigate = useNavigate();

  const AVATARS = ['🎮', '⚡', '👾', '🦊', '🚀', '🔮'];

  // Redirect if logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Initialize Google Identity Services with polling for async script load
  useEffect(() => {
    if (authMode === 'guest') return;

    let attempts = 0;
    const maxAttempts = 25; // 5 seconds of polling

    const renderGoogleBtn = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response) => {
              loginWithGoogle(response);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          googleBtnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'rectangular',
            width: 360,
            text: 'continue_with',
            logo_alignment: 'center',
          });
          return true;
        } catch (err) {
          console.warn('Google button render note:', err);
        }
      }
      return false;
    };

    if (!renderGoogleBtn()) {
      const interval = setInterval(() => {
        attempts++;
        if (renderGoogleBtn() || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [googleClientId, loginWithGoogle, authMode]);

  const handleCustomGooglePrompt = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            loginWithGoogle(response);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('Google prompt note:', err);
      }
    }
  };

  const handleEmailAuth = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!email || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }

    // Direct login via auth context
    const username = name.trim() || email.split('@')[0];
    loginAsGuest(username);
  };

  const handleGuestPlay = (e) => {
    e.preventDefault();
    const guestUser = guestTag.trim() || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
    loginAsGuest(`${selectedAvatar} ${guestUser}`);
  };

  const tabIndexMap = {
    signin: 0,
    signup: 1,
    guest: 2,
  };

  const activeIndex = tabIndexMap[authMode] ?? 0;

  return (
    <div className="auth-viewport">
      {/* Background Atmosphere */}
      <div className="auth-ambient-mesh" />
      <div className="auth-spotlight" />

      {/* Navigation Header */}
      <header className="auth-nav-header">
        <Link to="/" className="auth-nav-brand">
          <div className="auth-brand-logo-mark">
            <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
              <defs>
                <linearGradient id="brandLogoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              <path
                d="M9 10C5.5 10 3 13 3 17.5C3 21 5.5 24 8 24C9.5 24 10.8 23 12 21.5L14.5 18.5H17.5L20 21.5C21.2 23 22.5 24 24 24C26.5 24 29 21 29 17.5C29 13 26.5 10 23 10H9Z"
                fill="url(#brandLogoGrad)"
                fillOpacity="0.25"
                stroke="url(#brandLogoGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M8 14V18M6 16H10" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="23" cy="14.5" r="1.2" fill="#38bdf8" />
              <circle cx="25.5" cy="17" r="1.2" fill="#ec4899" />
              <circle cx="20.5" cy="17" r="1.2" fill="#facc15" />
              <circle cx="23" cy="19.5" r="1.2" fill="#4ade80" />
            </svg>
          </div>
          <span className="auth-brand-title">Game<span className="brand-highlight">Hub</span></span>
        </Link>

        {user ? (
          <Link to="/" className="auth-nav-return-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Return to Dashboard
          </Link>
        ) : (
          <span className="auth-nav-badge">
            🔒 Authentication Required
          </span>
        )}
      </header>

      {/* Main Form Container */}
      <main className="auth-main-content">
        <div className="auth-card-panel">
          {/* Header Segment with consistent height */}
          <div className="auth-panel-heading">
            <h1 className="auth-title">
              {authMode === 'signin' && 'Sign in to your account'}
              {authMode === 'signup' && 'Create your account'}
              {authMode === 'guest' && 'Instant Guest Play'}
            </h1>
            <p className="auth-subtitle">
              {authMode === 'signin' && 'Welcome back! Enter your details to access your games.'}
              {authMode === 'signup' && 'Start tracking your achievements and global rankings today.'}
              {authMode === 'guest' && 'Jump straight into the games without creating an account.'}
            </p>
          </div>

          {/* Mode Switcher Tabs with Sliding Pill */}
          <div className="auth-segmented-switch">
            <div
              className="auth-segment-pill-bg"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            />
            <button
              type="button"
              className={`auth-segment-btn ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => { setAuthMode('signin'); setFormError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-segment-btn ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => { setAuthMode('signup'); setFormError(''); }}
            >
              Sign Up
            </button>
            <button
              type="button"
              className={`auth-segment-btn ${authMode === 'guest' ? 'active' : ''}`}
              onClick={() => { setAuthMode('guest'); setFormError(''); }}
            >
              Guest Play
            </button>
          </div>

          {/* Error Notification */}
          {(error || formError) && (
            <div className="auth-alert auth-alert-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error || formError}</span>
            </div>
          )}

          {/* Success Notification */}
          {formSuccess && (
            <div className="auth-alert auth-alert-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Stable Viewport Container */}
          <div className="auth-tabs-viewport">
            {/* ── TAB 1: SIGN IN ── */}
            {authMode === 'signin' && (
              <div className="auth-tab-view" key="view-signin">
                <div className="auth-oauth-container">
                  <div ref={googleBtnRef} className="google-official-wrapper" />
                  <button
                    type="button"
                    className="auth-google-full-btn"
                    onClick={handleCustomGooglePrompt}
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" className="google-icon-svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </div>

                <div className="auth-separator">
                  <span className="separator-line" />
                  <span className="separator-text">or continue with email</span>
                  <span className="separator-line" />
                </div>

                <form className="auth-credential-form" onSubmit={handleEmailAuth} autoComplete="off">
                  <div className="form-field-group">
                    <label className="form-label" htmlFor="signin-email">Email Address</label>
                    <div className="form-input-shell">
                      <input
                        id="signin-email"
                        name="gamehub_login_email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-control"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck="false"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field-group">
                    <div className="label-with-link">
                      <label className="form-label" htmlFor="signin-password">Password</label>
                      <button
                        type="button"
                        className="form-sub-link"
                        onClick={() => setFormSuccess('Password reset link sent to email (Demo)')}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="form-input-shell password-shell">
                      <input
                        id="signin-password"
                        name="gamehub_login_password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-control"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-reveal-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-options-row">
                    <label className="checkbox-container">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="checkbox-mark" />
                      <span className="checkbox-text">Remember for 30 days</span>
                    </label>
                  </div>

                  <button type="submit" className="form-submit-btn" disabled={loading}>
                    {loading ? (
                      <div className="btn-loading-state">
                        <div className="btn-spinner" />
                        <span>Authenticating...</span>
                      </div>
                    ) : (
                      <span>Sign in to GameHub</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ── TAB 2: SIGN UP ── */}
            {authMode === 'signup' && (
              <div className="auth-tab-view" key="view-signup">
                <div className="auth-oauth-container">
                  <div ref={googleBtnRef} className="google-official-wrapper" />
                  <button
                    type="button"
                    className="auth-google-full-btn"
                    onClick={handleCustomGooglePrompt}
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" className="google-icon-svg">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign up with Google</span>
                  </button>
                </div>

                <div className="auth-separator">
                  <span className="separator-line" />
                  <span className="separator-text">or sign up with email</span>
                  <span className="separator-line" />
                </div>

                <form className="auth-credential-form" onSubmit={handleEmailAuth} autoComplete="off">
                  <div className="form-field-group">
                    <label className="form-label" htmlFor="signup-name">Full Name</label>
                    <div className="form-input-shell">
                      <input
                        id="signup-name"
                        name="gamehub_signup_name"
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="form-control"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label className="form-label" htmlFor="signup-email">Email Address</label>
                    <div className="form-input-shell">
                      <input
                        id="signup-email"
                        name="gamehub_signup_email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-control"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck="false"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field-group">
                    <label className="form-label" htmlFor="signup-password">Password</label>
                    <div className="form-input-shell password-shell">
                      <input
                        id="signup-password"
                        name="gamehub_signup_password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-control"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-reveal-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                            <path d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="form-submit-btn" disabled={loading}>
                    {loading ? (
                      <div className="btn-loading-state">
                        <div className="btn-spinner" />
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      <span>Create GameHub Account</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ── TAB 3: GUEST PLAY (BALANCED HEIGHT) ── */}
            {authMode === 'guest' && (
              <div className="auth-tab-view" key="view-guest">
                <div className="guest-info-banner">
                  <span className="guest-badge-icon">⚡</span>
                  <div className="guest-badge-text">
                    <strong>Instant Play Mode</strong>
                    <span>No registration required. Progress saved in browser.</span>
                  </div>
                </div>

                <form className="auth-credential-form" onSubmit={handleGuestPlay} autoComplete="off">
                  <div className="avatar-pick-block">
                    <label className="form-label">Choose Avatar</label>
                    <div className="avatar-capsule-row">
                      {AVATARS.map((av) => (
                        <button
                          type="button"
                          key={av}
                          className={`avatar-pill-btn ${selectedAvatar === av ? 'selected' : ''}`}
                          onClick={() => setSelectedAvatar(av)}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-field-group">
                    <div className="label-with-link">
                      <label className="form-label" htmlFor="guest-tag-field">Player Nickname</label>
                      <button
                        type="button"
                        className="form-sub-link"
                        onClick={() => setGuestTag(generateGamerTag())}
                      >
                        🎲 Randomize
                      </button>
                    </div>
                    <div className="form-input-shell guest-input-shell">
                      <span className="guest-avatar-prefix">{selectedAvatar}</span>
                      <input
                        id="guest-tag-field"
                        name="gamehub_guest_nickname"
                        type="text"
                        placeholder="e.g. NeonKnight_42"
                        value={guestTag}
                        onChange={(e) => setGuestTag(e.target.value)}
                        maxLength={18}
                        className="form-control"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="guest-feature-checks">
                    <div className="guest-check-item">
                      <span className="check-bullet">✓</span>
                      <span>Instant 1-click launch into 2048 & Tic-Tac-Toe</span>
                    </div>
                    <div className="guest-check-item">
                      <span className="check-bullet">✓</span>
                      <span>Can link Google account later in profile anytime</span>
                    </div>
                  </div>

                  <button type="submit" className="form-submit-btn guest-btn" disabled={loading}>
                    <span>Launch Arena as Guest 🚀</span>
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Footer Security / Terms */}
          <footer className="auth-panel-footer">
            <p className="auth-policy-text">
              By continuing, you agree to GameHub's{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a> and{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '744551691173-9hef8f2pe0kkulqte9m2k9g3migj89aj.apps.googleusercontent.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gamehub_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('gamehub_token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Warm-up backend ping on app startup (prevents Render cold start delays)
  useEffect(() => {
    try {
      fetch(`${API_URL}/api/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
    } catch {
      // Ignore initial warm-up errors
    }
  }, []);

  // Parse JWT payload safely
  function parseJwt(t) {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  // Handle Google Login Credential Response with Instant Optimistic Authentication
  const loginWithGoogle = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = credentialResponse?.credential;
      if (!idToken) {
        throw new Error('No Google credentials received');
      }

      const decoded = parseJwt(idToken);
      if (!decoded) {
        throw new Error('Unable to parse Google token');
      }

      // Step 1: INSTANT LOGIN (Zero waiting / No spinner delay)
      const instantUser = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || decoded.given_name || 'Player',
        picture: decoded.picture || null,
        provider: 'google',
        gamesPlayed: 0,
        wins: 0
      };

      setUser(instantUser);
      setToken(idToken);
      localStorage.setItem('gamehub_user', JSON.stringify(instantUser));
      localStorage.setItem('gamehub_token', idToken);
      setLoading(false);

      // Step 2: Background sync with backend (with short 3.5s timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: idToken, userInfo: instantUser }),
        signal: controller.signal
      })
        .then(async (res) => {
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              setUser(data.user);
              localStorage.setItem('gamehub_user', JSON.stringify(data.user));
            }
            if (data?.token) {
              setToken(data.token);
              localStorage.setItem('gamehub_token', data.token);
            }
          }
        })
        .catch((backendErr) => {
          clearTimeout(timeoutId);
          console.warn('Backend sync note (using fast local auth session):', backendErr.message);
        });

    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  // Fast Guest Login
  const loginAsGuest = async (name) => {
    setLoading(true);
    setError(null);

    const guestName = name?.trim() || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
    const localUser = {
      id: `guest_${Date.now()}`,
      name: guestName,
      email: `guest_${Date.now()}@gamehub.local`,
      picture: null,
      provider: 'guest',
      gamesPlayed: 0,
      wins: 0
    };

    // Instant local activation
    setUser(localUser);
    setToken('guest_token');
    localStorage.setItem('gamehub_user', JSON.stringify(localUser));
    localStorage.setItem('gamehub_token', 'guest_token');
    setLoading(false);

    // Background backend registration with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      fetch(`${API_URL}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName }),
        signal: controller.signal
      })
        .then(async (res) => {
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              setUser(data.user);
              localStorage.setItem('gamehub_user', JSON.stringify(data.user));
            }
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
        });
    } catch {
      // Ignored
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('gamehub_user');
    localStorage.removeItem('gamehub_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        googleClientId: GOOGLE_CLIENT_ID,
        loginWithGoogle,
        loginAsGuest,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

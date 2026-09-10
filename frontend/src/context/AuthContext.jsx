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

  // Parse JWT helper
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

  // Handle Google Login Credential Response
  const loginWithGoogle = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = credentialResponse.credential;
      const decoded = parseJwt(idToken);

      const userInfo = decoded ? {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture
      } : null;

      // Send to backend for server-side verification and session token
      let backendSuccess = false;
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken, userInfo })
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('gamehub_user', JSON.stringify(data.user));
          localStorage.setItem('gamehub_token', data.token);
          backendSuccess = true;
        }
      } catch (backendErr) {
        console.warn('Backend verification fallback:', backendErr.message);
      }

      // If backend was unreachable but Google gave valid JWT
      if (!backendSuccess && userInfo) {
        const localUser = {
          ...userInfo,
          provider: 'google',
          gamesPlayed: 0,
          wins: 0
        };
        setUser(localUser);
        setToken(idToken);
        localStorage.setItem('gamehub_user', JSON.stringify(localUser));
        localStorage.setItem('gamehub_token', idToken);
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  // Guest Login
  const loginAsGuest = async (name) => {
    setLoading(true);
    setError(null);
    try {
      try {
        const res = await fetch(`${API_URL}/api/auth/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('gamehub_user', JSON.stringify(data.user));
          localStorage.setItem('gamehub_token', data.token);
          return;
        }
      } catch (backendErr) {
        console.warn('Backend guest login fallback:', backendErr.message);
      }

      // Local fallback
      const guestName = name?.trim() || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
      const localUser = {
        id: `guest_${Date.now()}`,
        name: guestName,
        email: `guest@gamehub.local`,
        picture: null,
        provider: 'guest',
        gamesPlayed: 0,
        wins: 0
      };
      setUser(localUser);
      setToken('guest_token');
      localStorage.setItem('gamehub_user', JSON.stringify(localUser));
      localStorage.setItem('gamehub_token', 'guest_token');
    } catch (err) {
      setError(err.message || 'Guest login failed');
    } finally {
      setLoading(false);
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

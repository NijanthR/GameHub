import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import TicTacToe from './pages/TicTacToe';
import Game2048 from './pages/Game2048';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Chess from './pages/Chess';
import FlowPuzzle from './pages/FlowPuzzle';
import FlappyBird from './pages/FlappyBird';
import Sudoku from './pages/Sudoku';
import WaterSort from './pages/WaterSort';
import DinoRunner3D from './pages/DinoRunner3D';
import AdminPortal from './pages/AdminPortal';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Admin Telemetry & Activity Monitoring Portal */}
          <Route path="/admin" element={<AdminPortal />} />

          {/* Protected Routes (Requires Login / Auth to access) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dino"
            element={
              <ProtectedRoute>
                <DinoRunner3D />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tictactoe"
            element={
              <ProtectedRoute>
                <TicTacToe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/2048"
            element={
              <ProtectedRoute>
                <Game2048 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chess"
            element={
              <ProtectedRoute>
                <Chess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flow"
            element={
              <ProtectedRoute>
                <FlowPuzzle />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flappy"
            element={
              <ProtectedRoute>
                <FlappyBird />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sudoku"
            element={
              <ProtectedRoute>
                <Sudoku />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watersort"
            element={
              <ProtectedRoute>
                <WaterSort />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

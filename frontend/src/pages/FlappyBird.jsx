import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  playFlapSound,
  playScoreSound,
  playCoinSound,
  playHitSound,
  playDieSound,
  playHighScoreFanfare
} from '../utils/soundEffects';
import { recordFlappyOutcome } from '../utils/statsService';
import './FlappyBird.css';

const BIRD_SKINS = [
  { id: 'goldy', name: 'Golden Finch', color: '#facc15', secondary: '#f59e0b', eye: '#1e1b4b', icon: '🐥' },
  { id: 'cyber', name: 'Cyber Neon', color: '#06b6d4', secondary: '#3b82f6', eye: '#ec4899', icon: '🤖' },
  { id: 'phoenix', name: 'Phoenix Fire', color: '#ef4444', secondary: '#f97316', eye: '#fde047', icon: '🔥' },
  { id: 'alien', name: 'Cosmic Alien', color: '#10b981', secondary: '#84cc16', eye: '#a855f7', icon: '🛸' },
  { id: 'violet', name: 'Synthwave', color: '#c084fc', secondary: '#a855f7', eye: '#38bdf8', icon: '💜' }
];

const GAME_MODES = [
  { id: 'classic', title: 'Classic Arcade', desc: 'Original physics & pipe gaps', speed: 2.3, gap: 145, icon: '🕹️' },
  { id: 'rush', title: 'Speed Rush', desc: '1.4x Faster speed & tight gaps', speed: 3.2, gap: 130, icon: '⚡' },
  { id: 'coins', title: 'Coin Collector', desc: 'Collect floating golden coins & shields', speed: 2.3, gap: 155, hasCoins: true, icon: '🪙' }
];

export default function FlappyBird() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';

  // Game configuration
  const [gameMode, setGameMode] = useState('classic');
  const [selectedSkin, setSelectedSkin] = useState(BIRD_SKINS[0]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aiAutopilot, setAiAutopilot] = useState(false);

  // High score tracking
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('gamehub_flappy_best') || '0', 10);
  });
  const [totalCoins, setTotalCoins] = useState(() => {
    return parseInt(localStorage.getItem('gamehub_flappy_coins') || '0', 10);
  });

  // Game state
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'playing' | 'gameover' | 'paused'
  const [score, setScore] = useState(0);
  const [roundCoins, setRoundCoins] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [isNewHigh, setIsNewHigh] = useState(false);

  // Canvas ref
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Engine Physics mutable state (stored in ref for zero-latency 60FPS loop)
  const engineRef = useRef({
    bird: {
      x: 100,
      y: 250,
      radius: 16,
      velocity: 0,
      gravity: 0.38,
      jump: -7.2,
      rotation: 0,
      wingAngle: 0,
      wingDir: 1
    },
    pipes: [],
    coins: [],
    particles: [],
    frameCount: 0,
    backgroundOffset: 0,
    cityOffset: 0,
    groundOffset: 0,
    lastPipeFrame: 0,
    pipeInterval: 110,
    modeSpeed: 2.3,
    modeGap: 145,
    hasCoins: false,
    scoreVal: 0,
    coinsVal: 0,
    shieldVal: false,
    aiEnabled: false
  });

  // Sync state into engineRef
  useEffect(() => {
    const curMode = GAME_MODES.find((m) => m.id === gameMode) || GAME_MODES[0];
    engineRef.current.modeSpeed = curMode.speed;
    engineRef.current.modeGap = curMode.gap;
    engineRef.current.hasCoins = !!curMode.hasCoins;
    engineRef.current.aiEnabled = aiAutopilot;
  }, [gameMode, aiAutopilot]);

  // ── Flap / Jump Action ──
  const triggerFlap = useCallback(() => {
    const eng = engineRef.current;
    if (gameState === 'idle') {
      // Start Game
      eng.bird.y = 250;
      eng.bird.velocity = eng.bird.jump;
      eng.pipes = [];
      eng.coins = [];
      eng.particles = [];
      eng.scoreVal = 0;
      eng.coinsVal = 0;
      eng.shieldVal = false;
      eng.lastPipeFrame = 0;
      setScore(0);
      setRoundCoins(0);
      setHasShield(false);
      setIsNewHigh(false);
      setGameState('playing');
      if (soundEnabled) playFlapSound();
      return;
    }

    if (gameState === 'playing') {
      eng.bird.velocity = eng.bird.jump;
      if (soundEnabled) playFlapSound();

      // Spawn puff particles
      for (let i = 0; i < 6; i++) {
        eng.particles.push({
          x: eng.bird.x - 12,
          y: eng.bird.y + Math.random() * 8 - 4,
          vx: -Math.random() * 2 - 1,
          vy: Math.random() * 2 - 1,
          size: Math.random() * 4 + 2,
          color: 'rgba(255, 255, 255, 0.7)',
          life: 18
        });
      }
    }
  }, [gameState, soundEnabled]);

  // ── Keyboard Controls ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        triggerFlap();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'playing') setGameState('paused');
        else if (gameState === 'paused') setGameState('playing');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerFlap, gameState]);

  // ── Trigger Game Over ──
  const handleGameOver = useCallback((finalScore, finalCoins) => {
    setGameState('gameover');
    if (soundEnabled) {
      playHitSound();
      setTimeout(() => playDieSound(), 120);
    }

    let isNewBest = false;
    const currentBest = parseInt(localStorage.getItem('gamehub_flappy_best') || '0', 10);
    if (finalScore > currentBest) {
      isNewBest = true;
      setIsNewHigh(true);
      setHighScore(finalScore);
      localStorage.setItem('gamehub_flappy_best', String(finalScore));
      if (soundEnabled) setTimeout(() => playHighScoreFanfare(), 300);
    }

    const updatedCoins = totalCoins + finalCoins;
    setTotalCoins(updatedCoins);
    localStorage.setItem('gamehub_flappy_coins', String(updatedCoins));

    // Record stats
    recordFlappyOutcome(userId, {
      score: finalScore,
      bestScore: Math.max(currentBest, finalScore),
      coins: finalCoins,
      mode: gameMode.toUpperCase()
    });
  }, [soundEnabled, totalCoins, userId, gameMode]);

  // ── Main Canvas Render & Physics Loop (60FPS) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isRunning = true;

    const W = canvas.width;
    const H = canvas.height;
    const groundY = H - 75;

    const renderLoop = () => {
      if (!isRunning) return;

      const eng = engineRef.current;
      eng.frameCount++;

      // ── 1. Clear & Background Gradient ──
      const bgGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      bgGrad.addColorStop(0, '#060a17');
      bgGrad.addColorStop(0.5, '#0d152b');
      bgGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Distant Stars & Cyber Moons
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 47 + eng.frameCount * 0.05) % W;
        const sy = (i * 29) % (groundY - 120);
        ctx.fillRect(sx, sy, (i % 3 === 0 ? 2 : 1), (i % 3 === 0 ? 2 : 1));
      }

      // Glowing Cyber Moon
      ctx.save();
      ctx.shadowBlur = 35;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.45)';
      const moonGrad = ctx.createRadialGradient(W - 90, 80, 5, W - 90, 80, 42);
      moonGrad.addColorStop(0, '#cffafe');
      moonGrad.addColorStop(0.7, '#22d3ee');
      moonGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = moonGrad;
      ctx.beginPath();
      ctx.arc(W - 90, 80, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 2. Parallax Cyberpunk City Skyline ──
      eng.cityOffset = (eng.cityOffset + (gameState === 'playing' ? eng.modeSpeed * 0.35 : 0.4)) % 120;
      ctx.fillStyle = '#0a1024';
      for (let x = -eng.cityOffset - 120; x < W + 120; x += 38) {
        const bHeight = 70 + Math.sin(x * 13) * 45 + 30;
        ctx.fillRect(x, groundY - bHeight, 34, bHeight);
        // Neon windows
        ctx.fillStyle = (x % 3 === 0) ? 'rgba(6, 182, 212, 0.25)' : 'rgba(236, 72, 153, 0.22)';
        for (let wy = groundY - bHeight + 10; wy < groundY - 10; wy += 14) {
          ctx.fillRect(x + 6, wy, 8, 6);
          ctx.fillRect(x + 18, wy, 8, 6);
        }
        ctx.fillStyle = '#0a1024';
      }

      // ── 3. AI Autopilot Controller ──
      if (eng.aiEnabled && gameState === 'playing') {
        const nextPipe = eng.pipes.find((p) => p.x + p.width > eng.bird.x);
        if (nextPipe) {
          const targetY = nextPipe.topHeight + nextPipe.gap / 2;
          // Jump when falling below target
          if (eng.bird.y > targetY + 10 && eng.bird.velocity > 0.8) {
            eng.bird.velocity = eng.bird.jump;
            if (soundEnabled) playFlapSound();
          }
        } else if (eng.bird.y > groundY / 2 && eng.bird.velocity > 1.2) {
          eng.bird.velocity = eng.bird.jump;
        }
      }

      // ── 4. Physics & Pipe Spawning ──
      if (gameState === 'playing') {
        // Bird gravity
        eng.bird.velocity += eng.bird.gravity;
        eng.bird.y += eng.bird.velocity;

        // Wing flap oscillation
        eng.bird.wingAngle += 0.25 * eng.bird.wingDir;
        if (eng.bird.wingAngle > 0.8 || eng.bird.wingAngle < -0.8) {
          eng.bird.wingDir *= -1;
        }

        // Tilt angle
        if (eng.bird.velocity < 0) {
          eng.bird.rotation = Math.max(-0.45, eng.bird.velocity * 0.08);
        } else {
          eng.bird.rotation = Math.min(1.2, (eng.bird.velocity - 2) * 0.12);
        }

        // Ceiling collision
        if (eng.bird.y - eng.bird.radius < 0) {
          eng.bird.y = eng.bird.radius;
          eng.bird.velocity = 0;
        }

        // Ground collision
        if (eng.bird.y + eng.bird.radius >= groundY) {
          eng.bird.y = groundY - eng.bird.radius;
          handleGameOver(eng.scoreVal, eng.coinsVal);
        }

        // Spawn Pipes
        if (eng.frameCount - eng.lastPipeFrame >= eng.pipeInterval) {
          eng.lastPipeFrame = eng.frameCount;
          const minTop = 60;
          const maxTop = groundY - eng.modeGap - 70;
          const topHeight = Math.floor(Math.random() * (maxTop - minTop)) + minTop;

          const pipeObj = {
            x: W + 10,
            width: 58,
            topHeight,
            gap: eng.modeGap,
            passed: false
          };
          eng.pipes.push(pipeObj);

          // Optional floating coin in the gap
          if (eng.hasCoins && Math.random() < 0.7) {
            eng.coins.push({
              x: W + 10 + 29,
              y: topHeight + eng.modeGap / 2,
              radius: 11,
              collected: false,
              bobOffset: Math.random() * Math.PI
            });
          }
        }

        // Update Pipes & Collisions
        eng.pipes.forEach((p) => {
          p.x -= eng.modeSpeed;

          // Check score pass
          if (!p.passed && p.x + p.width < eng.bird.x) {
            p.passed = true;
            eng.scoreVal += 1;
            setScore(eng.scoreVal);
            if (soundEnabled) playScoreSound();
          }

          // Pipe Hitbox Check
          const birdLeft = eng.bird.x - eng.bird.radius + 4;
          const birdRight = eng.bird.x + eng.bird.radius - 4;
          const birdTop = eng.bird.y - eng.bird.radius + 4;
          const birdBottom = eng.bird.y + eng.bird.radius - 4;

          const inXRange = birdRight > p.x && birdLeft < p.x + p.width;
          const hitTopPipe = inXRange && birdTop < p.topHeight;
          const hitBottomPipe = inXRange && birdBottom > p.topHeight + p.gap;

          if (hitTopPipe || hitBottomPipe) {
            if (eng.shieldVal) {
              // Break shield instead of die
              eng.shieldVal = false;
              setHasShield(false);
              p.x = -100; // remove hit pipe
              if (soundEnabled) playHitSound();
            } else {
              handleGameOver(eng.scoreVal, eng.coinsVal);
            }
          }
        });

        // Filter off-screen pipes
        eng.pipes = eng.pipes.filter((p) => p.x + p.width > -40);

        // Update Coins
        eng.coins.forEach((c) => {
          c.x -= eng.modeSpeed;
          if (!c.collected) {
            const dx = eng.bird.x - c.x;
            const dy = eng.bird.y - (c.y + Math.sin(eng.frameCount * 0.08 + c.bobOffset) * 6);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < eng.bird.radius + c.radius) {
              c.collected = true;
              eng.coinsVal += 1;
              setRoundCoins(eng.coinsVal);
              if (soundEnabled) playCoinSound();

              // Sparkles on coin pickup
              for (let i = 0; i < 8; i++) {
                eng.particles.push({
                  x: c.x,
                  y: c.y,
                  vx: Math.cos(i * 0.8) * 3,
                  vy: Math.sin(i * 0.8) * 3,
                  size: 3.5,
                  color: '#fbbf24',
                  life: 20
                });
              }
            }
          }
        });
        eng.coins = eng.coins.filter((c) => c.x > -30 && !c.collected);

      } else if (gameState === 'idle') {
        // Bobbing animation on idle
        eng.bird.y = 250 + Math.sin(eng.frameCount * 0.06) * 12;
        eng.bird.rotation = 0;
        eng.bird.wingAngle = Math.sin(eng.frameCount * 0.15) * 0.6;
      }

      // ── 5. Render Neon Cyber Pipes ──
      eng.pipes.forEach((p) => {
        // Top Pipe
        const topGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
        topGrad.addColorStop(0, '#065f46');
        topGrad.addColorStop(0.3, '#10b981');
        topGrad.addColorStop(0.7, '#34d399');
        topGrad.addColorStop(1, '#064e3b');

        ctx.fillStyle = topGrad;
        ctx.fillRect(p.x, 0, p.width, p.topHeight);

        // Top Pipe Cap / Ring
        ctx.fillStyle = '#059669';
        ctx.fillRect(p.x - 4, p.topHeight - 24, p.width + 8, 24);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(p.x - 4, p.topHeight - 4, p.width + 8, 4); // Glowing rim

        // Bottom Pipe
        const botY = p.topHeight + p.gap;
        const botHeight = groundY - botY;
        ctx.fillStyle = topGrad;
        ctx.fillRect(p.x, botY, p.width, botHeight);

        // Bottom Pipe Cap
        ctx.fillStyle = '#059669';
        ctx.fillRect(p.x - 4, botY, p.width + 8, 24);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillRect(p.x - 4, botY, p.width + 8, 4); // Glowing rim

        // Glowing Conduit Accents
        ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.fillRect(p.x + 8, 0, 3, p.topHeight - 24);
        ctx.fillRect(p.x + 8, botY + 24, 3, botHeight - 24);
      });

      // ── 6. Render Floating Coins ──
      eng.coins.forEach((c) => {
        if (!c.collected) {
          const cy = c.y + Math.sin(eng.frameCount * 0.08 + c.bobOffset) * 6;
          ctx.save();
          ctx.shadowBlur = 14;
          ctx.shadowColor = '#fbbf24';
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(c.x, cy, c.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(c.x, cy, c.radius - 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#78350f';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', c.x, cy);
          ctx.restore();
        }
      });

      // ── 7. Render Particles ──
      eng.particles.forEach((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.5, pt.size * (pt.life / 20)), 0, Math.PI * 2);
        ctx.fill();
      });
      eng.particles = eng.particles.filter((pt) => pt.life > 0);

      // ── 8. Render Bird ──
      ctx.save();
      ctx.translate(eng.bird.x, eng.bird.y);
      ctx.rotate(eng.bird.rotation);

      // Shield Bubble Aura
      if (eng.shieldVal) {
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#38bdf8';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, eng.bird.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Bird Shadow / Glow
      ctx.shadowBlur = 12;
      ctx.shadowColor = selectedSkin.secondary;

      // Bird Body
      const birdGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, eng.bird.radius);
      birdGrad.addColorStop(0, '#ffffff');
      birdGrad.addColorStop(0.3, selectedSkin.color);
      birdGrad.addColorStop(1, selectedSkin.secondary);
      ctx.fillStyle = birdGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, eng.bird.radius, eng.bird.radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing (Animated oscillating angle)
      ctx.save();
      ctx.translate(-4, 2);
      ctx.rotate(eng.bird.wingAngle);
      ctx.fillStyle = selectedSkin.secondary;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(7, -5, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = selectedSkin.eye;
      ctx.beginPath();
      ctx.arc(8.5, -5, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(20, 2);
      ctx.lineTo(12, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // ── 9. Render Ground Layer ──
      eng.groundOffset = (eng.groundOffset + (gameState === 'playing' ? eng.modeSpeed : 0.8)) % 24;

      // Ground Top Border Line
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, groundY, W, 4);

      // Ground Base
      const gGrad = ctx.createLinearGradient(0, groundY + 4, 0, H);
      gGrad.addColorStop(0, '#0f172a');
      gGrad.addColorStop(1, '#020617');
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, groundY + 4, W, H - groundY - 4);

      // Ground Diagonal Cyber Grid Stripes
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      for (let gx = -eng.groundOffset; gx < W + 30; gx += 24) {
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 4);
        ctx.lineTo(gx + 12, groundY + 4);
        ctx.lineTo(gx - 4, H);
        ctx.lineTo(gx - 16, H);
        ctx.closePath();
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState, selectedSkin, soundEnabled, handleGameOver]);

  // Restart Round
  const handleRestart = () => {
    setGameState('idle');
    setScore(0);
    setRoundCoins(0);
    setIsNewHigh(false);
    const eng = engineRef.current;
    eng.bird.y = 250;
    eng.bird.velocity = 0;
    eng.pipes = [];
    eng.coins = [];
    eng.particles = [];
    eng.scoreVal = 0;
    eng.coinsVal = 0;
  };

  return (
    <div className="flappy-viewport">
      {/* Wallpaper Background */}
      <div className="flappy-page-wallpaper" />
      <div className="flappy-blob-1" />
      <div className="flappy-blob-2" />

      {/* Header */}
      <header className="flappy-header">
        <div className="flappy-header-left">
          <Link to="/" className="flappy-btn-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Hub</span>
          </Link>
          <div className="flappy-title-badge">
            <span className="flappy-title-icon">🐥</span>
            <div>
              <h1 className="flappy-title-text">FLOPPY BIRD</h1>
              <span className="flappy-subtitle-text">Cyberpunk Arcade Action · High Score Rush</span>
            </div>
          </div>
        </div>

        <div className="flappy-header-right">
          <button
            className={`flappy-ctrl-btn ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle Sound Effects"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            className={`flappy-ctrl-btn ai-btn ${aiAutopilot ? 'active' : ''}`}
            onClick={() => setAiAutopilot(!aiAutopilot)}
            title="Toggle AI Autopilot"
          >
            🤖 AI Bot: {aiAutopilot ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* Main Game Layout */}
      <main className="flappy-arena-layout">
        {/* Left Side: Game Canvas Container */}
        <section className="flappy-canvas-column">
          {/* Top Real-time HUD Bar */}
          <div className="flappy-hud-bar">
            <div className="flappy-hud-pill">
              <span className="fhud-lbl">CURRENT SCORE</span>
              <span className="fhud-val">{score}</span>
            </div>

            <div className="flappy-hud-pill highlight-gold">
              <span className="fhud-lbl">ALL-TIME BEST</span>
              <span className="fhud-val stat-gold">🏆 {highScore}</span>
            </div>

            <div className="flappy-hud-pill">
              <span className="fhud-lbl">COINS BANK</span>
              <span className="fhud-val stat-amber">🪙 {totalCoins + roundCoins}</span>
            </div>

            <div className="flappy-hud-pill">
              <span className="fhud-lbl">MODE</span>
              <span className="fhud-val stat-cyan">{gameMode.toUpperCase()}</span>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="flappy-canvas-frame" onClick={triggerFlap}>
            <canvas
              ref={canvasRef}
              width={420}
              height={580}
              className="flappy-canvas"
            />

            {/* In-Game Score Overlay */}
            {gameState === 'playing' && (
              <div className="flappy-live-score">
                <span className="live-score-digits">{score}</span>
              </div>
            )}

            {/* Idle Start Screen Overlay */}
            {gameState === 'idle' && (
              <div className="flappy-overlay-idle">
                <div className="flappy-idle-badge">FLAP TO FLY</div>
                <div className="flappy-idle-bird-pulse">
                  <span className="idle-bird-emoji">{selectedSkin.icon}</span>
                </div>
                <h2 className="flappy-tap-title">CLICK OR PRESS SPACE</h2>
                <p className="flappy-tap-desc">Dodge neon pipes & reach the leaderboard</p>
                <div className="flappy-key-hints">
                  <span className="key-cap">Space</span>
                  <span className="key-cap">▲ Up</span>
                  <span className="key-cap">Tap</span>
                </div>
              </div>
            )}

            {/* Paused Overlay */}
            {gameState === 'paused' && (
              <div className="flappy-overlay-paused">
                <h2 className="paused-title">PAUSED</h2>
                <p className="paused-sub">Press Space or P to resume</p>
                <button className="btn-resume-game" onClick={() => setGameState('playing')}>
                  ▶ Resume Game
                </button>
              </div>
            )}

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
              <div className="flappy-overlay-gameover" onClick={(e) => e.stopPropagation()}>
                <div className="gameover-card">
                  {isNewHigh && <div className="new-record-ribbon">⭐ NEW BEST! ⭐</div>}
                  <h2 className="gameover-title">GAME OVER</h2>

                  <div className="gameover-medal-row">
                    <div className="medal-showcase">
                      <span className="medal-icon">
                        {score >= 50 ? '💎' : score >= 25 ? '🥇' : score >= 10 ? '🥈' : '🥉'}
                      </span>
                      <span className="medal-name">
                        {score >= 50 ? 'Platinum Tier' : score >= 25 ? 'Gold Medal' : score >= 10 ? 'Silver Medal' : 'Bronze Scout'}
                      </span>
                    </div>

                    <div className="gameover-stats-grid">
                      <div className="go-stat-box">
                        <span className="go-stat-lbl">SCORE</span>
                        <span className="go-stat-val">{score}</span>
                      </div>
                      <div className="go-stat-box">
                        <span className="go-stat-lbl">BEST</span>
                        <span className="go-stat-val stat-gold">{Math.max(highScore, score)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="gameover-actions">
                    <button className="btn-play-again" onClick={handleRestart}>
                      🚀 Play Again
                    </button>
                    <Link to="/" className="btn-go-hub">
                      🏠 Hub
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Game Modes, Skins & Guide */}
        <aside className="flappy-sidebar-column">
          {/* Game Modes Card */}
          <div className="sidebar-card modes-card">
            <h3 className="sidebar-heading">Game Mode</h3>
            <div className="mode-select-list">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`fmode-btn ${gameMode === mode.id ? 'active' : ''}`}
                  onClick={() => {
                    setGameMode(mode.id);
                    handleRestart();
                  }}
                >
                  <span className="fmode-icon">{mode.icon}</span>
                  <div className="fmode-info">
                    <span className="fmode-title">{mode.title}</span>
                    <span className="fmode-desc">{mode.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bird Skin Selector */}
          <div className="sidebar-card skins-card">
            <h3 className="sidebar-heading">Bird Skin</h3>
            <div className="skins-grid">
              {BIRD_SKINS.map((skin) => (
                <button
                  key={skin.id}
                  className={`skin-btn ${selectedSkin.id === skin.id ? 'active' : ''}`}
                  onClick={() => setSelectedSkin(skin)}
                >
                  <span className="skin-icon">{skin.icon}</span>
                  <span className="skin-name">{skin.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Controls & Tips */}
          <div className="sidebar-card tips-card">
            <h3 className="sidebar-heading">Pro Tips</h3>
            <ul className="flappy-tips-list">
              <li>Tap gently to maintain a steady rhythm.</li>
              <li>Aim for the middle of each pipe gap.</li>
              <li>Enable AI Bot mode to study optimal flap frequency!</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

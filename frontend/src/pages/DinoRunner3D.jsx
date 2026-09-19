import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';
import {
  playDinoJumpSound, playDinoMilestoneSound, playDinoDuckSound,
  playDinoHitSound, playDinoPowerupSound, playDinoRoarSound, playDinoCollectSound
} from '../utils/soundEffects';
import { recordDinoOutcome } from '../utils/statsService';
import { trackGameStart } from '../utils/activityTracker';
import './DinoRunner3D.css';

// ─── Realistic Dinosaur Skins ────────────────────────────────────────────────
const DINO_SKINS = [
  { id:'classic', name:'Jurassic T-Rex', tag:'JURASSIC',   body:0x3e423b, belly:0x968c7c, accent:0x222620, eye:0xf59e0b, icon:'🦖' },
  { id:'green',   name:'Prime Raptor',   tag:'CRETACEOUS', body:0x2e4a33, belly:0x8cb878, accent:0x1b301f, eye:0xeab308, icon:'🌿' },
  { id:'cyber',   name:'Cyber Giga',     tag:'SYNTHWAVE',  body:0x18202c, belly:0x06b6d4, accent:0xec4899, eye:0x22d3ee, icon:'🤖' },
  { id:'magma',   name:'Volcanic Rex',   tag:'VOLCANIC',   body:0x251c19, belly:0xef6c00, accent:0xff3d00, eye:0xff6b00, icon:'🔥' },
  { id:'gold',    name:'Apex Imperial',  tag:'PRESTIGE',   body:0x92400e, belly:0xfde047, accent:0x78350f, eye:0xfbbf24, icon:'👑' },
];
const GAME_MODES = [
  { id:'classic', title:'Classic Desert',  desc:'Standard speed & acceleration', startSpeed:13, accel:0.0014, gravity:36, jumpPower:18.0, icon:'🌵' },
  { id:'frenzy',  title:'Speed Frenzy',    desc:'1.5× faster · hyper reflexes',  startSpeed:20, accel:0.002,  gravity:40, jumpPower:19.5, icon:'⚡' },
  { id:'cyber',   title:'Synthwave Night', desc:'Neon atmosphere · low gravity',  startSpeed:14, accel:0.0016, gravity:22, jumpPower:14.5, lowGrav:true, icon:'🌌' },
];

export default function DinoRunner3D() {
  const { user } = useAuth();
  const userId = user?.email || user?.id || 'default';

  const [gameState,       setGameState]       = useState('idle');
  const [score,           setScore]           = useState(0);
  const [highScore,       setHighScore]       = useState(() => parseInt(localStorage.getItem('gamehub_dino_best')||'0',10));
  const [coins,           setCoins]           = useState(() => parseInt(localStorage.getItem('gamehub_dino_coins')||'0',10));
  const [roundCoins,      setRoundCoins]      = useState(0);
  const [selectedSkin,    setSelectedSkin]    = useState(DINO_SKINS[0]);
  const [gameMode,        setGameMode]        = useState('classic');
  const [soundEnabled,    setSoundEnabled]    = useState(true);
  const [aiAutopilot,     setAiAutopilot]     = useState(false);
  const [activePowerup,   setActivePowerup]   = useState(null);
  const [powerupTimeLeft, setPowerupTimeLeft] = useState(0);
  const [isMilestone,     setIsMilestone]     = useState(false);
  const [fps,             setFps]             = useState(60);

  const mountRef = useRef(null);
  const eng = useRef({
    scene:null, camera:null, renderer:null, animId:null, initialized:false,
    dinoGroup:null, dinoParts:{}, shieldMesh:null, boostTrailMesh:null,
    // Physics
    posY:0, velY:0, gravity:36, jumpPower:18.0, isGrounded:true,
    // Animation state
    animFrame:0, animTimer:0,
    dinoState:'running',
    // Game
    speed:13, baseSpeed:13, dist:0, score:0, roundCoins:0,
    obstaclesPassed:0, lastMilestone:0,
    // Day/Night
    dayCycle:0, dirLight:null, hemiLight:null, ambientLight:null,
    fog:null, sunMesh:null, moonMesh:null, starsMesh:null,
    // Scene
    groundSegs:[], obstacles:[], collectibles:[],
    // Power-ups
    shieldActive:false, boostTimer:0, slowmoTimer:0,
    nextObsDist:24, nextColDist:16,
    sound:true, ai:false, mode:'classic',
  });

  useEffect(()=>{ eng.current.sound=soundEnabled; },[soundEnabled]);
  useEffect(()=>{ eng.current.ai=aiAutopilot; },[aiAutopilot]);
  useEffect(()=>{
    const m=GAME_MODES.find(m=>m.id===gameMode)||GAME_MODES[0];
    eng.current.mode=gameMode; eng.current.baseSpeed=m.startSpeed;
    eng.current.gravity=m.gravity||36; eng.current.jumpPower=m.jumpPower||18.0;
  },[gameMode]);

  // ══════════════════════════════════════════════════════════════════════════
  // PIXEL VOXEL T-REX BUILDER
  // All BoxGeometry, flatShading. Dino faces +X (right on screen).
  // Camera at +Z so we see a clean side profile.
  //
  // Chrome Dino proportions: huge rectangular head, tiny arms, thick legs,
  // long counterbalance tail. Body is compact. Legs alternate in 2-frame cycle.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // HYPER-REALISTIC ANATOMICAL 3D T-REX RIG BUILDER
  // Features organic muscular anatomy matching Jurassic predatory T-Rex reference:
  // - Procedural reptilian scale & bump texture mapping
  // - Massive muscular curved thighs and digitigrade talon feet
  // - S-curved muscular neck and detailed predatory skull with teeth & amber eyes
  // - Streamlined counter-shaded torso and 4-segment tapering tail
  // ══════════════════════════════════════════════════════════════════════════
  const buildDinoRig = useCallback((skin) => {
    const e = eng.current;
    if (!e.scene) return;
    if (e.dinoGroup) e.scene.remove(e.dinoGroup);

    // ── PROCEDURAL SCALE & BUMP MAP GENERATORS ──────────────────────────────
    const createScalesCanvas = (baseColor, darkColor) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#' + new THREE.Color(baseColor).getHexString();
      ctx.fillRect(0, 0, 512, 512);

      // Organic reptilian scales pattern
      const darkHex = '#' + new THREE.Color(darkColor).getHexString();
      ctx.fillStyle = darkHex;
      ctx.globalAlpha = 0.18;
      for (let y = 4; y < 512; y += 12) {
        const offset = (Math.floor(y / 12) % 2) * 6;
        for (let x = 4; x < 512; x += 12) {
          ctx.beginPath();
          ctx.arc(x + offset + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, 4 + Math.random() * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Micro-texture highlights
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 2000; i++) {
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      ctx.globalAlpha = 1.0;
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      return tex;
    };

    const createDinoBumpTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 8) {
        const off = (Math.floor(y / 8) % 2) * 4;
        for (let x = 0; x < 256; x += 8) {
          const v = Math.floor(110 + Math.random() * 80);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath();
          ctx.arc(x + off, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      return tex;
    };

    const bumpMap = createDinoBumpTex();
    const bodyTexNear = createScalesCanvas(skin.body, skin.accent);
    const bellyTexNear = createScalesCanvas(skin.belly, skin.body);

    const farBodyC  = new THREE.Color(skin.body).multiplyScalar(0.68).getHex();
    const farBellyC = new THREE.Color(skin.belly).multiplyScalar(0.68).getHex();
    const farAccC   = new THREE.Color(skin.accent).multiplyScalar(0.68).getHex();

    const bodyTexFar  = createScalesCanvas(farBodyC, farAccC);
    const bellyTexFar = createScalesCanvas(farBellyC, farBodyC);

    // ── HIGH-FIDELITY STANDARD MATERIALS
    const mBodyNear  = new THREE.MeshStandardMaterial({ color: skin.body, map: bodyTexNear, bumpMap, bumpScale: 0.04, roughness: 0.62, metalness: 0.12 });
    const mBellyNear = new THREE.MeshStandardMaterial({ color: skin.belly, map: bellyTexNear, bumpMap, bumpScale: 0.03, roughness: 0.72, metalness: 0.08 });
    const mAccNear   = new THREE.MeshStandardMaterial({ color: skin.accent, roughness: 0.52, metalness: 0.22 });

    const mBodyFar   = new THREE.MeshStandardMaterial({ color: farBodyC, map: bodyTexFar, bumpMap, bumpScale: 0.04, roughness: 0.68, metalness: 0.10 });
    const mBellyFar  = new THREE.MeshStandardMaterial({ color: farBellyC, map: bellyTexFar, bumpMap, bumpScale: 0.03, roughness: 0.78, metalness: 0.06 });

    const mClaw      = new THREE.MeshStandardMaterial({ color: 0x181614, roughness: 0.30, metalness: 0.40 });
    const mTooth     = new THREE.MeshStandardMaterial({ color: 0xfffaed, roughness: 0.22, metalness: 0.06 });
    const mMouth     = new THREE.MeshStandardMaterial({ color: 0x882535, roughness: 0.45, metalness: 0.10 });
    const mEye       = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.15, metalness: 0.60 });
    const mPupil     = new THREE.MeshBasicMaterial   ({ color: 0x020202 });
    const mGlint     = new THREE.MeshBasicMaterial   ({ color: 0xffffff });

    const root = new THREE.Group();
    e.scene.add(root);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. TORSO & PELVIS (Massive Deep Ribcage, Muscular Flanks & Counter-Shaded Underbelly)
    // ──────────────────────────────────────────────────────────────────────────
    // Main deep chest ribcage
    const chestGeo = new THREE.SphereGeometry(1.05, 16, 14);
    const chestMesh = new THREE.Mesh(chestGeo, mBodyNear);
    chestMesh.position.set(0.65, 2.75, 0);
    chestMesh.scale.set(1.15, 1.25, 0.72);
    chestMesh.castShadow = true;
    root.add(chestMesh);

    // Counter-shaded throat-to-chest underbelly
    const bellyGeo = new THREE.SphereGeometry(0.85, 14, 12);
    const bellyMesh = new THREE.Mesh(bellyGeo, mBellyNear);
    bellyMesh.position.set(0.55, 2.15, 0);
    bellyMesh.scale.set(1.10, 0.95, 0.64);
    bellyMesh.castShadow = true;
    root.add(bellyMesh);

    // Abdomen & Pelvis (flanks connecting to thighs and tail)
    const pelvisGeo = new THREE.SphereGeometry(1.02, 16, 14);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, mBodyNear);
    pelvisMesh.position.set(-0.85, 2.80, 0);
    pelvisMesh.scale.set(1.20, 1.15, 0.75);
    pelvisMesh.castShadow = true;
    root.add(pelvisMesh);

    // Left and Right Muscular Pelvic Flank Bulges
    for (const [sz, bMat] of [[0.38, mBodyNear], [-0.38, mBodyFar]]) {
      const flank = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10), bMat);
      flank.position.set(-0.55, 2.85, sz);
      flank.scale.set(1.05, 0.95, 0.55);
      flank.castShadow = true;
      root.add(flank);
    }

    // Dorsal spine ridge with organic scutes
    for (let i = -1.6; i <= 1.4; i += 0.32) {
      const scuteH = 0.22 + Math.cos(i * 1.1) * 0.12;
      const scute = new THREE.Mesh(new THREE.ConeGeometry(0.09, scuteH, 5), mAccNear);
      scute.position.set(i, 3.60 - Math.abs(i) * 0.18, 0);
      scute.rotation.z = -0.12;
      scute.castShadow = true;
      root.add(scute);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. S-CURVED NECK & DETAILED PREDATORY T-REX SKULL
    // ──────────────────────────────────────────────────────────────────────────
    // S-curve muscular neck extending upward and forward
    const neckBase = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.78, 1.35, 14), mBodyNear);
    neckBase.position.set(1.55, 3.25, 0);
    neckBase.rotation.z = -Math.PI / 3.4;
    neckBase.scale.set(1.0, 1.05, 0.65);
    neckBase.castShadow = true;
    root.add(neckBase);

    const neckThroat = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.62, 1.25, 12), mBellyNear);
    neckThroat.position.set(1.48, 2.95, 0);
    neckThroat.rotation.z = -Math.PI / 3.4;
    neckThroat.scale.set(0.95, 0.95, 0.58);
    root.add(neckThroat);

    // Head group (pivot at neck-cranium junction)
    const headGroup = new THREE.Group();
    headGroup.position.set(2.15, 3.65, 0);

    // Cranium / Upper Skull (muscular postorbital cranium with temporal brow crests)
    const cranium = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.92, 0.68), mBodyNear);
    cranium.position.set(0.55, 0.24, 0);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Supraorbital brow horns
    for (const [sz, angle] of [[0.32, 0.25], [-0.32, -0.25]]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 6), mAccNear);
      horn.position.set(0.42, 0.75, sz);
      horn.rotation.z = -0.45; horn.rotation.x = angle;
      headGroup.add(horn);
    }

    // Powerful tapered snout & maxilla
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 1.55, 12), mBodyNear);
    snout.rotateZ(Math.PI / 2);
    snout.position.set(1.58, 0.16, 0);
    snout.scale.set(0.72, 1.0, 0.56);
    snout.castShadow = true;
    headGroup.add(snout);

    // Snout tip & Nostril bumps
    const snoutTip = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), mBodyNear);
    snoutTip.position.set(2.32, 0.16, 0);
    snoutTip.scale.set(0.90, 0.82, 0.50);
    headGroup.add(snoutTip);

    // Realistic amber eyes with slit pupils & eye glints
    for (const sz of [-1, 1]) {
      const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), mEye);
      eyeOrb.position.set(0.45, 0.44, sz * 0.35);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), mPupil);
      pupil.position.set(0.09, 0, sz * 0.04);
      eyeOrb.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mGlint);
      glint.position.set(0.10, 0.05, sz * 0.05);
      eyeOrb.add(glint);
      headGroup.add(eyeOrb);
    }

    // Upper sharp predatory ivory teeth
    for (let tx = 0.90; tx <= 2.25; tx += 0.18) {
      const toothLen = 0.15 + Math.sin((tx - 0.9) * 2.4) * 0.14;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.038, toothLen, 5), mTooth);
      tooth.rotation.z = Math.PI;
      tooth.position.set(tx, -0.10, 0.22);
      headGroup.add(tooth);
    }

    // JAW GROUP (articulated lower mandible hinged at skull base)
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0.15, -0.18, 0);

    const jawMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 2.05, 10), mBellyNear);
    jawMesh.rotateZ(Math.PI / 2);
    jawMesh.position.set(1.05, -0.06, 0);
    jawMesh.scale.set(0.62, 1.0, 0.50);
    jawMesh.castShadow = true;
    jawGroup.add(jawMesh);

    // Oral cavity & tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 0.26), mMouth);
    tongue.position.set(0.85, 0.08, 0);
    jawGroup.add(tongue);

    // Lower interlocking teeth
    for (let tx = 0.45; tx <= 1.95; tx += 0.20) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.16, 5), mTooth);
      tooth.position.set(tx, 0.12, 0.20);
      jawGroup.add(tooth);
    }

    headGroup.add(jawGroup);
    root.add(headGroup);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. TINY VESTIGIAL FOREARMS (2-Clawed T-Rex Arms on Chest)
    // ──────────────────────────────────────────────────────────────────────────
    const makeArm = (zPos, isFar) => {
      const g = new THREE.Group();
      g.position.set(1.15, 2.35, zPos);
      const bMat = isFar ? mBodyFar : mBodyNear;

      // Upper arm
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.48, 8), bMat);
      upper.rotation.z = -0.45;
      upper.position.set(0.08, -0.18, 0);
      g.add(upper);

      // Forearm
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.40, 8), bMat);
      fore.rotation.z = 0.65;
      fore.position.set(0.24, -0.42, 0);
      g.add(fore);

      // 2 Claws
      for (const cz of [-0.04, 0.04]) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), mClaw);
        claw.rotation.z = 1.2;
        claw.position.set(0.38, -0.56, cz);
        g.add(claw);
      }
      root.add(g);
      return g;
    };
    const armNear = makeArm( 0.42, false);
    const armFar  = makeArm(-0.42, true);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. LONG TAPERING COUNTER-BALANCE TAIL (4-Segment Articulated Chain)
    // ──────────────────────────────────────────────────────────────────────────
    const tailBase = new THREE.Group();
    tailBase.position.set(-1.65, 2.85, 0);

    // Tail Segment 1 (Base - thick muscular flow from pelvis)
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 1.45, 12), mBodyNear);
    t1.rotateZ(Math.PI / 2.05);
    t1.position.set(-0.70, 0, 0);
    t1.scale.set(1.0, 1.05, 0.68);
    t1.castShadow = true;
    tailBase.add(t1);

    // Tail Segment 2 (Mid-1)
    const tailMid1 = new THREE.Group();
    tailMid1.position.set(-1.40, -0.06, 0);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 1.40, 12), mBodyNear);
    t2.rotateZ(Math.PI / 2.08);
    t2.position.set(-0.68, 0, 0);
    t2.scale.set(1.0, 1.0, 0.62);
    t2.castShadow = true;
    tailMid1.add(t2);

    // Tail Segment 3 (Mid-2)
    const tailMid2 = new THREE.Group();
    tailMid2.position.set(-1.35, -0.06, 0);
    const t3 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.35, 10), mBodyNear);
    t3.rotateZ(Math.PI / 2.10);
    t3.position.set(-0.65, 0, 0);
    t3.scale.set(1.0, 0.95, 0.55);
    t3.castShadow = true;
    tailMid2.add(t3);

    // Tail Segment 4 (Tip - slender tapering whip)
    const tailTip = new THREE.Group();
    tailTip.position.set(-1.30, -0.04, 0);
    const t4 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.35, 10), mBodyNear);
    t4.rotateZ(Math.PI / 2.12);
    t4.position.set(-0.65, 0, 0);
    t4.castShadow = true;
    tailTip.add(t4);

    tailMid2.add(tailTip);
    tailMid1.add(tailMid2);
    tailBase.add(tailMid1);
    root.add(tailBase);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. POWERFUL DIGITIGRADE HINDLIMBS (Muscular Thigh → Shank → Ankle → Talons)
    // ──────────────────────────────────────────────────────────────────────────
    const makeLeg = (sz, isFar) => {
      const bMat   = isFar ? mBodyFar  : mBodyNear;
      const belMat = isFar ? mBellyFar : mBellyNear;

      const hipGroup = new THREE.Group();
      hipGroup.position.set(-0.35, 2.65, sz);

      // Massive muscular curved thigh
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, 1.40, 12), bMat);
      thigh.rotation.z = 0.25;
      thigh.position.set(0.12, -0.58, 0);
      thigh.scale.set(1.15, 1.0, 0.85);
      thigh.castShadow = true;
      hipGroup.add(thigh);

      // Knee joint (backward angled)
      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0.24, -1.22, 0);

      // Crus / Shank (muscular calf sloping forward)
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, 1.25, 10), belMat);
      shank.rotation.z = -0.38;
      shank.position.set(-0.16, -0.52, 0);
      shank.scale.set(1.0, 1.0, 0.75);
      shank.castShadow = true;
      kneeGroup.add(shank);

      // Ankle joint / Hock (elevated rear-facing joint)
      const ankleGroup = new THREE.Group();
      ankleGroup.position.set(-0.36, -1.05, 0);

      // Metatarsus (foot bone extending down & forward)
      const tarsus = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.65, 8), bMat);
      tarsus.rotation.z = 0.25;
      tarsus.position.set(0.08, -0.28, 0);
      ankleGroup.add(tarsus);

      // 3 Main Talon Toes
      for (const [tx, tz, tScale] of [[0.42, 0, 1.0], [0.38, 0.16, 0.85], [0.38, -0.16, 0.85]]) {
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.45 * tScale, 0.16, 0.14), bMat);
        toe.position.set(tx, -0.52, tz);
        ankleGroup.add(toe);

        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08 * tScale, 0.28 * tScale, 5), mClaw);
        claw.rotation.z = -Math.PI / 2.3;
        claw.position.set(tx + 0.28 * tScale, -0.54, tz);
        ankleGroup.add(claw);
      }

      // Rear dewclaw
      const dewclaw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.20, 5), mClaw);
      dewclaw.rotation.z = Math.PI / 2.5;
      dewclaw.position.set(-0.18, -0.42, 0);
      ankleGroup.add(dewclaw);

      kneeGroup.add(ankleGroup);
      hipGroup.add(kneeGroup);
      root.add(hipGroup);
      return { hipGroup, kneeGroup, ankleGroup };
    };

    const leftLeg  = makeLeg( 0.44, false); // Near (+Z)
    const rightLeg = makeLeg(-0.44, true);  // Far (-Z, darker)

    // ──────────────────────────────────────────────────────────────────────────
    // 6. SHIELD BUBBLE & BOOST TRAIL
    // ──────────────────────────────────────────────────────────────────────────
    const shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0, wireframe: true })
    );
    shieldMesh.position.set(0.3, 2.6, 0);
    root.add(shieldMesh);
    e.shieldMesh = shieldMesh;

    const boostTrail = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.8, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff5722, transparent: true, opacity: 0 })
    );
    boostTrail.position.set(-2.5, 2.6, 0);
    root.add(boostTrail);
    e.boostTrailMesh = boostTrail;

    e.dinoGroup = root;
    e.dinoParts = { headGroup, jawGroup, armNear, armFar, tailBase, tailMid1, tailMid2, tailTip, leftLeg, rightLeg };
  }, []);

  // ── Pixel-style Ground Segment ─────────────────────────────────────────────
  const createGroundSeg = useCallback((xPos) => {
    const group = new THREE.Group();
    group.position.set(xPos, 0, 0);

    // Main flat desert ground
    const gMat = new THREE.MeshLambertMaterial({ color:0xd4b483, flatShading:true });
    const gMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 12, 1, 1), gMat);
    gMesh.rotation.x = -Math.PI/2;
    gMesh.receiveShadow = true;
    group.add(gMesh);

    // Ground edge block (gives thickness feel like pixel art)
    const edgeBlock = new THREE.Mesh(new THREE.BoxGeometry(80, 0.35, 12), new THREE.MeshLambertMaterial({ color:0xba9b6a, flatShading:true }));
    edgeBlock.position.set(0, -0.175, 0);
    group.add(edgeBlock);

    // Far horizon ground
    const horizMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshLambertMaterial({ color:0xc8a870 }));
    horizMesh.rotation.x = -Math.PI/2;
    horizMesh.position.set(0, -0.02, -36);
    group.add(horizMesh);

    // Pixel-style rocks (just boxes, not dodecahedrons)
    for (let r=0; r<6; r++) {
      const rw = 0.4+Math.random()*0.9, rh = 0.3+Math.random()*0.7, rd = 0.4+Math.random()*0.7;
      const rock = new THREE.Mesh(
        new THREE.BoxGeometry(rw, rh, rd),
        new THREE.MeshLambertMaterial({ color:0x9e8060, flatShading:true })
      );
      const xR = (Math.random()-0.5)*68;
      const zR = (Math.random()>0.5?1:-1)*(5+Math.random()*4);
      rock.position.set(xR, rh/2, zR);
      rock.castShadow = true; rock.receiveShadow = true;
      group.add(rock);
    }

    return { group, x:xPos, length:80 };
  }, []);

  // ── Pixel Cactus (all BoxGeometry) ────────────────────────────────────────
  const createCactus = useCallback((type, xPos) => {
    const g = new THREE.Group();
    g.position.set(xPos, 0, 0);
    const mat = new THREE.MeshLambertMaterial({ color:0x1e6b2e, flatShading:true });

    // Helper: box block
    const blk = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      m.position.set(x, y+h/2, z); m.castShadow=true; g.add(m); return m;
    };
    const armH = (atY, side, len) => { // horizontal arm block
      const m = new THREE.Mesh(new THREE.BoxGeometry(len,0.30,0.36), mat);
      m.position.set(side*len/2, atY, 0); m.castShadow=true; g.add(m);
      const vert = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.55, 0.36), mat);
      vert.position.set(side*len, atY+0.28, 0); vert.castShadow=true; g.add(vert);
    };

    let bW=0.85, bH=1.65;
    if (type==='single') {
      blk(0.52, 1.65, 0.50, 0, 0, 0); armH(0.70, 1, 0.55); armH(0.95, -1, 0.50); bH=1.65; bW=0.85;
    } else if (type==='twin') {
      blk(0.50, 1.90, 0.48, -0.28, 0, 0); armH(0.85, -1, 0.55);
      blk(0.44, 1.40, 0.42,  0.32, 0, 0); armH(0.60, 1, 0.45); bW=1.10; bH=1.90;
    } else if (type==='triple') {
      blk(0.50, 2.15, 0.48, 0, 0, 0); armH(1.0, 1, 0.60); armH(0.75, -1, 0.55);
      blk(0.44, 1.50, 0.42, -0.60, 0, 0.05);
      blk(0.40, 1.30, 0.38,  0.60, 0,-0.05); bW=1.45; bH=2.15;
    } else {
      blk(0.62, 2.45, 0.54, 0, 0, 0); armH(1.2, 1, 0.70); armH(1.5, -1, 0.65); bW=1.20; bH=2.45;
    }

    return { group:g, type:'cactus', x:xPos, width:bW, height:bH };
  }, []);

  // ── Pixel Pterodactyl ─────────────────────────────────────────────────────
  const createPterodactyl = useCallback((altType, xPos) => {
    const g = new THREE.Group();
    // Altitudes: low = 1.65 (jumpable), mid = 2.85 (pronation duck zone), high = 4.40 (misses standing dino)
    const altY = { low:1.65, mid:2.85, high:4.40 }[altType]??1.65;
    g.position.set(xPos, altY, 0);

    const mat = new THREE.MeshLambertMaterial({ color:0x4c1d95, flatShading:true });
    const wMat = new THREE.MeshLambertMaterial({ color:0x6d28d9, flatShading:true, side:THREE.DoubleSide });
    const bkMat= new THREE.MeshLambertMaterial({ color:0xfbbf24, flatShading:true });

    // Body (pixel blocks)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.55, 1.2), mat);
    body.castShadow=true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.55), mat);
    head.position.set(0.62, 0.2, 0); head.castShadow=true; g.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.28), bkMat);
    beak.position.set(1.25, 0.16, 0); beak.castShadow=true; g.add(beak);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), bkMat);
    crest.position.set(0.52, 0.52, 0); crest.castShadow=true; g.add(crest);
    // eyes
    for (const sz of [-1,1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.08), new THREE.MeshBasicMaterial({ color:0xff1744 }));
      eye.position.set(0.68, 0.26, sz*0.24); g.add(eye);
    }

    // Wings (flat box panels)
    const leftWing = new THREE.Group(); leftWing.position.set(0, 0, 0.55);
    const lw = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.8), wMat);
    lw.position.set(0.7, 0.05, 0.3); leftWing.add(lw); g.add(leftWing);
    const rightWing = new THREE.Group(); rightWing.position.set(0, 0, -0.55);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.8), wMat);
    rw.position.set(0.7, 0.05, -0.3); rightWing.add(rw); g.add(rightWing);

    return { group:g, type:'pterodactyl', altType, altY, x:xPos, width:1.2, height:1.1, leftWing, rightWing, flapPhase:Math.random()*Math.PI };
  }, []);

  // ── Collectible ───────────────────────────────────────────────────────────
  const createCollectible = useCallback((type, xPos) => {
    const g = new THREE.Group();
    const yPos = 1.8+Math.random()*1.5;
    g.position.set(xPos, yPos, 0);
    let mesh;
    if (type==='egg') {
      mesh=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.75,0.6), new THREE.MeshLambertMaterial({ color:0xfbbf24, flatShading:true }));
    } else if (type==='bone') {
      mesh=new THREE.Group();
      const bm=new THREE.MeshLambertMaterial({ color:0xf5f0ea, flatShading:true });
      const sh=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.75,0.18),bm); sh.rotation.z=Math.PI/4; mesh.add(sh);
      for (const s of [-1,1]) { const k=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),bm); k.position.set(s*0.28,s*0.28,0); mesh.add(k); }
    } else if (type==='shield') {
      mesh=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.7), new THREE.MeshLambertMaterial({ color:0x06b6d4, flatShading:true, emissive:0x0891b2, emissiveIntensity:0.6 }));
    } else if (type==='boost') {
      mesh=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.7), new THREE.MeshLambertMaterial({ color:0xef4444, flatShading:true, emissive:0xdc2626, emissiveIntensity:0.6 }));
    } else {
      mesh=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.7,0.7), new THREE.MeshLambertMaterial({ color:0x8b5cf6, flatShading:true, emissive:0x7c3aed, emissiveIntensity:0.6 }));
    }
    if (mesh.castShadow!==undefined) mesh.castShadow=true;
    g.add(mesh);
    return { group:g, type, x:xPos, y:yPos, radius:0.85, mesh, collected:false };
  }, []);

  // ── Three.js Init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const W=mount.clientWidth||900, H=mount.clientHeight||520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf9e9b8);

    // ── CAMERA ───────────────────────────────────────────────────────────────
    // Narrow FOV perspective from +Z → creates the flat side-scroll look.
    // Dino faces +X (right), camera behind at +Z. Ground is perfectly flat/horizontal.
    // FOV 28° + distance 26 ≈ near-orthographic, no road tilt.
    const camera = new THREE.PerspectiveCamera(28, W/H, 0.1, 350);
    camera.position.set(0, 4.8, 26);
    camera.lookAt(2.0, 3.0, 0);           // look at dino center (slight right bias for running space)

    const fog = new THREE.Fog(0xf9e9b8, 60, 150);  // linear fog (no density variation = pixel-clean)
    scene.fog = fog;

    const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft realistic shadows
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.replaceChildren(renderer.domElement);

    // Dynamic Lighting
    const ambient = new THREE.AmbientLight(0xfff8e1, 0.95);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xfff3cd, 0xd4a848, 0.65);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff1cf, 1.35);
    dir.position.set(6, 24, 18);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near=1; dir.shadow.camera.far=80;
    dir.shadow.camera.left=-22; dir.shadow.camera.right=22;
    dir.shadow.camera.top=22; dir.shadow.camera.bottom=-22;
    dir.shadow.bias=-0.0005;
    scene.add(dir);

    // Sun & Moon
    const sunMesh=new THREE.Mesh(new THREE.BoxGeometry(8,8,8), new THREE.MeshBasicMaterial({ color:0xfbbf24 }));
    sunMesh.position.set(50, 42,-110); scene.add(sunMesh);
    const moonMesh=new THREE.Mesh(new THREE.BoxGeometry(6,6,6), new THREE.MeshBasicMaterial({ color:0xbde0ff }));
    moonMesh.position.set(-50,-28,-110); scene.add(moonMesh);

    // Pixel stars (point cloud)
    const starGeo=new THREE.BufferGeometry();
    const sPts=new Float32Array(300*3);
    for (let i=0;i<300*3;i+=3){sPts[i]=(Math.random()-0.5)*250;sPts[i+1]=14+Math.random()*80;sPts[i+2]=-65-Math.random()*110;}
    starGeo.setAttribute('position',new THREE.BufferAttribute(sPts,3));
    const starsMesh=new THREE.Points(starGeo,new THREE.PointsMaterial({ color:0xffffff, size:1.2, transparent:true, opacity:0 }));
    scene.add(starsMesh);

    const e=eng.current;
    Object.assign(e, { scene, camera, renderer, ambientLight:ambient, hemiLight:hemi, dirLight:dir, fog, sunMesh, moonMesh, starsMesh, initialized:true });

    // Initial ground (5 segments at x positions)
    for (let i=0;i<5;i++) {
      const seg=createGroundSeg(i*80-80);
      scene.add(seg.group); e.groundSegs.push(seg);
    }

    buildDinoRig(selectedSkin);

    const onResize=()=>{ if (!mountRef.current||!e.renderer||!e.camera) return; const w=mountRef.current.clientWidth,h=mountRef.current.clientHeight; e.camera.aspect=w/h; e.camera.updateProjectionMatrix(); e.renderer.setSize(w,h); };
    window.addEventListener('resize', onResize);
    return ()=>{ window.removeEventListener('resize',onResize); if (e.animId) cancelAnimationFrame(e.animId); renderer.dispose(); };
  }, [buildDinoRig, createGroundSeg, selectedSkin]);

  useEffect(()=>{ if (eng.current.initialized) buildDinoRig(selectedSkin); },[selectedSkin, buildDinoRig]);

  // ── Input ─────────────────────────────────────────────────────────────────
  const handleJump = useCallback(() => {
    const e=eng.current;
    if (gameState!=='running'||!e.isGrounded) return;
    e.velY=e.jumpPower; e.isGrounded=false; e.dinoState='jumping';
    if (e.sound) playDinoJumpSound();
  }, [gameState]);

  const handleDuckStart = useCallback(() => {
    const e=eng.current;
    if (gameState!=='running') return;
    e.dinoState='ducking';
    if (!e.isGrounded) e.velY-=16;
    if (e.sound) playDinoDuckSound();
  }, [gameState]);

  const handleDuckEnd = useCallback(() => {
    const e=eng.current;
    if (gameState!=='running') return;
    if (e.dinoState==='ducking') e.dinoState=e.isGrounded?'running':'jumping';
  }, [gameState]);

  useEffect(()=>{
    const kd=(ev)=>{
      if (ev.repeat) return;
      if (['Space','ArrowUp'].includes(ev.code)||ev.key==='w'){ ev.preventDefault(); if (gameState==='idle'||gameState==='gameover') startGame(); else if (gameState==='running') handleJump(); }
      if (ev.code==='ArrowDown'||ev.key==='s'){ ev.preventDefault(); handleDuckStart(); }
      if (ev.code==='KeyP') setGameState(p=>p==='running'?'paused':p==='paused'?'running':p);
      if (ev.code==='KeyA') setAiAutopilot(p=>!p);
      if (ev.code==='KeyM') setSoundEnabled(p=>!p);
    };
    const ku=(ev)=>{ if (ev.code==='ArrowDown'||ev.key==='s'){ ev.preventDefault(); handleDuckEnd(); } };
    window.addEventListener('keydown',kd); window.addEventListener('keyup',ku);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  },[gameState,handleJump,handleDuckStart,handleDuckEnd]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startGame = useCallback(()=>{
    const e=eng.current; if (!e.initialized) return;
    e.speed=e.baseSpeed; e.posY=0; e.velY=0; e.isGrounded=true;
    e.dinoState='running'; e.dist=0; e.score=0; e.roundCoins=0;
    e.obstaclesPassed=0; e.lastMilestone=0; e.dayCycle=0;
    e.shieldActive=false; e.boostTimer=0; e.slowmoTimer=0;
    e.animFrame=0; e.animTimer=0;
    e.nextObsDist=22; e.nextColDist=16;
    e.obstacles.forEach(o=>e.scene.remove(o.group)); e.obstacles=[];
    e.collectibles.forEach(c=>e.scene.remove(c.group)); e.collectibles=[];
    if (e.dinoGroup){ e.dinoGroup.position.set(0,0,0); e.dinoGroup.rotation.set(0,0,0); }
    setScore(0); setRoundCoins(0); setActivePowerup(null); setPowerupTimeLeft(0);
    setIsMilestone(false); setGameState('running');
    trackGameStart('Chrome Dino 3D',`Mode:${gameMode}`);
    if (e.sound) playDinoJumpSound();
  },[gameMode]);

  // ── Game Over ─────────────────────────────────────────────────────────────
  const triggerGameOver = useCallback(()=>{
    const e=eng.current; e.dinoState='dead'; setGameState('gameover');
    if (e.dinoGroup){ e.dinoGroup.rotation.z=Math.PI*0.28; e.dinoGroup.position.y=0.4; }
    if (e.sound) playDinoHitSound();
    const s=Math.floor(e.score), nb=Math.max(highScore,s);
    setHighScore(nb);
    const tc=coins+e.roundCoins; setCoins(tc);
    localStorage.setItem('gamehub_dino_best',nb);
    localStorage.setItem('gamehub_dino_coins',tc);
    recordDinoOutcome(userId,{ score:s, bestScore:nb, coins:e.roundCoins, mode:gameMode, obstaclesPassed:e.obstaclesPassed });
  },[highScore,coins,userId,gameMode]);

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN GAME LOOP
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(()=>{
    const e=eng.current; if (!e.initialized) return;
    let last=performance.now(), fc=0, lastFps=performance.now();

    const animate=(now)=>{
      e.animId=requestAnimationFrame(animate);
      const dt=Math.min((now-last)/1000,0.1);
      last=now;
      fc++;
      if (now-lastFps>500){ setFps(Math.round(fc*1000/(now-lastFps))); fc=0; lastFps=now; }

      if (gameState==='running') {

        // ── Speed & Score ────────────────────────────────────────────────
        let sm=1.0;
        if (e.boostTimer>0){ e.boostTimer-=dt; sm=2.2; if (e.boostTimer<=0){ setActivePowerup(null); if(e.boostTrailMesh)e.boostTrailMesh.material.opacity=0; } else setPowerupTimeLeft(Math.ceil(e.boostTimer)); }
        else if (e.slowmoTimer>0){ e.slowmoTimer-=dt; sm=0.48; if(e.slowmoTimer<=0) setActivePowerup(null); else setPowerupTimeLeft(Math.ceil(e.slowmoTimer)); }

        const cm=GAME_MODES.find(m=>m.id===e.mode)||GAME_MODES[0];
        e.speed=Math.min(36,e.baseSpeed+e.dist*cm.accel);
        const es=e.speed*sm, dx=es*dt;
        e.dist+=dx; e.score+=dx*1.2;
        const is=Math.floor(e.score); setScore(is);
        if (is>=e.lastMilestone+100){ e.lastMilestone=Math.floor(is/100)*100; setIsMilestone(true); setTimeout(()=>setIsMilestone(false),800); if(e.sound)playDinoMilestoneSound(); }

        // ── Day / Night ──────────────────────────────────────────────────
        const p=(e.dist%600)/600; e.dayCycle=p;
        let skyC,fogC,li,so;
        if (p<0.35){ skyC=new THREE.Color().lerpColors(new THREE.Color(0xf9e9b8),new THREE.Color(0xfde68a),p/0.35); fogC=skyC; li=0.9; so=0; }
        else if (p<0.5){ const f=(p-0.35)/0.15; skyC=new THREE.Color().lerpColors(new THREE.Color(0xfde68a),new THREE.Color(0xf97316),f); fogC=new THREE.Color().lerpColors(new THREE.Color(0xfb923c),new THREE.Color(0x7c2d12),f); li=0.9-0.6*f; so=f*0.35; }
        else if (p<0.85){ const f=(p-0.5)/0.35; skyC=new THREE.Color().lerpColors(new THREE.Color(0x090d16),new THREE.Color(0x1e1b4b),Math.sin(f*Math.PI)); fogC=new THREE.Color(0x0d1117); li=0.3; so=0.9; }
        else { const f=(p-0.85)/0.15; skyC=new THREE.Color().lerpColors(new THREE.Color(0x1e1b4b),new THREE.Color(0xf9e9b8),f); fogC=skyC; li=0.3+0.6*f; so=0.9*(1-f); }
        if (e.scene) e.scene.background=skyC;
        if (e.fog) e.fog.color=fogC;
        if (e.dirLight) e.dirLight.intensity=li;
        if (e.starsMesh) e.starsMesh.material.opacity=so;
        const oa=p*Math.PI*2;
        if (e.sunMesh) e.sunMesh.position.set(Math.cos(oa)*100,42+Math.sin(oa)*45,-110);
        if (e.moonMesh) e.moonMesh.position.set(-Math.cos(oa)*100,-28-Math.sin(oa)*45,-110);

        // ── Vertical Physics ─────────────────────────────────────────────
        if (!e.isGrounded){ e.velY-=e.gravity*dt; e.posY+=e.velY*dt; if(e.posY<=0){ e.posY=0; e.velY=0; e.isGrounded=true; if(e.dinoState!=='ducking') e.dinoState='running'; } }
        if (e.dinoGroup) e.dinoGroup.position.y=e.posY;

        // ── DYNAMIC 3D DINO ANIMATION SYSTEM ────────────────────────────
        const parts = e.dinoParts;
        const { leftLeg, rightLeg, headGroup, jawGroup, armNear, armFar, tailBase, tailMid1, tailMid2, tailTip } = parts;

        if (leftLeg && rightLeg) {
          const isDuck = e.dinoState === 'ducking';
          const isAir  = !e.isGrounded;

          if (isDuck) {
            // ── PRONING / DUCK CRAWL: True low horizontal slide ──────────
            const strideFreq = 18 + Math.min(18, es * 0.6);
            e.animTimer += dt * strideFreq;
            const thetaD = e.animTimer;
            const sL = Math.sin(thetaD), sR = Math.sin(thetaD + Math.PI);

            // Legs fold close against underbelly with rapid skimming scramble
            leftLeg.hipGroup.rotation.z   = THREE.MathUtils.lerp(leftLeg.hipGroup.rotation.z,   sL * 0.45 + 0.35, dt * 26);
            leftLeg.kneeGroup.rotation.z  = THREE.MathUtils.lerp(leftLeg.kneeGroup.rotation.z,  1.38, dt * 26);
            if (leftLeg.ankleGroup)  leftLeg.ankleGroup.rotation.z  = THREE.MathUtils.lerp(leftLeg.ankleGroup.rotation.z,  -0.52, dt * 26);

            rightLeg.hipGroup.rotation.z  = THREE.MathUtils.lerp(rightLeg.hipGroup.rotation.z,  sR * 0.45 + 0.35, dt * 26);
            rightLeg.kneeGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.kneeGroup.rotation.z, 1.38, dt * 26);
            if (rightLeg.ankleGroup) rightLeg.ankleGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.ankleGroup.rotation.z, -0.52, dt * 26);

            // Streamlined flat head and neck lowered forward
            if (headGroup) {
              headGroup.position.set(2.35, 1.85, 0);
              headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, -0.06, dt * 25);
            }
            // Tail stretches horizontal straight back
            if (tailBase) tailBase.rotation.z = THREE.MathUtils.lerp(tailBase.rotation.z, 0.05, dt * 22);
            if (tailMid1) tailMid1.rotation.z = THREE.MathUtils.lerp(tailMid1.rotation.z, 0.04, dt * 22);
            if (tailMid2) tailMid2.rotation.z = THREE.MathUtils.lerp(tailMid2.rotation.z, 0.03, dt * 22);
            if (tailTip)  tailTip.rotation.z  = THREE.MathUtils.lerp(tailTip.rotation.z,  0.02, dt * 22);

            // Arms tucked tight against flanks
            if (armNear)  armNear.rotation.z  = THREE.MathUtils.lerp(armNear.rotation.z,  0.88, dt * 22);
            if (armFar)   armFar.rotation.z   = THREE.MathUtils.lerp(armFar.rotation.z,   0.88, dt * 22);

            if (e.dinoGroup) {
              e.dinoGroup.position.y = THREE.MathUtils.lerp(e.dinoGroup.position.y, e.posY - 1.12, dt * 26);
              e.dinoGroup.rotation.z = THREE.MathUtils.lerp(e.dinoGroup.rotation.z, 0.04, dt * 22);
            }

          } else if (isAir) {
            // ── JUMP FLIGHT POSE: legs tucked back, tail arched, arms forward ──
            if (headGroup) {
              headGroup.position.set(2.15, 3.65, 0); // restore standing head pivot
              headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, -0.10, dt * 18);
            }

            leftLeg.hipGroup.rotation.z   = THREE.MathUtils.lerp(leftLeg.hipGroup.rotation.z,   0.55, dt * 18);
            leftLeg.kneeGroup.rotation.z  = THREE.MathUtils.lerp(leftLeg.kneeGroup.rotation.z,  0.88, dt * 18);
            if (leftLeg.ankleGroup)  leftLeg.ankleGroup.rotation.z  = THREE.MathUtils.lerp(leftLeg.ankleGroup.rotation.z,  -0.30, dt * 18);

            rightLeg.hipGroup.rotation.z  = THREE.MathUtils.lerp(rightLeg.hipGroup.rotation.z,  0.42, dt * 18);
            rightLeg.kneeGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.kneeGroup.rotation.z, 0.76, dt * 18);
            if (rightLeg.ankleGroup) rightLeg.ankleGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.ankleGroup.rotation.z, -0.22, dt * 18);

            if (tailBase) tailBase.rotation.z = THREE.MathUtils.lerp(tailBase.rotation.z, -0.20, dt * 18);
            if (tailMid1) tailMid1.rotation.z = THREE.MathUtils.lerp(tailMid1.rotation.z, -0.16, dt * 18);
            if (tailMid2) tailMid2.rotation.z = THREE.MathUtils.lerp(tailMid2.rotation.z, -0.12, dt * 18);
            if (tailTip)  tailTip.rotation.z  = THREE.MathUtils.lerp(tailTip.rotation.z,  -0.08, dt * 18);

            if (armNear)  armNear.rotation.z  = THREE.MathUtils.lerp(armNear.rotation.z, -0.50, dt * 18);
            if (armFar)   armFar.rotation.z   = THREE.MathUtils.lerp(armFar.rotation.z,  -0.50, dt * 18);

            if (e.dinoGroup) {
              e.dinoGroup.rotation.z = THREE.MathUtils.lerp(e.dinoGroup.rotation.z, -0.12, dt * 18);
            }

          } else {
            // ── SMOOTH RUNNING STRIDE CYCLE ──────────────────────────────
            if (headGroup) {
              headGroup.position.set(2.15, 3.65, 0); // restore standing head pivot
            }

            const strideFreq = 8.5 + Math.min(22, es * 0.60);
            e.animTimer += dt * strideFreq;
            const theta = e.animTimer;

            // ── Left Leg (Near) ──────────────────────────────────────────
            const sinL = Math.sin(theta);
            const cosL = Math.cos(theta);
            const targetHipL   = sinL * 0.82;
            const targetKneeL  = cosL > 0 ? (cosL * 0.92 + 0.08) : (-cosL * 0.12);
            const targetAnkleL = sinL > 0 ? (-sinL * 0.40) : (cosL * 0.20);

            leftLeg.hipGroup.rotation.z  = THREE.MathUtils.lerp(leftLeg.hipGroup.rotation.z,  targetHipL,   dt * 36);
            leftLeg.kneeGroup.rotation.z = THREE.MathUtils.lerp(leftLeg.kneeGroup.rotation.z, targetKneeL,  dt * 36);
            if (leftLeg.ankleGroup) leftLeg.ankleGroup.rotation.z = THREE.MathUtils.lerp(leftLeg.ankleGroup.rotation.z, targetAnkleL, dt * 36);

            // ── Right Leg (Far - 180° out of phase) ──────────────────────
            const sinR = Math.sin(theta + Math.PI);
            const cosR = Math.cos(theta + Math.PI);
            const targetHipR   = sinR * 0.82;
            const targetKneeR  = cosR > 0 ? (cosR * 0.92 + 0.08) : (-cosR * 0.12);
            const targetAnkleR = sinR > 0 ? (-sinR * 0.40) : (cosR * 0.20);

            rightLeg.hipGroup.rotation.z  = THREE.MathUtils.lerp(rightLeg.hipGroup.rotation.z,  targetHipR,   dt * 36);
            rightLeg.kneeGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.kneeGroup.rotation.z, targetKneeR,  dt * 36);
            if (rightLeg.ankleGroup) rightLeg.ankleGroup.rotation.z = THREE.MathUtils.lerp(rightLeg.ankleGroup.rotation.z, targetAnkleR, dt * 36);

            // ── Body Dynamics (Bob + Lean) ───────────────────────────────
            const bodyBob   = -Math.abs(Math.sin(theta)) * 0.16 + 0.08;
            const bodyPitch = Math.sin(theta * 2 - 0.4) * 0.05 - 0.06;

            if (e.dinoGroup) {
              e.dinoGroup.position.y = THREE.MathUtils.lerp(e.dinoGroup.position.y, e.posY + bodyBob, dt * 26);
              e.dinoGroup.rotation.z = THREE.MathUtils.lerp(e.dinoGroup.rotation.z, bodyPitch, dt * 24);
            }

            // ── Head Nod ─────────────────────────────────────────────────
            if (headGroup) {
              headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, Math.sin(theta * 2 + 0.3) * 0.07, dt * 25);
            }

            // ── Counter-Swinging Arms ────────────────────────────────────
            if (armNear) armNear.rotation.z = THREE.MathUtils.lerp(armNear.rotation.z, -sinL * 0.65, dt * 28);
            if (armFar)  armFar.rotation.z  = THREE.MathUtils.lerp(armFar.rotation.z,   sinL * 0.65, dt * 28);

            // ── Articulated 4-Segment Tail Counter-Wave ──────────────────
            if (tailBase) tailBase.rotation.z = THREE.MathUtils.lerp(tailBase.rotation.z, Math.sin(theta * 2 - 0.5) * 0.08, dt * 24);
            if (tailMid1) tailMid1.rotation.z = THREE.MathUtils.lerp(tailMid1.rotation.z, Math.sin(theta * 2 - 1.0) * 0.12, dt * 24);
            if (tailMid2) tailMid2.rotation.z = THREE.MathUtils.lerp(tailMid2.rotation.z, Math.sin(theta * 2 - 1.5) * 0.16, dt * 24);
            if (tailTip)  tailTip.rotation.z  = THREE.MathUtils.lerp(tailTip.rotation.z,  Math.sin(theta * 2 - 2.0) * 0.22, dt * 24);
          }

          // Jaw: opens wide during boost
          if (jawGroup) {
            const tj = e.boostTimer > 0 ? 0.48 : 0.02;
            jawGroup.rotation.z = THREE.MathUtils.lerp(jawGroup.rotation.z, tj, dt * 14);
          }
        }

        // Shield
        if (e.shieldMesh){ e.shieldMesh.material.opacity=THREE.MathUtils.lerp(e.shieldMesh.material.opacity,e.shieldActive?0.38:0,dt*7); if(e.shieldActive){e.shieldMesh.rotation.y+=dt*2;e.shieldMesh.rotation.z+=dt;} }
        if (e.boostTrailMesh&&e.boostTimer>0) e.boostTrailMesh.material.opacity=0.7+Math.sin(now*0.04)*0.3;

        // ── Ground Scroll (X-axis) ───────────────────────────────────────
        e.groundSegs.forEach(seg=>{ seg.group.position.x-=dx; if(seg.group.position.x<-160) seg.group.position.x+=400; });

        // ── Obstacle Spawn ───────────────────────────────────────────────
        e.nextObsDist-=dx;
        if (e.nextObsDist<=0){
          const sx=95+Math.random()*15;
          const isPtero=e.dist>200&&Math.random()>0.52;
          if (isPtero){ const alts=['low','mid','high']; const o=createPterodactyl(alts[Math.floor(Math.random()*3)],sx); e.scene.add(o.group); e.obstacles.push(o); }
          else { const types=['single','twin','triple','giant']; const o=createCactus(types[Math.floor(Math.random()*4)],sx); e.scene.add(o.group); e.obstacles.push(o); }
          e.nextObsDist=Math.max(22,40-e.speed*0.40)+Math.random()*14;
        }

        // ── Collectible Spawn ────────────────────────────────────────────
        e.nextColDist-=dx;
        if (e.nextColDist<=0){
          const sx=90+Math.random()*10;
          const r=Math.random();
          const t=r<0.46?'egg':r<0.70?'bone':r<0.82?'shield':r<0.92?'boost':'slowmo';
          const item=createCollectible(t,sx); e.scene.add(item.group); e.collectibles.push(item);
          e.nextColDist=24+Math.random()*28;
        }

        // ── Fair Hitbox & Collision Detection ────────────────────────────
        const isDuck   = e.dinoState === 'ducking';
        const dinoMinY = e.posY + (isDuck ? 0.0 : 0.15);
        const dinoMaxY = e.posY + (isDuck ? 1.35 : 3.90);
        const dinoCX   = 0.65;  // dino effective torso center-X

        for (let i=e.obstacles.length-1;i>=0;i--){
          const obs=e.obstacles[i];
          obs.x-=dx; obs.group.position.x=obs.x;

          // Pterodactyl wing flap
          if (obs.type==='pterodactyl'){
            obs.flapPhase+=dt*10;
            const fl=Math.sin(obs.flapPhase)>0?0.55:-0.55;
            if (obs.leftWing) obs.leftWing.rotation.x=fl;
            if (obs.rightWing) obs.rightWing.rotation.x=-fl;
          }

          // Fair collision margin (doesn't unfairly punish close near-misses)
          const hitMarginX = 0.18;
          const xOvr = obs.x > dinoCX - (obs.width * 0.42) - hitMarginX && obs.x < dinoCX + (obs.width * 0.42) + hitMarginX;

          if (xOvr){
            let hit=false;
            if (obs.type==='cactus') hit = dinoMinY < (obs.height - 0.22);
            else if (obs.altType==='low') hit = dinoMinY < (obs.altY + 0.55);
            else if (obs.altType==='mid') hit = !isDuck && (dinoMaxY > obs.altY - 0.35);
            else hit = dinoMaxY > (obs.altY - 0.20);

            if (hit){
              if (e.boostTimer>0){ e.scene.remove(obs.group); e.obstacles.splice(i,1); e.obstaclesPassed++; if(e.sound)playDinoCollectSound(); }
              else if (e.shieldActive){ e.shieldActive=false; setActivePowerup(null); e.scene.remove(obs.group); e.obstacles.splice(i,1); if(e.sound)playDinoHitSound(); }
              else { triggerGameOver(); break; }
            }
          }
          if (obs.x<-15){ e.obstaclesPassed++; e.scene.remove(obs.group); e.obstacles.splice(i,1); }
        }

        // Collectibles
        for (let i=e.collectibles.length-1;i>=0;i--){
          const item=e.collectibles[i];
          item.x-=dx; item.group.position.x=item.x;
          // Rotate collectible cube
          if (item.mesh?.rotation) item.mesh.rotation.y+=dt*2.5;
          // Bob up/down
          item.group.position.y=item.y+Math.sin(now*0.003+item.x)*0.18;

          const xOvr=Math.abs(item.x-dinoCX)<1.9, yOvr=Math.abs(item.y-(e.posY+2.5))<2.6;
          if (xOvr&&yOvr&&!item.collected){
            item.collected=true; e.scene.remove(item.group); e.collectibles.splice(i,1);
            if (item.type==='egg'){ e.roundCoins+=1; e.score+=50; setRoundCoins(e.roundCoins); if(e.sound)playDinoCollectSound(); }
            else if (item.type==='bone'){ e.roundCoins+=2; e.score+=100; setRoundCoins(e.roundCoins); if(e.sound)playDinoCollectSound(); }
            else if (item.type==='shield'){ e.shieldActive=true; setActivePowerup('shield'); setPowerupTimeLeft(999); if(e.sound)playDinoPowerupSound(); }
            else if (item.type==='boost'){ e.boostTimer=6; setActivePowerup('boost'); setPowerupTimeLeft(6); if(e.sound)playDinoRoarSound(); }
            else { e.slowmoTimer=7; setActivePowerup('slowmo'); setPowerupTimeLeft(7); if(e.sound)playDinoPowerupSound(); }
            continue;
          }
          if (item.x<-15){ e.scene.remove(item.group); e.collectibles.splice(i,1); }
        }

        // AI Autopilot
        if (e.ai){
          let nearest=null,nearDist=999;
          e.obstacles.forEach(o=>{ if(o.x>0&&o.x<nearDist){ nearDist=o.x; nearest=o; } });
          if (nearest){
            const jt=es*0.5;
            if (nearest.type==='cactus'){ if(nearDist<=jt&&e.isGrounded) handleJump(); }
            else if (nearest.altType==='low'&&nearDist<=jt&&e.isGrounded) handleJump();
            else if (nearest.altType==='mid'&&nearDist<=es*0.65) e.dinoState='ducking';
            else if (nearest.altType==='mid'&&nearDist<-5&&e.dinoState==='ducking') e.dinoState='running';
          }
        }
      }

      if (e.renderer&&e.scene&&e.camera) e.renderer.render(e.scene,e.camera);
    };

    e.animId=requestAnimationFrame(animate);
    return ()=>{ if (e.animId) cancelAnimationFrame(e.animId); };
  },[gameState,handleJump,createCactus,createPterodactyl,createCollectible,triggerGameOver]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className={`dino-container ${isMilestone?'milestone-flash':''}`}>
      <div className="dino-viewport" ref={mountRef} tabIndex="0"/>

      <header className="dino-header">
        <div className="dino-nav-left">
          <Link to="/" className="dino-back-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Hub</span>
          </Link>
          <div className="dino-title-badge"><span>🦖</span><span className="dino-badge-text">3D PIXEL DINO</span></div>
        </div>
        <div className="dino-score-panel">
          <div className="dino-score-group"><span className="dino-score-label">HI</span><span className="dino-score-val dino-high-val">{String(highScore).padStart(5,'0')}</span></div>
          <div className="dino-score-group current-score"><span className="dino-score-val">{String(score).padStart(5,'0')}</span><span className="dino-unit">m</span></div>
          <div className="dino-score-group coins-group"><span className="dino-coin-icon">🪙</span><span className="dino-coin-val">{coins+roundCoins}</span></div>
        </div>
        <div className="dino-controls-right">
          <button className={`dino-tool-btn ${aiAutopilot?'active-ai':''}`} onClick={()=>setAiAutopilot(p=>!p)}>🤖 <span>{aiAutopilot?'AI:ON':'AI:OFF'}</span></button>
          <button className="dino-tool-btn" onClick={()=>setSoundEnabled(p=>!p)}>{soundEnabled?'🔊':'🔇'}</button>
          <div className="dino-fps-badge">{fps}fps</div>
        </div>
      </header>

      {activePowerup && (
        <div className={`dino-powerup-pill ${activePowerup}`}>
          {activePowerup==='shield'&&'🛡️ SHIELD ACTIVE'}
          {activePowerup==='boost' &&`🚀 HYPER BOOST (${powerupTimeLeft}s)`}
          {activePowerup==='slowmo'&&`⏳ TIME DILATION (${powerupTimeLeft}s)`}
        </div>
      )}

      {gameState==='idle' && (
        <div className="dino-overlay idle-overlay">
          <div className="dino-modal-card">
            <div className="dino-hero-icon">🦖</div>
            <h1 className="dino-game-title">PIXEL T-REX 3D</h1>
            <p className="dino-game-subtitle">Chrome Dino · Voxel 3D · Pixel Animation</p>

            <div className="dino-skin-selector">
              <span className="selector-title">SELECT SKIN</span>
              <div className="skins-grid">
                {DINO_SKINS.map(s=>(
                  <button key={s.id} className={`skin-btn ${selectedSkin.id===s.id?'active':''}`} onClick={()=>setSelectedSkin(s)}>
                    <span className="skin-icon">{s.icon}</span>
                    <span className="skin-name">{s.name}</span>
                    <span className="skin-tag">{s.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="dino-mode-selector">
              <span className="selector-title">GAME MODE</span>
              <div className="modes-row">
                {GAME_MODES.map(m=>(
                  <button key={m.id} className={`mode-btn ${gameMode===m.id?'active':''}`} onClick={()=>setGameMode(m.id)}>
                    <span className="mode-icon">{m.icon}</span>
                    <div className="mode-text"><strong>{m.title}</strong><small>{m.desc}</small></div>
                  </button>
                ))}
              </div>
            </div>

            <button className="dino-start-btn" onClick={startGame}>
              <span>PRESS SPACE OR CLICK TO RUN</span>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div className="dino-quick-tips">
              <span>⌨️ <b>Space/↑</b> Jump</span>
              <span>⌨️ <b>↓/S</b> Duck</span>
              <span>⌨️ <b>A</b> AI Pilot</span>
            </div>
          </div>
        </div>
      )}

      {gameState==='gameover' && (
        <div className="dino-overlay gameover-overlay">
          <div className="dino-modal-card gameover-card">
            <div className="gameover-skull">💥</div>
            <h2 className="gameover-title">GAME OVER</h2>
            <div className="gameover-stats-grid">
              <div className="g-stat-box"><span className="g-label">DISTANCE</span><span className="g-val">{score}m</span></div>
              <div className="g-stat-box highlight"><span className="g-label">BEST</span><span className="g-val">{highScore}m</span></div>
              <div className="g-stat-box"><span className="g-label">COINS</span><span className="g-val">+{roundCoins}🪙</span></div>
              <div className="g-stat-box"><span className="g-label">DODGED</span><span className="g-val">{eng.current.obstaclesPassed}</span></div>
            </div>
            <div className="gameover-actions">
              <button className="dino-replay-btn" onClick={startGame}>
                <span>PLAY AGAIN</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
                </svg>
              </button>
              <Link to="/profile" className="dino-profile-link">View Profile & XP</Link>
            </div>
          </div>
        </div>
      )}

      <div className="dino-touch-controls">
        <button className="touch-btn duck-touch-btn"
          onTouchStart={ev=>{ev.preventDefault();handleDuckStart();}}
          onTouchEnd={ev=>{ev.preventDefault();handleDuckEnd();}}
          onMouseDown={handleDuckStart} onMouseUp={handleDuckEnd}>
          <span>DUCK ⬇️</span>
        </button>
        <button className="touch-btn jump-touch-btn"
          onTouchStart={ev=>{ev.preventDefault();gameState==='running'?handleJump():startGame();}}
          onMouseDown={()=>gameState==='running'?handleJump():startGame()}>
          <span>JUMP ⬆️</span>
        </button>
      </div>
    </div>
  );
}

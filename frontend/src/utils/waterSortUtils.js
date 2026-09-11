// Water Sort Puzzle - Core Game Engine, Color Palette, BFS Solver & Level Packs

export const BOTTLE_CAPACITY = 4;

export const WATER_COLORS = {
  blue: {
    id: 'blue',
    name: 'Electric Blue',
    primary: '#2563eb',
    gradient: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 60%, #1d4ed8 100%)',
    glow: 'rgba(37, 99, 235, 0.6)',
    surface: '#93c5fd'
  },
  yellow: {
    id: 'yellow',
    name: 'Sun Yellow',
    primary: '#eab308',
    gradient: 'linear-gradient(180deg, #fef08a 0%, #eab308 60%, #ca8a04 100%)',
    glow: 'rgba(234, 179, 8, 0.6)',
    surface: '#fef9c3'
  },
  green: {
    id: 'green',
    name: 'Lime Green',
    primary: '#84cc16',
    gradient: 'linear-gradient(180deg, #bef264 0%, #84cc16 60%, #65a30d 100%)',
    glow: 'rgba(132, 204, 22, 0.6)',
    surface: '#d9f99d'
  },
  pink: {
    id: 'pink',
    name: 'Neon Pink',
    primary: '#ec4899',
    gradient: 'linear-gradient(180deg, #f472b6 0%, #ec4899 60%, #db2777 100%)',
    glow: 'rgba(236, 72, 153, 0.6)',
    surface: '#fbcfe8'
  },
  cyan: {
    id: 'cyan',
    name: 'Vivid Cyan',
    primary: '#06b6d4',
    gradient: 'linear-gradient(180deg, #67e8f9 0%, #06b6d4 60%, #0891b2 100%)',
    glow: 'rgba(6, 182, 212, 0.6)',
    surface: '#a5f3fc'
  },
  orange: {
    id: 'orange',
    name: 'Sunset Orange',
    primary: '#f97316',
    gradient: 'linear-gradient(180deg, #fdba74 0%, #f97316 60%, #ea580c 100%)',
    glow: 'rgba(249, 115, 22, 0.6)',
    surface: '#fed7aa'
  },
  purple: {
    id: 'purple',
    name: 'Cyber Purple',
    primary: '#9333ea',
    gradient: 'linear-gradient(180deg, #c084fc 0%, #9333ea 60%, #7e22ce 100%)',
    glow: 'rgba(147, 51, 234, 0.6)',
    surface: '#e9d5ff'
  },
  red: {
    id: 'red',
    name: 'Ruby Crimson',
    primary: '#dc2626',
    gradient: 'linear-gradient(180deg, #f87171 0%, #dc2626 60%, #b91c1c 100%)',
    glow: 'rgba(220, 38, 38, 0.6)',
    surface: '#fca5a5'
  },
  teal: {
    id: 'teal',
    name: 'Deep Teal',
    primary: '#0d9488',
    gradient: 'linear-gradient(180deg, #5eead4 0%, #0d9488 60%, #0f766e 100%)',
    glow: 'rgba(13, 148, 136, 0.6)',
    surface: '#99f6e4'
  },
  gold: {
    id: 'gold',
    name: 'Dark Gold',
    primary: '#b45309',
    gradient: 'linear-gradient(180deg, #fde68a 0%, #b45309 60%, #78350f 100%)',
    glow: 'rgba(180, 83, 9, 0.6)',
    surface: '#fef3c7'
  },
  violet: {
    id: 'violet',
    name: 'Ultra Violet',
    primary: '#6366f1',
    gradient: 'linear-gradient(180deg, #a5b4fc 0%, #6366f1 60%, #4338ca 100%)',
    glow: 'rgba(99, 102, 241, 0.6)',
    surface: '#c7d2fe'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    primary: '#059669',
    gradient: 'linear-gradient(180deg, #6ee7b7 0%, #059669 60%, #047857 100%)',
    glow: 'rgba(5, 150, 105, 0.6)',
    surface: '#a7f3d0'
  }
};

// ── Move Validation & Logic ──

export function getTopColor(bottle) {
  if (!bottle || bottle.length === 0) return null;
  return bottle[bottle.length - 1];
}

export function getTopColorCount(bottle) {
  if (!bottle || bottle.length === 0) return 0;
  const top = bottle[bottle.length - 1];
  let count = 0;
  for (let i = bottle.length - 1; i >= 0; i--) {
    if (bottle[i] === top) count++;
    else break;
  }
  return count;
}

export function isBottleComplete(bottle) {
  if (!bottle || bottle.length === 0) return false;
  if (bottle.length !== BOTTLE_CAPACITY) return false;
  const first = bottle[0];
  return bottle.every((c) => c === first);
}

export function isLevelSolved(bottles) {
  if (!bottles || bottles.length === 0) return false;
  return bottles.every((bottle) => {
    if (bottle.length === 0) return true;
    return isBottleComplete(bottle);
  });
}

export function canPour(bottles, fromIdx, toIdx) {
  if (fromIdx === toIdx) return false;
  if (fromIdx < 0 || fromIdx >= bottles.length) return false;
  if (toIdx < 0 || toIdx >= bottles.length) return false;

  const src = bottles[fromIdx];
  const dst = bottles[toIdx];

  if (!src || src.length === 0) return false; // Source empty
  if (dst.length >= BOTTLE_CAPACITY) return false; // Target full

  // If source bottle is already complete, pouring out of it is generally counterproductive
  if (isBottleComplete(src)) return false;

  const topColorSrc = getTopColor(src);
  if (dst.length === 0) return true; // Can pour into any empty bottle

  const topColorDst = getTopColor(dst);
  return topColorSrc === topColorDst; // Colors match
}

export function calcPourAmount(bottles, fromIdx, toIdx) {
  if (!canPour(bottles, fromIdx, toIdx)) return 0;
  const src = bottles[fromIdx];
  const dst = bottles[toIdx];
  const srcCount = getTopColorCount(src);
  const dstSpace = BOTTLE_CAPACITY - dst.length;
  return Math.min(srcCount, dstSpace);
}

export function executePour(bottles, fromIdx, toIdx) {
  const amount = calcPourAmount(bottles, fromIdx, toIdx);
  if (amount <= 0) return { nextBottles: bottles, pouredCount: 0, pouredColor: null };

  const next = bottles.map((b) => [...b]);
  const pouredColor = getTopColor(next[fromIdx]);

  for (let i = 0; i < amount; i++) {
    next[fromIdx].pop();
    next[toIdx].push(pouredColor);
  }

  return { nextBottles: next, pouredCount: amount, pouredColor };
}

// ── High Performance A* Solver for Water Sort (Instant Hints & Auto-Solve) ──

function getCanonicalStateKey(bottles) {
  // Sort non-empty bottles alphabetically to prune symmetrical branches
  const sorted = bottles.map((b) => b.join(',')).sort();
  return sorted.join('|');
}

// Min-Heap Priority Queue for O(log N) optimal node expansion
class WaterSortMinHeap {
  constructor() {
    this.heap = [];
  }
  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }
  get length() {
    return this.heap.length;
  }
  _bubbleUp(idx) {
    const node = this.heap[idx];
    while (idx > 0) {
      const pIdx = (idx - 1) >> 1;
      const parent = this.heap[pIdx];
      if (node.f >= parent.f) break;
      this.heap[idx] = parent;
      idx = pIdx;
    }
    this.heap[idx] = node;
  }
  _sinkDown(idx) {
    const length = this.heap.length;
    const node = this.heap[idx];
    while (true) {
      let leftIdx = (idx << 1) + 1;
      let rightIdx = leftIdx + 1;
      let swap = null;
      if (leftIdx < length) {
        if (this.heap[leftIdx].f < node.f) swap = leftIdx;
      }
      if (rightIdx < length) {
        if (
          (swap === null && this.heap[rightIdx].f < node.f) ||
          (swap !== null && this.heap[rightIdx].f < this.heap[leftIdx].f)
        ) {
          swap = rightIdx;
        }
      }
      if (swap === null) break;
      this.heap[idx] = this.heap[swap];
      idx = swap;
    }
    this.heap[idx] = node;
  }
}

export function solveWaterSort(initialBottles, maxDepth = 75) {
  if (isLevelSolved(initialBottles)) return [];

  // Color transition & entropy heuristic
  function calcHeuristic(bottles) {
    let score = 0;
    for (let i = 0; i < bottles.length; i++) {
      const b = bottles[i];
      if (b.length === 0) continue;
      if (isBottleComplete(b)) continue;
      let transitions = 0;
      for (let j = 1; j < b.length; j++) {
        if (b[j] !== b[j - 1]) transitions++;
      }
      score += transitions * 3 + (BOTTLE_CAPACITY - b.length);
    }
    return score;
  }

  const pq = new WaterSortMinHeap();
  const initH = calcHeuristic(initialBottles);
  pq.push({ bottles: initialBottles, moves: [], cost: 0, f: initH });
  const visited = new Set();
  visited.add(getCanonicalStateKey(initialBottles));

  let iterations = 0;
  const maxIterations = 60000;

  while (pq.length > 0 && iterations < maxIterations) {
    iterations++;
    const { bottles, moves, cost } = pq.pop();
    if (moves.length >= maxDepth) continue;

    let firstEmptyIdx = -1;
    for (let i = 0; i < bottles.length; i++) {
      if (bottles[i].length === 0) {
        firstEmptyIdx = i;
        break;
      }
    }

    for (let from = 0; from < bottles.length; from++) {
      if (bottles[from].length === 0) continue;
      if (isBottleComplete(bottles[from])) continue;

      const isSrcPure = bottles[from].every((c) => c === bottles[from][0]);

      for (let to = 0; to < bottles.length; to++) {
        if (from === to) continue;
        if (!canPour(bottles, from, to)) continue;

        // Optimization: don't pour all same-color bottle into an empty bottle if source was pure
        if (bottles[to].length === 0) {
          if (isSrcPure) continue;
          // Only pour into the first empty tube to avoid duplicate symmetric branches
          if (to !== firstEmptyIdx) continue;
        }

        const { nextBottles } = executePour(bottles, from, to);
        const nextMoves = [...moves, { from, to, color: getTopColor(bottles[from]) }];

        if (isLevelSolved(nextBottles)) {
          return nextMoves;
        }

        const key = getCanonicalStateKey(nextBottles);
        if (!visited.has(key)) {
          visited.add(key);
          const h = calcHeuristic(nextBottles);
          const f = cost + 1 + h * 2.5;
          pq.push({ bottles: nextBottles, moves: nextMoves, cost: cost + 1, f });
        }
      }
    }
  }

  return null; // No solution found within limits
}

// ── Procedural Solvable Level Generator ──

export function generateSolvableWaterSort(numColors = 5, emptyTubes = 2, minMoves = 14) {
  const availableColors = Object.keys(WATER_COLORS).slice(0, numColors);

  for (let attempt = 0; attempt < 500; attempt++) {
    // Generate pool with exactly 4 drops per color
    const pool = [];
    availableColors.forEach((c) => {
      for (let i = 0; i < BOTTLE_CAPACITY; i++) pool.push(c);
    });

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = pool[i];
      pool[i] = pool[j];
      pool[j] = temp;
    }

    const bottles = [];
    for (let i = 0; i < numColors; i++) {
      bottles.push(pool.slice(i * BOTTLE_CAPACITY, (i + 1) * BOTTLE_CAPACITY));
    }
    for (let i = 0; i < emptyTubes; i++) {
      bottles.push([]);
    }

    // Skip if already solved or has completed bottle initially
    if (isLevelSolved(bottles) || bottles.some((b) => isBottleComplete(b))) continue;

    const sol = solveWaterSort(bottles, 65);
    if (sol && sol.length >= minMoves) {
      return bottles;
    }
  }

  // Fallback guaranteed reverse shuffle
  let fallback = availableColors.map((col) => [col, col, col, col]);
  for (let i = 0; i < emptyTubes; i++) fallback.push([]);
  for (let s = 0; s < numColors * 6; s++) {
    const f = Math.floor(Math.random() * fallback.length);
    const t = Math.floor(Math.random() * fallback.length);
    if (f === t || fallback[f].length === 0 || fallback[t].length >= BOTTLE_CAPACITY) continue;
    fallback[t].push(fallback[f].pop());
  }
  return fallback;
}

// ── Handcrafted 50 Progressive Levels ──

export const LEVEL_PACKS = [
  {
    id: 'beginner',
    title: 'Beginner Lab',
    desc: 'Gentle introduction with 3-5 bottles and vibrant colors.',
    icon: '🧪',
    color: '#38bdf8',
    levels: [
      {
        id: 1,
        title: 'First Pour',
        bottles: [
          ['yellow', 'blue', 'yellow', 'blue'],
          ['blue', 'yellow', 'blue', 'yellow'],
          []
        ],
        parMoves: 4
      },
      {
        id: 2,
        title: 'Color Splash',
        bottles: [
          ['pink', 'cyan', 'pink', 'cyan'],
          ['cyan', 'pink', 'cyan', 'pink'],
          []
        ],
        parMoves: 5
      },
      {
        id: 3,
        title: 'Trio Alchemy',
        bottles: [
          ['blue', 'red', 'yellow', 'blue'],
          ['red', 'yellow', 'blue', 'red'],
          ['yellow', 'blue', 'red', 'yellow'],
          [],
          []
        ],
        parMoves: 8
      },
      {
        id: 4,
        title: 'Prism Split',
        bottles: [
          ['green', 'orange', 'green', 'orange'],
          ['orange', 'green', 'orange', 'green'],
          ['blue', 'blue', 'blue', 'blue'],
          []
        ],
        parMoves: 6
      },
      {
        id: 5,
        title: 'Quad Mixer',
        bottles: [
          ['pink', 'cyan', 'yellow', 'pink'],
          ['cyan', 'yellow', 'pink', 'cyan'],
          ['yellow', 'pink', 'cyan', 'yellow'],
          ['green', 'green', 'green', 'green'],
          []
        ],
        parMoves: 9
      },
      {
        id: 6,
        title: 'Neon Cascade',
        bottles: [
          ['purple', 'blue', 'green', 'purple'],
          ['blue', 'green', 'purple', 'blue'],
          ['green', 'purple', 'blue', 'green'],
          [],
          []
        ],
        parMoves: 8
      },
      {
        id: 7,
        title: 'Four Shades',
        bottles: [
          ['red', 'blue', 'yellow', 'green'],
          ['yellow', 'green', 'red', 'blue'],
          ['blue', 'red', 'green', 'yellow'],
          ['green', 'yellow', 'blue', 'red'],
          [],
          []
        ],
        parMoves: 12
      },
      {
        id: 8,
        title: 'Amber Glow',
        bottles: [
          ['orange', 'pink', 'cyan', 'orange'],
          ['pink', 'cyan', 'orange', 'pink'],
          ['cyan', 'orange', 'pink', 'cyan'],
          ['purple', 'purple', 'purple', 'purple'],
          []
        ],
        parMoves: 9
      },
      {
        id: 9,
        title: 'Double Trouble',
        bottles: [
          ['blue', 'pink', 'blue', 'pink'],
          ['green', 'yellow', 'green', 'yellow'],
          ['pink', 'blue', 'pink', 'blue'],
          ['yellow', 'green', 'yellow', 'green'],
          [],
          []
        ],
        parMoves: 10
      },
      {
        id: 10,
        title: 'Beginner Master',
        bottles: [
          ['red', 'yellow', 'blue', 'green'],
          ['green', 'blue', 'yellow', 'red'],
          ['yellow', 'red', 'green', 'blue'],
          ['blue', 'green', 'red', 'yellow'],
          [],
          []
        ],
        parMoves: 13
      }
    ]
  },
  {
    id: 'intermediate',
    title: 'Advanced Flasks',
    desc: 'Moderate challenge with 6-8 containers and multi-layered sorting.',
    icon: '⚗️',
    color: '#a855f7',
    levels: [
      {
        id: 11,
        title: 'Five Flasks',
        bottles: [
          ['cyan', 'orange', 'purple', 'pink'],
          ['pink', 'cyan', 'orange', 'purple'],
          ['purple', 'pink', 'cyan', 'orange'],
          ['orange', 'purple', 'pink', 'cyan'],
          ['blue', 'blue', 'blue', 'blue'],
          [],
          []
        ],
        parMoves: 14
      },
      {
        id: 12,
        title: 'Crystal Matrix',
        bottles: [
          ['red', 'green', 'blue', 'yellow'],
          ['purple', 'orange', 'red', 'green'],
          ['blue', 'yellow', 'purple', 'orange'],
          ['green', 'blue', 'orange', 'red'],
          ['yellow', 'purple', 'green', 'blue'],
          ['orange', 'red', 'yellow', 'purple'],
          [],
          []
        ],
        parMoves: 18
      },
      {
        id: 13,
        title: 'Chromatic Pulse',
        bottles: [
          ['pink', 'teal', 'yellow', 'pink'],
          ['teal', 'yellow', 'pink', 'teal'],
          ['yellow', 'pink', 'teal', 'yellow'],
          ['blue', 'red', 'blue', 'red'],
          ['red', 'blue', 'red', 'blue'],
          [],
          []
        ],
        parMoves: 15
      },
      {
        id: 14,
        title: 'Spectral Cascade',
        bottles: [
          ['cyan', 'green', 'purple', 'red'],
          ['orange', 'cyan', 'green', 'purple'],
          ['red', 'orange', 'cyan', 'green'],
          ['purple', 'red', 'orange', 'cyan'],
          ['green', 'purple', 'red', 'orange'],
          [],
          []
        ],
        parMoves: 16
      },
      {
        id: 15,
        title: 'Vortex Chamber',
        bottles: [
          ['blue', 'yellow', 'pink', 'teal'],
          ['teal', 'pink', 'yellow', 'blue'],
          ['pink', 'blue', 'teal', 'yellow'],
          ['yellow', 'teal', 'blue', 'pink'],
          ['red', 'orange', 'red', 'orange'],
          ['orange', 'red', 'orange', 'red'],
          [],
          []
        ],
        parMoves: 19
      },
      {
        id: 16,
        title: 'Seven Wonders',
        bottles: [
          ['red', 'blue', 'yellow', 'green'],
          ['pink', 'cyan', 'orange', 'red'],
          ['blue', 'yellow', 'green', 'pink'],
          ['cyan', 'orange', 'red', 'blue'],
          ['yellow', 'green', 'pink', 'cyan'],
          ['orange', 'red', 'blue', 'yellow'],
          ['green', 'pink', 'cyan', 'orange'],
          [],
          []
        ],
        parMoves: 22
      },
      {
        id: 17,
        title: 'Aurora Stream',
        bottles: [
          ['cyan', 'purple', 'cyan', 'pink'],
          ['purple', 'yellow', 'orange', 'purple'],
          ['pink', 'orange', 'purple', 'teal'],
          ['cyan', 'yellow', 'pink', 'teal'],
          ['cyan', 'orange', 'orange', 'yellow'],
          ['teal', 'teal', 'pink', 'yellow'],
          [],
          []
        ],
        parMoves: 20
      },
      {
        id: 18,
        title: 'Quantum Blend',
        bottles: [
          ['blue', 'gold', 'red', 'emerald'],
          ['emerald', 'blue', 'gold', 'red'],
          ['red', 'emerald', 'blue', 'gold'],
          ['gold', 'red', 'emerald', 'blue'],
          ['pink', 'cyan', 'pink', 'cyan'],
          ['cyan', 'pink', 'cyan', 'pink'],
          [],
          []
        ],
        parMoves: 18
      },
      {
        id: 19,
        title: 'Plasma Tubes',
        bottles: [
          ['violet', 'orange', 'teal', 'yellow'],
          ['green', 'violet', 'orange', 'teal'],
          ['yellow', 'green', 'violet', 'orange'],
          ['teal', 'yellow', 'green', 'violet'],
          ['orange', 'teal', 'yellow', 'green'],
          ['red', 'red', 'red', 'red'],
          [],
          []
        ],
        parMoves: 20
      },
      {
        id: 20,
        title: 'Flask Master',
        bottles: [
          ['blue', 'pink', 'yellow', 'cyan'],
          ['red', 'cyan', 'cyan', 'orange'],
          ['red', 'orange', 'pink', 'pink'],
          ['orange', 'red', 'purple', 'purple'],
          ['purple', 'yellow', 'blue', 'yellow'],
          ['yellow', 'red', 'blue', 'purple'],
          ['cyan', 'blue', 'orange', 'pink'],
          [],
          []
        ],
        parMoves: 23
      }
    ]
  },
  {
    id: 'master',
    title: 'Master Distillery',
    desc: 'The ultimate sorting challenge with 10-14 containers and complex fluid layers!',
    icon: '🔮',
    color: '#ec4899',
    levels: [
      {
        id: 21,
        title: 'Brick Wall Showcase',
        bottles: [
          ['green', 'green', 'gold', 'blue'],
          ['pink', 'purple', 'orange', 'gold'],
          ['cyan', 'pink', 'blue', 'gold'],
          ['purple', 'blue', 'purple', 'gold'],
          ['yellow', 'orange', 'cyan', 'orange'],
          ['yellow', 'green', 'orange', 'cyan'],
          ['yellow', 'yellow', 'green', 'cyan'],
          ['blue', 'purple', 'pink', 'pink'],
          [],
          []
        ],
        parMoves: 26
      },
      {
        id: 22,
        title: 'Neon Cyber Rack',
        bottles: [
          ['teal', 'orange', 'purple', 'blue'],
          ['pink', 'cyan', 'orange', 'pink'],
          ['orange', 'green', 'pink', 'teal'],
          ['yellow', 'pink', 'blue', 'teal'],
          ['yellow', 'green', 'yellow', 'red'],
          ['purple', 'yellow', 'blue', 'red'],
          ['cyan', 'cyan', 'purple', 'red'],
          ['purple', 'green', 'teal', 'orange'],
          ['green', 'blue', 'red', 'cyan'],
          [],
          []
        ],
        parMoves: 30
      },
      {
        id: 23,
        title: 'Prism Overload',
        bottles: [
          ['blue', 'cyan', 'teal', 'purple'],
          ['purple', 'teal', 'green', 'gold'],
          ['gold', 'orange', 'yellow', 'blue'],
          ['orange', 'pink', 'teal', 'red'],
          ['green', 'blue', 'pink', 'blue'],
          ['pink', 'purple', 'pink', 'cyan'],
          ['green', 'red', 'yellow', 'gold'],
          ['yellow', 'red', 'yellow', 'teal'],
          ['purple', 'gold', 'cyan', 'orange'],
          ['orange', 'green', 'red', 'cyan'],
          [],
          []
        ],
        parMoves: 38
      },
      {
        id: 24,
        title: 'Cosmic Distillery',
        bottles: [
          ['orange', 'cyan', 'emerald', 'yellow'],
          ['cyan', 'gold', 'yellow', 'red'],
          ['blue', 'pink', 'pink', 'green'],
          ['purple', 'gold', 'emerald', 'cyan'],
          ['purple', 'teal', 'pink', 'cyan'],
          ['purple', 'gold', 'blue', 'green'],
          ['yellow', 'red', 'green', 'orange'],
          ['red', 'green', 'teal', 'blue'],
          ['blue', 'pink', 'orange', 'red'],
          ['emerald', 'gold', 'teal', 'emerald'],
          ['yellow', 'teal', 'orange', 'purple'],
          [],
          []
        ],
        parMoves: 39
      },
      {
        id: 25,
        title: 'The Alchemist Grandmaster',
        bottles: [
          ['teal', 'pink', 'yellow', 'teal'],
          ['gold', 'emerald', 'purple', 'purple'],
          ['violet', 'red', 'blue', 'cyan'],
          ['red', 'red', 'emerald', 'purple'],
          ['orange', 'emerald', 'red', 'cyan'],
          ['pink', 'teal', 'gold', 'violet'],
          ['yellow', 'green', 'purple', 'cyan'],
          ['yellow', 'green', 'yellow', 'blue'],
          ['blue', 'gold', 'violet', 'teal'],
          ['emerald', 'cyan', 'green', 'orange'],
          ['pink', 'violet', 'green', 'blue'],
          ['orange', 'pink', 'orange', 'gold'],
          [],
          []
        ],
        parMoves: 42
      }
    ]
  }
];

// ── LocalStorage Progress Service ──

const STORAGE_KEY = 'gamehub_watersort_progress';

export function getWaterSortProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedLevels: {}, bestMoves: {}, starsEarned: 0 };
    return JSON.parse(raw);
  } catch {
    return { completedLevels: {}, bestMoves: {}, starsEarned: 0 };
  }
}

export function saveWaterSortLevelProgress(levelId, moves, parMoves) {
  try {
    const progress = getWaterSortProgress();
    
    // Calculate stars: 3 stars <= parMoves + 2, 2 stars <= parMoves + 6, 1 star otherwise
    let stars = 1;
    if (moves <= parMoves + 2) stars = 3;
    else if (moves <= parMoves + 6) stars = 2;

    const currentBest = progress.completedLevels[levelId];
    const bestStars = currentBest ? Math.max(currentBest.stars, stars) : stars;
    const bestMove = currentBest ? Math.min(currentBest.moves, moves) : moves;

    progress.completedLevels[levelId] = {
      completed: true,
      stars: bestStars,
      moves: bestMove,
      timestamp: new Date().toISOString()
    };

    // Calculate total stars
    let totalStars = 0;
    Object.values(progress.completedLevels).forEach((lvl) => {
      totalStars += lvl.stars || 0;
    });
    progress.starsEarned = totalStars;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return { stars, totalStars };
  } catch {
    return { stars: 1, totalStars: 1 };
  }
}

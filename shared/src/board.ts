import type { BranchName, ForkOption, Space, SpaceType } from './types'

export const STUDENT_DEBT = 50_000

// ---------------------------------------------------------------------------
// Path sampling: centripetal-ish Catmull-Rom through control points, then
// resampled at (approximately) even arc lengths so tiles are evenly spaced.
// Implemented locally so shared/ has no three.js dependency.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number]

function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t
  const t3 = t2 * t
  const out: Vec3 = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const v0 = (p2[i] - p0[i]) * 0.5
    const v1 = (p3[i] - p1[i]) * 0.5
    out[i] =
      (2 * p1[i] - 2 * p2[i] + v0 + v1) * t3 +
      (-3 * p1[i] + 3 * p2[i] - 2 * v0 - v1) * t2 +
      v0 * t +
      p1[i]
  }
  return out
}

function curvePoint(pts: Vec3[], t: number): Vec3 {
  const n = pts.length - 1
  const raw = Math.min(Math.max(t, 0), 0.9999) * n
  const seg = Math.floor(raw)
  const lt = raw - seg
  const p0 = pts[Math.max(0, seg - 1)]
  const p1 = pts[seg]
  const p2 = pts[Math.min(n, seg + 1)]
  const p3 = pts[Math.min(n, seg + 2)]
  return catmullRom(p0, p1, p2, p3, lt)
}

/** Sample `count` positions along the curve, evenly spaced by arc length. */
function samplePath(pts: Vec3[], count: number): Vec3[] {
  const DENSE = Math.max(200, count * 40)
  const dense: Vec3[] = []
  const cum: number[] = [0]
  for (let i = 0; i <= DENSE; i++) {
    const p = curvePoint(pts, i / DENSE)
    dense.push(p)
    if (i > 0) {
      const q = dense[i - 1]
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
      cum.push(cum[i - 1] + d)
    }
  }
  const total = cum[cum.length - 1]
  const out: Vec3[] = []
  for (let i = 0; i < count; i++) {
    const target = count === 1 ? 0 : (i / (count - 1)) * total
    let lo = 0
    while (lo < cum.length - 1 && cum[lo + 1] < target) lo++
    const span = cum[lo + 1] - cum[lo] || 1
    const f = (target - cum[lo]) / span
    const a = dense[lo]
    const b = dense[Math.min(lo + 1, dense.length - 1)]
    out.push([
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ])
  }
  return out
}

// ---------------------------------------------------------------------------
// Board definition
// ---------------------------------------------------------------------------

interface SegmentDef {
  name: string
  branch: BranchName
  pts: Vec3[]
  types: SpaceType[]
  labels?: Record<number, string>
  collegePool?: boolean
}

const E: SpaceType = 'EVENT'
const P: SpaceType = 'PAYDAY'

const SEGMENTS: SegmentDef[] = [
  {
    name: 'college',
    branch: 'college',
    pts: [
      [-45, 0, 20],
      [-48, 0, 12],
      [-44, 0, 4],
      [-36, 0, 0],
      [-30, 0, 4],
      [-26, 0, 10],
    ],
    types: [E, E, E, 'STOP_CAREER', E, P, E, E, P, E],
    labels: { 3: 'GRADUATION' },
    collegePool: true,
  },
  {
    name: 'work',
    branch: 'work',
    pts: [
      [-43, 0, 27],
      [-36, 0, 29],
      [-29, 0, 26],
      [-25, 0, 20],
      [-25, 0, 14],
    ],
    types: [E, 'STOP_CAREER', E, P, E, E, P],
    labels: { 1: 'FIRST JOB' },
    collegePool: false,
  },
  {
    name: 'mainA',
    branch: 'main',
    pts: [
      [-24, 0, 11],
      [-18, 0, 6],
      [-11, 0, 9],
      [-5, 0, 14],
      [2, 0, 16],
      [8, 0, 12],
      [10, 0, 6],
    ],
    types: [E, P, E, E, 'TAX', E, P, E, 'CRASH', E, E, P, E, 'STOP_MARRIAGE'],
    labels: { 13: 'THE CHAPEL' },
  },
  {
    name: 'mainB',
    branch: 'main',
    pts: [
      [9, 0, 2],
      [4, 0, -3],
      [-3, 0, -6],
      [-10, 0, -10],
      [-8, 0, -17],
      [-1, 0, -20],
      [7, 0, -19],
    ],
    types: [E, E, P, E, 'GAMBLE', E, E, P, E, 'TAX', E, P, E, 'STOP_HOUSE'],
    labels: { 13: 'OPEN HOUSE' },
  },
  {
    name: 'mainC',
    branch: 'main',
    pts: [
      [11, 0, -17],
      [17, 0, -14],
      [22, 0, -10],
      [25, 0, -4],
    ],
    types: [E, P, E, 'CRASH', E, P, E, E, P, E],
    labels: { 9: 'CROSSROADS' },
  },
  {
    name: 'risky',
    branch: 'risky',
    pts: [
      [28, 0, -8],
      [33, 0, -13],
      [39, 0, -11],
      [43, 0, -5],
      [44, 0, 1],
    ],
    types: ['GAMBLE', E, 'GAMBLE', E, 'CRASH', 'GAMBLE', E, P, 'GAMBLE', E, E],
    labels: { 0: 'CASINO STRIP' },
  },
  {
    name: 'safe',
    branch: 'safe',
    pts: [
      [26, 0, 1],
      [24, 0, 8],
      [28, 0, 14],
      [34, 0, 17],
      [40, 0, 14],
      [44, 0, 8],
      [45, 0, 3],
    ],
    types: [E, P, E, E, P, E, 'TAX', E, P, E, E, P, E, 'CRASH', E],
    labels: { 0: 'THE SUBURBS' },
  },
  {
    name: 'mainD',
    branch: 'main',
    pts: [
      [46, 0, -1],
      [44, 0.8, -8],
      [38, 1.8, -13],
      [33, 2.8, -18],
      [28, 3.5, -22],
    ],
    types: [E, P, E, E, 'TAX', E, P, E, E, P, E, 'RETIREMENT'],
    labels: { 11: 'RETIREMENT' },
  },
]

function buildBoard(): { spaces: Space[]; startId: number } {
  const spaces: Space[] = []

  // START space
  const start: Space = {
    id: 0,
    type: 'START',
    next: [],
    pos: [-47, 0, 24],
    branch: 'main',
    label: 'START',
  }
  spaces.push(start)

  const segStart: Record<string, number> = {}
  const segEnd: Record<string, number> = {}

  for (const seg of SEGMENTS) {
    const positions = samplePath(seg.pts, seg.types.length)
    const first = spaces.length
    seg.types.forEach((type, i) => {
      const id = spaces.length
      const space: Space = {
        id,
        type,
        next: [id + 1], // provisional: linked within segment; fixed up below
        pos: positions[i],
        branch: seg.branch,
      }
      if (seg.labels?.[i]) space.label = seg.labels[i]
      if (type === 'STOP_CAREER') space.collegePool = seg.collegePool ?? false
      spaces.push(space)
    })
    segStart[seg.name] = first
    segEnd[seg.name] = spaces.length - 1
  }

  const link = (from: number, to: number[]) => {
    spaces[from].next = to
  }
  const fork = (from: number, options: ForkOption[]) => {
    spaces[from].next = options.map((o) => o.next)
    spaces[from].forkOptions = options
  }

  // START forks into college vs. straight-to-work
  fork(0, [
    {
      label: 'Go to College',
      detail: `Student loans: $${(STUDENT_DEBT / 1000).toFixed(0)}k owed at retirement, but the fancy career pool.`,
      next: segStart.college,
      debt: STUDENT_DEBT,
    },
    {
      label: 'Straight to Work',
      detail: 'No debt, no diploma, no shame. Hustle-tier careers.',
      next: segStart.work,
    },
  ])

  // Both starter branches merge into mainA
  link(segEnd.college, [segStart.mainA])
  link(segEnd.work, [segStart.mainA])

  // mainA -> mainB -> mainC
  link(segEnd.mainA, [segStart.mainB])
  link(segEnd.mainB, [segStart.mainC])

  // mainC ends at the midlife crossroads fork
  fork(segEnd.mainC, [
    {
      label: 'The Vegas Strip',
      detail: 'Shortcut through casino country. High rolls, low decisions.',
      next: segStart.risky,
    },
    {
      label: 'The Suburbs',
      detail: 'The long, safe way. More paydays, mandatory small talk.',
      next: segStart.safe,
    },
  ])

  // risky + safe merge into mainD
  link(segEnd.risky, [segStart.mainD])
  link(segEnd.safe, [segStart.mainD])

  // Retirement is terminal
  link(segEnd.mainD, [])

  return { spaces, startId: 0 }
}

const built = buildBoard()

export const SPACES: Space[] = built.spaces
export const START_ID = built.startId
export const RETIREMENT_ID = SPACES.find((s) => s.type === 'RETIREMENT')!.id

export function spaceById(id: number): Space {
  const s = SPACES[id]
  if (!s) throw new Error(`No such space: ${id}`)
  return s
}

export function isStopSpace(s: Space): boolean {
  return (
    s.type === 'STOP_CAREER' ||
    s.type === 'STOP_MARRIAGE' ||
    s.type === 'STOP_HOUSE' ||
    s.type === 'RETIREMENT'
  )
}

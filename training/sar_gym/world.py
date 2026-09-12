"""GridWorld: the shared world model behind the training environment.

This module is the single source of truth for sensing, pathing, region
partitioning and the observation spec. The ROS deployment node (sar_alloc_rl)
mirrors the observation builders exactly — see docs/interfaces.md.
"""

import heapq
from math import cos, sin

import numpy as np

from .maze_gen import generate_map, reachable_cells

ORTHO = ((1, 0), (-1, 0), (0, 1), (0, -1))
DIAG = ((-1, -1), (-1, 1), (1, -1), (1, 1))


def _far_from(points, cells, min_d):
    """Cells at least min_d (Chebyshev-free, euclidean) away from every point."""
    d2 = min_d * min_d
    return [c for c in cells
            if all((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 >= d2 for p in points)]


class GridWorld:
    def __init__(self, cfg, seed: int):
        self.cfg = cfg
        self.size = cfg.map_size
        self.walls = generate_map(self.size, seed, cfg.n_rooms)
        self.free = ~self.walls

        free_cells = list(zip(*np.nonzero(self.free)))
        reach = reachable_cells(self.walls, free_cells[0])
        self.reach = reach
        reach_list = sorted(reach)

        self.robot_starts = self._spread_points(reach_list, cfg.n_robots, seed + 1)
        victim_pool = _far_from(self.robot_starts, reach_list, min_d=6) or \
            _far_from(self.robot_starts, reach_list, min_d=3) or reach_list
        self.victim_cells = self._spread_points(victim_pool, cfg.n_victims, seed + 2)
        self.n_victims = len(self.victim_cells)
        self.victim_found = np.zeros(self.n_victims, dtype=bool)
        self.victim_detect_step = np.full(self.n_victims, -1, dtype=int)

        # knowledge state
        self.explored = np.zeros((self.size, self.size), dtype=bool)
        self.owner = np.full((self.size, self.size), -1, dtype=np.int8)  # first observer robot
        self.robots = [list(s) for s in self.robot_starts]
        self.assigned_region = [None] * cfg.n_robots
        self.t = 0
        self.overlap_cells = 0

        # caches / lookups (invalidated per env step)
        self._victim_lookup = {cell: i for i, cell in enumerate(self.victim_cells)}
        self._frontier = None
        self._region_frontiers = None
        self._ray_steps = np.arange(0.5, cfg.fov_range + 0.01, 0.5)

        # initial sweep
        for i in range(cfg.n_robots):
            self._sense(i)
        self.invalidate()

    def invalidate(self) -> None:
        self._frontier = None
        self._region_frontiers = None

    # ------------------------------------------------------------- placement
    def _spread_points(self, cells, n, seed, avoid=frozenset()):
        """Farthest-point sampling (seeded) over free `cells`, never on `avoid`.

        Guarantees well-spread starts/victims; no random fallback that could
        place a victim next to a spawn.
        """
        rng = np.random.default_rng(seed)
        pool = [c for c in cells if c not in avoid]
        pts = [pool[int(rng.integers(len(pool)))]]
        while len(pts) < n:
            best, best_d = pool[0], -1.0
            for c in rng.permutation(pool)[:800]:  # subsample for speed
                d = min((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 for p in pts)
                if d > best_d:
                    best, best_d = c, d
            pts.append(best)
        return [tuple(p) for p in pts]

    # --------------------------------------------------------------- sensing
    def _sense(self, robot_idx: int) -> tuple:
        """Raycast FOV sweep. Returns (newly_explored_by_me, overlapped_cells)."""
        r0, c0 = self.robots[robot_idx]
        rng_ = self.cfg.fov_range
        new_for_me, overlap = [], 0
        for k in range(self.cfg.fov_rays):
            ang = 2.0 * np.pi * k / self.cfg.fov_rays
            dr, dc = cos(ang), sin(ang)
            for step in self._ray_steps:
                rr, cc = int(round(r0 + step * dr)), int(round(c0 + step * dc))
                if not (0 <= rr < self.size and 0 <= cc < self.size):
                    break
                if not self.explored[rr, cc]:
                    self.explored[rr, cc] = True
                    if self.owner[rr, cc] == -1:
                        self.owner[rr, cc] = robot_idx
                        new_for_me.append((rr, cc))
                    else:
                        overlap += 1
                if self.walls[rr, cc]:
                    break
                vi = self._victim_lookup.get((rr, cc))
                if vi is not None and not self.victim_found[vi]:
                    self.victim_found[vi] = True
                    self.victim_detect_step[vi] = self.t
        return new_for_me, overlap

    # ------------------------------------------------------------- frontiers
    def frontier_mask(self) -> np.ndarray:
        """Free + explored + adjacent (4-neighbour) to unexplored. Cached per step."""
        if self._frontier is not None:
            return self._frontier
        unknown = ~self.explored
        nb_unknown = np.zeros_like(unknown)
        s = self.size
        nb_unknown |= _shift(unknown, 1, 0, s) | _shift(unknown, -1, 0, s) \
            | _shift(unknown, 0, 1, s) | _shift(unknown, 0, -1, s)
        self._frontier = self.free & self.explored & nb_unknown
        return self._frontier

    def region_id(self, r: int, c: int) -> int:
        ry, rx = self.cfg.region_grid
        rh, rw = self.size // ry, self.size // rx
        return min(r // rh, ry - 1) * rx + min(c // rw, rx - 1)

    def region_frontiers(self) -> dict:
        """{region_id: (centroid (r,c) float or None, n_frontier_cells)}. Cached per step."""
        if self._region_frontiers is not None:
            return self._region_frontiers
        cells = np.argwhere(self.frontier_mask())
        out = {i: (None, 0) for i in range(self.cfg.region_grid[0] * self.cfg.region_grid[1])}
        for r, c in cells:
            rid = self.region_id(int(r), int(c))
            cent, n = out[rid]
            out[rid] = ((r, c) if cent is None else
                        ((cent[0] * n + r) / (n + 1), (cent[1] * n + c) / (n + 1)), n + 1)
        self._region_frontiers = out
        return out

    # ------------------------------------------------------------------ A*
    def astar(self, start: tuple, goal: tuple, limit: int = 25000) -> list:
        """8-connected A* with corner-cut prevention. Returns cell path or []"""
        s, h = self.size, self.size
        if self.walls[goal]:
            goal = self._nearest_free(goal)
            if goal is None:
                return []
        openq = [(0, start)]
        g = {start: 0}
        parent = {}
        expansions = 0
        while openq and expansions < limit:
            _, cur = heapq.heappop(openq)
            if cur == goal:
                path = [cur]
                while cur in parent:
                    cur = parent[cur]
                    path.append(cur)
                return path[::-1]
            expansions += 1
            for dr, dc in ORTHO + DIAG:
                nr, nc = cur[0] + dr, cur[1] + dc
                if not (0 <= nr < s and 0 <= nc < h) or self.walls[nr, nc]:
                    continue
                if dr and dc and (self.walls[cur[0] + dr, cur[1]] or self.walls[cur[0], cur[1] + dc]):
                    continue  # no corner cutting
                ng = g[cur] + (1.4142 if dr and dc else 1.0)
                if (nr, nc) not in g or ng < g[(nr, nc)]:
                    g[(nr, nc)] = ng
                    parent[(nr, nc)] = cur
                    dx, dy = abs(nr - goal[0]), abs(nc - goal[1])
                    fcost = ng + max(dx, dy) + 0.4142 * min(dx, dy)
                    heapq.heappush(openq, (fcost, (nr, nc)))
        return []

    def _nearest_free(self, cell: tuple):
        from collections import deque
        if not self.walls[cell]:
            return cell
        seen = {cell}
        q = deque([cell])
        while q:
            r, c = q.popleft()
            for dr, dc in ORTHO:
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.size and 0 <= nc < self.size and (nr, nc) not in seen:
                    if not self.walls[nr, nc]:
                        return (nr, nc)
                    seen.add((nr, nc))
                    q.append((nr, nc))
        return None

    # ------------------------------------------------------- target selection
    def region_target_cell(self, rid: int) -> tuple:
        cent, n = self.region_frontiers()[rid]
        if cent is not None and n > 0:
            cell = (int(round(cent[0])), int(round(cent[1])))
            if not self.walls[cell]:
                return cell
            nf = self._nearest_free(cell)
            if nf is not None:
                return nf
        ry, rx = self.cfg.region_grid
        rh, rw = self.size // ry, self.size // rx
        center = (rid // rx * rh + rh // 2, rid % rx * rw + rw // 2)
        return self._nearest_free(center) or self.robots[0]

    # --------------------------------------------------------------- metrics
    def coverage(self) -> float:
        n_free = int(self.free.sum())
        n_known_free = int((self.explored & self.free).sum())
        return n_known_free / max(n_free, 1)

    def overlap_ratio(self) -> float:
        known = int((self.explored & self.free).sum())
        return self.overlap_cells / max(known, 1)

    # ------------------------------------------------------------ observation
    def actor_obs(self, robot_idx: int) -> tuple:
        """(crop (3,C,C) float32, extras (4,) float32) — mirrored by sar_alloc_rl."""
        C = self.cfg.crop_size
        half = C // 2
        r, c = self.robots[robot_idx]
        wall_c = _crop(self.walls.astype(np.float32), r, c, half, C)
        expl_c = _crop(self.explored.astype(np.float32), r, c, half, C)
        front_c = _crop(self.frontier_mask().astype(np.float32), r, c, half, C)
        crop = np.stack([wall_c, expl_c, front_c]).astype(np.float32)
        extras = np.array([
            r / (self.size - 1), c / (self.size - 1),
            self.victim_found.sum() / max(self.n_victims, 1),
            self.t / self.cfg.max_steps,
        ], dtype=np.float32)
        return crop, extras

    def critic_obs(self) -> tuple:
        """(grid (4+n_robots,S,S) float32, extras (3,) float32) — mirrored by sar_alloc_rl."""
        chans = [self.walls.astype(np.float32),
                 self.explored.astype(np.float32),
                 self.frontier_mask().astype(np.float32),
                 _victim_channel(self)]
        for i in range(self.cfg.n_robots):
            onehot = np.zeros((self.size, self.size), dtype=np.float32)
            onehot[self.robots[i][0], self.robots[i][1]] = 1.0
            chans.append(onehot)
        grid = np.stack(chans).astype(np.float32)
        extras = np.array([
            self.coverage(),
            self.victim_found.sum() / max(self.n_victims, 1),
            self.t / self.cfg.max_steps,
        ], dtype=np.float32)
        return grid, extras


def _shift(a: np.ndarray, dr: int, dc: int, s: int) -> np.ndarray:
    out = np.zeros_like(a)
    r0, r1 = max(dr, 0), s + min(dr, 0)
    c0, c1 = max(dc, 0), s + min(dc, 0)
    out[r0 - dr:r1 - dr, c0 - dc:c1 - dc] = a[r0:r1, c0:c1]
    return out


def _crop(a: np.ndarray, r: int, c: int, half: int, C: int) -> np.ndarray:
    s = a.shape[0]
    out = np.zeros((C, C), dtype=np.float32)
    r_lo, r_hi = max(0, r - half), min(s, r + half + 1)
    c_lo, c_hi = max(0, c - half), min(s, c + half + 1)
    out[r_lo - (r - half):r_hi - (r - half), c_lo - (c - half):c_hi - (c - half)] = a[r_lo:r_hi, c_lo:c_hi]
    return out


def _victim_channel(w: "GridWorld") -> np.ndarray:
    ch = np.zeros((w.size, w.size), dtype=np.float32)
    for vi, (vr, vc) in enumerate(w.victim_cells):
        if w.victim_found[vi]:
            ch[vr, vc] = 1.0
    return ch

"""Procedural room-and-corridor maze generation for SAR worlds.

Produces a square boolean grid, True = wall. Rooms are carved then connected
by an L-shaped 2-cell-wide corridor between consecutive room centers, which
guarantees the whole map is one connected component.
"""

import numpy as np


def generate_map(size: int, seed: int, n_rooms: int = 9) -> np.ndarray:
    rng = np.random.default_rng(seed)
    walls = np.ones((size, size), dtype=bool)

    rooms = []
    attempts = 0
    while len(rooms) < n_rooms and attempts < 300:
        attempts += 1
        w = int(rng.integers(7, 14))
        h = int(rng.integers(7, 14))
        x = int(rng.integers(2, size - w - 2))
        y = int(rng.integers(2, size - h - 2))
        if any(x < ox + ow + 1 and ox < x + w + 1 and y < oy + oh + 1 and oy < y + h + 1
               for (ox, oy, ow, oh) in rooms):
            continue
        rooms.append((x, y, w, h))
        walls[y:y + h, x:x + w] = False

    for i in range(1, len(rooms)):
        cx0 = rooms[i - 1][0] + rooms[i - 1][2] // 2
        cy0 = rooms[i - 1][1] + rooms[i - 1][3] // 2
        cx1 = rooms[i][0] + rooms[i][2] // 2
        cy1 = rooms[i][1] + rooms[i][3] // 2
        _carve_h(walls, cy0, cx0, cx1)
        _carve_v(walls, cx1, cy0, cy1)

    return walls


def _carve_h(walls: np.ndarray, y: int, x0: int, x1: int) -> None:
    h, w = walls.shape
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for yy in (y, y + 1):
            if 1 <= yy < h - 1 and 1 <= x < w - 1:
                walls[yy, x] = False


def _carve_v(walls: np.ndarray, x: int, y0: int, y1: int) -> None:
    h, w = walls.shape
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for xx in (x, x + 1):
            if 1 <= y < h - 1 and 1 <= xx < w - 1:
                walls[y, xx] = False


def reachable_cells(walls: np.ndarray, start: tuple) -> set:
    """BFS flood fill of free cells from `start` (row, col)."""
    from collections import deque
    h, w = walls.shape
    seen = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and not walls[nr, nc] and (nr, nc) not in seen:
                seen.add((nr, nc))
                q.append((nr, nc))
    return seen

let hamiltonianPath = [];
let aiStepIndex = 0;
let CELL = 20;
let GRID = 0;
let lastDecisionStateKey = "";
let lastDecisionDir = null;
let lookaheadBudget = 0;
let recentStateQueue = [];
let recentStateCounts = new Map();

const DIRECTIONS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
];

const AI_CONFIG = {
    depthBoost: 1,
    minSpaceFloor: 12,
    spaceBuffer: 1,
    stateTailReachBonus: 1800,
    stateTailBlockedPenalty: -900,
    stateSpaceWeight: 8,
    stateFoodDistanceWeight: 18,
    moveSafeBonus: 650,
    moveUnsafePenalty: -650,
    moveTailReachBonus: 150,
    moveTailBlockedPenalty: -120,
    moveSpaceWeight: 5,
    moveFoodDistanceWeight: 24,
    moveEdgeDistanceWeight: 7,
    keepDirectionBonus: 70,
    directionChangePenalty: 45,
    zigzagPenalty: 90,
    switchThreshold: 40,
    moveGrowBonus: 1100,
    recurseDiscount: 0.82,
    rootDiscount: 0.88,
    strictSafeFilter: true,
    preferSafeMoves: true,
    requireFutureMobility: true,
    minFutureMovesAfterEat: 2,
    maxLookaheadNodes: 560
};

function currentProfileConfig() {
    return AI_CONFIG;
}

export function initAI(path, cellSize) {
    hamiltonianPath = Array.isArray(path) ? path : [];
    CELL = cellSize;
    aiStepIndex = 0;
    GRID = inferGridSize(hamiltonianPath);
    lastDecisionStateKey = "";
    lastDecisionDir = null;
    recentStateQueue = [];
    recentStateCounts = new Map();
}

export function resetAI(snake) {
    if (!snake || !snake.length || !hamiltonianPath.length) {
        aiStepIndex = 0;
        return;
    }

    const headCell = toCell(snake[0]);
    const index = hamiltonianPath.findIndex(
        (cell) => cell.x === headCell.x && cell.y === headCell.y
    );

    if (index !== -1) {
        aiStepIndex = (index + 1) % hamiltonianPath.length;
    } else {
        aiStepIndex = 0;
    }

    lastDecisionStateKey = "";
    lastDecisionDir = null;
    recentStateQueue = [];
    recentStateCounts = new Map();
}

function inferGridSize(path) {
    if (!path.length) return 0;

    let maxCoord = 0;
    for (const cell of path) {
        if (cell.x > maxCoord) maxCoord = cell.x;
        if (cell.y > maxCoord) maxCoord = cell.y;
    }

    return maxCoord + 1;
}

function toCell(point) {
    return {
        x: Math.floor(point.x / CELL),
        y: Math.floor(point.y / CELL)
    };
}

function toSnakeCells(snake) {
    return snake.map(toCell);
}

function cellKey(cell) {
    return `${cell.x},${cell.y}`;
}

function isInside(cell) {
    return cell.x >= 0 && cell.y >= 0 && cell.x < GRID && cell.y < GRID;
}

function equalCells(a, b) {
    return a.x === b.x && a.y === b.y;
}

function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function cloneDirection(dir) {
    return dir ? { x: dir.x, y: dir.y } : null;
}

function equalDirection(a, b) {
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y;
}

function buildDecisionStateKey(cells, foodCell) {
    const head = cells[0];
    const tail = cells[cells.length - 1];
    const foodKey = foodCell ? `${foodCell.x},${foodCell.y}` : "none";
    return `${head.x},${head.y}|${tail.x},${tail.y}|${foodKey}|${cells.length}`;
}

function highlight(direction) {
    const up = document.getElementById("keyUp");
    const down = document.getElementById("keyDown");
    const left = document.getElementById("keyLeft");
    const right = document.getElementById("keyRight");

    if (!up || !down || !left || !right) return;

    up.classList.remove("active");
    down.classList.remove("active");
    left.classList.remove("active");
    right.classList.remove("active");

    if (direction.x === 0 && direction.y === -1) up.classList.add("active");
    if (direction.x === 0 && direction.y === 1) down.classList.add("active");
    if (direction.x === -1 && direction.y === 0) left.classList.add("active");
    if (direction.x === 1 && direction.y === 0) right.classList.add("active");
}

function neighbors(cell) {
    const result = [];

    for (const dir of DIRECTIONS) {
        const next = { x: cell.x + dir.x, y: cell.y + dir.y };
        if (isInside(next)) {
            result.push(next);
        }
    }

    return result;
}

function reconstructPath(parent, endKey) {
    const path = [];
    let cursor = endKey;

    while (cursor !== null) {
        const [x, y] = cursor.split(",").map(Number);
        path.push({ x, y });
        cursor = parent.get(cursor);
    }

    path.reverse();
    return path;
}

function bfs(start, target, blocked) {
    if (!isInside(start) || !isInside(target)) return null;

    const startKey = cellKey(start);
    const targetKey = cellKey(target);

    if (startKey === targetKey) {
        return [start];
    }

    const queue = [start];
    let head = 0;
    const parent = new Map();
    parent.set(startKey, null);

    while (head < queue.length) {
        const current = queue[head++];

        for (const next of neighbors(current)) {
            const nextKey = cellKey(next);

            if (parent.has(nextKey)) continue;
            if (blocked.has(nextKey) && nextKey !== targetKey) continue;

            parent.set(nextKey, cellKey(current));
            if (nextKey === targetKey) {
                return reconstructPath(parent, targetKey);
            }

            queue.push(next);
        }
    }

    return null;
}

function floodFillCount(start, blocked, limit) {
    if (!isInside(start)) return 0;
    if (blocked.has(cellKey(start))) return 0;

    const queue = [start];
    let head = 0;
    const seen = new Set([cellKey(start)]);

    while (head < queue.length && seen.size < limit) {
        const current = queue[head++];

        for (const next of neighbors(current)) {
            const nextKey = cellKey(next);
            if (seen.has(nextKey)) continue;
            if (blocked.has(nextKey)) continue;

            seen.add(nextKey);
            queue.push(next);
        }
    }

    return seen.size;
}

function buildBlocked(cells, headIndex = 0, tailIndex = cells.length - 1) {
    const blocked = new Set();
    for (let i = 0; i < cells.length; i++) {
        if (i === headIndex || i === tailIndex) continue;
        blocked.add(cellKey(cells[i]));
    }
    return blocked;
}

function canMoveTo(cells, next, willGrow) {
    if (!isInside(next)) return false;

    const checkUntil = willGrow ? cells.length - 1 : cells.length - 2;
    for (let i = 0; i <= checkUntil; i++) {
        if (equalCells(cells[i], next)) return false;
    }

    return true;
}

function simulateMove(cells, next, willGrow) {
    const trimmed = willGrow ? cells : cells.slice(0, -1);
    return [next, ...trimmed];
}

function evaluateState(cells) {
    const head = cells[0];
    const tail = cells[cells.length - 1];
    const blockedForPath = buildBlocked(cells);
    const tailPath = bfs(head, tail, blockedForPath);

    const blockedForSpace = new Set();
    for (let i = 1; i < cells.length; i++) {
        blockedForSpace.add(cellKey(cells[i]));
    }

    const freeSpace = floodFillCount(head, blockedForSpace, GRID * GRID);

    return {
        tailReachable: !!tailPath,
        freeSpace,
        snakeLength: cells.length
    };
}

function evaluateMove(cells, next, foodCell, cfg) {
    const willGrow = !!foodCell && equalCells(next, foodCell);

    if (!canMoveTo(cells, next, willGrow)) return null;

    const nextCells = simulateMove(cells, next, willGrow);
    const state = evaluateState(nextCells);

    const safeBySpace = state.freeSpace >= Math.max(state.snakeLength + cfg.spaceBuffer, cfg.minSpaceFloor);
    const safe = state.tailReachable || safeBySpace;
    const nextFood = willGrow ? null : foodCell;
    const nextMobility = countLegalMoves(nextCells, nextFood, cfg);

    return {
        next,
        willGrow,
        safe,
        tailReachable: state.tailReachable,
        freeSpace: state.freeSpace,
        nextMobility,
        nextCells
    };
}

function getHamiltonianNextCell(current) {
    if (!hamiltonianPath.length) return null;

    const currentIndex = hamiltonianPath.findIndex(
        (cell) => cell.x === current.x && cell.y === current.y
    );

    if (currentIndex !== -1) {
        aiStepIndex = (currentIndex + 1) % hamiltonianPath.length;
    }

    const candidate = hamiltonianPath[aiStepIndex];
    if (!candidate) return null;

    return { x: candidate.x, y: candidate.y };
}

function directionFromTo(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (dx === 1 && dy === 0) return { x: 1, y: 0 };
    if (dx === -1 && dy === 0) return { x: -1, y: 0 };
    if (dx === 0 && dy === 1) return { x: 0, y: 1 };
    if (dx === 0 && dy === -1) return { x: 0, y: -1 };

    return null;
}

function isOppositeDirection(a, b) {
    if (!a || !b) return false;
    return a.x === -b.x && a.y === -b.y;
}

function estimateStepPixels(snake) {
    if (!snake || snake.length < 2) {
        return Math.max(2, CELL * 0.15);
    }

    const dx = snake[0].x - snake[1].x;
    const dy = snake[0].y - snake[1].y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!Number.isFinite(distance) || distance < 0.5) {
        return Math.max(2, CELL * 0.15);
    }

    return Math.min(Math.max(distance, 2), CELL * 0.5);
}

function isDirectionLikelyCollision(snake, direction) {
    if (!snake || !snake.length) return false;

    const boardMax = GRID * CELL;
    const head = snake[0];
    const step = estimateStepPixels(snake);
    const horizon = 12;
    const collisionDistSq = 15 * 15;

    for (let n = 1; n <= horizon; n++) {
        const x = head.x + direction.x * step * n;
        const y = head.y + direction.y * step * n;

        if (x < 0 || y < 0 || x >= boardMax || y >= boardMax) {
            return true;
        }

        for (let i = 8; i < snake.length; i++) {
            const dx = x - snake[i].x;
            const dy = y - snake[i].y;
            if (dx * dx + dy * dy < collisionDistSq) {
                return true;
            }
        }
    }

    return false;
}

function evaluateStateScore(cells, foodCell, cfg) {
    const state = evaluateState(cells);
    let score = 0;

    score += state.tailReachable ? cfg.stateTailReachBonus : cfg.stateTailBlockedPenalty;
    score += state.freeSpace * cfg.stateSpaceWeight;

    if (foodCell) {
        score -= manhattan(cells[0], foodCell) * cfg.stateFoodDistanceWeight;
    }

    return score;
}

function immediateMoveScore(move, foodCell, cfg) {
    let score = 0;

    score += move.safe ? cfg.moveSafeBonus : cfg.moveUnsafePenalty;
    score += move.tailReachable ? cfg.moveTailReachBonus : cfg.moveTailBlockedPenalty;
    score += move.freeSpace * cfg.moveSpaceWeight;

    if (foodCell) {
        score -= manhattan(move.next, foodCell) * cfg.moveFoodDistanceWeight;
        if (move.willGrow) {
            score += cfg.moveGrowBonus;
        }
    }

    const edgeDist = Math.min(
        move.next.x,
        move.next.y,
        GRID - 1 - move.next.x,
        GRID - 1 - move.next.y
    );
    score += edgeDist * cfg.moveEdgeDistanceWeight;

    return score;
}

function computeLookaheadDepth(snakeLength, cfg) {
    let depth;

    if (snakeLength < 10) depth = 4;
    else if (snakeLength < 26) depth = 3;
    else depth = 2;

    return Math.max(1, depth + cfg.depthBoost);
}

function listMoves(cells, foodCell, cfg) {
    const head = cells[0];
    const result = [];

    for (const next of neighbors(head)) {
        const move = evaluateMove(cells, next, foodCell, cfg);
        if (move) {
            result.push(move);
        }
    }

    return result;
}

function chooseCandidateMoves(moves, cfg) {
    if (!moves.length) return moves;

    let candidates = moves;

    if ((cfg.preferSafeMoves || cfg.strictSafeFilter) && candidates.some((m) => m.safe)) {
        candidates = candidates.filter((m) => m.safe);
    }

    if (cfg.requireFutureMobility && candidates.some((m) => m.nextMobility > 0)) {
        candidates = candidates.filter((m) => m.nextMobility > 0);
    }

    return candidates;
}

function hasAnyLegalMove(cells, foodCell, cfg) {
    return listMoves(cells, foodCell, cfg).length > 0;
}

function countLegalMoves(cells, foodCell, cfg) {
    const head = cells[0];
    if (!head) return 0;

    let count = 0;
    for (const next of neighbors(head)) {
        const willGrow = !!foodCell && equalCells(next, foodCell);
        if (canMoveTo(cells, next, willGrow)) {
            count++;
        }
    }

    return count;
}

function pickSafeFoodPathMove(cells, foodCell, cfg) {
    if (!foodCell) return null;

    const head = cells[0];
    if (manhattan(head, foodCell) === 1) {
        const immediate = evaluateMove(cells, foodCell, foodCell, cfg);
        if (immediate) {
            const stillPlayable = immediate.safe || immediate.nextMobility > cfg.minFutureMovesAfterEat;
            if (stillPlayable) {
                return immediate;
            }
        }
    }

    const blocked = buildBlocked(cells);
    const pathToFood = bfs(cells[0], foodCell, blocked);
    if (!pathToFood || pathToFood.length < 2) return null;

    let simCells = cells;
    let simFood = foodCell;
    let firstMove = null;

    for (let i = 1; i < pathToFood.length; i++) {
        const step = pathToFood[i];
        const move = evaluateMove(simCells, step, simFood, cfg);
        if (!move) return null;

        if (i === 1) {
            firstMove = move;
        }

        simCells = move.nextCells;
        if (move.willGrow) {
            simFood = null;
        }
    }

    const endState = evaluateState(simCells);
    const safeEnd = endState.tailReachable
        || endState.freeSpace >= Math.max(endState.snakeLength + cfg.spaceBuffer + 2, cfg.minSpaceFloor + 2);

    return safeEnd ? firstMove : null;
}

function pickTailChaseMove(cells, foodCell, cfg) {
    const tail = cells[cells.length - 1];
    const blocked = buildBlocked(cells);
    const pathToTail = bfs(cells[0], tail, blocked);

    if (!pathToTail || pathToTail.length < 2) return null;

    const step = pathToTail[1];
    return evaluateMove(cells, step, foodCell, cfg);
}

function hasTwoStepEscape(move, foodCell, cfg) {
    if (!move) return false;

    const nextFood = move.willGrow ? null : foodCell;
    const secondMoves = listMoves(move.nextCells, nextFood, cfg);
    if (!secondMoves.length) return false;

    const candidates = chooseCandidateMoves(secondMoves, cfg);
    const inspected = candidates.length ? candidates : secondMoves;

    for (const step2 of inspected) {
        const state = evaluateState(step2.nextCells);
        const spacious = state.freeSpace >= Math.max(state.snakeLength + cfg.spaceBuffer + 1, cfg.minSpaceFloor + 1);
        if (state.tailReachable || spacious) {
            return true;
        }
    }

    return false;
}

function listTrapSafeMoves(cells, snake, foodCell, cfg) {
    const head = cells[0];
    const all = listMoves(cells, foodCell, cfg);
    if (!all.length) return [];

    const candidates = chooseCandidateMoves(all, cfg);
    const inspected = candidates.length ? candidates : all;
    const result = [];

    for (const move of inspected) {
        const dir = directionFromTo(head, move.next);
        if (!dir) continue;
        if (isDirectionLikelyCollision(snake, dir)) continue;
        if (!hasTwoStepEscape(move, foodCell, cfg)) continue;

        const state = evaluateState(move.nextCells);
        const spacious = state.freeSpace >= Math.max(state.snakeLength + cfg.spaceBuffer + 2, cfg.minSpaceFloor + 2);
        if (!state.tailReachable && !spacious) continue;

        result.push(move);
    }

    return result;
}

function pickBestEscapeMove(cells, snake, foodCell, cfg) {
    const moves = listMoves(cells, foodCell, cfg);
    if (!moves.length) return null;

    const candidates = chooseCandidateMoves(moves, cfg);
    const ranked = candidates.length ? candidates : moves;
    const head = cells[0];

    let best = null;
    let bestScore = -Infinity;

    for (const move of ranked) {
        const dir = directionFromTo(head, move.next);
        if (!dir) continue;
        if (isDirectionLikelyCollision(snake, dir)) continue;
        if (!hasTwoStepEscape(move, foodCell, cfg)) continue;

        let score = 0;
        score += move.safe ? 2000 : -1200;
        score += move.tailReachable ? 400 : -150;
        score += move.freeSpace * 12;
        score += move.nextMobility * 320;
        if (foodCell) {
            score -= manhattan(move.next, foodCell) * 10;
        }
        if (move.willGrow) score += 1200;

        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }

    return best;
}

function lookaheadScore(cells, foodCell, depth, cfg) {
    if (depth <= 0 || lookaheadBudget <= 0) {
        return evaluateStateScore(cells, foodCell, cfg);
    }
    lookaheadBudget--;

    const moves = listMoves(cells, foodCell, cfg);
    if (!moves.length) {
        return -1000000;
    }

    const candidateMoves = chooseCandidateMoves(moves, cfg);

    let best = -Infinity;

    for (const move of candidateMoves) {
        const nextFood = move.willGrow ? null : foodCell;
        const score = immediateMoveScore(move, foodCell, cfg)
            + cfg.recurseDiscount * lookaheadScore(move.nextCells, nextFood, depth - 1, cfg);

        if (score > best) {
            best = score;
        }
    }

    return best;
}

function pickLookaheadMove(cells, foodCell, cfg) {
    const moves = listMoves(cells, foodCell, cfg);
    if (!moves.length) return null;

    const candidateMoves = chooseCandidateMoves(moves, cfg);
    const depth = computeLookaheadDepth(cells.length, cfg);

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of candidateMoves) {
        const nextFood = move.willGrow ? null : foodCell;
        const score = immediateMoveScore(move, foodCell, cfg)
            + cfg.rootDiscount * lookaheadScore(move.nextCells, nextFood, depth - 1, cfg);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function pickBestMove(moves, foodCell, cfg) {
    if (!moves.length) return null;

    const candidates = chooseCandidateMoves(moves, cfg);

    candidates.sort((a, b) => {
        if (a.willGrow !== b.willGrow) {
            return a.willGrow ? -1 : 1;
        }

        if (foodCell) {
            const da = manhattan(a.next, foodCell);
            const db = manhattan(b.next, foodCell);
            if (da !== db) return da - db;
        }

        if (a.tailReachable !== b.tailReachable) {
            return a.tailReachable ? -1 : 1;
        }

        return b.freeSpace - a.freeSpace;
    });

    return candidates[0];
}

function buildGeometrySafeMove(cells, snake, foodCell, cfg) {
    const candidates = listMoves(cells, foodCell, cfg);
    if (!candidates.length) return null;

    const ranked = [...chooseCandidateMoves(candidates, cfg)];
    ranked.sort((a, b) => {
        if (a.safe !== b.safe) return a.safe ? -1 : 1;
        if (a.nextMobility !== b.nextMobility) return b.nextMobility - a.nextMobility;
        if (a.tailReachable !== b.tailReachable) return a.tailReachable ? -1 : 1;
        return b.freeSpace - a.freeSpace;
    });

    const head = cells[0];
    for (const move of ranked) {
        const dir = directionFromTo(head, move.next);
        if (!dir) continue;
        if (!isDirectionLikelyCollision(snake, dir)) {
            return move;
        }
    }

    return null;
}

function hamiltonianIndex(cell) {
    if (!cell || !hamiltonianPath.length) return -1;
    return hamiltonianPath.findIndex((p) => p.x === cell.x && p.y === cell.y);
}

function cycleDistance(fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || !hamiltonianPath.length) return Number.MAX_SAFE_INTEGER;
    const n = hamiltonianPath.length;
    return (toIndex - fromIndex + n) % n;
}

function updateLoopTracker(head, foodCell) {
    const headKey = cellKey(head);
    const foodKey = foodCell ? cellKey(foodCell) : "none";
    const key = `${headKey}|${foodKey}`;
    recentStateQueue.push(key);
    recentStateCounts.set(key, (recentStateCounts.get(key) || 0) + 1);

    if (recentStateQueue.length > 40) {
        const old = recentStateQueue.shift();
        if (old) {
            const nextCount = (recentStateCounts.get(old) || 1) - 1;
            if (nextCount <= 0) recentStateCounts.delete(old);
            else recentStateCounts.set(old, nextCount);
        }
    }

    const currentCount = recentStateCounts.get(key) || 0;
    const uniqueStates = recentStateCounts.size;
    const loopDensity = recentStateQueue.length > 0
        ? uniqueStates / recentStateQueue.length
        : 1;

    // Loop only when the exact same head+food state repeats many times
    // and the explored state variety is low.
    return currentCount >= 5 && loopDensity < 0.45;
}

function pickCycleProgressMove(cells, snake, foodCell, cfg) {
    const moves = listMoves(cells, foodCell, cfg);
    if (!moves.length) return null;

    const head = cells[0];
    const headIndex = hamiltonianIndex(head);
    const foodIndex = foodCell ? hamiltonianIndex(foodCell) : -1;
    const candidates = chooseCandidateMoves(moves, cfg);

    let best = null;
    let bestScore = -Infinity;

    for (const move of candidates) {
        const dir = directionFromTo(head, move.next);
        if (!dir) continue;

        const collisionPenalty = isDirectionLikelyCollision(snake, dir) ? -20000 : 0;
        const nextIndex = hamiltonianIndex(move.next);
        const progress = cycleDistance(headIndex, nextIndex);
        const foodDist = foodIndex >= 0 ? cycleDistance(nextIndex, foodIndex) : 0;
        const edgeDist = Math.min(
            move.next.x,
            move.next.y,
            GRID - 1 - move.next.x,
            GRID - 1 - move.next.y
        );
        const score = collisionPenalty
            + (move.safe ? 2600 : -1700)
            + move.freeSpace * 12
            + move.nextMobility * 260
            + progress * 2
            - foodDist * 22
            + edgeDist * 80
            + (move.willGrow ? 5000 : 0);

        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }

    return best;
}

function scoreMoveForStability(move, foodCell, cfg, currentDir, previousDir, snake, head) {
    if (!move) return -Infinity;

    const dir = directionFromTo(head, move.next);
    if (!dir) return -Infinity;

    let score = immediateMoveScore(move, foodCell, cfg);

    if (currentDir) {
        if (equalDirection(dir, currentDir)) score += cfg.keepDirectionBonus;
        else score -= cfg.directionChangePenalty;
    }

    if (previousDir && currentDir && !equalDirection(previousDir, currentDir) && equalDirection(dir, previousDir)) {
        score -= cfg.zigzagPenalty;
    }

    if (isDirectionLikelyCollision(snake, dir)) {
        score -= 25000;
    }

    return score;
}

export function runAI(snake, food, currentDir = null) {
    if (!snake || !snake.length || GRID <= 0) {
        return null;
    }

    const cells = toSnakeCells(snake);
    const head = cells[0];
    if (!isInside(head)) return null;

    const foodRawCell = food ? toCell(food) : null;
    const foodCell = foodRawCell && isInside(foodRawCell) ? foodRawCell : null;
    const cfg = currentProfileConfig();
    const stateKey = buildDecisionStateKey(cells, foodCell);
    const stuckLoop = cells.length >= 24 && updateLoopTracker(head, foodCell);

    if (!stuckLoop && stateKey === lastDecisionStateKey && lastDecisionDir) {
        highlight(lastDecisionDir);
        return cloneDirection(lastDecisionDir);
    }

    lookaheadBudget = Math.max(40, cfg.maxLookaheadNodes || 220);

    let chosen = null;

    if (stuckLoop) {
        chosen = pickCycleProgressMove(cells, snake, foodCell, cfg);
    }

    if (!chosen) {
        chosen = pickSafeFoodPathMove(cells, foodCell, cfg);
    }

    if (!chosen) {
        chosen = pickLookaheadMove(cells, foodCell, cfg);
    }

    if (!chosen) {
        chosen = pickTailChaseMove(cells, foodCell, cfg);
    }

    if (!chosen) {
        const fallbackMoves = listMoves(cells, foodCell, cfg);
        chosen = pickBestMove(fallbackMoves, foodCell, cfg);
    }

    if (!chosen) {
        const hamiltonianCell = getHamiltonianNextCell(head);
        if (hamiltonianCell && !equalCells(hamiltonianCell, head)) {
            const fallback = evaluateMove(cells, hamiltonianCell, foodCell, cfg);
            if (fallback) {
                chosen = fallback;
            }
        }
    }

    const trapSafeMoves = listTrapSafeMoves(cells, snake, foodCell, cfg);
    if (trapSafeMoves.length) {
        const chosenIsTrapSafe = !!chosen && trapSafeMoves.some((m) => equalCells(m.next, chosen.next));
        if (!chosenIsTrapSafe) {
            chosen = pickBestMove(trapSafeMoves, foodCell, cfg) || chosen;
        }
    } else if (chosen && !hasTwoStepEscape(chosen, foodCell, cfg)) {
        const rescue = pickBestEscapeMove(cells, snake, foodCell, cfg);
        if (rescue) {
            chosen = rescue;
        }
    }

    if (!chosen) {
        lastDecisionStateKey = stateKey;
        lastDecisionDir = null;
        return null;
    }

    let newDir = directionFromTo(head, chosen.next);
    if (!newDir) {
        lastDecisionStateKey = stateKey;
        lastDecisionDir = null;
        return null;
    }

    if (isDirectionLikelyCollision(snake, newDir)) {
        const saferMove = buildGeometrySafeMove(cells, snake, foodCell, cfg);
        if (saferMove) {
            const saferDir = directionFromTo(head, saferMove.next);
            if (saferDir) {
                chosen = saferMove;
                newDir = saferDir;
            }
        }
    }

    if (isOppositeDirection(newDir, currentDir)) {
        const alternatives = chooseCandidateMoves(listMoves(cells, foodCell, cfg), cfg);
        let replacement = null;
        for (const move of alternatives) {
            const dir = directionFromTo(head, move.next);
            if (!dir) continue;
            if (isOppositeDirection(dir, currentDir)) continue;
            if (isDirectionLikelyCollision(snake, dir)) continue;
            replacement = dir;
            break;
        }
        if (!replacement) {
            for (const move of alternatives) {
                const dir = directionFromTo(head, move.next);
                if (!dir) continue;
                if (isOppositeDirection(dir, currentDir)) continue;
                replacement = dir;
                break;
            }
        }
        if (replacement) {
            newDir = replacement;
        } else if (currentDir) {
            newDir = cloneDirection(currentDir);
        }
    }

    if (currentDir && !equalDirection(newDir, currentDir)) {
        const straightCell = { x: head.x + currentDir.x, y: head.y + currentDir.y };
        const straightMove = evaluateMove(cells, straightCell, foodCell, cfg);

        if (straightMove && !isDirectionLikelyCollision(snake, currentDir)) {
            const chosenScore = scoreMoveForStability(chosen, foodCell, cfg, currentDir, lastDecisionDir, snake, head);
            const straightScore = scoreMoveForStability(straightMove, foodCell, cfg, currentDir, lastDecisionDir, snake, head);
            const straightFoodDist = foodCell ? manhattan(straightMove.next, foodCell) : Number.MAX_SAFE_INTEGER;
            const chosenFoodDist = foodCell && chosen ? manhattan(chosen.next, foodCell) : Number.MAX_SAFE_INTEGER;
            const betterForFood = foodCell && chosen && (straightFoodDist - chosenFoodDist >= 2);
            const shouldKeepStraight = !chosen?.willGrow
                && !betterForFood
                && (straightScore + cfg.switchThreshold >= chosenScore);

            if (shouldKeepStraight) {
                chosen = straightMove;
                newDir = cloneDirection(currentDir);
            }
        }
    }

    lastDecisionStateKey = stateKey;
    lastDecisionDir = cloneDirection(newDir);
    highlight(newDir);
    return cloneDirection(newDir);
}

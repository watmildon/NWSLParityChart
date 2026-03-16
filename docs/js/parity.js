/**
 * Parity chain/cycle finding algorithms.
 * Port of the C# backtracking DFS from Program.cs.
 */

/**
 * Build an adjacency map from season data.
 * @param {Object} seasonData - Parsed JSON season data
 * @returns {Map<string, string[]>} adjacency list (winner -> [losers])
 */
function buildAdjacency(seasonData) {
    const adj = new Map();
    for (const team of seasonData.teams) {
        adj.set(team.id, []);
    }
    for (const week of seasonData.weeks) {
        for (const result of week.results) {
            adj.get(result.winner).push(result.loser);
        }
    }
    return adj;
}

/**
 * Find the longest simple cycle in the directed graph.
 * Direct port of FindLongestCycle from Program.cs.
 * @param {Map<string, string[]>} adjacency
 * @param {string[]} teams - team IDs (shuffled for random tie-breaking)
 * @returns {string[]} ordered list of teams in the cycle (last == first to close the loop)
 */
function findLongestCycle(adjacency, teams) {
    let longestCycle = [];

    for (const startVertex of teams) {
        const visited = new Set();
        const currentPath = [];
        _dfsCycle(startVertex, startVertex, visited, currentPath, adjacency, longestCycle);
    }

    return longestCycle;
}

function _dfsCycle(start, current, visited, path, adjacency, longest) {
    if (visited.has(current)) return;
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
        path.push({ from: current, to: neighbor });

        if (neighbor === start && (path.length > longest.length ||
            (path.length === longest.length && _containsPreferredEdges(path) && !_containsPreferredEdges(longest)))) {
            longest.length = 0;
            longest.push(...path);
        } else if (!visited.has(neighbor)) {
            _dfsCycle(start, neighbor, visited, path, adjacency, longest);
        }

        path.pop();
    }

    visited.delete(current);
}

/**
 * Find the longest simple path (not necessarily a cycle).
 * Used when no full-team cycle exists.
 * @param {Map<string, string[]>} adjacency
 * @param {string[]} teams
 * @returns {string[]} ordered list of teams in the longest path
 */
function findLongestPath(adjacency, teams) {
    let longestPath = [];

    for (const startVertex of teams) {
        const visited = new Set();
        visited.add(startVertex);
        const currentPath = [startVertex];
        _dfsPath(startVertex, visited, currentPath, adjacency, longestPath);
        visited.delete(startVertex);
    }

    return longestPath;
}

function _dfsPath(current, visited, path, adjacency, longest) {
    if (path.length > longest.length ||
        (path.length === longest.length && _containsPreferred(path) && !_containsPreferred(longest))) {
        longest.length = 0;
        longest.push(...path);
    }

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            visited.add(neighbor);
            path.push(neighbor);
            _dfsPath(neighbor, visited, path, adjacency, longest);
            path.pop();
            visited.delete(neighbor);
        }
    }
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Preferred team for tiebreaking equal-length paths/cycles. */
const PREFERRED_TEAM = 'SEA';

function _containsPreferred(path) {
    return path.includes(PREFERRED_TEAM);
}

function _containsPreferredEdges(edges) {
    return edges.some(e => e.from === PREFERRED_TEAM || e.to === PREFERRED_TEAM);
}

/**
 * Main entry: analyze season data and return the parity result.
 * @param {Object} seasonData
 * @returns {{ type: 'cycle'|'path', chain: string[], missingTeams: string[] }}
 */
function findParityChain(seasonData) {
    const adjacency = buildAdjacency(seasonData);
    const teams = seasonData.teams.map(t => t.id);

    // Shuffle for random tie-breaking among equal-length results
    const shuffled = shuffleArray([...teams]);

    // Try to find a cycle
    const cycleEdges = findLongestCycle(adjacency, shuffled);
    const cycleTeams = cycleEdges.map(e => e.from);

    if (cycleTeams.length === teams.length) {
        // Full circle — all teams in the cycle
        const chain = [...cycleTeams, cycleTeams[0]];
        return { type: 'cycle', chain, missingTeams: [] };
    }

    // No full cycle — find longest path instead
    const pathTeams = findLongestPath(adjacency, shuffled);
    const pathSet = new Set(pathTeams);
    const missing = teams.filter(t => !pathSet.has(t));

    return { type: 'path', chain: pathTeams, missingTeams: missing };
}

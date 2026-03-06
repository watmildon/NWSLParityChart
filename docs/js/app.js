/**
 * App entry point: loads season data, runs algorithm, renders visualization.
 */

const seasonSelect = document.getElementById('season');
const svgEl = document.getElementById('parity-chart');
const chainStatus = document.getElementById('chain-status');
const missingTeamsEl = document.getElementById('missing-teams');

async function loadSeason(year) {
    const response = await fetch(`data/${year}.json`);
    const seasonData = await response.json();

    const result = findParityChain(seasonData);
    renderParity(svgEl, seasonData, result);

    // Update info panel
    if (result.type === 'cycle') {
        chainStatus.textContent = `Complete circle of parity found! All ${seasonData.teams.length} teams connected.`;
        missingTeamsEl.textContent = '';
    } else {
        chainStatus.textContent = `Longest chain: ${result.chain.length} of ${seasonData.teams.length} teams.`;
        if (result.missingTeams.length > 0) {
            missingTeamsEl.textContent = `Not yet connected: ${result.missingTeams.join(', ')}`;
        }
    }
}

seasonSelect.addEventListener('change', () => {
    loadSeason(seasonSelect.value);
});

// Load initial season
loadSeason(seasonSelect.value);

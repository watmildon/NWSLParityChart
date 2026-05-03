/**
 * App entry point: loads season data, runs algorithm, renders visualization.
 * Supports URL hash routing: #2025, #2024, etc.
 */

const seasonSelect = document.getElementById('season');
const svgEl = document.getElementById('parity-chart');
const chainStatus = document.getElementById('chain-status');
const chainListEl = document.getElementById('chain-list');
const missingTeamsEl = document.getElementById('missing-teams');

async function loadSeason(year) {
    const response = await fetch(`data/${year}.json`);
    const seasonData = await response.json();

    // Use precomputed result if available, otherwise compute live
    const result = seasonData.parityResult || findParityChain(seasonData);
    renderParity(svgEl, seasonData, result);

    // Update info panel
    if (seasonData.cancelled) {
        chainStatus.textContent = '';
        chainListEl.textContent = '';
        missingTeamsEl.textContent = '';
    } else if (result.type === 'cycle') {
        chainStatus.textContent = `Complete circle of parity found! All ${seasonData.teams.length} teams connected.`;
        chainListEl.textContent = result.chain.join(' → ');
        missingTeamsEl.textContent = '';
    } else if (result.chain.length > 1) {
        chainStatus.textContent = `Longest chain: ${result.chain.length} of ${seasonData.teams.length} teams.`;
        chainListEl.textContent = result.chain.join(' → ');
        if (result.missingTeams.length > 0) {
            missingTeamsEl.textContent = `Not yet connected: ${result.missingTeams.join(', ')}`;
        } else {
            missingTeamsEl.textContent = '';
        }
    } else {
        chainStatus.textContent = '';
        chainListEl.textContent = '';
        missingTeamsEl.textContent = '';
    }
}

function getYearFromHash() {
    const hash = location.hash.replace('#', '');
    // Validate it's an available option
    const option = seasonSelect.querySelector(`option[value="${hash}"]`);
    return option ? hash : null;
}

function setYear(year, updateHash) {
    seasonSelect.value = year;
    if (updateHash) {
        history.replaceState(null, '', `#${year}`);
    }
    loadSeason(year);
}

seasonSelect.addEventListener('change', () => {
    const year = seasonSelect.value;
    history.pushState(null, '', `#${year}`);
    loadSeason(year);
});

window.addEventListener('popstate', () => {
    const year = getYearFromHash() || seasonSelect.querySelector('[selected]').value;
    seasonSelect.value = year;
    loadSeason(year);
});

// Initial load: use hash if present, otherwise use the default selected option
const initialYear = getYearFromHash() || seasonSelect.value;
setYear(initialYear, true);

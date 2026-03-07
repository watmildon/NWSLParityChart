/**
 * SVG visualization for the NWSL Circle of Parity.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const VIEW_SIZE = 800;
const CENTER_X = VIEW_SIZE / 2;
const CENTER_Y = 380;
const CIRCLE_RADIUS = 280;
const TEAM_RADIUS = 42;
const ARROW_COLOR = '#666666';
const ARROW_WIDTH = 2;

// Logos that are already circular and fill the node edge-to-edge.
// Non-circular logos are scaled down to fit inside the circle with padding.
const CIRCULAR_LOGOS = new Set([
    'BAY-2024.png',
    'KC-2021.png',
    'POR-2013.png', 'POR-2018.png',
    'UTA-2018.png',
    'LOU-2021.png',
    'HOU-2021.png',
    'ORL-2016.png',
    'FCKC-2013.png'
]);

/**
 * Render the parity visualization into the SVG element.
 */
function renderParity(svgEl, seasonData, parityResult) {
    svgEl.innerHTML = '';

    // Cancelled season (e.g. 2020 COVID)
    if (seasonData.cancelled) {
        renderCancelled(svgEl, seasonData);
        return;
    }

    // Build team lookup
    const teamMap = new Map();
    for (const t of seasonData.teams) {
        teamMap.set(t.id, t);
    }

    if (parityResult.type === 'cycle') {
        renderFullCircle(svgEl, seasonData, parityResult, teamMap);
    } else {
        renderPartial(svgEl, seasonData, parityResult, teamMap);
    }
}

/**
 * Cancelled season: show virus image and "SEASON CANCELLED" text.
 */
function renderCancelled(svgEl, seasonData) {
    // Size the virus image to match the full parity circle diameter
    const imgSize = CIRCLE_RADIUS * 2 + TEAM_RADIUS * 2;
    const img = createSvgElement('image', {
        x: CENTER_X - imgSize / 2,
        y: CENTER_Y - imgSize / 2,
        width: imgSize, height: imgSize
    });
    img.setAttributeNS(XLINK_NS, 'href', 'assets/SARS-CoV-2.png');
    svgEl.appendChild(img);

    const label = createSvgElement('text', {
        x: CENTER_X, y: CENTER_Y + imgSize / 2 + 40,
        'text-anchor': 'middle',
        'font-family': 'Arial, sans-serif',
        'font-size': '32',
        'font-weight': 'bold',
        fill: '#cc0000'
    });
    label.textContent = 'SEASON CANCELLED';
    svgEl.appendChild(label);
}

/**
 * Full circle: all teams in a cycle.
 */
function renderFullCircle(svgEl, seasonData, parityResult, teamMap) {
    let chain = parityResult.chain; // last element == first (closing the loop)
    const teamCount = chain.length - 1;

    // Rotate chain so SEA (Reign) is at the top when present
    const seaIdx = chain.indexOf('SEA');
    if (seaIdx > 0 && seaIdx < teamCount) {
        const rotated = chain.slice(seaIdx, teamCount).concat(chain.slice(0, seaIdx));
        rotated.push(rotated[0]); // close the loop
        chain = rotated;
    }

    // Arrow marker
    addArrowMarker(svgEl);

    // Scale logo size for team count
    const nodeRadius = getTeamRadius(teamCount);

    // Draw arrows between consecutive teams
    for (let i = 0; i < teamCount; i++) {
        const fromPos = getCirclePosition(i, teamCount);
        const toPos = getCirclePosition((i + 1) % teamCount, teamCount);
        const game = findGameInfo(seasonData, chain[i], chain[(i + 1) % teamCount]);
        drawArrow(svgEl, fromPos, toPos, nodeRadius, game);
    }
    for (let i = 0; i < teamCount; i++) {
        const teamId = chain[i];
        const pos = getCirclePosition(i, teamCount);
        drawTeamNode(svgEl, teamId, pos, teamMap.get(teamId), nodeRadius);
    }

    // Center NWSL logo
    drawCenterLogo(svgEl);

    // Title
    drawTitle(svgEl, `The ${seasonData.season} NWSL Circle of Parity`);
}

/**
 * Partial: longest path as an arc, missing teams below.
 */
function renderPartial(svgEl, seasonData, parityResult, teamMap) {
    const chain = parityResult.chain;
    const missing = parityResult.missingTeams;
    const totalTeams = seasonData.teams.length;
    const hasChain = chain.length > 1;

    addArrowMarker(svgEl);

    if (hasChain) {
        // Place chain teams on an arc proportional to their count
        const arcFraction = chain.length / totalTeams;
        const startAngle = -Math.PI / 2 - (arcFraction * Math.PI); // center the arc at top

        for (let i = 0; i < chain.length; i++) {
            const angle = startAngle + (2 * Math.PI * arcFraction * i / chain.length);
            const pos = {
                x: CENTER_X + CIRCLE_RADIUS * Math.cos(angle),
                y: CENTER_Y + CIRCLE_RADIUS * Math.sin(angle)
            };

            if (i < chain.length - 1) {
                const nextAngle = startAngle + (2 * Math.PI * arcFraction * (i + 1) / chain.length);
                const nextPos = {
                    x: CENTER_X + CIRCLE_RADIUS * Math.cos(nextAngle),
                    y: CENTER_Y + CIRCLE_RADIUS * Math.sin(nextAngle)
                };
                const game = findGameInfo(seasonData, chain[i], chain[i + 1]);
                drawArrow(svgEl, pos, nextPos, undefined, game);
            }

            drawTeamNode(svgEl, chain[i], pos, teamMap.get(chain[i]));
        }
    }

    // Center NWSL logo
    drawCenterLogo(svgEl);

    // Teams not in the chain — shown as a cluster anchored to the bottom
    const allUnconnected = hasChain ? missing : seasonData.teams.map(t => t.id);
    if (allUnconnected.length > 0) {
        const spacing = 55;
        const maxPerRow = 10;
        const rows = [];
        for (let i = 0; i < allUnconnected.length; i += maxPerRow) {
            rows.push(allUnconnected.slice(i, i + maxPerRow));
        }

        // Anchor cluster from the bottom of the viewBox, working upward
        const bottomMargin = 30;
        const lastRowY = VIEW_SIZE - bottomMargin - 22; // 22 = small team radius
        const clusterFirstRowY = lastRowY - (rows.length - 1) * 60;
        const labelY = clusterFirstRowY - 35;

        // Label
        const labelText = hasChain ? 'Not yet connected' : 'No results yet';
        const label = createSvgElement('text', {
            x: CENTER_X, y: labelY,
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif',
            'font-size': '14',
            fill: '#999'
        });
        label.textContent = labelText;
        svgEl.appendChild(label);

        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const rowStartX = CENTER_X - ((row.length - 1) * spacing) / 2;
            for (let i = 0; i < row.length; i++) {
                const pos = { x: rowStartX + i * spacing, y: clusterFirstRowY + r * 60 };
                drawTeamNode(svgEl, row[i], pos, teamMap.get(row[i]), 22);
            }
        }
    }

    // Title
    drawTitle(svgEl, `The ${seasonData.season} NWSL Circle of Parity`);

    // Status text
    if (hasChain) {
        const status = createSvgElement('text', {
            x: CENTER_X, y: CENTER_Y + 60,
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif',
            'font-size': '16',
            fill: '#666'
        });
        status.textContent = `Longest chain: ${chain.length} of ${totalTeams} teams`;
        svgEl.appendChild(status);
    }
}

// ---- Drawing helpers ----

function getCirclePosition(index, total) {
    const angle = (2 * Math.PI * index / total) - Math.PI / 2;
    return {
        x: CENTER_X + CIRCLE_RADIUS * Math.cos(angle),
        y: CENTER_Y + CIRCLE_RADIUS * Math.sin(angle)
    };
}

function getTeamRadius(teamCount) {
    // Scale logos so arrows have room. With 10 teams the default
    // TEAM_RADIUS fits perfectly; use sqrt for a gentler taper.
    const baseCount = 10;
    if (teamCount <= baseCount) return TEAM_RADIUS;
    return TEAM_RADIUS * Math.sqrt(baseCount / teamCount);
}

function drawTeamNode(svgEl, teamId, pos, teamData, radius) {
    const r = radius || TEAM_RADIUS;

    // Logo image at full size, no background circle or clipping
    const img = createSvgElement('image', {
        x: pos.x - r, y: pos.y - r,
        width: r * 2, height: r * 2,
        cursor: 'pointer'
    });
    img.setAttributeNS(XLINK_NS, 'href', teamData.logo);

    // Tooltip: team name + record
    const tooltipHtml = teamData.record
        ? `<strong>${teamData.name}</strong><br>${teamData.record}`
        : `<strong>${teamData.name}</strong>`;
    img.addEventListener('mouseenter', e => showTooltip(e, tooltipHtml));
    img.addEventListener('mousemove', e => moveTooltip(e));
    img.addEventListener('mouseleave', hideTooltip);
    img.addEventListener('touchstart', e => { e.preventDefault(); showTooltip(e, tooltipHtml); });

    svgEl.appendChild(img);
}

function drawCenterLogo(svgEl) {
    // Logo + title block centered in the ring.
    // Ring inner area spans CENTER_Y ± CIRCLE_RADIUS (y: 100–660).
    // Logo occupies ~60% of ring diameter; positioned above center
    // so the 2-line title fits below it within the ring.
    const logoSize = 310;
    // Logo top edge ~85px below the ring top (100+85=185)
    const logoTop = CENTER_Y - CIRCLE_RADIUS + 85;
    const img = createSvgElement('image', {
        x: CENTER_X - logoSize / 2,
        y: logoTop,
        width: logoSize, height: logoSize
    });
    img.setAttributeNS(XLINK_NS, 'href', 'assets/logos/nwsl.png');
    svgEl.appendChild(img);
}

function drawTitle(svgEl, text) {
    // Title sits below the center logo
    const logoSize = 310;
    const logoTop = CENTER_Y - CIRCLE_RADIUS + 85;
    const textTop = logoTop + logoSize + 30;

    // Split into two lines: "The YYYY NWSL" and "Circle of Parity"
    const match = text.match(/^The (\d+) NWSL (.+)$/);
    if (match) {
        const line1 = createSvgElement('text', {
            x: CENTER_X, y: textTop,
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif',
            'font-size': '26',
            'font-weight': 'bold',
            fill: '#333'
        });
        line1.textContent = `The ${match[1]} NWSL`;
        svgEl.appendChild(line1);

        const line2 = createSvgElement('text', {
            x: CENTER_X, y: textTop + 32,
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif',
            'font-size': '26',
            'font-weight': 'bold',
            fill: '#333'
        });
        line2.textContent = match[2];
        svgEl.appendChild(line2);
    } else {
        const title = createSvgElement('text', {
            x: CENTER_X, y: textTop + 16,
            'text-anchor': 'middle',
            'font-family': 'Arial, sans-serif',
            'font-size': '26',
            'font-weight': 'bold',
            fill: '#333'
        });
        title.textContent = text;
        svgEl.appendChild(title);
    }
}

function drawArrow(svgEl, from, to, nodeRadius, gameInfo) {
    const r = nodeRadius || TEAM_RADIUS;
    // Compute angles of the from/to points on the main circle
    const fromAngle = Math.atan2(from.y - CENTER_Y, from.x - CENTER_X);
    const toAngle = Math.atan2(to.y - CENTER_Y, to.x - CENTER_X);

    // Shorten start/end along the circle arc to clear team logos
    const startGap = (r + 4) / CIRCLE_RADIUS; // angular gap in radians
    const endGap = (r + 8) / CIRCLE_RADIUS;
    const startAngle = fromAngle + startGap;
    const endAngle = toAngle - endGap;

    const startX = CENTER_X + CIRCLE_RADIUS * Math.cos(startAngle);
    const startY = CENTER_Y + CIRCLE_RADIUS * Math.sin(startAngle);
    const endX = CENTER_X + CIRCLE_RADIUS * Math.cos(endAngle);
    const endY = CENTER_Y + CIRCLE_RADIUS * Math.sin(endAngle);

    const arcD = `M ${startX} ${startY} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 1 ${endX} ${endY}`;

    // Invisible wider hit target for easier hovering
    const hitTarget = createSvgElement('path', {
        d: arcD,
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 14,
        cursor: 'pointer'
    });
    svgEl.appendChild(hitTarget);

    // Visible arrow
    const path = createSvgElement('path', {
        d: arcD,
        fill: 'none',
        stroke: ARROW_COLOR,
        'stroke-width': ARROW_WIDTH,
        'marker-end': 'url(#arrowhead)',
        'pointer-events': 'none'
    });
    svgEl.appendChild(path);

    // Tooltip on the hit target
    if (gameInfo) {
        const tooltipHtml = formatGameTooltip(gameInfo);
        hitTarget.addEventListener('mouseenter', e => showTooltip(e, tooltipHtml));
        hitTarget.addEventListener('mousemove', e => moveTooltip(e));
        hitTarget.addEventListener('mouseleave', hideTooltip);
        hitTarget.addEventListener('touchstart', e => { e.preventDefault(); showTooltip(e, tooltipHtml); });
    }
}

function addArrowMarker(svgEl) {
    const defs = createSvgElement('defs', {});
    const marker = createSvgElement('marker', {
        id: 'arrowhead',
        markerWidth: 10, markerHeight: 7,
        refX: 9, refY: 3.5,
        orient: 'auto', markerUnits: 'strokeWidth'
    });
    const polygon = createSvgElement('polygon', {
        points: '0 0, 10 3.5, 0 7',
        fill: ARROW_COLOR
    });
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);
}

function createSvgElement(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

// ---- Tooltip helpers ----

function showTooltip(evt, html) {
    const tip = document.getElementById('tooltip');
    tip.innerHTML = html;
    tip.classList.add('visible');
    moveTooltip(evt);
}

function moveTooltip(evt) {
    const tip = document.getElementById('tooltip');
    const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) + 12;
    const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) + 12;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').classList.remove('visible');
}

// Dismiss tooltip when tapping elsewhere on mobile
document.addEventListener('touchstart', e => {
    if (!e.target.closest('#tooltip')) hideTooltip();
});

function formatGameTooltip(game) {
    let lines = [];
    if (game.date) {
        const d = new Date(game.date + 'T00:00:00');
        lines.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
    if (game.score) {
        lines.push(`${game.winner} ${game.score.replace('-', ' - ')} ${game.loser}`);
    } else {
        lines.push(`${game.winner} beat ${game.loser}`);
    }
    return lines.join('<br>');
}

function findGameInfo(seasonData, winner, loser) {
    for (const week of seasonData.weeks) {
        for (const result of week.results) {
            if (result.winner === winner && result.loser === loser) {
                return result;
            }
        }
    }
    return null;
}

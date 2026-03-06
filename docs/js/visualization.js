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

/**
 * Render the parity visualization into the SVG element.
 */
function renderParity(svgEl, seasonData, parityResult) {
    svgEl.innerHTML = '';

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

    // Draw arrows between consecutive teams
    for (let i = 0; i < teamCount; i++) {
        const fromPos = getCirclePosition(i, teamCount);
        const toPos = getCirclePosition((i + 1) % teamCount, teamCount);
        drawArrow(svgEl, fromPos, toPos);
    }

    // Draw team circles with logos
    for (let i = 0; i < teamCount; i++) {
        const teamId = chain[i];
        const pos = getCirclePosition(i, teamCount);
        drawTeamNode(svgEl, teamId, pos, teamMap.get(teamId));
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
                drawArrow(svgEl, pos, nextPos);
            }

            drawTeamNode(svgEl, chain[i], pos, teamMap.get(chain[i]));
        }
    }

    // Center NWSL logo
    drawCenterLogo(svgEl);

    // Teams not in the chain — shown as a cluster below
    const allUnconnected = hasChain ? missing : seasonData.teams.map(t => t.id);
    if (allUnconnected.length > 0) {
        const clusterY = hasChain ? 700 : CENTER_Y + 120;
        const spacing = 55;
        const maxPerRow = 10;
        const rows = [];
        for (let i = 0; i < allUnconnected.length; i += maxPerRow) {
            rows.push(allUnconnected.slice(i, i + maxPerRow));
        }

        // Label
        const labelText = hasChain ? 'Not yet connected' : 'No results yet';
        const label = createSvgElement('text', {
            x: CENTER_X, y: clusterY - 45,
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
                const pos = { x: rowStartX + i * spacing, y: clusterY + r * 60 };
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

function drawTeamNode(svgEl, teamId, pos, teamData, radius) {
    const r = radius || TEAM_RADIUS;
    const g = createSvgElement('g', {});

    // White circle background
    const bg = createSvgElement('circle', {
        cx: pos.x, cy: pos.y, r: r,
        fill: 'white', stroke: '#cccccc', 'stroke-width': 2
    });
    g.appendChild(bg);

    // Clip path for logo
    const clipId = `clip-${teamId}`;
    const clipPath = createSvgElement('clipPath', { id: clipId });
    const clipCircle = createSvgElement('circle', {
        cx: pos.x, cy: pos.y, r: r - 2
    });
    clipPath.appendChild(clipCircle);
    svgEl.appendChild(clipPath);

    // Logo image
    const img = createSvgElement('image', {
        x: pos.x - r, y: pos.y - r,
        width: r * 2, height: r * 2,
        'clip-path': `url(#${clipId})`
    });
    img.setAttributeNS(XLINK_NS, 'href', teamData.logo);
    g.appendChild(img);

    svgEl.appendChild(g);
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

function drawArrow(svgEl, from, to) {
    // Compute angles of the from/to points on the main circle
    const fromAngle = Math.atan2(from.y - CENTER_Y, from.x - CENTER_X);
    const toAngle = Math.atan2(to.y - CENTER_Y, to.x - CENTER_X);

    // Shorten start/end along the circle arc to clear team circles
    const startGap = (TEAM_RADIUS + 4) / CIRCLE_RADIUS; // angular gap in radians
    const endGap = (TEAM_RADIUS + 8) / CIRCLE_RADIUS;
    const startAngle = fromAngle + startGap;
    const endAngle = toAngle - endGap;

    const startX = CENTER_X + CIRCLE_RADIUS * Math.cos(startAngle);
    const startY = CENTER_Y + CIRCLE_RADIUS * Math.sin(startAngle);
    const endX = CENTER_X + CIRCLE_RADIUS * Math.cos(endAngle);
    const endY = CENTER_Y + CIRCLE_RADIUS * Math.sin(endAngle);

    // SVG arc: follows the main circle's circumference
    // sweep-flag=1 for clockwise
    const path = createSvgElement('path', {
        d: `M ${startX} ${startY} A ${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 1 ${endX} ${endY}`,
        fill: 'none',
        stroke: ARROW_COLOR,
        'stroke-width': ARROW_WIDTH,
        'marker-end': 'url(#arrowhead)'
    });
    svgEl.appendChild(path);
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

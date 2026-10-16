import { bindText, escapeXml, initials, isSafeSrc, resolveColor } from './bind';
    import { approxMeasure, fitText } from './fitText';
import QRCode from 'qrcode';
    
    const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';
    const num = (v) => Math.round(v * 100) / 100; // keep SVG numbers short
    
    // ---- RECT -----------------------------------------------------------------
    // Fill: a flat colour, or a linear gradient when fill2 is set (angle in degrees, 0 = left to right,
    // 90 = top to bottom). The gradient id starts with "clip-" so renderDraft makes it unique per card.
    function paint(l, t, d, key) {
    const c1 = escapeXml(resolveColor(l.fill, t, d));
    if (!l.fill2) return { defs: '', attr: `fill="${c1}"${l.opacity != null ? ` fill-opacity="${l.opacity}"` : ''}` };
    const c2 = escapeXml(resolveColor(l.fill2, t, d));
    const a = ((l.angle ?? 90) * Math.PI) / 180;
    const x1 = num(0.5 - Math.cos(a) / 2), y1 = num(0.5 - Math.sin(a) / 2);
    const x2 = num(0.5 + Math.cos(a) / 2), y2 = num(0.5 + Math.sin(a) / 2);
    const id = 'clip-g-' + key.replace(/[^\w-]/g, '_');
    const op = l.opacity != null ? ` stop-opacity="${l.opacity}"` : '';
    return {
        defs: `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"${op}/><stop offset="1" stop-color="${c2}"${op}/></linearGradient>`,
        attr: `fill="url(#${id})"`,
    };
    }

    function renderRect(l, t, d) {
    const p = paint(l, t, d, l.id);
    return `${p.defs}<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.radius ?? 0}" ${p.attr}/>`;
    }

    // Decorative shapes. polygon points are percentages (0-100) of the layer box.
    function renderPolygon(l, t, d) {
    const p = paint(l, t, d, l.id);
    const pts = l.points.map(([px, py]) => `${num(l.x + (px / 100) * l.w)},${num(l.y + (py / 100) * l.h)}`).join(' ');
    return `${p.defs}<polygon points="${pts}" ${p.attr}/>`;
    }
    function renderEllipse(l, t, d) {
    const p = paint(l, t, d, l.id);
    const stroke = l.stroke ? ` stroke="${escapeXml(resolveColor(l.stroke, t, d))}" stroke-width="${l.strokeWidth ?? 2}"${l.strokeOpacity != null ? ` stroke-opacity="${l.strokeOpacity}"` : ''}` : '';
    const fill = l.fill === 'none' ? 'fill="none"' : p.attr;
    return `${p.defs}<ellipse cx="${num(l.x + l.w / 2)}" cy="${num(l.y + l.h / 2)}" rx="${num(l.w / 2)}" ry="${num(l.h / 2)}" ${fill}${stroke}/>`;
    }
    
    // ---- TEXT -----------------------------------------------------------------
    // SVG text is placed by ONE point (x, y), where y is the BASELINE (the line
    // the letters sit on). text-anchor says how it sits on x:
    //   start = left aligned, middle = centered, end = right aligned.
    // fitText gives us the lines + font size; we write one <tspan> per line.
    function renderText(l, t, d, warnings, measure) {
    const { text: bound, missing } = bindText(l.text, d);
    if (missing.length > 0 || bound === '') {
        if (!l.optional) for (const field of missing) warnings.push({ layerId: l.id, kind: 'missing', field });
        return '';
    }
    const raw = l.uppercase ? bound.toUpperCase() : bound;
    const weight = l.weight ?? 400;
    const lineHeight = l.lineHeight ?? 1.2;
    
    const fit = fitText({
        text: raw, maxWidth: l.w, maxHeight: l.h, size: l.size,
        minSize: l.minSize ?? l.size, maxLines: l.maxLines ?? 1,
        lineHeight, weight, measure,
    });
    if (fit.truncated) warnings.push({ layerId: l.id, kind: 'overflow' });
    
    const align = l.align ?? 'left';
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const x = align === 'center' ? l.x + l.w / 2 : align === 'right' ? l.x + l.w : l.x;
    const color = escapeXml(resolveColor(l.color, t, d));
    
    const tspans = fit.lines
        .map((line, i) => `<tspan x="${num(x)}" y="${num(l.y + fit.size + i * fit.size * lineHeight)}">${escapeXml(line)}</tspan>`)
        .join('');
    
    return `<text font-family="${escapeXml(l.font || DEFAULT_FONT)}" font-size="${fit.size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${tspans}</text>`;
    }
    
    // ---- BADGE ----------------------------------------------------------------
    function renderBadge(l, t, d, warnings) {
    const { text: raw, missing } = bindText(l.text, d);
    if (missing.length > 0 || raw === '') {
        if (!l.optional) for (const field of missing) warnings.push({ layerId: l.id, kind: 'missing', field });
        return '';
    }
    const fill = escapeXml(resolveColor(l.fill, t, d));
    const color = escapeXml(resolveColor(l.color, t, d));
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    return (
        `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.radius ?? l.h / 2}" fill="${fill}"/>` +
        `<text x="${cx}" y="${cy}" font-family="${escapeXml(l.font || DEFAULT_FONT)}" font-size="${l.size}" font-weight="${l.weight ?? 700}" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(raw.toUpperCase())}</text>`
    );
    }
    
    // ---- IMAGE ----------------------------------------------------------------
    // fit "contain" -> preserveAspectRatio "meet":  whole image visible, NEVER
    //                  stretched (logos).
    // fit "cover"   -> "slice": fills the box and crops the extra (photos).
    // circle shape  -> a <clipPath> circle cuts the image round.
    function renderImage(l, t, d, warnings) {
    const { text: src, missing } = bindText(l.src, d);
    
    if (!src || !isSafeSrc(src)) {
        if (!l.optional) warnings.push({ layerId: l.id, kind: 'missing', field: missing[0] ?? l.src });
        return l.fallback === 'initials' ? renderInitials(l, t, d) + ringFor(l, t, d) : '';
    }
    
    // contain + align: where the logo sits inside its box when the box is wider
    // than the logo (left = hugs the left edge, right = hugs the right edge).
    const alignX = l.align === 'left' ? 'xMin' : l.align === 'right' ? 'xMax' : 'xMid';
    const par = l.fit === 'cover' ? 'xMidYMid slice' : `${alignX}YMid meet`;
    const img = `<image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" href="${escapeXml(src)}" preserveAspectRatio="${par}"`;
    
    const ring = l.ringColor ? { c: escapeXml(resolveColor(l.ringColor, t, d)), w: l.ringWidth ?? 6 } : null;
    void ring;
    if (l.shape === 'circle') {
        const id = 'clip-' + l.id.replace(/[^\w-]/g, '_');
        const r = Math.min(l.w, l.h) / 2;
        const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
        const rg = ring ? `<circle cx="${cx}" cy="${cy}" r="${r + ring.w / 2}" fill="none" stroke="${ring.c}" stroke-width="${ring.w}"/>` : '';
        return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${img} clip-path="url(#${id})"/>${rg}`;
    }
    if (l.radius) {
        const id = 'clip-' + l.id.replace(/[^\w-]/g, '_');
        const rg = ring ? `<rect x="${l.x - ring.w / 2}" y="${l.y - ring.w / 2}" width="${l.w + ring.w}" height="${l.h + ring.w}" rx="${l.radius + ring.w / 2}" fill="none" stroke="${ring.c}" stroke-width="${ring.w}"/>` : '';
        return `<clipPath id="${id}"><rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.radius}"/></clipPath>${img} clip-path="url(#${id})"/>${rg}`;
    }
    return `${img}/>`;
    }
    
    // The coloured outline around a photo (circle or rounded box). Used with and without a photo.
function ringFor(l, t, d) {
    if (!l.ringColor) return '';
    const c = escapeXml(resolveColor(l.ringColor, t, d));
    const w = l.ringWidth ?? 6;
    if (l.shape === 'circle') return `<circle cx="${l.x + l.w / 2}" cy="${l.y + l.h / 2}" r="${Math.min(l.w, l.h) / 2 + w / 2}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    return `<rect x="${l.x - w / 2}" y="${l.y - w / 2}" width="${l.w + w}" height="${l.h + w}" rx="${(l.radius ?? 0) + w / 2}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
}

// No photo -> grey shape with the person's initials in their role color.
    function renderInitials(l, t, d) {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const bg = l.shape === 'circle'
        ? `<circle cx="${cx}" cy="${cy}" r="${Math.min(l.w, l.h) / 2}" fill="#e5e7eb"/>`
        : `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.radius ?? 0}" fill="#e5e7eb"/>`;
    const letters = initials(d.name);
    if (!letters) return bg;
    const color = escapeXml(resolveColor('$role', t, d));
    const size = Math.min(l.w, l.h) * 0.4;
    return `${bg}<text x="${cx}" y="${cy}" font-family="${DEFAULT_FONT}" font-size="${num(size)}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(letters)}</text>`;
    }
    
    // ---- QR -------------------------------------------------------------------
// Drawn as ONE <path> (no image, no network), so it stays sharp at any size and
// in PDF. The white box keeps a 2-module quiet zone so phones can scan it.
function renderQr(l, t, d, warnings) {
    const { text: value, missing } = bindText(l.value, d);
    if (!value) {
    if (!l.optional) warnings.push({ layerId: l.id, kind: 'missing', field: missing[0] ?? 'qrUrl' });
    return '';
    }
    let qr;
    try {
    qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    } catch {
    warnings.push({ layerId: l.id, kind: 'overflow' }); // too long to fit in a QR code
    return '';
    }
    const n = qr.modules.size;
    const margin = 2;
    const side = Math.min(l.w, l.h);
    const cell = side / (n + margin * 2);
    const ox = l.x + (l.w - side) / 2;
    const oy = l.y + (l.h - side) / 2;
    let path = '';
    for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
        if (!qr.modules.get(r, c)) { c++; continue; }
        const start = c;
        while (c < n && qr.modules.get(r, c)) c++;
        path += `M${start + margin} ${r + margin}h${c - start}v1h${-(c - start)}z`;
    }
    }
    return (
    `<rect x="${num(ox)}" y="${num(oy)}" width="${num(side)}" height="${num(side)}" fill="#ffffff"/>` +
    `<path transform="translate(${num(ox)} ${num(oy)}) scale(${cell})" d="${path}" fill="#000000" shape-rendering="crispEdges"/>`
    );
}

// ---- ONE LAYER ------------------------------------------------------------
    function renderLayer(l, t, d, warnings, measure) {
    if (l.hideIfEmpty) {
        const v = d[l.hideIfEmpty];
        if (v === undefined || String(v).trim() === '') return '';
    }
    switch (l.type) {
        case 'rect':  return renderRect(l, t, d);
        case 'polygon': return renderPolygon(l, t, d);
        case 'ellipse': return renderEllipse(l, t, d);
        case 'text':  return renderText(l, t, d, warnings, measure);
        case 'badge': return renderBadge(l, t, d, warnings);
        case 'image': return renderImage(l, t, d, warnings);
        case 'qr':    return renderQr(l, t, d, warnings);
        default:
        // anything unknown
        warnings.push({ layerId: l.id, kind: 'unsupported' });
        return '';
    }
    }
    
    // ---- WHOLE CARD -----------------------------------------------------------
    // options.measure lets you plug in real font measuring later.
    export function renderCard(t, data, options = {}) {
    const measure = options.measure ?? approxMeasure;
    const warnings = [];
    const body = t.layers.map((l) => renderLayer(l, t, data, warnings, measure)).join('\n  ');
    const { width, height, background } = t.canvas;
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n` +
        `  <rect width="100%" height="100%" fill="${escapeXml(background)}"/>\n` +
        `  ${body}\n</svg>`;
    return { svg, warnings };
    }
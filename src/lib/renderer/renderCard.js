    import { bindText, escapeXml, initials, isSafeSrc, resolveColor } from './bind';
    import { approxMeasure, fitText } from './fitText';
    
    const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';
    const num = (v) => Math.round(v * 100) / 100; // keep SVG numbers short
    
    // ---- RECT -----------------------------------------------------------------
    function renderRect(l, t, d) {
    const fill = escapeXml(resolveColor(l.fill, t, d));
    return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.radius ?? 0}" fill="${fill}"/>`;
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
        return l.fallback === 'initials' ? renderInitials(l, t, d) : '';
    }
    
    // contain + align: where the logo sits inside its box when the box is wider
    // than the logo (left = hugs the left edge, right = hugs the right edge).
    const alignX = l.align === 'left' ? 'xMin' : l.align === 'right' ? 'xMax' : 'xMid';
    const par = l.fit === 'cover' ? 'xMidYMid slice' : `${alignX}YMid meet`;
    const img = `<image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" href="${escapeXml(src)}" preserveAspectRatio="${par}"`;
    
    if (l.shape === 'circle') {
        const id = 'clip-' + l.id.replace(/[^\w-]/g, '_');
        const r = Math.min(l.w, l.h) / 2;
        return `<clipPath id="${id}"><circle cx="${l.x + l.w / 2}" cy="${l.y + l.h / 2}" r="${r}"/></clipPath>${img} clip-path="url(#${id})"/>`;
    }
    return `${img}/>`;
    }
    
    // No photo -> grey shape with the person's initials in their role color.
    function renderInitials(l, t, d) {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const bg = l.shape === 'circle'
        ? `<circle cx="${cx}" cy="${cy}" r="${Math.min(l.w, l.h) / 2}" fill="#e5e7eb"/>`
        : `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="#e5e7eb"/>`;
    const letters = initials(d.name);
    if (!letters) return bg;
    const color = escapeXml(resolveColor('$role', t, d));
    const size = Math.min(l.w, l.h) * 0.4;
    return `${bg}<text x="${cx}" y="${cy}" font-family="${DEFAULT_FONT}" font-size="${num(size)}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="central">${escapeXml(letters)}</text>`;
    }
    
    // ---- ONE LAYER ------------------------------------------------------------
    function renderLayer(l, t, d, warnings, measure) {
    if (l.hideIfEmpty) {
        const v = d[l.hideIfEmpty];
        if (v === undefined || String(v).trim() === '') return '';
    }
    switch (l.type) {
        case 'rect':  return renderRect(l, t, d);
        case 'text':  return renderText(l, t, d, warnings, measure);
        case 'badge': return renderBadge(l, t, d, warnings);
        case 'image': return renderImage(l, t, d, warnings);
        default:
        // 'qr' (Task 5) and anything unknown
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
    
    export function approxMeasure(text, size, weight = 400) {
    // Rough per-character widths (in "em", where 1 em = the font size), close to
    // Arial. CAPITALS are much wider than lowercase, and names are often
    // uppercased on cards, so we count them separately.
    const bold = weight >= 600;
    let em = 0;
    for (const ch of text) {
        if (ch === ' ') em += 0.28;
        else if (/[A-Z]/.test(ch)) em += bold ? 0.74 : 0.68;
        else if (/[a-z]/.test(ch)) em += bold ? 0.57 : 0.52;
        else if (/[0-9]/.test(ch)) em += 0.56;
        else if (/[.,:;'"!|()-]/.test(ch)) em += 0.3;
        else em += 0.6;
    }
    return em * size;
    }
    
    // A single word wider than the box: split it by characters.
    function breakLongWord(word, size, maxWidth, measure, weight) {
    const parts = [];
    let current = '';
    for (const ch of word) {
        // leave room for a "-" so a split word reads as "RAMACHAN-" / "DRAN"
        if (current && measure(current + ch + '-', size, weight) > maxWidth) {
        parts.push(current + '-');
        current = ch;
        } else {
        current += ch;
        }
    }
    if (current) parts.push(current);
    return parts;
    }
    
    // Greedy wrap: keep adding words to the line until the next one doesn't fit.
    export function wrap(text, size, maxWidth, measure = approxMeasure, weight = 400) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? line + ' ' + word : word;
        if (measure(candidate, size, weight) <= maxWidth) {
        line = candidate;
        continue;
        }
        if (line) {
        lines.push(line);
        line = '';
        }
        if (measure(word, size, weight) <= maxWidth) {
        line = word;
        } else {
        const parts = breakLongWord(word, size, maxWidth, measure, weight);
        line = parts.pop();
        lines.push(...parts);
        }
    }
    if (line) lines.push(line);
    return lines;
    }
    
    function ellipsize(line, size, maxWidth, measure, weight) {
    let s = line.trimEnd();
    while (s.length > 0 && measure(s + '…', size, weight) > maxWidth) s = s.slice(0, -1).trimEnd();
    return s + '…';
    }
    
    function widestWord(text, size, measure, weight) {
    return Math.max(0, ...text.split(/\s+/).filter(Boolean).map((w) => measure(w, size, weight)));
    }
    
    // Returns { lines, size, truncated }
    export function fitText({
    text, maxWidth, maxHeight, size, minSize = size,
    maxLines = 1, lineHeight = 1.2, weight = 400, measure = approxMeasure,
    }) {
    if (!text) return { lines: [], size, truncated: false };
    
    // 1 + 2: try big -> small; at each size wrap, and accept the first that fits.
    // First pass refuses sizes where a word would have to be split in the
    // middle ("RAMACHAN-DRAN"): we'd rather shrink a little. Only if no size
    // works do we allow splitting words (second pass).
    for (const allowWordSplit of [false, true]) {
        for (let s = size; s >= minSize; s -= 1) {
        if (!allowWordSplit && widestWord(text, s, measure, weight) > maxWidth) continue;
        const lines = wrap(text, s, maxWidth, measure, weight);
        if (lines.length <= maxLines && lines.length * s * lineHeight <= maxHeight) {
            return { lines, size: s, truncated: false };
        }
        }
    }
    
    // 3: still doesn't fit at the smallest size -> keep what fits, end with "…"
    let lines = wrap(text, minSize, maxWidth, measure, weight);
    const rowsThatFit = Math.max(1, Math.floor(maxHeight / (minSize * lineHeight)));
    const keep = Math.min(maxLines, rowsThatFit);
    const wasCut = lines.length > keep;
    lines = lines.slice(0, keep);
    if (wasCut) lines[keep - 1] = ellipsize(lines[keep - 1], minSize, maxWidth, measure, weight);
    return { lines, size: minSize, truncated: wasCut };
    }
    
    import { describe, expect, it } from 'vitest';
    import { bindText, escapeXml, initials, isSafeSrc, resolveColor } from './bind';
    import { fitText, wrap } from './fitText';
    import { renderCard } from './renderCard';
    import modern from '../templates/modern.json';
    import { templates } from '../templates/index';
    
    const t = {
    id: 't', name: 't', version: 1,
    canvas: { width: 540, height: 856, background: '#fff' },
    roleColors: { participant: '#111', organizer: '#222', mentor: '#333', volunteer: '#444' },
    layers: [
        { id: 'name', type: 'text', x: 0, y: 0, w: 460, h: 100, text: '{{name}}',
        font: 'Arial', size: 44, minSize: 24, weight: 700, color: '#000', maxLines: 2, lineHeight: 1.15 },
        { id: 'badge', type: 'badge', x: 0, y: 200, w: 200, h: 50, text: '{{role}}',
        fill: '$role', color: '#fff', size: 20 },
        { id: 'logo', type: 'image', x: 0, y: 300, w: 160, h: 56, src: '{{logo}}', fit: 'contain', optional: true },
        { id: 'photo', type: 'image', x: 0, y: 400, w: 200, h: 200, src: '{{photo}}',
        fit: 'cover', shape: 'circle', fallback: 'initials' },
    ],
    };
    const PNG = 'data:image/png;base64,iVBORw0KGgo=';
    
    describe('bind helpers', () => {
    it('escapes special characters', () => {
        expect(escapeXml(`D'Souza & Co <Ltd>`)).toBe('D&apos;Souza &amp; Co &lt;Ltd&gt;');
    });
    it('replaces placeholders and reports missing ones', () => {
        expect(bindText('{{a}} - {{b}}', { a: 'x', b: 'y' }).text).toBe('x - y');
        expect(bindText('{{a}} {{b}}', { a: '  ' }).missing).toEqual(['a', 'b']);
    });
    it('resolves $role with a fallback', () => {
        expect(resolveColor('$role', t, { role: 'mentor' })).toBe('#333');
        expect(resolveColor('$role', t, {})).toBe('#64748b');
    });
    it('makes initials', () => {
        expect(initials('Aarav Shah')).toBe('AS');
        expect(initials('Madonna')).toBe('M');
        expect(initials('')).toBe('');
    });
    it('only allows safe image sources', () => {
        expect(isSafeSrc(PNG)).toBe(true);
        expect(isSafeSrc('https://x.com/a.png')).toBe(true);
        expect(isSafeSrc('javascript:alert(1)')).toBe(false);
    });
    });
    
    describe('fitText', () => {
    const base = { maxWidth: 460, maxHeight: 100, size: 44, minSize: 24, maxLines: 2, lineHeight: 1.15, weight: 700 };
    it('keeps a short name at full size on one line', () => {
        const r = fitText({ ...base, text: 'Aarav Shah' });
        expect(r).toMatchObject({ size: 44, truncated: false });
        expect(r.lines).toEqual(['Aarav Shah']);
    });
    it('shrinks and wraps a long name without cutting it', () => {
        const r = fitText({ ...base, text: 'Venkatasubramanian Ramachandran Iyer' });
        expect(r.truncated).toBe(false);
        expect(r.lines.length).toBe(2);
        expect(r.size).toBeLessThan(44);
    });
    it('breaks one huge word by characters', () => {
        const lines = wrap('A'.repeat(100), 24, 200);
        expect(lines.length).toBeGreaterThan(1);
    });
    it('truncates with an ellipsis when nothing fits', () => {
        const r = fitText({ ...base, text: 'word '.repeat(60) });
        expect(r.truncated).toBe(true);
        expect(r.lines.at(-1).endsWith('…')).toBe(true);
        expect(r.lines.length).toBeLessThanOrEqual(2);
    });
    it('handles empty text', () => {
        expect(fitText({ ...base, text: '' }).lines).toEqual([]);
    });
    });
    
    describe('renderCard', () => {
    it('renders text, badge and role color', () => {
        const { svg, warnings } = renderCard(t, { name: 'Asha', role: 'mentor', photo: PNG });
        expect(svg).toContain('Asha');
        expect(svg).toContain('MENTOR');
        expect(svg).toContain('fill="#333"');
        expect(warnings).toEqual([]);
    });
    it('escapes names so the SVG stays valid', () => {
        expect(renderCard(t, { name: 'A & B <x>', role: 'mentor' }).svg).toContain('A &amp; B &lt;x&gt;');
    });
    it('uses initials when the photo is missing, and warns', () => {
        const { svg, warnings } = renderCard(t, { name: 'Aarav Shah', role: 'mentor' });
        expect(svg).toContain('>AS<');
        expect(svg).not.toContain('<clipPath');
        expect(warnings).toEqual([{ layerId: 'photo', kind: 'missing', field: 'photo' }]);
    });
    it('uses the photo in a circle clip when given', () => {
        const { svg } = renderCard(t, { name: 'Aarav Shah', role: 'mentor', photo: PNG });
        expect(svg).toContain('<clipPath id="clip-photo">');
        expect(svg).toContain('xMidYMid slice');
    });
    it('keeps logo proportions (meet) and skips a missing optional logo silently', () => {
        expect(renderCard(t, { name: 'A', role: 'mentor', logo: PNG }).svg).toContain('xMidYMid meet');
        const { warnings } = renderCard(t, { name: 'A', role: 'mentor', photo: PNG });
        expect(warnings.find((w) => w.layerId === 'logo')).toBeUndefined();
    });
    it('rejects unsafe image sources', () => {
        const { svg } = renderCard(t, { name: 'A', role: 'mentor', logo: 'javascript:alert(1)' });
        expect(svg).not.toContain('javascript');
    });
    it('flags overflow when text must be cut', () => {
        const { warnings } = renderCard(t, { name: 'word '.repeat(80), role: 'mentor', photo: PNG });
        expect(warnings).toContainEqual({ layerId: 'name', kind: 'overflow' });
    });
    it('skips layers with missing data and records warnings', () => {
        const { warnings } = renderCard(t, {});
        expect(warnings.map((w) => w.field)).toEqual(['name', 'role', 'photo']);
    });
    });
    
    describe('image align', () => {
    it('left/right align hugs the side, default is centered', () => {
        const mk = (align) => ({ ...t, layers: [{ id: 'l', type: 'image', x: 0, y: 0, w: 100, h: 50, src: '{{logo}}', fit: 'contain', align }] });
        expect(renderCard(mk('left'), { logo: PNG }).svg).toContain('xMinYMid meet');
        expect(renderCard(mk('right'), { logo: PNG }).svg).toContain('xMaxYMid meet');
        expect(renderCard(mk(undefined), { logo: PNG }).svg).toContain('xMidYMid meet');
    });
    });
    
    describe('modern template', () => {
    const full = {
        name: 'Stuti Gupta', role: 'participant', idNumber: 'INC26-001', photo: PNG,
        logoLeft: PNG, logoRight: PNG,
        eventName: 'Incursion 2026', eventSubtitle: '24-Hour Hackathon', eventDate: '18 October 2026',
    };
    it('renders a complete card with no warnings', () => {
        const { svg, warnings } = renderCard(modern, full);
        expect(warnings).toEqual([]);
        for (const text of ['STUTI GUPTA', 'INCURSION 2026', '24-HOUR HACKATHON', 'ID: INC26-001', '18 OCTOBER 2026', 'PARTICIPANT']) {
        expect(svg).toContain(text);
        }
    });
    it('uses a different color for every role', () => {
        const colors = ['participant', 'organizer', 'mentor', 'volunteer'].map((role) => modern.roleColors[role]);
        expect(new Set(colors).size).toBe(4);
    });
    it('warns when logos or the ID are missing', () => {
        const { warnings } = renderCard(modern, { ...full, logoLeft: undefined, idNumber: undefined });
        expect(warnings.map((w) => w.layerId).sort()).toEqual(['id-number', 'logo-left']);
    });
    });
    
    describe('fitText prefers shrinking over splitting words', () => {
    it('keeps every word whole when a smaller size makes it fit', () => {
        const r = fitText({ text: 'VENKATASUBRAMANIAN RAMACHANDRAN IYER', maxWidth: 250, maxHeight: 200,
        size: 44, minSize: 18, maxLines: 4, lineHeight: 1.05, weight: 700 });
        expect(r.lines.join(' ')).toBe('VENKATASUBRAMANIAN RAMACHANDRAN IYER');
        expect(r.truncated).toBe(false);
    });
    });
    
    describe.each(templates)('template: $name', (tpl) => {
    const full = {
        name: 'Stuti Gupta', role: 'participant', idNumber: 'INC26-001', photo: PNG,
        logoLeft: PNG, logoRight: PNG, eventName: 'Incursion 2026',
        eventSubtitle: '24-Hour Hackathon', eventDate: '18 October 2026', venue: 'SVNIT Surat',
    };
    it('renders a full card with no warnings', () => {
        expect(renderCard(tpl, full).warnings).toEqual([]);
    });
    it('has 4 different role colors and a role badge', () => {
        expect(new Set(Object.values(tpl.roleColors)).size).toBe(4);
        expect(tpl.layers.some((l) => l.type === 'badge')).toBe(true);
    });
    it('shows both logos and the ID', () => {
        const ids = tpl.layers.map((l) => l.id);
        expect(ids).toEqual(expect.arrayContaining(['logo-left', 'logo-right', 'id-number', 'photo']));
    });
    it('has unique layer ids and every layer is inside the card', () => {
        const ids = tpl.layers.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const l of tpl.layers) {
        expect(l.x).toBeGreaterThanOrEqual(0);
        expect(l.y).toBeGreaterThanOrEqual(0);
        expect(l.x + l.w).toBeLessThanOrEqual(tpl.canvas.width);
        expect(l.y + l.h).toBeLessThanOrEqual(tpl.canvas.height);
        }
    });
    it('fits a very long name without an overflow warning', () => {
        const { warnings } = renderCard(tpl, { ...full, name: 'Venkatasubramanian Ramachandran Iyer' });
        expect(warnings).toEqual([]);
    });
    });
    
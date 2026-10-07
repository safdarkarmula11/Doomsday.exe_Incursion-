    import fs from 'node:fs';
    import path from 'node:path';
    import { renderCard } from '../src/lib/renderer/renderCard';
    import { bufferToDataUri, fileToDataUri } from '../src/lib/renderer/assets';
    import { templates } from '../src/lib/templates/index';
    
    const root = process.cwd();
    
    // Your real logos, embedded as data URIs (see assets.js for why).
    const logo = (file) => {
    const p = path.join(root, 'public/logos', file);
    if (!fs.existsSync(p)) { console.warn('!! logo not found:', p); return undefined; }
    return fileToDataUri(p);
    };
    const logoLeft = logo('ACMLogo.png');
    const logoRight = logo('NIT_Surat_Logo.svg.webp');
    
    // A made-up portrait photo so you can test without real photos.
    const photo = bufferToDataUri(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#f59e0b"/><circle cx="200" cy="190" r="90" fill="#fff"/><rect x="80" y="300" width="240" height="200" rx="100" fill="#fff"/></svg>`));
    
    // EDIT THIS to change the event shown on the test cards.
    const event = {
    eventName: 'Incursion 2026', eventSubtitle: '24-Hour Hackathon', eventDate: '18 October 2026',
    venue: 'SVNIT Surat', logoLeft, logoRight,
    };
    
    const cases = {
    'participant': { ...event, name: 'Stuti Gupta', role: 'participant', idNumber: 'INC26-001', photo },
    'organizer': { ...event, name: 'Priya Patel', role: 'organizer', idNumber: 'INC26-ORG-01', photo },
    'mentor': { ...event, name: 'Dr. Rohan Mehta', role: 'mentor', idNumber: 'INC26-M-03', photo },
    'volunteer': { ...event, name: 'Kabir Singh', role: 'volunteer', idNumber: 'INC26-V-12', photo },
    'long-name': { ...event, name: 'Venkatasubramanian Ramachandran Iyer', role: 'participant', idNumber: 'INC26-002', photo },
    'very-long-name': { ...event, name: 'Venkatasubramanian Ramachandran Iyer Subramaniam Krishnamurthy Narayanan', role: 'participant', idNumber: 'INC26-003', photo },
    'no-photo': { ...event, name: 'Aarav Shah', role: 'participant', idNumber: 'INC26-004' },
    'special-chars': { ...event, name: "D'Souza & Co <Ltd>", role: 'mentor', idNumber: 'INC26-005', photo },
    'missing-id': { ...event, name: 'No Id Person', role: 'volunteer', photo },
    'missing-role': { ...event, name: 'No Role Person', idNumber: 'INC26-006', photo },
    'missing-logos': { ...event, logoLeft: undefined, logoRight: undefined, name: 'No Logo Person', role: 'participant', idNumber: 'INC26-007', photo },
    };
    
    const outDir = path.join(root, 'render-output');
    fs.mkdirSync(outDir, { recursive: true });
    
    let html = '<body style="font-family:sans-serif">';
    for (const tpl of templates) {
    html += `<h2>${tpl.name}</h2><div style="display:flex;flex-wrap:wrap;gap:16px">`;
    for (const [name, data] of Object.entries(cases)) {
        const { svg, warnings } = renderCard(tpl, data);
        const file = `${tpl.id}-${name}`;
        fs.writeFileSync(path.join(outDir, `${file}.svg`), svg);
        html += `<figure style="margin:0"><img src="${file}.svg" width="270" style="border:1px solid #ccc"><figcaption>${name}</figcaption></figure>`;
        console.log(file.padEnd(30), warnings.length ? JSON.stringify(warnings) : 'ok');
    }
    html += '</div>';
    }
    html += '</body>';
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
    console.log('\nOpen render-output/index.html in your browser.');
    
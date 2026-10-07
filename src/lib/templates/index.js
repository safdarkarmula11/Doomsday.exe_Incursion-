    import modern from './modern.json';
    import minimal from './minimal.json';
    import bold from './bold.json';
    
    export const templates = [modern, minimal, bold];
    
    export function getTemplate(id) {
    return templates.find((t) => t.id === id);
    }
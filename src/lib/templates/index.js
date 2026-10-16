import campus from './campus.json';
import midnight from './midnight.json';
import aurora from './aurora.json';
import noir from './noir.json';
import geometric from './geometric.json';
import modern from './modern.json';
import minimal from './minimal.json';
import bold from './bold.json';

// Every built-in design. The first three are the starting drafts for a new project;
// the rest can be added from "Add a design from a template".
export const templates = [campus, midnight, aurora, noir, geometric, modern, minimal, bold];
export const DEFAULT_DRAFT_IDS = ['campus', 'midnight', 'aurora'];

export function getTemplate(id) {
  return templates.find((t) => t.id === id);
}
// Recipes contain settings only, never attachments or student details.
export const RECIPE_VERSION = 1;
export const MAX_CUSTOM_RECIPES = 20;
export const RECIPE_BYTES = 32 * 1024;
const kinds = ['all', 'Images', 'Documents', 'Other', 'PDF'];

export function validateRecipe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== RECIPE_VERSION) throw new Error('Use a Hand-in Kit recipe file, version 1.');
  const text = (field, max, required = false) => {
    if (typeof value[field] !== 'string' || value[field].length > max || (required && !value[field].trim())) throw new Error(`Recipe ${field} is missing or too long.`);
    return value[field].trim();
  };
  const title = text('title', 60, true);
  const description = text('description', 240);
  const category = text('category', 30, true);
  if (!['number', 'keep'].includes(value.naming) || ![150, 300, 500, 1000].includes(value.targetKB)
      || ![1200, 1600, 2000].includes(value.maxEdge) || !Number.isInteger(value.budgetMB)
      || value.budgetMB < 1 || value.budgetMB > 80 || typeof value.group !== 'boolean' || typeof value.includeIndex !== 'boolean') {
    throw new Error('Recipe settings are outside the supported choices.');
  }
  if (!Array.isArray(value.requirements) || value.requirements.length > 8) throw new Error('A recipe can have up to eight file requirements.');
  const requirements = value.requirements.map(rule => {
    if (!rule || !kinds.includes(rule.kind) || !Number.isInteger(rule.min) || rule.min < 1 || rule.min > 40) throw new Error('Recipe requirements must use supported file types and counts from 1 to 40.');
    return { kind: rule.kind, min: rule.min };
  });
  // Explicit projection discards extra properties, URLs, code and prototype keys.
  return { version: RECIPE_VERSION, title, description, category, naming: value.naming, targetKB: value.targetKB,
    maxEdge: value.maxEdge, budgetMB: value.budgetMB, group: value.group, includeIndex: value.includeIndex, requirements };
}

export function parseRecipe(text) {
  if (new TextEncoder().encode(text).length > RECIPE_BYTES) throw new Error('Recipe files must be 32 KB or smaller.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. No settings were changed.'); }
  return validateRecipe(data);
}

const recipe = (id, title, description, category, budgetMB, requirements, changes = {}) => ({ id,
  ...validateRecipe({ version: 1, title, description, category, naming: 'number', targetKB: 300,
    maxEdge: 1600, budgetMB, group: true, includeIndex: false, requirements, ...changes }) });

export const BUILT_IN_RECIPES = Object.freeze([
  recipe('class-handin', 'Class hand-in', 'Number your work, keep scans small, and check the attachment count before sending.', 'School', 10, [{ kind: 'all', min: 1 }]),
  recipe('lab-record', 'Lab record', 'Keep written notes alongside two or more observation scans. A file index makes the pack easier to follow.', 'School', 8, [{ kind: 'Images', min: 2 }, { kind: 'Documents', min: 1 }], { includeIndex: true }),
  recipe('pdf-and-proof', 'PDF & proof', 'Check that a PDF and an image are both included. PDF contents still need your own review.', 'School', 5, [{ kind: 'PDF', min: 1 }, { kind: 'Images', min: 1 }], { targetKB: 150 }),
  recipe('design-handoff', 'Design handoff', 'Keep descriptive source names. Include a readable index for the next person opening the folder.', 'Creative', 40, [{ kind: 'all', min: 1 }], { naming: 'keep', targetKB: 1000, maxEdge: 2000, includeIndex: true }),
  recipe('photo-contact', 'Photo selection', 'Make a compact set of numbered JPEG copies, then compare each one with its original.', 'Creative', 15, [{ kind: 'Images', min: 3 }], { targetKB: 500 }),
  recipe('club-kit', 'Club application', 'Gather a document and a supporting image. Names and requirements are examples you can adapt.', 'Community', 10, [{ kind: 'Documents', min: 1 }, { kind: 'Images', min: 1 }]),
  recipe('tiny-mail', 'Small email pack', 'A two-megabyte budget makes it easy to spot a pack that needs another pass. It is a warning, not an upload limit.', 'Everyday', 2, [{ kind: 'all', min: 1 }], { targetKB: 150, maxEdge: 1200, group: false })
]);

export function requirementResults(rows, requirements) {
  return requirements.map(rule => {
    const count = rows.filter(row => rule.kind === 'all' || (rule.kind === 'PDF' ? row.extension === 'pdf' : row.kind === rule.kind)).length;
    return { ...rule, count, met: count >= rule.min };
  });
}

export function filterRecipes(recipes, query = '', category = 'all') {
  const needle = query.trim().toLocaleLowerCase();
  return recipes.filter(item => (category === 'all' || item.category === category)
    && `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase().includes(needle));
}

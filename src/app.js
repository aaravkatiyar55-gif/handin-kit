import { validateFiles, planFiles, prettyBytes, handInMessage, archiveName, cleanStem } from './core.js';
import { canOptimise, optimiseImage, demoFiles, imageDimensions } from './images.js';
import { zipBlob } from './zip.js';
import { BUILT_IN_RECIPES, MAX_CUSTOM_RECIPES, RECIPE_BYTES, validateRecipe, parseRecipe, requirementResults, filterRecipes } from './recipes.js';
import { FOLDERS, appearance, moveItem, packEntries, zipBytes, findDuplicates, fileMatches, packReport } from './workbench.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'handin-kit-workspace-v1';
const state = { items: [], removed: null, busy: false, controller: null, demo: false, duplicates: [],
  messageDirty: false, customRecipes: [], activeRecipeId: BUILT_IN_RECIPES[0].id, previewURLs: [], previewGeneration: 0,
  draftRules: [], editRecipeId: null, recipeSettings: null };
const controls = ['file-input', 'subject', 'student', 'naming', 'order', 'group', 'target', 'edge', 'include-index', 'budget', 'active-recipe', 'import-recipe', 'create-recipe', 'open-recipe-editor', 'forget-settings'];
let look = appearance();

function allRecipes() { return [...BUILT_IN_RECIPES, ...state.customRecipes]; }
function activeRecipe() { return allRecipes().find(recipe => recipe.id === state.activeRecipeId) || BUILT_IN_RECIPES[0]; }
function budgetMB() { return Math.min(80, Math.max(1, Math.round(Number($('budget').value) || 10))); }

function loadSaved() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text || text.length > 64 * 1024) return;
    const data = JSON.parse(text);
    look = appearance(data.appearance);
    if (Array.isArray(data.recipes)) {
      const ids = new Set();
      for (const value of data.recipes.slice(0, MAX_CUSTOM_RECIPES)) {
        try {
          if (!/^custom-[a-f0-9-]{36}$/.test(value.id) || ids.has(value.id)) continue;
          state.customRecipes.push({ id: value.id, ...validateRecipe(value) });
          ids.add(value.id);
        } catch { /* One invalid saved recipe must not block the rest of the workspace. */ }
      }
    }
  } catch { $('storage-status').textContent = 'Saved settings could not be loaded. The workbench is still usable.'; }
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: look, recipes: state.customRecipes }));
    $('storage-status').textContent = 'Appearance and saved recipes are stored on this browser only.';
    return true;
  } catch {
    $('storage-status').textContent = 'Browser storage is unavailable or full. Changes work for this visit; export recipes to keep them.';
    return false;
  }
}

function applyAppearance() {
  for (const [key, value] of Object.entries(look)) { document.documentElement.dataset[key] = value; $(key).value = value; }
  document.querySelector('meta[name="theme-color"]').content = look.theme === 'night' ? '#18232b' : look.theme === 'mint' ? '#edf4ee' : '#f6f2e9';
}

function updateRecipeSelect() {
  const select = $('active-recipe');
  select.replaceChildren(...allRecipes().map(recipe => {
    const option = node('option', '', recipe.title);
    option.value = recipe.id;
    return option;
  }));
  select.value = activeRecipe().id;
}

function applyRecipe(id, announce = true) {
  if (state.busy) return;
  const recipe = allRecipes().find(item => item.id === id);
  if (!recipe) return;
  state.activeRecipeId = recipe.id;
  $('active-recipe').value = recipe.id;
  $('naming').value = recipe.naming;
  $('target').value = String(recipe.targetKB);
  $('edge').value = String(recipe.maxEdge);
  $('budget').value = String(recipe.budgetMB);
  $('group').checked = recipe.group;
  $('include-index').checked = recipe.includeIndex;
  render();
  if (announce) say(`${recipe.title} applied. Files and your identity fields stay in place. Scan settings affect the next image-processing pass.`);
}

function options() {
  return { subject: $('subject').value, student: $('student').value, naming: $('naming').value,
    order: $('order').value, group: $('group').checked, includeIndex: $('include-index').checked, budgetMB: budgetMB() };
}

function say(text, kind = 'note') {
  $('status').textContent = text;
  $('status').dataset.kind = kind;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function refreshSummary(rows) {
  const original = rows.reduce((sum, row) => sum + row.file.size, 0);
  const prepared = rows.reduce((sum, row) => sum + row.blob.size, 0);
  const saved = Math.max(0, original - prepared);
  $('count').textContent = `${rows.length} ${rows.length === 1 ? 'file' : 'files'}`;
  $('empty').hidden = rows.length > 0;
  $('list-area').hidden = !rows.length;
  const sampleCount = state.items.filter(item => item.demo).length;
  state.demo = sampleCount > 0;
  $('sample-label').hidden = !sampleCount;
  $('sample-label').textContent = sampleCount === rows.length ? 'FICTIONAL DEMO FILES · NOT YOUR DOCUMENTS' : `INCLUDES ${sampleCount} FICTIONAL DEMO FILES · NOT YOUR DOCUMENTS`;
  $('original-size').textContent = prettyBytes(original);
  $('prepared-size').textContent = prettyBytes(prepared);
  $('saving').textContent = saved ? `${Math.round(saved / original * 100)}% less` : '—';
  $('saving-label').textContent = saved ? `${prettyBytes(saved)} saved` : rows.length ? 'No byte savings yet' : 'No files yet';
  if (!state.messageDirty) $('message').value = rows.length ? handInMessage(rows, options()) : '';
  $('message').disabled = state.busy || !rows.length;
  $('reset-message').disabled = state.busy || !rows.length;
  $('message-state').textContent = state.messageDirty ? 'Your edited message is kept as the pack changes. Check its filenames and count before copying.' : 'The suggestion follows your pack until you edit it. This tool never sends the message.';
  const estimate = rows.length ? zipBytes(packEntries(rows, options())) : 0;
  const limit = budgetMB() * 1024 * 1024;
  $('budget-size').textContent = rows.length ? `${prettyBytes(estimate)} ZIP` : 'No files yet';
  $('budget-text').textContent = estimate > limit ? `${prettyBytes(estimate - limit)} over budget. Reduce scans or remove files; downloads remain available.` : `${prettyBytes(Math.max(0, limit - estimate))} available in the ${budgetMB()} MB budget. Includes notes and the optional index.`;
  $('budget-meter').value = Math.min(100, estimate / limit * 100);
  $('budget-meter').dataset.over = String(estimate > limit);
  const checks = requirementResults(rows, activeRecipe().requirements);
  $('requirements').replaceChildren(...checks.map(rule => {
    const li = node('li', rule.met ? 'met' : 'unmet', `${rule.met ? '✓' : '○'} ${rule.kind === 'all' ? 'Any files' : rule.kind}: ${rule.count} of ${rule.min} needed`);
    return li;
  }));
  if (!checks.length) $('requirements').append(node('li', '', 'No file-count requirements in this recipe.'));
  $('active-description').textContent = activeRecipe().description;
}

function updatePaths(rows) {
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const li of $('file-list').children) {
    const row = byId.get(li.dataset.id);
    if (!row) continue;
    li.querySelector('.planned-path').textContent = row.path;
    li.querySelector('.name-editor').placeholder = `Custom name (optional): ${row.stem}`;
  }
  refreshSummary(rows);
}

function removeItems(ids) {
  state.removed = { entries: state.items.map((item, index) => ({ item, index })).filter(entry => ids.includes(entry.item.id)), demo: state.demo };
  state.items = state.items.filter(item => !ids.includes(item.id));
  state.duplicates = [];
  render();
  say('Removed from this pack. Your device files are unchanged. Undo restores this removal.');
  $('undo').focus();
}

function render() {
  const rows = planFiles(state.items, options());
  refreshSummary(rows);
  for (const id of controls) $(id).disabled = state.busy;
  $('dropzone').setAttribute('aria-disabled', String(state.busy));
  $('demo').disabled = state.busy || rows.length > 0;
  $('download').disabled = state.busy || !rows.length;
  $('copy').disabled = state.busy || !rows.length;
  $('report').disabled = state.busy || !rows.length;
  $('duplicates').disabled = state.busy || rows.length < 2;
  $('clear').disabled = state.busy || !rows.length;
  $('undo').disabled = state.busy || !state.removed;
  $('optimise').disabled = state.busy || !state.items.some(item => canOptimise(item.file));
  $('restore').disabled = state.busy || !state.items.some(item => item.prepared);
  $('cancel').hidden = !state.busy;
  $('duplicate-summary').hidden = !state.duplicates.length;
  $('remove-duplicates').disabled = state.busy;
  $('duplicate-text').textContent = `${state.duplicates.length} exact duplicate ${state.duplicates.length === 1 ? 'copy' : 'copies'} found by SHA-256 of original file bytes. Renaming or JPEG conversion does not change this check.`;
  const list = $('file-list');
  list.replaceChildren();
  let visible = 0;
  for (const row of rows) {
    if (!fileMatches(row, $('file-search').value, $('file-kind').value)) continue;
    visible++;
    const li = node('li', 'file-row');
    li.dataset.id = row.id;
    li.append(node('span', 'file-number', String(row.number).padStart(2, '0')));
    const detail = node('div', 'file-detail');
    detail.append(node('p', 'original-name', row.file.name), node('p', 'planned-path', row.path));
    const editor = node('input', 'name-editor');
    editor.type = 'text';
    editor.maxLength = 80;
    editor.placeholder = `Custom name (optional): ${row.stem}`;
    editor.value = row.customName || '';
    editor.setAttribute('aria-label', `Custom name for file ${row.number}, ${row.file.name}`);
    editor.disabled = state.busy;
    editor.addEventListener('input', () => {
      const originalItem = state.items.find(item => item.id === row.id);
      originalItem.customName = editor.value;
      // Preserve the focused input and caret, including while the list is filtered.
      const updated = planFiles(state.items, options());
      updatePaths(updated);
      say('Filename preview updated. Duplicate names receive a safe suffix.');
    });
    detail.append(editor);
    const route = node('select', 'folder-editor');
    route.setAttribute('aria-label', `Folder for file ${row.number}, ${row.file.name}`);
    for (const folder of FOLDERS) {
      const option = node('option', '', folder === '' ? 'Folder: automatic' : folder === 'root' ? 'Folder: pack root' : `Folder: ${folder}`);
      option.value = folder; route.append(option);
    }
    route.value = row.folder || '';
    route.disabled = state.busy;
    route.addEventListener('change', () => { state.items.find(item => item.id === row.id).folder = route.value; updatePaths(planFiles(state.items, options())); });
    detail.append(route);
    if (row.note) detail.append(node('p', 'file-note', row.note));
    if (state.duplicates.some(duplicate => duplicate.id === row.id)) detail.append(node('p', 'duplicate-badge', 'Exact duplicate copy'));
    const meta = node('div', 'file-meta');
    if (row.prepared) meta.append(node('del', '', prettyBytes(row.file.size)));
    meta.append(node('strong', '', prettyBytes(row.blob.size)));
    const remove = node('button', 'remove-file', 'Remove');
    remove.setAttribute('aria-label', `Remove file ${row.number}, ${row.file.name}`);
    remove.disabled = state.busy;
    remove.addEventListener('click', () => removeItems([row.id]));
    const preview = node('button', 'quiet-button preview-file', 'Preview');
    preview.setAttribute('aria-label', `Preview file ${row.number}, ${row.file.name}`);
    preview.disabled = state.busy;
    preview.addEventListener('click', () => openPreview(row));
    const movers = node('div', 'file-movers');
    for (const [direction, label] of [[-1, '↑'], [1, '↓']]) {
      const move = node('button', 'move-file', label);
      move.setAttribute('aria-label', `Move file ${row.number} ${direction < 0 ? 'up' : 'down'}`);
      const index = state.items.findIndex(item => item.id === row.id);
      move.disabled = state.busy || $('order').value !== 'picked' || index + direction < 0 || index + direction >= state.items.length;
      move.addEventListener('click', () => {
        state.items = moveItem(state.items, row.id, direction);
        render();
        say('File order updated. Numbers now follow the new order.');
        const moved = [...list.children].find(element => element.dataset.id === row.id);
        moved?.querySelector('.preview-file').focus();
      });
      movers.append(move);
    }
    meta.append(preview, movers, remove);
    li.append(detail, meta);
    list.append(li);
  }
  $('filter-result').textContent = `${visible} of ${rows.length} files shown. ${$('order').value === 'name' ? 'Switch to added order to move files manually.' : 'Use the arrows to change numbering order.'} Filters do not exclude files from the ZIP.`;
  renderMarketplace();
  return rows;
}

function addFiles(files, demo = false) {
  if (state.busy) return;
  const incoming = Array.from(files);
  const error = validateFiles(state.items, incoming);
  if (error) { say(error, 'error'); return; }
  state.items.push(...incoming.map(file => ({ id: crypto.randomUUID(), file, demo })));
  state.duplicates = [];
  state.demo = demo || (state.demo && !incoming.length);
  render();
  say(`${incoming.length} ${incoming.length === 1 ? 'file added' : 'files added'}. Review the planned names; originals stay unchanged.`, 'success');
}

function busyStart() {
  state.busy = true;
  state.controller = new AbortController();
  render();
  return state.controller.signal;
}

function busyEnd() { state.busy = false; state.controller = null; render(); }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function renderMarketplace() {
  const recipes = allRecipes();
  const categorySelect = $('recipe-category');
  const selected = categorySelect.value;
  categorySelect.replaceChildren(node('option', '', 'All categories'));
  categorySelect.firstElementChild.value = 'all';
  for (const category of new Set(recipes.map(recipe => recipe.category))) {
    const option = node('option', '', category); option.value = category; categorySelect.append(option);
  }
  categorySelect.value = [...categorySelect.options].some(option => option.value === selected) ? selected : 'all';
  const shown = filterRecipes(recipes, $('recipe-search').value, categorySelect.value);
  $('recipe-count').textContent = `${shown.length} ${shown.length === 1 ? 'recipe' : 'recipes'} shown · ${state.customRecipes.length} of ${MAX_CUSTOM_RECIPES} custom slots used`;
  $('recipe-grid').replaceChildren(...shown.map(recipe => {
    const card = node('article', 'recipe-card');
    card.dataset.active = String(recipe.id === state.activeRecipeId);
    card.append(node('p', 'recipe-category', `${recipe.category} · ${recipe.id.startsWith('custom-') ? 'SAVED HERE' : 'HAND-IN KIT'}`),
      node('h3', '', recipe.title), node('p', 'recipe-description', recipe.description),
      node('p', 'recipe-specs', `${recipe.budgetMB} MB budget · ${recipe.targetKB} KB per scan · ${recipe.requirements.length} file ${recipe.requirements.length === 1 ? 'check' : 'checks'}`));
    const actions = node('div', 'recipe-actions');
    const use = node('button', 'button primary', recipe.id === state.activeRecipeId ? 'Recipe selected' : 'Use recipe');
    use.disabled = state.busy || recipe.id === state.activeRecipeId;
    use.setAttribute('aria-label', `Use ${recipe.title} recipe`);
    use.addEventListener('click', () => { applyRecipe(recipe.id); $('active-recipe').focus(); });
    const share = node('button', 'quiet-button', 'Export');
    share.setAttribute('aria-label', `Export ${recipe.title} recipe`);
    share.addEventListener('click', () => {
      downloadBlob(new Blob([JSON.stringify(validateRecipe(recipe), null, 2) + '\n'], { type: 'application/json' }), `${cleanStem(recipe.title).toLowerCase()}.handin-recipe.json`);
      say('Recipe download started. It contains settings and checklist rules, not your attachments or workbench identity fields.');
    });
    actions.append(use, share);
    if (recipe.id.startsWith('custom-')) {
      const edit = node('button', 'quiet-button', 'Edit');
      edit.disabled = state.busy;
      edit.setAttribute('aria-label', `Edit ${recipe.title} recipe`);
      edit.addEventListener('click', () => openRecipeEditor(recipe));
      const remove = node('button', 'quiet-button', 'Delete');
      remove.disabled = state.busy;
      remove.setAttribute('aria-label', `Delete ${recipe.title} recipe`);
      remove.addEventListener('click', () => {
        state.customRecipes = state.customRecipes.filter(item => item.id !== recipe.id);
        if (state.activeRecipeId === recipe.id) state.activeRecipeId = BUILT_IN_RECIPES[0].id;
        const persisted = saveLocal(); updateRecipeSelect(); render();
        say(persisted ? 'Custom recipe deleted from this browser. Attachments and downloaded recipe files are unchanged.' : 'Recipe removed for this visit. Browser storage could not be updated.', persisted ? 'note' : 'error');
        $('create-recipe').focus();
      });
      actions.append(edit, remove);
    }
    card.append(actions);
    return card;
  }));
  if (!shown.length) $('recipe-grid').append(node('p', 'market-empty', 'No matching recipes. Clear the search, choose another category, or make a recipe from your settings.'));
}

function drawDraftRules() {
  $('draft-rules').replaceChildren(...state.draftRules.map((rule, index) => {
    const li = node('li', '', `${rule.kind === 'all' ? 'Any files' : rule.kind}: at least ${rule.min}`);
    const remove = node('button', 'quiet-button', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove requirement ${index + 1}`);
    remove.addEventListener('click', () => { state.draftRules.splice(index, 1); drawDraftRules(); $('add-rule').focus(); });
    li.append(remove); return li;
  }));
}

function openRecipeEditor(recipe = null) {
  if (state.busy) return;
  state.editRecipeId = recipe?.id || null;
  state.recipeSettings = recipe || { naming: $('naming').value, targetKB: Number($('target').value), maxEdge: Number($('edge').value),
    budgetMB: budgetMB(), group: $('group').checked, includeIndex: $('include-index').checked };
  state.draftRules = (recipe || activeRecipe()).requirements.map(rule => ({ ...rule }));
  $('recipe-name').value = recipe?.title || '';
  $('recipe-about').value = recipe?.description || '';
  $('recipe-title').textContent = recipe ? 'Edit your recipe' : 'Save your current setup';
  $('recipe-error').hidden = true;
  drawDraftRules(); $('recipe-dialog').showModal(); $('recipe-name').focus();
}

function clearPreview() {
  state.previewGeneration++;
  for (const url of state.previewURLs) URL.revokeObjectURL(url);
  state.previewURLs = [];
  $('preview-content').replaceChildren();
}

async function openPreview(row) {
  clearPreview();
  const generation = state.previewGeneration;
  $('preview-title').textContent = row.file.name;
  $('preview-description').textContent = row.prepared ? 'Original and prepared copy, side by side. Scroll a full-size view to inspect small text.' : 'Your original attachment. Preparing an image adds a comparison view.';
  $('preview-dialog').showModal(); $('close-preview').focus();
  const pane = node('div', 'preview-pane');
  $('preview-content').append(pane);
  try {
    if (canOptimise(row.file)) {
      const entries = [{ label: 'Original', blob: row.file }, ...(row.prepared ? [{ label: 'Prepared JPEG', blob: row.prepared.blob }] : [])];
      pane.remove();
      for (const entry of entries) {
        const dims = await imageDimensions(entry.blob);
        if (generation !== state.previewGeneration) return;
        const section = node('section', 'preview-pane');
        section.append(node('h3', '', entry.label), node('p', 'fine-print', `${dims.width} × ${dims.height} px · ${prettyBytes(entry.blob.size)}`));
        const viewport = node('div', 'preview-viewport');
        const img = node('img', 'scan-preview');
        const url = URL.createObjectURL(entry.blob);
        state.previewURLs.push(url);
        img.src = url; img.alt = `${entry.label} of ${row.file.name}`;
        img.addEventListener('error', () => { if (generation === state.previewGeneration) viewport.replaceChildren(node('p', 'fine-print', 'The browser could not display this image. Original kept.')); });
        viewport.append(img);
        const label = node('label', 'check', 'Inspect at full size');
        const zoom = node('input', ''); zoom.type = 'checkbox'; label.prepend(zoom);
        zoom.addEventListener('change', () => { viewport.dataset.zoom = String(zoom.checked); });
        section.append(label, viewport); $('preview-content').append(section);
      }
    } else if (/\.(txt|csv|json|md)$/i.test(row.file.name)) {
      const text = await row.file.slice(0, 64 * 1024).text();
      if (generation !== state.previewGeneration) return;
      pane.append(node('pre', 'text-preview', text));
      if (row.file.size > 64 * 1024) pane.append(node('p', 'fine-print', 'Only the first 64 KB is shown. The complete file remains in the pack.'));
    } else {
      pane.append(node('p', '', 'Inline preview supports JPEG, PNG, WebP and TXT/CSV/JSON/Markdown. PDF, SVG and other formats remain unchanged in the ZIP; open them with a suitable viewer on your device.'));
    }
  } catch (error) {
    if (generation !== state.previewGeneration) return;
    $('preview-content').append(node('p', 'status', error.message || 'Preview unavailable. Original kept.'));
  }
}

for (const id of ['theme', 'accent', 'density']) $(id).addEventListener('change', () => {
  look = appearance({ theme: $('theme').value, accent: $('accent').value, density: $('density').value });
  applyAppearance(); saveLocal();
});
$('active-recipe').addEventListener('change', () => applyRecipe($('active-recipe').value));
for (const id of ['recipe-search', 'recipe-category']) $(id).addEventListener('input', renderMarketplace);
for (const id of ['file-search', 'file-kind']) $(id).addEventListener('input', render);
$('budget').addEventListener('input', () => refreshSummary(planFiles(state.items, options())));
$('budget').addEventListener('change', () => { $('budget').value = String(budgetMB()); refreshSummary(planFiles(state.items, options())); });
$('create-recipe').addEventListener('click', () => openRecipeEditor());
$('open-recipe-editor').addEventListener('click', () => openRecipeEditor());
$('close-recipe').addEventListener('click', () => $('recipe-dialog').close());
$('close-preview').addEventListener('click', () => $('preview-dialog').close());
$('preview-dialog').addEventListener('close', clearPreview);
$('add-rule').addEventListener('click', () => {
  const min = Number($('rule-min').value);
  const kind = $('rule-kind').value;
  if (!Number.isInteger(min) || min < 1 || min > 40) { $('recipe-error').hidden = false; $('recipe-error').textContent = 'Use a whole count from 1 to 40.'; return; }
  const existing = state.draftRules.find(rule => rule.kind === kind);
  if (existing) existing.min = min;
  else if (state.draftRules.length < 8) state.draftRules.push({ kind, min });
  else { $('recipe-error').hidden = false; $('recipe-error').textContent = 'Use up to eight requirements.'; return; }
  $('recipe-error').hidden = true; drawDraftRules();
});
$('recipe-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    if (!state.editRecipeId && state.customRecipes.length >= MAX_CUSTOM_RECIPES) throw new Error('All 20 custom recipe slots are used. Export and delete one before adding another.');
    const recipe = { id: state.editRecipeId || `custom-${crypto.randomUUID()}`, ...validateRecipe({ ...state.recipeSettings,
      version: 1, title: $('recipe-name').value, description: $('recipe-about').value, category: 'My recipes', requirements: state.draftRules }) };
    const index = state.customRecipes.findIndex(item => item.id === recipe.id);
    if (index >= 0) state.customRecipes[index] = recipe;
    else state.customRecipes.push(recipe);
    const saved = saveLocal();
    updateRecipeSelect(); $('recipe-dialog').close(); applyRecipe(recipe.id, false);
    say(saved ? 'Recipe saved on this browser and applied. Export it for a portable copy.' : 'Recipe created for this visit and applied. Storage is unavailable; export it to keep a copy.', saved ? 'success' : 'note');
    $('active-recipe').focus();
  } catch (error) { $('recipe-error').hidden = false; $('recipe-error').textContent = error.message; }
});
$('import-recipe').addEventListener('click', () => $('recipe-input').click());
$('recipe-input').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file || state.busy) return;
  try {
    if (file.size > RECIPE_BYTES) throw new Error('Recipe files must be 32 KB or smaller.');
    if (state.customRecipes.length >= MAX_CUSTOM_RECIPES) throw new Error('All 20 custom recipe slots are used. Export and delete one before importing.');
    const recipe = { id: `custom-${crypto.randomUUID()}`, ...parseRecipe(await file.text()), category: 'My recipes' };
    // Recheck after async reading: another import or operation may have started.
    if (state.busy || state.customRecipes.length >= MAX_CUSTOM_RECIPES) throw new Error('The workbench changed while reading. Try this import again when it is ready.');
    state.customRecipes.push(recipe);
    const saved = saveLocal(); updateRecipeSelect(); render();
    say(saved ? `Imported ${recipe.title}. Choose Use recipe when you want to apply it.` : 'Recipe imported for this visit. Storage is unavailable; export it to keep a copy.', saved ? 'success' : 'note');
  } catch (error) { say(error.message, 'error'); }
});
$('forget-settings').addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    state.customRecipes = []; look = appearance(); state.activeRecipeId = BUILT_IN_RECIPES[0].id;
    applyAppearance(); updateRecipeSelect(); render();
    $('storage-status').textContent = 'Saved recipes and appearance cleared. The current pack is still in this tab.';
    say('Only Hand-in Kit’s saved settings were cleared. Current attachments and downloaded files are unchanged.');
  } catch { $('storage-status').textContent = 'Browser storage could not be cleared. No reset was claimed.'; }
});
$('duplicates').addEventListener('click', async () => {
  const signal = busyStart();
  try {
    state.duplicates = await findDuplicates(state.items, { signal, onProgress: (done, total) => say(`Checking original bytes ${done} of ${total}…`) });
    say(state.duplicates.length ? `${state.duplicates.length} duplicate ${state.duplicates.length === 1 ? 'copy' : 'copies'} found. Review before removing.` : 'No exact duplicates found. Similar-looking scans with different bytes are not counted.', 'success');
  } catch (error) { say(error.name === 'AbortError' ? 'Duplicate check cancelled. No files removed.' : 'Duplicate checking is unavailable. Your pack is unchanged.', 'note'); }
  finally { busyEnd(); }
});
$('remove-duplicates').addEventListener('click', () => { if (!state.busy && state.duplicates.length) removeItems(state.duplicates.map(item => item.id)); });
$('message').addEventListener('input', () => { state.messageDirty = true; refreshSummary(planFiles(state.items, options())); });
$('reset-message').addEventListener('click', () => { state.messageDirty = false; refreshSummary(planFiles(state.items, options())); say('Suggestion rebuilt from the current pack.'); });
$('report').addEventListener('click', () => {
  const rows = planFiles(state.items, options());
  const report = packReport(rows, options(), requirementResults(rows, activeRecipe().requirements), activeRecipe().title);
  downloadBlob(new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' }), `hand-in-${cleanStem(options().subject || 'assignment').toLowerCase()}-report.json`);
  say('Report download started. It includes original filenames and sizes. Check it before sharing.');
});

$('file-input').addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
$('dropzone').addEventListener('keydown', event => {
  if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!state.busy) $('file-input').click(); }
});
$('dropzone').addEventListener('click', event => { if (state.busy) event.preventDefault(); });
for (const type of ['dragenter', 'dragover']) $('dropzone').addEventListener(type, event => {
  event.preventDefault(); if (!state.busy) $('dropzone').classList.add('dragging');
});
for (const type of ['dragleave', 'drop']) $('dropzone').addEventListener(type, event => {
  event.preventDefault(); $('dropzone').classList.remove('dragging');
  if (type === 'drop') addFiles(event.dataTransfer.files);
});
document.addEventListener('paste', event => {
  if (event.target.closest('input, textarea') || state.busy) return;
  const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
  if (files.length) { event.preventDefault(); addFiles(files); }
});
for (const id of ['subject', 'student', 'naming', 'order', 'group', 'include-index']) $(id).addEventListener('input', () => render());

$('demo').addEventListener('click', async () => {
  if (state.items.length) return;
  busyStart();
  say('Making fictional sample scans on this device…');
  try {
    const files = await demoFiles();
    const cancelled = state.controller.signal.aborted;
    busyEnd();
    if (cancelled) { say('Sample generation cancelled.'); return; }
    addFiles(files, true);
  } catch { busyEnd(); say('Could not generate samples in this browser. You can still choose your own files.', 'error'); }
});

$('optimise').addEventListener('click', async () => {
  const signal = busyStart();
  const candidates = state.items.filter(item => canOptimise(item.file));
  let changed = 0;
  let skipped = 0;
  try {
    for (let index = 0; index < candidates.length; index++) {
      const item = candidates[index];
      say(`Preparing scan ${index + 1} of ${candidates.length}…`);
      try {
        const result = await optimiseImage(item.file, { targetKB: Number($('target').value), maxEdge: Number($('edge').value), signal });
        if (result.changed) { item.prepared = result; changed++; }
        else { item.prepared = null; skipped++; }
        item.note = result.note;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        skipped++;
        item.prepared = null;
        item.note = 'Could not prepare this image. Original kept; other files are still usable.';
      }
    }
    say(`${changed} smaller ${changed === 1 ? 'copy' : 'copies'} ready${skipped ? `; ${skipped} kept unchanged` : ''}. Check small writing before sending.`, 'success');
  } catch (error) {
    say(error.name === 'AbortError' ? 'Processing cancelled. Completed copies remain; the rest are unchanged.' : 'Processing stopped. Originals are still available.', 'note');
  } finally { busyEnd(); }
});

$('restore').addEventListener('click', () => {
  for (const item of state.items) { item.prepared = null; item.note = ''; }
  render();
  say('Original images restored in this pack. Your device files were never changed.');
});
$('undo').addEventListener('click', () => {
  if (!state.removed) return;
  const error = validateFiles(state.items, state.removed.entries.map(entry => entry.item.file));
  if (error) { say(error, 'error'); return; }
  for (const entry of state.removed.entries) state.items.splice(entry.index, 0, entry.item);
  state.demo = state.removed.demo && state.demo;
  state.duplicates = [];
  state.removed = null;
  render();
  say('Removed files restored.', 'success');
});
$('clear').addEventListener('click', () => {
  state.items = []; state.removed = null; state.demo = false; state.duplicates = []; state.messageDirty = false;
  $('file-search').value = ''; $('file-kind').value = 'all';
  render(); say('Pack cleared. Files on your device are unchanged.'); $('demo').focus();
});
$('cancel').addEventListener('click', () => { state.controller?.abort(); say('Cancelling after the current image or file…'); });

$('download').addEventListener('click', async () => {
  const signal = busyStart();
  const settings = options();
  const rows = planFiles(state.items, settings);
  const entries = packEntries(rows, settings);
  try {
    const zip = await zipBlob(entries, { signal, onProgress: (done, total) => say(`Packing ${done} of ${total} files…`) });
    downloadBlob(zip, archiveName(settings.subject));
    say(`ZIP download started (${prettyBytes(zip.size)}). Open it and check the attachments before sending.`, 'success');
  } catch (error) { say(error.name === 'AbortError' ? 'Packing cancelled. No partial ZIP was downloaded.' : 'Could not make the ZIP. Your files remain available.', 'error'); }
  finally { busyEnd(); }
});

$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('message').value); say('Message copied. Edit it as needed; nothing was sent.', 'success'); }
  catch { $('message').focus(); $('message').select(); say('Message selected. Use your browser’s copy command; nothing was sent.'); }
});

loadSaved(); applyAppearance(); updateRecipeSelect(); applyRecipe(BUILT_IN_RECIPES[0].id, false);
const development = location.hostname === '127.0.0.1' && location.port === '4190';
if (development) $('offline-status').textContent = 'Development server · offline testing uses the build';
else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $('offline-status').textContent = navigator.onLine ? 'Available offline after this visit' : 'Offline · local processing works'; })
    .catch(() => { $('offline-status').textContent = 'Local processing · offline cache unavailable'; });
}
window.addEventListener('offline', () => { $('offline-status').textContent = 'Offline · local processing works'; });
window.addEventListener('online', () => { $('offline-status').textContent = 'Local processing · no analytics'; });

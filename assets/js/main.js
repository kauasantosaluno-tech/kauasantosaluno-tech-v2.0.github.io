// ── Utilities ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fileCategory(ext) {
  if (ext === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','gif','webp','svg','bmp','avif'].includes(ext)) return 'image';
  if (['py','pyw'].includes(ext)) return 'python';
  if (['doc','docx','odt','rtf'].includes(ext)) return 'doc';
  if (['txt','md','csv','json','xml','html','htm','js','ts','css'].includes(ext)) return 'text';
  if (['xls','xlsx','ods'].includes(ext)) return 'sheet';
  if (['ppt','pptx'].includes(ext)) return 'slide';
  return 'other';
}

function fileEmoji(ext) {
  const map = {
    pdf:'📄', doc:'📝', docx:'📝', odt:'📝', rtf:'📝',
    txt:'📃', md:'📃', py:'🐍', pyw:'🐍',
    png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️', svg:'🖼️', avif:'🖼️',
    csv:'📊', xls:'📊', xlsx:'📊', ods:'📊',
    ppt:'📽️', pptx:'📽️',
    json:'📦', xml:'📦', zip:'🗜️', rar:'🗜️',
    js:'⚙️', ts:'⚙️', css:'🎨', html:'🌐',
    mp3:'🎵', mp4:'🎬', mov:'🎬',
  };
  return map[ext] || '📎';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function buildPath(post) {
  return post.folder ? `uploads/${post.folder}/${post.filename}` : `uploads/${post.filename}`;
}

// ── Syntax highlight (lightweight, no deps) ───────────────
function highlightPython(code) {
  const esc = code
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return esc
    // strings (single + double + triple)
    .replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
      '<span class="hl-str">$1</span>')
    // comments
    .replace(/(#[^\n]*)/g, '<span class="hl-cmt">$1</span>')
    // keywords
    .replace(/\b(def|class|return|import|from|as|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|with|raise|pass|break|continue|lambda|yield|global|nonlocal|del|assert|async|await)\b/g,
      '<span class="hl-kw">$1</span>')
    // built-ins
    .replace(/\b(print|len|range|type|int|float|str|list|dict|set|tuple|bool|open|input|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round|format|repr|isinstance|hasattr|getattr|setattr)\b/g,
      '<span class="hl-builtin">$1</span>')
    // decorators
    .replace(/(@\w+)/g, '<span class="hl-dec">$1</span>')
    // numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');
}

// ── State ─────────────────────────────────────────────────
let allPosts = [];
let currentView = 'grid';
let searchQuery = '';

// ── Load ──────────────────────────────────────────────────
async function loadPosts() {
  try {
    const r = await fetch('posts.json?v=' + Date.now());
    if (!r.ok) throw new Error();
    allPosts = await r.json();
  } catch {
    allPosts = [];
  }
  render();
  $('footerYear').textContent = new Date().getFullYear();
}

// ── Search wiring ──────────────────────────────────────────
const searchInput = $('searchInput');
const searchClear = $('searchClear');

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  searchClear.style.display = searchQuery ? 'flex' : 'none';
  render();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  render();
});

// ── Render ────────────────────────────────────────────────
function render() {
  const container = $('postsView');
  const empty = $('emptyState');

  // Filter by search query — matches title, description, folder, filename, ext
  function postMatches(p) {
    if (!searchQuery) return true;
    const haystack = [p.title, p.description, p.folder, p.filename, p.ext]
      .filter(Boolean).join(' ').toLowerCase();
    return searchQuery.split(/\s+/).every(term => haystack.includes(term));
  }

  let posts = allPosts.filter(postMatches);

  // Group by folder (project)
  const groups = {};
  posts.forEach(post => {
    const key = post.folder || 'Sem pasta';
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
  });

  if (posts.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    empty.innerHTML = searchQuery
      ? `Nenhum resultado para "<strong>${searchQuery}</strong>".<br><a href="#" id="clearSearch">Limpar busca →</a>`
      : `Nenhuma publicação ainda.<br><a href="admin/index.html">Adicionar no painel admin →</a>`;
    if (searchQuery) {
      document.getElementById('clearSearch')?.addEventListener('click', e => {
        e.preventDefault();
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        render();
      });
    }
    return;
  }
  empty.style.display = 'none';

  if (currentView === 'list') {
    container.className = 'posts-list-outer';
    container.innerHTML = Object.entries(groups).map(([folder, items]) => `
      <div class="project-list-group">
        <div class="project-list-header">
          <span class="project-list-icon">📁</span>
          <span class="project-list-name">${folder.replace(/-/g, ' ')}</span>
          <span class="project-count-badge">${items.length}</span>
        </div>
        ${items.map(listItemHTML).join('')}
      </div>`).join('');
  } else {
    // Grid: unified masonry-style, each project is a card group
    container.className = 'projects-grid';
    container.innerHTML = Object.entries(groups).map(([folder, items]) =>
      projectCardHTML(folder, items)
    ).join('');
  }

  // Events
  container.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => {
      openModal(allPosts.find(p => p.slug === el.dataset.slug));
    });
  });

  // Hover preview: flip + lazy load
  container.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const pop = card.querySelector('.card-preview-pop');
      if (!pop) return;
      const rect = card.getBoundingClientRect();
      pop.classList.toggle('flip-left', (window.innerWidth - rect.right) < 320);

      const pre = pop.querySelector('pre[data-src]');
      if (pre && pre.dataset.loaded !== 'true') {
        pre.dataset.loaded = 'true';
        fetch(pre.dataset.src)
          .then(r => r.text())
          .then(t => {
            const cat = pre.dataset.cat;
            if (cat === 'python') {
              pre.innerHTML = highlightPython(t.slice(0, 1500));
            } else {
              pre.textContent = t.slice(0, 1500);
            }
          })
          .catch(() => { pre.textContent = '(erro ao carregar)'; });
      }
    });
  });
}

// ── Project card (grid mode) ───────────────────────────────
function projectCardHTML(folder, posts) {
  return `
  <div class="project-card">
    <div class="project-card-header">
      <div class="project-card-icon">📁</div>
      <div class="project-card-meta">
        <span class="project-card-name">${folder.replace(/-/g, ' ')}</span>
        <span class="project-card-count">${posts.length} arquivo${posts.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="project-files">
      ${posts.map(fileCardHTML).join('')}
    </div>
  </div>`;
}

// ── File card (inside project card) ───────────────────────
function fileCardHTML(post) {
  const cat = fileCategory(post.ext);
  const path = buildPath(post);

  let thumb;
  if (cat === 'image') {
    thumb = `<img src="${path}" alt="${post.title}" loading="lazy" />`;
  } else {
    thumb = `
      <div class="file-icon-wrap">
        <span class="file-icon-big">${fileEmoji(post.ext)}</span>
        <span class="ext-chip">${post.ext}</span>
      </div>`;
  }

  // Popover content
  let popContent;
  if (cat === 'pdf') {
    popContent = `<iframe src="${path}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" loading="lazy"></iframe>`;
  } else if (cat === 'image') {
    popContent = `<img src="${path}" alt="${post.title}" loading="lazy" />`;
  } else if (cat === 'python') {
    popContent = `<pre class="py-preview" data-src="${path}" data-cat="python" data-loaded="false">Carregando…</pre>`;
  } else if (cat === 'text') {
    popContent = `<pre data-src="${path}" data-cat="text" data-loaded="false">Carregando…</pre>`;
  } else {
    popContent = `
      <div class="pop-no-preview">
        <span>${fileEmoji(post.ext)}</span>
        <span>.${post.ext.toUpperCase()}</span>
        <span style="font-size:11px">Clique para abrir</span>
      </div>`;
  }

  return `
  <div class="file-card" data-slug="${post.slug}">
    <div class="card-thumb">${thumb}</div>
    <div class="card-body">
      <div class="card-title" title="${post.title}">${post.title}</div>
      <div class="card-meta">
        <span>${formatDate(post.date)}</span>
        ${post.size ? `<span>${formatSize(post.size)}</span>` : ''}
      </div>
    </div>
    <div class="card-preview-pop">
      <div class="pop-header">
        <span>${fileEmoji(post.ext)}</span>
        <span>${post.title}</span>
      </div>
      <div class="pop-body">${popContent}</div>
    </div>
  </div>`;
}

// ── List item ──────────────────────────────────────────────
function listItemHTML(post) {
  return `
  <div class="list-item" data-slug="${post.slug}">
    <span class="list-icon">${fileEmoji(post.ext)}</span>
    <div class="list-info">
      <div class="list-title">${post.title}</div>
      <div class="list-meta">${formatDate(post.date)}${post.description ? ' · ' + post.description : ''}${post.size ? ' · ' + formatSize(post.size) : ''}</div>
    </div>
    <span class="list-badge">${post.ext.toUpperCase()}</span>
  </div>`;
}

// ── View toggle ───────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });
});

// ── Modal ─────────────────────────────────────────────────
function openModal(post) {
  if (!post) return;
  const path = buildPath(post);
  const cat = fileCategory(post.ext);

  $('modalTitleText').textContent = post.title;
  const body = $('modalBody');

  if (cat === 'image') {
    body.innerHTML = `<img src="${path}" alt="${post.title}" />`;
  } else if (cat === 'pdf') {
    body.innerHTML = `<iframe src="${path}" title="${post.title}"></iframe>`;
  } else if (cat === 'python') {
    body.innerHTML = `<div class="text-viewer py-modal-viewer" id="textContent"><span style="color:var(--muted)">Carregando…</span></div>`;
    fetch(path).then(r => r.text()).then(t => {
      const el = document.getElementById('textContent');
      if (el) el.innerHTML = highlightPython(t);
    });
  } else if (cat === 'text') {
    body.innerHTML = `<div class="text-viewer" id="textContent">Carregando…</div>`;
    fetch(path).then(r => r.text()).then(t => {
      const el = document.getElementById('textContent');
      if (el) el.textContent = t;
    });
  } else {
    body.innerHTML = `
      <div class="no-preview">
        <span class="icon">${fileEmoji(post.ext)}</span>
        <p>Pré-visualização não disponível para arquivos .${post.ext}.</p>
      </div>`;
  }

  $('modalFooter').innerHTML = `
    <div class="modal-info">
      <strong>${post.title}</strong>
      <p class="meta">${formatDate(post.date)}${post.description ? ' · ' + post.description : ''}${post.size ? ' · ' + formatSize(post.size) : ''}</p>
    </div>
    <a class="btn-download" href="${path}" download="${post.filename}">⬇ Baixar</a>`;

  $('modalOverlay').classList.add('open');
}

$('modalClose').addEventListener('click', () => $('modalOverlay').classList.remove('open'));
$('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) $('modalOverlay').classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modalOverlay').classList.remove('open'); });

loadPosts();

// ── Helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function fileEmoji(ext) {
  const map = {
    pdf:'📄', doc:'📝', docx:'📝', txt:'📃', md:'📃',
    png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️',
    csv:'📊', xls:'📊', xlsx:'📊', ppt:'📽️', pptx:'📽️',
    json:'📦', zip:'🗜️', mp3:'🎵', mp4:'🎬',
  };
  return map[ext] || '📎';
}

// ── Auth state ────────────────────────────────────────────
let TOKEN = '';
let REPO  = '';

function loadAuth() {
  TOKEN = localStorage.getItem('acervo_token') || '';
  REPO  = localStorage.getItem('acervo_repo')  || '';
  if ($('repoInput')) $('repoInput').value = REPO;
}

function saveAuth(token, repo) {
  TOKEN = token;
  REPO  = repo;
  localStorage.setItem('acervo_token', token);
  localStorage.setItem('acervo_repo', repo);
}

function clearAuth() {
  TOKEN = '';
  REPO  = '';
  localStorage.removeItem('acervo_token');
  localStorage.removeItem('acervo_repo');
}

// ── GitHub API ────────────────────────────────────────────
async function ghGet(path) {
  const url = path === '__repo__'
    ? `https://api.github.com/repos/${REPO}`
    : `https://api.github.com/repos/${REPO}/contents/${path}`;
  const r = await fetch(url, {
    headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${r.status}`);
  }
  return r.json();
}

async function ghPut(path, body) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${r.status}`);
  }
  return r.json();
}

async function ghDelete(path, sha, message) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, sha })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${r.status}`);
  }
  return r.json();
}

// Get SHA of an existing file (returns null if not found)
async function getFileSHA(path) {
  try {
    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
    const r = await fetch(url, {
      headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.sha;
  } catch {
    return null;
  }
}

// Read posts.json from GitHub
async function fetchPosts() {
  try {
    const url = `https://api.github.com/repos/${REPO}/contents/posts.json`;
    const r = await fetch(url, {
      headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!r.ok) return [];
    const data = await r.json();
    const json = atob(data.content.replace(/\n/g, ''));
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// Write posts.json to GitHub
async function writePosts(posts) {
  const sha = await getFileSHA('posts.json');
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
  await ghPut('posts.json', {
    message: 'chore: atualiza posts.json via Acervo',
    content,
    ...(sha ? { sha } : {})
  });
}

// Upload a file to uploads/<folder>/<filename>
async function uploadFile(file, folder, filename, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1];
        const ghPath = folder ? `uploads/${folder}/${filename}` : `uploads/${filename}`;
        const sha = await getFileSHA(ghPath);

        onProgress(60);
        await ghPut(ghPath, {
          message: `upload: ${filename}`,
          content: base64,
          ...(sha ? { sha } : {})
        });
        onProgress(100);
        resolve(ghPath);
      } catch(err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
    onProgress(20);
  });
}

// ── Posts state ───────────────────────────────────────────
let posts = [];

// ── Auth flow ─────────────────────────────────────────────
loadAuth();

$('btnAuth').addEventListener('click', async () => {
  const token = $('tokenInput').value.trim();
  const repo  = $('repoInput').value.trim();
  const err   = $('authError');

  if (!token || !repo) {
    err.innerHTML = '<div class="notice error">Preencha o token e o repositório.</div>';
    return;
  }

  $('btnAuth').disabled = true;
  $('btnAuth').textContent = 'Verificando…';
  err.innerHTML = '';

  try {
    TOKEN = token;
    REPO  = repo;
    await ghGet('__repo__'); // testa acesso ao repositório
    saveAuth(token, repo);
    showAdminPanel();
  } catch(e) {
    let msg = 'Não foi possível conectar. Verifique:';
    if (e.message.includes('Not Found') || e.message.includes('404')) {
      msg = `Repositório <strong>${repo}</strong> não encontrado. Verifique o nome (formato: usuario/repositorio).`;
    } else if (e.message.includes('Bad credentials') || e.message.includes('401')) {
      msg = 'Token inválido ou expirado. Gere um novo em github.com/settings/tokens com a permissão <code>repo</code>.';
    } else if (e.message.includes('403')) {
      msg = 'Token sem permissão suficiente. Certifique-se de marcar <code>repo</code> (não só <code>public_repo</code>).';
    } else {
      msg = `Erro: ${e.message}`;
    }
    err.innerHTML = `<div class="notice error">${msg}</div>`;
    TOKEN = REPO = '';
  } finally {
    $('btnAuth').disabled = false;
    $('btnAuth').textContent = 'Entrar';
  }
});

$('tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnAuth').click(); });

$('btnLogout').addEventListener('click', () => {
  clearAuth();
  $('adminPanel').style.display = 'none';
  $('authGate').style.display = 'flex';
  $('tokenInput').value = '';
});

// Auto-login if credentials saved
if (TOKEN && REPO) {
  showAdminPanel();
}

async function showAdminPanel() {
  $('authGate').style.display = 'none';
  $('adminPanel').style.display = 'block';
  $('footerYear').textContent = new Date().getFullYear();
  posts = await fetchPosts();
  renderList();
  populateFolderSuggestions();
}

// ── File selection ────────────────────────────────────────
let selectedFiles = [];

const zone  = $('uploadZone');
const input = $('fileInput');

zone.addEventListener('click', () => input.click());
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});
input.addEventListener('change', () => {
  if (input.files.length) addFiles([...input.files]);
  input.value = '';
});

function addFiles(files) {
  selectedFiles = [...selectedFiles, ...files];
  renderSelectedFiles();
}

function renderSelectedFiles() {
  const container = $('selectedFiles');
  if (selectedFiles.length === 0) {
    container.style.display = 'none';
    $('uploadForm').style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  $('uploadForm').style.display = 'block';

  container.innerHTML = selectedFiles.map((f, i) => `
    <div class="selected-file-item">
      <span>${fileEmoji(f.name.split('.').pop().toLowerCase())}</span>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${formatSize(f.size)}</span>
      <button class="remove-file" data-i="${i}" title="Remover">✕</button>
    </div>`).join('');

  container.querySelectorAll('.remove-file').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(parseInt(btn.dataset.i), 1);
      renderSelectedFiles();
    });
  });

  // Auto-fill title from first file name
  if (!$('postTitle').value && selectedFiles.length === 1) {
    $('postTitle').value = selectedFiles[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }
}

// ── Upload ────────────────────────────────────────────────
$('btnUpload').addEventListener('click', async () => {
  const status = $('uploadStatus');

  if (selectedFiles.length === 0) {
    status.innerHTML = '<div class="notice error">Selecione ao menos um arquivo.</div>';
    return;
  }
  const title = $('postTitle').value.trim();
  if (!title) {
    status.innerHTML = '<div class="notice error">Preencha o título do trabalho.</div>';
    return;
  }

  // Folder: use input value or derive from title
  const folderRaw = $('postFolder').value.trim() || slugify(title);
  const folder = slugify(folderRaw);
  const description = $('postDesc').value.trim();

  $('btnUpload').disabled = true;
  status.innerHTML = '';

  const results = [];
  const errors  = [];

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    const ext  = file.name.split('.').pop().toLowerCase();
    const baseSlug = slugify(title) + (selectedFiles.length > 1 ? `-${i+1}` : '') + '-' + Date.now();
    const filename = baseSlug + '.' + ext;

    // Progress UI
    status.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-label">Enviando: ${file.name} (${i+1}/${selectedFiles.length})</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="pBar" style="width:0%"></div></div>
      </div>`;

    try {
      await uploadFile(file, folder, filename, pct => {
        const bar = document.getElementById('pBar');
        if (bar) bar.style.width = pct + '%';
      });

      const post = {
        slug: baseSlug,
        title: selectedFiles.length > 1 ? `${title} (${i+1})` : title,
        description,
        folder,
        filename,
        ext,
        size: file.size,
        date: new Date().toISOString(),
      };
      results.push(post);
    } catch(err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (results.length > 0) {
    posts = [...results, ...posts];
    try {
      await writePosts(posts);
      renderList();
      populateFolderSuggestions();

      status.innerHTML = `
        <div class="notice success">
          ✅ ${results.length} arquivo(s) publicado(s) na pasta <strong>${folder}</strong>!
          ${errors.length ? `<br>⚠️ ${errors.length} erro(s): ${errors.join(', ')}` : ''}
        </div>`;

      // Reset
      selectedFiles = [];
      $('selectedFiles').style.display = 'none';
      $('uploadForm').style.display = 'none';
      $('postTitle').value = '';
      $('postFolder').value = '';
      $('postDesc').value = '';
    } catch(err) {
      status.innerHTML = `<div class="notice error">Arquivos enviados mas falha ao atualizar posts.json: ${err.message}</div>`;
    }
  } else {
    status.innerHTML = `<div class="notice error">Falha no upload: ${errors.join('; ')}</div>`;
  }

  $('btnUpload').disabled = false;
});

// ── Render post list (admin) ───────────────────────────────
function renderList() {
  const container = $('postList');
  if (posts.length === 0) {
    container.innerHTML = '<p class="loading-state">Nenhuma publicação ainda.</p>';
    return;
  }

  // Group by folder
  const groups = {};
  posts.forEach(p => {
    const key = p.folder || 'Sem pasta';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  container.innerHTML = Object.entries(groups).map(([folder, items]) => `
    <div class="admin-folder-group">
      <div class="admin-folder-label">📁 ${folder.replace(/-/g, ' ')} <span style="color:var(--muted);font-weight:400">(${items.length})</span></div>
      ${items.map((p, _) => `
        <div class="admin-post-item">
          <span class="admin-post-icon">${fileEmoji(p.ext)}</span>
          <div class="admin-post-info">
            <strong>${p.title}</strong>
            <span>${p.filename} · ${new Date(p.date).toLocaleDateString('pt-BR')}${p.size ? ' · ' + formatSize(p.size) : ''}</span>
          </div>
          <button class="btn-danger" data-slug="${p.slug}">Remover</button>
        </div>`).join('')}
    </div>`).join('');

  container.querySelectorAll('[data-slug]').forEach(btn => {
    btn.addEventListener('click', () => removePost(btn.dataset.slug));
  });
}

async function removePost(slug) {
  const post = posts.find(p => p.slug === slug);
  if (!post) return;
  if (!confirm(`Remover "${post.title}" do acervo?\n\nO arquivo no GitHub NÃO será deletado automaticamente.`)) return;

  posts = posts.filter(p => p.slug !== slug);
  try {
    await writePosts(posts);
    renderList();
    $('uploadStatus').innerHTML = `<div class="notice info">"${post.title}" removido do acervo.</div>`;
  } catch(err) {
    $('uploadStatus').innerHTML = `<div class="notice error">Falha ao salvar: ${err.message}</div>`;
    posts.push(post); // rollback
    renderList();
  }
}

// ── Folder autocomplete ────────────────────────────────────
function populateFolderSuggestions() {
  const dl = $('folderSuggestions');
  if (!dl) return;
  const folders = [...new Set(posts.map(p => p.folder).filter(Boolean))];
  dl.innerHTML = folders.map(f => `<option value="${f}">`).join('');
}

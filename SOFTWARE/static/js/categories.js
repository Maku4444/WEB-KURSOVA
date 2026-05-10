
async function loadCategories() {
    const token    = getToken();
    const response = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) return;

    const categories  = await response.json();
    const container   = document.getElementById('categoriesContainer');
    if (!container) return;

    container.innerHTML = categories.map(c => `
        <div class="cat-item card">
            <div style="display:flex; align-items:center; gap:15px; width:100%;">
                <div class="dot" style="background:${c.color_hex}"></div>
                <span style="font-weight:600; flex-grow:1;">${c.name}</span>
                <button class="action-btn edit-btn"   onclick='openEditCatModal(${JSON.stringify(c)})'    title="Редагувати"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn" onclick="deleteCategory(${c.categorie_id})" title="Видалити"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function openAddCatModal() {
    document.getElementById('catForm').reset();
    document.getElementById('catId').value           = '';
    document.getElementById('catModalTitle').innerText = 'Нова категорія';
    document.getElementById('catModal').style.display = 'flex';
}

function openEditCatModal(c) {
    document.getElementById('catId').value             = c.categorie_id;
    document.getElementById('catName').value           = c.name;
    document.getElementById('catColor').value          = c.color_hex;
    document.getElementById('catModalTitle').innerText = 'Редагувати категорію';
    document.getElementById('catModal').style.display  = 'flex';
}

function closeCatModal() {
    document.getElementById('catModal').style.display = 'none';
}

document.getElementById('catForm').onsubmit = async (e) => {
    e.preventDefault();

    const token   = getToken();
    const id      = document.getElementById('catId').value;
    const payload = {
        name:      document.getElementById('catName').value.trim(),
        color_hex: document.getElementById('catColor').value,
    };

    const res = await fetch(id ? `/api/categories/${id}` : '/api/categories', {
        method:  id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(payload),
    });

    if (res.ok) {
        closeCatModal();
        loadCategories();
    } else {
        const err = await res.json();
        alert(err.error || 'Помилка збереження');
    }
};

async function deleteCategory(id) {
    if (!confirm('Видалити категорію? Події стануть "Без категорії".')) return;

    const token = getToken();
    const res   = await fetch(`/api/categories/${id}`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.ok) loadCategories();
}

document.addEventListener('DOMContentLoaded', loadCategories);

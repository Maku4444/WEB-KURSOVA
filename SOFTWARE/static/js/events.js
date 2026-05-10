let allEvents        = [];
let cachedCategories = null; 

async function loadEvents() {
    const token = getToken();

    try {
        const response = await fetch('/api/events', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return;

        allEvents = await response.json();

        const list = document.getElementById('eventsList');
        if (!list) return;

        list.innerHTML = allEvents.map(e => {
            const start = new Date(e.start_time).toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
            const end = new Date(e.end_time).toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });

            return `
            <tr>
                <td style="font-weight:600;">${e.title}</td>
                <td>
                    <span class="badge" style="background:${e.category_color || '#cbd5e1'}; color:white; padding:4px 8px; border-radius:6px; font-size:12px;">
                        ${e.category_name || 'Без категорії'}
                    </span>
                </td>
                <td style="color:#636e72;">${start}</td>
                <td style="color:#636e72;">${end}</td>
                <td class="text-center">
                    <button class="action-btn edit-btn"   onclick='openEditModal(${JSON.stringify(e)})' title="Редагувати"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" onclick="deleteEvent(${e.id_events})"          title="Видалити"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('Помилка завантаження подій:', err);
    }
}


async function loadCategoriesForSelect() {
    const select = document.getElementById('eventCategory');
    if (!select) return;

    if (!cachedCategories) {
        const token    = getToken();
        const response = await fetch('/api/categories', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        cachedCategories = response.ok ? await response.json() : [];
    }

    select.innerHTML =
        '<option value="">Без категорії</option>' +
        cachedCategories.map(c => `<option value="${c.categorie_id}">${c.name}</option>`).join('');
}


function openAddModal() {
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value       = '';
    document.getElementById('modalTitle').innerText = 'Нова подія';
    loadCategoriesForSelect();
    document.getElementById('eventModal').style.display = 'flex';
}

function openEditModal(e) {
    document.getElementById('eventId').value    = e.id_events;
    document.getElementById('eventTitle').value = e.title;
    document.getElementById('eventStart').value = e.start_time.replace(' ', 'T').slice(0, 16);
    document.getElementById('eventEnd').value   = e.end_time.replace(' ', 'T').slice(0, 16);
    document.getElementById('modalTitle').innerText = 'Редагувати подію';

    loadCategoriesForSelect().then(() => {
        if (e.category_id) {
            document.getElementById('eventCategory').value = e.category_id;
        }
    });

    document.getElementById('eventModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
}


document.getElementById('eventForm').onsubmit = async (event) => {
    event.preventDefault();

    const token = getToken();
    const id    = document.getElementById('eventId').value;

    const payload = {
        title:       document.getElementById('eventTitle').value.trim(),
        start_time:  document.getElementById('eventStart').value,
        end_time:    document.getElementById('eventEnd').value,
        category_id: document.getElementById('eventCategory').value || null,
    };

    try {
        const res = await fetch(id ? `/api/events/${id}` : '/api/events', {
            method:  id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify(payload),
        });

        if (res.ok) {
            closeModal();
            loadEvents();
        } else {
            const err = await res.json();
            alert('Помилка: ' + (err.error || 'не вдалося зберегти'));
        }
    } catch (err) {
        console.error(err);
    }
};


async function deleteEvent(id) {
    if (!confirm('Видалити цю подію?')) return;

    const token = getToken();

    try {
        const res = await fetch(`/api/events/${id}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) loadEvents();
    } catch (err) {
        console.error(err);
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    await loadEvents();

    const urlParams     = new URLSearchParams(window.location.search);
    const eventIdToEdit = urlParams.get('edit');

    if (eventIdToEdit) {
        const eventToEdit = allEvents.find(ev => ev.id_events == eventIdToEdit);
        if (eventToEdit) openEditModal(eventToEdit);
    }
});


async function loadProfile() {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data    = await response.json();
        const nameEl  = document.getElementById('profile-name');
        const emailEl = document.getElementById('profile-email');

        if (nameEl)  nameEl.value  = data.full_name;
        if (emailEl) emailEl.value = data.email;

        if (data.avatar_url) {
            setAllAvatars(data.avatar_url);
            const userData = getCurrentUser();
            if (userData) {
                userData.avatar_url = data.avatar_url;
                localStorage.setItem('user', JSON.stringify(userData));
            }
        }
    } catch (err) {
        console.error('Помилка завантаження профілю:', err);
    }
}

function setAllAvatars(url) {
    document.querySelectorAll('img.user-avatar').forEach(img => {
        img.src = url + '?t=' + Date.now(); 
    });
    const preview = document.getElementById('avatar-preview');
    if (preview) preview.src = url + '?t=' + Date.now();
}

function triggerAvatarUpload() {
    document.getElementById('avatar-file-input').click();
}

async function onAvatarFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.src = e.target.result;
    };
    reader.readAsDataURL(file);

    await uploadAvatar(file);

    event.target.value = '';
}

async function uploadAvatar(file) {
    const token    = getToken();
    const formData = new FormData();
    formData.append('avatar', file);

    const btn = document.getElementById('avatar-upload-btn');
    if (btn) { btn.disabled = true; btn.innerText = 'Завантаження...'; }

    try {
        const response = await fetch('/api/auth/avatar', {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body:    formData,
        });

        const result = await response.json();

        if (response.ok) {
            setAllAvatars(result.avatar_url);

            const userData = getCurrentUser();
            if (userData) {
                userData.avatar_url = result.avatar_url;
                localStorage.setItem('user', JSON.stringify(userData));
            }

            showAvatarMessage('✓ Аватарку оновлено!', 'success');
        } else {
            showAvatarMessage('✗ ' + (result.error || 'Помилка завантаження'), 'error');
            loadProfile();
        }
    } catch (err) {
        console.error('Помилка завантаження аватарки:', err);
        showAvatarMessage('✗ Помилка з\'єднання', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'Змінити фото'; }
    }
}

async function deleteAvatar() {
    if (!confirm('Видалити аватарку та повернутись до стандартної?')) return;

    const token = getToken();

    try {
        const response = await fetch('/api/auth/avatar', {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const result = await response.json();

        if (response.ok) {
            setAllAvatars(result.avatar_url);

            const userData = getCurrentUser();
            if (userData) {
                userData.avatar_url = result.avatar_url;
                localStorage.setItem('user', JSON.stringify(userData));
            }

            showAvatarMessage('✓ Аватарку видалено', 'success');

            const delBtn = document.getElementById('avatar-delete-btn');
            if (delBtn) delBtn.style.display = 'none';
        }
    } catch (err) {
        console.error('Помилка видалення аватарки:', err);
    }
}

function showAvatarMessage(text, type) {
    const el = document.getElementById('avatar-message');
    if (!el) return;
    el.innerText = text;
    el.style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3000);
}


async function updateProfile() {
    const token           = getToken();
    const name            = document.getElementById('profile-name').value.trim();
    const email           = document.getElementById('profile-email').value.trim();
    const password        = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password && password !== confirmPassword) {
        return alert('Паролі не збігаються!');
    }

    try {
        const response = await fetch('/api/auth/profile/update', {
            method:  'PUT',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ username: name, email, password }),
        });

        const result = await response.json();

        if (response.ok) {
            alert('Зміни збережено!');
            const userData = getCurrentUser();
            if (userData) {
                userData.name = name;
                localStorage.setItem('user', JSON.stringify(userData));
            }
            location.reload();
        } else {
            alert(result.error || 'Сталася помилка при збереженні');
        }
    } catch (err) {
        console.error('Помилка запиту:', err);
        alert("Помилка з'єднання з сервером");
    }
}


async function loadUsersAdmin() {
    const list = document.getElementById('adminUsersList');
    if (!list) return;

    const token = getToken();

    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            list.innerHTML = '<tr><td colspan="4">Помилка завантаження</td></tr>';
            return;
        }

        const users = await response.json();

        list.innerHTML = users.map(u => `
            <tr>
                <td>#${u.user_id}</td>
                <td>${u.email}</td>
                <td>
                    <select class="role-selector" onchange="changeRole(${u.user_id}, this.value)">
                        <option value="User"  ${u.role === 'User'  ? 'selected' : ''}>User</option>
                        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="text-center">
                    <button class="action-btn delete-btn" onclick="deleteUser(${u.user_id})" title="Видалити">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Помилка завантаження користувачів:', err);
    }
}

async function changeRole(userId, newRole) {
    const token = getToken();

    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method:  'PUT',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ role: newRole }),
        });

        if (!response.ok) {
            alert('Не вдалося змінити роль');
            loadUsersAdmin();
        }
    } catch (err) {
        console.error('Помилка запиту:', err);
    }
}

async function deleteUser(userId) {
    if (!confirm('Увага! Будуть видалені всі події та категорії цього користувача. Продовжити?')) return;

    const token = getToken();

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            loadUsersAdmin();
        } else {
            alert('Помилка: ' + result.error);
        }
    } catch (err) {
        console.error('Помилка при видаленні:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {

    const userData = getCurrentUser();
    if (userData && userData.avatar_url) {
        setAllAvatars(userData.avatar_url);
    }

    loadProfile();     
    loadUsersAdmin();  
});

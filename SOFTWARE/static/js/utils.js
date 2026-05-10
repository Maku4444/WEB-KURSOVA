
function getToken() {
    const token = localStorage.getItem('token');
    if (!token) window.location.href = 'login.html';
    return token;
}

function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('user')) || null; }
    catch { return null; }
}

function initUI() {
    const userData = getCurrentUser();

    const nameEl = document.getElementById('user-display-name');
    if (nameEl && userData) {
        nameEl.innerText = userData.name + (userData.role === 'Admin' ? ' (Admin)' : '');
    }

    if (userData?.avatar_url) {
        document.querySelectorAll('img.user-avatar').forEach(img => {
            img.src = userData.avatar_url;
        });
    }


    if (!userData || userData.role !== 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}


function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle('open');
    backdrop?.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
}


window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarBackdrop')?.classList.remove('active');
        document.body.style.overflow = '';
    }
});

document.addEventListener('DOMContentLoaded', initUI);


async function handleRegister(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data     = Object.fromEntries(formData.entries());

    if (data.password !== data['confirm-password']) {
        return alert('Паролі не збігаються!');
    }

    const response = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            full_name: data.full_name,
            email:     data.email,
            password:  data.password,
        }),
    });

    const result = await response.json();
    if (response.ok) {
        alert('Реєстрація успішна! Тепер увійдіть.');
        window.location.href = 'login.html';
    } else {
        alert(result.error || 'Помилка реєстрації');
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data     = Object.fromEntries(formData.entries());

    const response = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
    });

    const result = await response.json();
    if (response.ok) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user',  JSON.stringify(result.user));
        window.location.replace('calendar.html');
    } else {
        alert(result.error || 'Помилка входу');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('registerForm');
    if (regForm) regForm.onsubmit = handleRegister;

    const logForm = document.getElementById('loginForm');
    if (logForm) logForm.onsubmit = handleLogin;

    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.onsubmit = handleForgotPassword;

    
    const modal = document.getElementById('forgotModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeForgotModal();
        });
    }
});

function openForgotModal() {
    document.getElementById('forgotModal').style.display = 'flex';
    document.getElementById('forgotEmail').value = '';
    document.getElementById('forgotError').textContent = '';
    document.getElementById('forgotEmail').focus();
}

function closeForgotModal() {
    document.getElementById('forgotModal').style.display = 'none';
}


async function handleForgotPassword(event) {
    event.preventDefault();

    const email   = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');
    const btn     = document.getElementById('forgotSubmitBtn');

    errorEl.textContent = '';
    btn.disabled        = true;
    btn.textContent     = 'Надсилаємо...';

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email }),
        });

        const result = await response.json();

        if (response.ok) {
            closeForgotModal();
            alert('✅ Тимчасовий пароль надіслано на вашу пошту. Перевірте поштову скриньку.');
        } else if (response.status === 404) {
            errorEl.textContent = 'Користувача з такою поштою не знайдено.';
        } else {
            errorEl.textContent = result.error || 'Щось пішло не так. Спробуйте пізніше.';
        }
    } catch {
        errorEl.textContent = 'Помилка мережі. Перевірте з\'єднання.';
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Надіслати';
    }
}


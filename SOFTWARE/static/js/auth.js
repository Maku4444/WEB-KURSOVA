
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
        window.location.href = 'calendar.html';
    } else {
        alert(result.error || 'Помилка входу');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('registerForm');
    if (regForm) regForm.onsubmit = handleRegister;

    const logForm = document.getElementById('loginForm');
    if (logForm) logForm.onsubmit = handleLogin;
});


let currentMonth = new Date().getMonth();
let currentYear  = new Date().getFullYear();

const MONTH_NAMES = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

async function renderCalendar() {
    const grid  = document.getElementById('calendarGrid');
    const title = document.getElementById('month-title');
    if (!grid || !title) return;

    title.innerText = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    let events = [];
    try {
        const token    = getToken();
        const response = await fetch(
            `/api/events?year=${currentYear}&month=${currentMonth + 1}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (response.ok) events = await response.json();
    } catch (err) {
        console.error('Помилка завантаження подій:', err);
    }

    const DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    grid.innerHTML = DAY_HEADERS.map(h => `<div class="day-name">${h}</div>`).join('');

    const firstDay     = new Date(currentYear, currentMonth, 1).getDay();
    const padding      = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthEnd = new Date(currentYear, currentMonth, 0).getDate();
    const today        = new Date();

    for (let i = padding - 1; i >= 0; i--) {
        grid.innerHTML += `<div class="day-cell other-month"><div class="day-number">${prevMonthEnd - i}</div></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        const isToday =
            d === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear  === today.getFullYear();

        if (isToday) cell.classList.add('today');
        cell.innerHTML = `<div class="day-number">${d}</div>`;

        const dayEvents = events.filter(e => {
            const date = new Date(e.start_time);
            return (
                date.getDate()     === d &&
                date.getMonth()    === currentMonth &&
                date.getFullYear() === currentYear
            );
        });

        dayEvents.forEach(e => {
            const ev       = document.createElement('div');
            ev.className   = 'event-item';
            ev.innerText   = e.title;
            ev.style.cursor = 'pointer';
            ev.title        = e.title;

            if (e.category_color) {
                ev.style.backgroundColor = e.category_color;
                ev.style.borderLeft      = '4px solid rgba(0,0,0,0.2)';
            }

            ev.onclick = () => {
                window.location.href = `events.html?edit=${e.id_events}`;
            };

            cell.appendChild(ev);
        });

        grid.appendChild(cell);
    }

    const filledCells = padding + daysInMonth;
    const remaining   = (7 - (filledCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        grid.innerHTML += `<div class="day-cell other-month"><div class="day-number">${i}</div></div>`;
    }
}

function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0;  currentYear++; }
    renderCalendar();
}

document.addEventListener('DOMContentLoaded', renderCalendar);


async function loadAnalytics() {
    const canvas          = document.getElementById('timeChart');
    const legendContainer = document.getElementById('analyticsLegend');
    const totalEl         = document.getElementById('total-hours-value');

    if (!canvas) return;

    const token = getToken();

    try {
        const response = await fetch('/api/analytics/stats', {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data = await response.json();

        if (totalEl) totalEl.innerText = data.total_hours;

        const labels = data.categories.map(item => item.category);
        const hours  = data.categories.map(item => item.hours);
        const colors = data.categories.map(item => item.color);

        new Chart(canvas, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data:            hours,
                    backgroundColor: colors,
                    borderWidth:     1,
                    borderColor:     '#ffffff',
                }],
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.label}: ${ctx.raw} год`,
                        },
                    },
                },
            },
        });

        if (legendContainer) {
            legendContainer.innerHTML = '';
            data.categories.forEach(item => {
                const row = document.createElement('div');
                row.className = 'card';
                Object.assign(row.style, {
                    padding:        '15px',
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    borderLeft:     `5px solid ${item.color}`,
                });
                row.innerHTML = `
                    <div style="font-weight:600;">${item.category}</div>
                    <div style="text-align:right;">
                        <div style="font-weight:700; color:var(--primary);">${item.hours} год</div>
                        <div style="font-size:12px; color:var(--text-muted);">${item.percentage}% від загального часу</div>
                    </div>`;
                legendContainer.appendChild(row);
            });
        }
    } catch (err) {
        console.error('Помилка аналітики:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadAnalytics);

const socket = io('http://localhost:3000');

// Chart setup
const charts = {
    cpu: new Chart(document.getElementById('cpuChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'CPU Usage (%)', data: [], borderColor: 'red', fill: false }] },
        options: { scales: { y: { min: 0, max: 100 } } }
    }),
    cpuTemp: new Chart(document.getElementById('cpuTempChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'CPU Temp (°C)', data: [], borderColor: 'orange', fill: false }] },
        options: { scales: { y: { min: 0, max: 120 } } }
    }),
    memory: new Chart(document.getElementById('memoryChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'Memory Usage (%)', data: [], borderColor: 'blue', fill: false }] },
        options: { scales: { y: { min: 0, max: 100 } } }
    }),
    disk: new Chart(document.getElementById('diskChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'Disk Usage (%)', data: [], borderColor: 'green', fill: false }] },
        options: { scales: { y: { min: 0, max: 100 } } }
    }),
    gpuTemp: new Chart(document.getElementById('gpuTempChart').getContext('2d'), {
        type: 'line', data: { labels: [], datasets: [{ label: 'GPU Temp (°C)', data: [], borderColor: 'purple', fill: false }] },
        options: { scales: { y: { min: 0, max: 120 } } }
    })
};

function updateChart(chart, label, value) {
    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value === 'N/A' ? null : parseFloat(value));
    chart.update();
}

function updateTable(tableId, data, columns) {
    const tbody = document.getElementById(tableId).querySelector('tbody');
    tbody.innerHTML = '';
    data.forEach(item => {
        const row = document.createElement('tr');
        columns.forEach(col => {
            const cell = document.createElement('td');
            cell.textContent = item[col];
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

// Initial fetch (optional)
fetch('/metrics')
    .then(res => res.json())
    .then(data => updateMetrics(data));

// Real-time updates
socket.on('metricsUpdate', (data) => updateMetrics(data));

function updateMetrics(data) {
    const time = new Date(data.timestamp).toLocaleTimeString();
    updateChart(charts.cpu      , time, data.cpu);
    updateChart(charts.cpuTemp  , time, data.cpuTemp);
    updateChart(charts.memory   , time, data.memory);
    updateChart(charts.disk     , time, data.disk);
    updateChart(charts.gpuTemp  , time, data.gpuTemp);

    updateTable('processesTable', data.top5Mem || [], ['name', 'memory']);
    updateTable('containersTable', data.containers || [], ['name', 'cpu', 'memory']);
}
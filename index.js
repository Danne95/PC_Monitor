const express = require('express');
const si = require('systeminformation');
const { Server } = require('socket.io');
const http = require('http');
const nodemailer = require('nodemailer');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

let emailConfig = {};
let lastEmailSent = null;

app.use(express.static('public'));

// fetch metrics
app.get('/metrics', async (req, res) => {
    try {
        const cpu           = await si.currentLoad();
        const cpuTemp       = await si.cpuTemperature();
        const memory        = await si.mem();
        const disk          = await si.fsSize();
        const graphics      = await si.graphics();
        const processes     = await si.processes();
        const containers    = await si.dockerContainerStats();

        const gpuController = graphics.controllers[graphics.controllers.length - 1];

        const data = {
            timestamp:  new Date().toISOString(),
            cpu:        cpu.currentLoad.toFixed(2),
            cpuTemp:    cpuTemp.main ? cpuTemp.main.toFixed(1) : 'N/A',
            memory:     ((memory.used / memory.total) * 100).toFixed(2),
            disk:       disk[0] ? ((disk[0].used / disk[0].size) * 100).toFixed(2) : 0,
            gpu:        gpuController ? gpuController.model : 'N/A',
            gpuTemp:    gpuController?.temperatureGpu ? gpuController.temperatureGpu.toFixed(1) : 'N/A',
            top5Mem:    processes.list
                            .sort((a, b) => (b.memRss || 0) - (a.memRss || 0))
                            .slice(0, 5)
                            .map(p => ({ 
                                name: p.name, 
                                memory: ((p.memRss || 0) / 1024).toFixed(1) + ' MB'
            })),
            containers: containers.map(c => ({
                            name:   c.name,
                            cpu:    c.cpu_percent.toFixed(2),
                            memory: c.memory_percent.toFixed(2)
            }))
        };
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: `Failed to fetch metrics\n${err}` });
    }
});

// Load email config from file
try {
    const configData = fs.readFileSync('config.txt', 'utf8');
    configData.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) emailConfig[key.trim()] = value.trim();
    });
} catch (err) {
    console.error('Failed to load config.txt:', err);
    process.exit(1);
}

// Email alert setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailConfig.EMAIL,
        pass: emailConfig.PASSWORD
    }
});

// Mail sending function
function sendAlert({title, body}) {
    const mailOptions = {
        from:       emailConfig.EMAIL,
        to:         emailConfig.EMAIL,
        subject:    title,
        text:       body
    };
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.log('Email error:', err);
        else console.log('Alert sent:', info.response);
    });
}


// Real-time updates with Socket.IO
setInterval(async () => {
    const cpu           = await si.currentLoad();
    const cpuTemp       = await si.cpuTemperature();
    const memory        = await si.mem();
    const disk          = await si.fsSize();
    const graphics      = await si.graphics();
    const processes     = await si.processes();
    const containers    = await si.dockerContainerStats();

    const gpuController = graphics.controllers[graphics.controllers.length - 1];

    const data = {
        timestamp:  new Date().toISOString(),
        cpu:        cpu.currentLoad.toFixed(2),
        cpuTemp:    cpuTemp.main ? cpuTemp.main.toFixed(1) : 'N/A',
        memory:     ((memory.used / memory.total) * 100).toFixed(2),
        disk:       disk[0] ? ((disk[0].used / disk[0].size) * 100).toFixed(2) : 0,
        gpu:        gpuController ? gpuController.model : 'N/A',
        gpuTemp:    gpuController?.temperatureGpu ? gpuController.temperatureGpu.toFixed(1) : 'N/A',
        top5Mem:    processes.list
                        .sort((a, b) => (b.memRss || 0) - (a.memRss || 0))
                        .slice(0, 5)
                        .map(p => ({ 
                            name: p.name, 
                            memory: ((p.memRss || 0) / 1024).toFixed(1) + ' MB'})),
        containers: containers
                        .map(c => ({
                            name:   c.name,
                            cpu:    c.cpu_percent.toFixed(2),
                            memory: c.memory_percent.toFixed(2)}))
    };
    io.emit('metricsUpdate', data);

    let alerts = [];

    // CPU Usage
    alerts.push(data.cpu > 80 ? `CPU Usage: *${data.cpu}%* (exceeds 80%)` : `CPU Usage: ${data.cpu}%`);

    // CPU Temp
    if (data.cpuTemp !== 'N/A') {
        alerts.push(data.cpuTemp > 85 ? `CPU Temp: *${data.cpuTemp}°C* (exceeds 85°C)` : `CPU Temp: ${data.cpuTemp}°C`);
    }

    // Memory
    alerts.push(data.memory > 80 ? `Memory: *${data.memory}%* (exceeds 80%)` : `Memory: ${data.memory}%`);

    // Disk
    alerts.push(data.disk > 90 ? `Disk: *${data.disk}%* (exceeds 90%)` : `Disk: ${data.disk}%`);

    // GPU Temp (if available)
    if (data.gpuTemp !== 'N/A') {
        alerts.push(data.gpuTemp > 75 ? `GPU Temp: *${data.gpuTemp}°C* (exceeds 75°C)` : `GPU Temp: ${data.gpuTemp}°C`);
    }

    // Top 5 Memory Processes
    alerts.push(`Top 5 Memory Processes:\n${data.top5Mem.map(p => `${p.name}: ${p.memory}`).join('\n')}`);
    
    // Container Health (if Docker is running)
    if (containers.length > 0) {
        const containerStats = containers.map(c => 
            c.memory_percent > 50 ? 
            `${c.name}: CPU ${c.cpu_percent}%, Memory *${c.memory_percent.toFixed(2)}%* (exceeds 50%)` : 
            `${c.name}: CPU ${c.cpu_percent}%, Memory ${c.memory_percent.toFixed(2)}%`
        );
        alerts.push(`Docker Containers:\n${containerStats.join('\n')}`);
    }

    if (alerts.some(line => line.includes('*'))) {
        // Log to file
        const logEntry = `Alert at ${data.timestamp}:\n${alerts.join('\n')}\n---\n`;
        fs.appendFile('alerts.log', logEntry, (err) => {
            if (err) console.log('Failed to write to log:', err);
        });

        // Check if 30 minutes have passed since last email
        const now = new Date();
        const thirtyMinutes = 30 * 60 * 1000; // 30 min in milliseconds
        if (!lastEmailSent || (now - lastEmailSent) > thirtyMinutes) {
            sendAlert({
                title: 'Server Alert: Metrics Report',
                body: `Current server status at ${data.timestamp}:\n\n${alerts.join('\n\n')}`
            });
            lastEmailSent = now; // Update last email time
        }
    }
}, 5000);

// Start server
server.listen(3000, () => console.log('Server running on http://localhost:3000'));
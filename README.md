# Server Monitoring Dashboard

A real-time system monitoring tool built with Node.js, Express, and Socket.IO, displaying CPU, memory, disk, and process metrics via an interactive web dashboard using Chart.js. Designed to track server health with email alerts and file logging.

## Features
- **Real-Time Metrics**: Monitors CPU usage (%), memory usage (GB), disk usage (%), and GPU info, updated every 5 seconds via Socket.IO.
- **Top 5 Processes**: Displays the top 5 memory-consuming processes (in GB), sortable by resident memory usage.
- **Interactive Dashboard**: Visualizes metrics with dynamic charts (CPU, memory, disk) and tables (processes) using Chart.js.
- **Alerts**: Logs alerts to `alerts.log` and sends emails (throttled to every 30 minutes) when thresholds are exceeded (e.g., CPU > 80%, memory > 80%).
- **Extensible**: Built with plans for Docker and Kubernetes integration (in progress).

## Tech Stack
- **Backend**: Node.js, Express, Socket.IO, `systeminformation` (for system metrics), `nodemailer` (for email alerts).
- **Frontend**: HTML, CSS, JavaScript, Chart.js.
- **File System**: Logs alerts to a local file (`alerts.log`).

## Prerequisites
- Node.js (v18+ recommended)
- npm
- A Gmail account for email alerts (with an App Password if 2FA is enabled)

## Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/server-monitoring-dashboard.git
   cd server-monitoring-dashboard

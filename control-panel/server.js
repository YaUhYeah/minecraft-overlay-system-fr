const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 52435;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Serve the control panel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ port: 8082 });

wss.on('connection', (ws) => {
    console.log('Control panel client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received from control panel:', data);
            
            // Broadcast to all connected clients
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Control panel client disconnected');
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Control Panel server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:8081`);
});
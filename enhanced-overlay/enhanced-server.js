const express = require('express');
const cors = require('cors');
const util = require('minecraft-server-util');
const NodeCache = require('node-cache');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const tmi = require('tmi.js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;
const server = http.createServer(app);

// Create caches
const statusCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });
const chatMessagesCache = [];
const clientDataCache = new Map();
const serverDataCache = new Map();
const overlayConfigCache = new Map();
const MAX_CACHED_MESSAGES = 100;

// Configuration
let config = {
  server: {
    address: 'play.nomercymc.org',
    port: 25565,
    updateInterval: 30000
  },
  twitch: {
    channelName: 'YaUhYeah',
    clientId: '',
    accessToken: '',
    autoReconnect: true
  },
  overlay: {
    streamerName: 'YaUhYeah',
    chatMessageLifetime: 15000,
    maxChatMessages: 7,
    enableClientData: true,
    enableServerData: true,
    hideCoordinatesFromStream: true
  }
};

// WebSocket servers
const chatWss = new WebSocket.Server({ server, path: '/chat' });
const controlPanelWss = new WebSocket.Server({ server, path: '/control-panel' });
const overlayWss = new WebSocket.Server({ server, path: '/overlay' });

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Enable CORS and JSON
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files
app.use('/', express.static(path.join(__dirname, '../..')));
app.use('/control-panel', express.static(path.join(__dirname, '../control-panel/dist')));

// Load Twitch configuration
function loadTwitchConfig() {
  try {
    const configPath = path.join(__dirname, '../../twitch_config.json');
    if (fs.existsSync(configPath)) {
      const loadedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.twitch = { ...config.twitch, ...loadedConfig };
      console.log('Loaded Twitch configuration');
    }
  } catch (err) {
    console.error('Error loading Twitch config:', err);
  }
}

// Initialize TMI (Twitch chat client)
let twitchClient = null;
function initTwitchClient() {
  if (twitchClient) {
    try {
      twitchClient.disconnect();
      twitchClient.removeAllListeners();
    } catch (e) { 
      console.error('Error disconnecting existing Twitch client:', e);
    }
  }

  const cleanToken = config.twitch.accessToken ? 
    (config.twitch.accessToken.startsWith('oauth:') ? 
     config.twitch.accessToken.slice(6) : config.twitch.accessToken) : '';

  if (!config.twitch.channelName) {
    console.error('Cannot initialize Twitch: Channel name not configured');
    return null;
  }

  const tmiOptions = {
    options: { debug: false },
    connection: { reconnect: config.twitch.autoReconnect, secure: true },
    channels: [`#${config.twitch.channelName}`]
  };

  if (cleanToken) {
    tmiOptions.identity = {
      username: config.twitch.channelName,
      password: `oauth:${cleanToken}`
    };
  } else {
    console.warn('Connecting to Twitch anonymously (no token provided)');
  }

  twitchClient = new tmi.Client(tmiOptions);

  twitchClient.on('connected', (address, port) => {
    console.log(`Connected to Twitch chat at ${address}:${port}`);
    addChatMessage('System', 'Connected to Twitch chat', { system: true });
  });

  twitchClient.on('disconnected', (reason) => {
    console.log(`Disconnected from Twitch chat: ${reason}`);
    addChatMessage('System', `Disconnected from Twitch chat: ${reason}`, { system: true });
  });

  twitchClient.on('message', (channel, userstate, message, self) => {
    if (self && !config.twitch.relaySelfMessages) return;
    
    const username = userstate['display-name'] || userstate.username || 'user';
    addChatMessage(username, message, userstate);
  });

  twitchClient.connect().catch(err => {
    console.error(`Error connecting to Twitch: ${err.message}`);
    addChatMessage('System', `Error connecting to Twitch: ${err.message}`, { system: true });
  });

  return twitchClient;
}

// Chat message handling
function addChatMessage(username, message, userState = {}) {
  const chatMessage = {
    type: 'chat',
    username: username,
    message: message,
    userState: {
      color: userState.color || '#FFFFFF',
      mod: !!userState.mod,
      subscriber: !!userState.subscriber,
      broadcaster: userState.badges && userState.badges.broadcaster === '1',
      vip: userState.badges && !!userState.badges.vip,
      bits: userState.bits || 0,
      emotes: userState.emotes || null,
      id: userState.id,
      userId: userState['user-id'],
      roomId: userState['room-id'],
      system: !!userState.system
    },
    timestamp: Date.now(),
    id: Math.random().toString(36).substring(2, 15)
  };

  chatMessagesCache.push(chatMessage);
  
  if (chatMessagesCache.length > MAX_CACHED_MESSAGES) {
    chatMessagesCache.shift();
  }

  broadcastToClients(chatWss, chatMessage);
  broadcastToClients(overlayWss, chatMessage);
  
  return chatMessage;
}

// Minecraft server status check
async function checkServerStatus(serverHost, serverPort) {
  const options = {
    timeout: 5000,
    enableSRV: true
  };

  try {
    const response = await util.status(serverHost, serverPort, options);
    return {
      online: true,
      version: response.version.name || 'Unknown',
      protocol: response.version.protocol,
      players: {
        online: response.players.online,
        max: response.players.max,
        sample: response.players.sample || []
      },
      description: response.motd.clean || 'Unknown',
      favicon: response.favicon,
      latency: response.roundTripLatency,
      error: null
    };
  } catch (javaErr) {
    console.warn(`Java ping failed (${serverHost}:${serverPort}): ${javaErr.message}`);
    
    try {
      const bedrockPort = 19132;
      const br = await util.statusBedrock(serverHost, bedrockPort, options);
      return {
        online: true,
        version: br.version || 'Unknown',
        protocol: 'bedrock',
        players: {
          online: br.players.online,
          max: br.players.max,
          sample: []
        },
        description: br.motd || 'Unknown',
        favicon: null,
        latency: br.latency || null,
        error: null
      };
    } catch (bedErr) {
      console.warn(`Bedrock ping failed: ${bedErr.message}`);
      
      return {
        online: false,
        version: 'Unknown',
        players: { online: 0, max: 0 },
        description: 'Unknown',
        favicon: null,
        latency: null,
        error: `Server unreachable: ${javaErr.message}`
      };
    }
  }
}

// WebSocket connection handlers
chatWss.on('connection', (ws) => {
  console.log('New chat WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'system', 
    message: 'Connected to chat server',
    timestamp: Date.now()
  }));
  
  const recentMessages = chatMessagesCache.slice(-20);
  recentMessages.forEach(msg => {
    ws.send(JSON.stringify(msg));
  });
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Error processing chat WebSocket message:', e);
    }
  });
});

controlPanelWss.on('connection', (ws) => {
  console.log('New control panel WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to control panel',
    timestamp: Date.now()
  }));
  
  // Send current data
  sendCurrentDataToControlPanel(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleControlPanelMessage(ws, data);
    } catch (e) {
      console.error('Error processing control panel WebSocket message:', e);
    }
  });
});

overlayWss.on('connection', (ws) => {
  console.log('New overlay WebSocket client connected');
  
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to overlay server',
    timestamp: Date.now()
  }));
  
  // Send current overlay configuration
  sendOverlayConfig(ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleOverlayMessage(ws, data);
    } catch (e) {
      console.error('Error processing overlay WebSocket message:', e);
    }
  });
});

function handleControlPanelMessage(ws, data) {
  switch (data.type) {
    case 'config_update':
      updateOverlayConfig(data.settings);
      broadcastConfigUpdate();
      break;
    case 'refresh_request':
      sendCurrentDataToControlPanel(ws);
      break;
  }
}

function handleOverlayMessage(ws, data) {
  switch (data.type) {
    case 'config_request':
      sendOverlayConfig(ws);
      break;
  }
}

function sendCurrentDataToControlPanel(ws) {
  // Send latest client data
  clientDataCache.forEach((data, clientId) => {
    ws.send(JSON.stringify(data));
  });
  
  // Send latest server data
  serverDataCache.forEach((data, serverId) => {
    ws.send(JSON.stringify(data));
  });
}

function sendOverlayConfig(ws) {
  const overlayConfig = overlayConfigCache.get('main') || getDefaultOverlayConfig();
  ws.send(JSON.stringify({
    type: 'overlay_config',
    config: overlayConfig,
    timestamp: Date.now()
  }));
}

function updateOverlayConfig(newConfig) {
  overlayConfigCache.set('main', newConfig);
  
  // Save to file
  try {
    const configPath = path.join(__dirname, 'overlay-config.json');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  } catch (e) {
    console.error('Error saving overlay config:', e);
  }
}

function broadcastConfigUpdate() {
  const overlayConfig = overlayConfigCache.get('main');
  const message = JSON.stringify({
    type: 'config_update',
    config: overlayConfig,
    timestamp: Date.now()
  });
  
  broadcastToClients(overlayWss, JSON.parse(message));
  broadcastToClients(controlPanelWss, JSON.parse(message));
}

function getDefaultOverlayConfig() {
  return {
    theme: 'dark',
    primaryColor: '#FFCC00',
    backgroundOpacity: 70,
    position: 'top-right',
    scale: 100,
    elements: {
      coordinates: { visible: true, x: 10, y: 10, fontSize: 16, color: '#FFFFFF' },
      health: { visible: true, x: 10, y: 40, fontSize: 16, color: '#FF0000' },
      'server-info': { visible: true, x: 10, y: 70, fontSize: 14, color: '#FFCC00' }
    },
    dataCollection: {
      clientdata: true,
      serverdata: true
    },
    placeholders: []
  };
}

function broadcastToClients(wss, message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (e) {
        console.error('Error sending message to WebSocket client:', e);
      }
    }
  });
}

// Keep WebSocket connections alive
setInterval(() => {
  [chatWss, controlPanelWss, overlayWss].forEach(wss => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      
      ws.isAlive = false;
      ws.ping(() => {});
    });
  });
}, 30000);

// API Routes
app.get('/api/status', async (req, res) => {
  const serverAddress = req.query.server || config.server.address;
  const serverNumericPort = parseInt(req.query.port || config.server.port, 10);
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const cacheKey = `${serverAddress}:${serverNumericPort}`;
    let cachedStatus = statusCache.get(cacheKey);
    let apiResponse;
    
    if (cachedStatus) {
      apiResponse = { ...cachedStatus, retrievedFromCache: true };
    } else {
      const currentStatus = await checkServerStatus(serverAddress, serverNumericPort);
      
      apiResponse = {
        server: serverAddress,
        port: serverNumericPort,
        timestamp: Math.floor(Date.now() / 1000),
        date: new Date().toISOString(),
        online: currentStatus.online,
        playerCount: currentStatus.players.online || 0,
        maxPlayers: currentStatus.players.max || 0,
        status: currentStatus.online ? 'online' : (currentStatus.error ? 'error' : 'offline'),
        version: currentStatus.version,
        description: currentStatus.description,
        favicon: currentStatus.favicon,
        latency: currentStatus.latency,
        error: currentStatus.error,
        retrievedFromCache: false
      };
      
      if (currentStatus.online || !currentStatus.error) {
        statusCache.set(cacheKey, apiResponse);
      }
    }
    
    res.json(apiResponse);
  } catch (error) {
    console.error(`Error in /api/status route:`, error);
    res.status(500).json({
      server: serverAddress,
      port: serverNumericPort,
      timestamp: Math.floor(Date.now() / 1000),
      date: new Date().toISOString(),
      online: false,
      playerCount: 0,
      maxPlayers: 0,
      status: 'error',
      error: `Internal server error: ${error.message}`
    });
  }
});

// Client data endpoint (from Fabric mod)
app.post('/api/client-data', (req, res) => {
  try {
    const clientData = req.body;
    clientData.timestamp = Date.now();
    
    // Store client data
    const clientId = req.ip || 'default';
    clientDataCache.set(clientId, clientData);
    
    // Broadcast to control panel and overlay
    broadcastToClients(controlPanelWss, clientData);
    broadcastToClients(overlayWss, clientData);
    
    res.json({ success: true, timestamp: clientData.timestamp });
  } catch (error) {
    console.error('Error processing client data:', error);
    res.status(500).json({ error: 'Server error processing client data' });
  }
});

// Server data endpoint (from Spigot plugin)
app.post('/api/server-data', (req, res) => {
  try {
    const serverData = req.body;
    serverData.timestamp = Date.now();
    
    // Store server data
    const serverId = req.ip || 'default';
    serverDataCache.set(serverId, serverData);
    
    // Broadcast to control panel and overlay
    broadcastToClients(controlPanelWss, serverData);
    broadcastToClients(overlayWss, serverData);
    
    res.json({ success: true, timestamp: serverData.timestamp });
  } catch (error) {
    console.error('Error processing server data:', error);
    res.status(500).json({ error: 'Server error processing server data' });
  }
});

// Chat API endpoints
app.get('/api/chat/messages', (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const recentMessages = chatMessagesCache.filter(msg => msg.timestamp > since);
  
  res.json({
    messages: recentMessages,
    timestamp: Date.now()
  });
});

app.get('/api/chat/status', (req, res) => {
  res.json({
    connected: twitchClient && twitchClient.readyState() === 'OPEN',
    messageCount: chatMessagesCache.length,
    timestamp: Date.now()
  });
});

// Mock chat message (for testing)
app.post('/api/chat/mock', (req, res) => {
  try {
    const { username, message, userState } = req.body;
    if (!username || !message) {
      return res.status(400).json({ error: 'Username and message required' });
    }
    
    const chatMessage = addChatMessage(username, message, userState || {});
    res.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error('Error with mock chat message:', error);
    res.status(500).json({ error: 'Server error processing mock message' });
  }
});

// Overlay configuration endpoints
app.get('/api/overlay/config', (req, res) => {
  const overlayConfig = overlayConfigCache.get('main') || getDefaultOverlayConfig();
  res.json(overlayConfig);
});

app.post('/api/overlay/config', (req, res) => {
  try {
    updateOverlayConfig(req.body);
    broadcastConfigUpdate();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating overlay config:', error);
    res.status(500).json({ error: 'Server error updating overlay config' });
  }
});

// Enhanced overlay page
app.get('/overlay-preview', (req, res) => {
  res.sendFile(path.join(__dirname, 'enhanced-overlay.html'));
});

// Save Twitch configuration
app.post('/api/twitch/config', (req, res) => {
  try {
    const { channelName, accessToken, clientId } = req.body;
    if (!channelName || !accessToken || !clientId) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const newConfig = {
      channelName: channelName.trim(),
      accessToken: accessToken.trim(),
      clientId: clientId.trim(),
      autoReconnect: true
    };
    
    fs.writeFileSync(path.join(__dirname, '../../twitch_config.json'), JSON.stringify(newConfig, null, 2), 'utf8');
    config.twitch = { ...config.twitch, ...newConfig };
    
    twitchClient = initTwitchClient();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving Twitch config:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../minecraft-overlay.html'));
});

app.get('/control-panel', (req, res) => {
  res.sendFile(path.join(__dirname, '../control-panel/dist/index.html'));
});

app.get('/twitch-setup', (req, res) => {
  res.sendFile(path.join(__dirname, '../../twitch-setup.html'));
});

// Start periodic server status updates
let serverStatusInterval = null;
function startServerStatusUpdates() {
  if (serverStatusInterval) {
    clearInterval(serverStatusInterval);
  }
  
  checkServerStatus(config.server.address, config.server.port)
    .then(status => {
      if (status.online) {
        console.log(`✓ Initial connection to Minecraft server successful: ${status.players.online}/${status.players.max} players`);
      } else {
        console.warn(`! Initial connection to Minecraft server failed: ${status.error}`);
      }
    })
    .catch(err => {
      console.error(`! Critical error checking server status: ${err.message}`);
    });
  
  serverStatusInterval = setInterval(() => {
    checkServerStatus(config.server.address, config.server.port)
      .catch(err => {
        console.error(`Error checking server status: ${err.message}`);
      });
  }, config.server.updateInterval);
}

// Initialize and start server
function startServer() {
  loadTwitchConfig();
  twitchClient = initTwitchClient();
  startServerStatusUpdates();
  
  // Load overlay configuration
  try {
    const configPath = path.join(__dirname, 'overlay-config.json');
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      overlayConfigCache.set('main', savedConfig);
      console.log('Loaded overlay configuration');
    } else {
      overlayConfigCache.set('main', getDefaultOverlayConfig());
    }
  } catch (e) {
    console.error('Error loading overlay config:', e);
    overlayConfigCache.set('main', getDefaultOverlayConfig());
  }
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
==========================================================
🎮 Enhanced Minecraft Stream Overlay System
==========================================================
Server running at:
- Main Overlay: http://localhost:${PORT}
- Control Panel: http://localhost:${PORT}/control-panel
- Overlay Preview: http://localhost:${PORT}/overlay-preview
- Server Status API: http://localhost:${PORT}/api/status
- Chat API: http://localhost:${PORT}/api/chat/messages
- Twitch Setup: http://localhost:${PORT}/twitch-setup

WebSocket Endpoints:
- Chat: ws://localhost:${PORT}/chat
- Control Panel: ws://localhost:${PORT}/control-panel
- Overlay: ws://localhost:${PORT}/overlay

API Endpoints:
- Client Data: POST http://localhost:${PORT}/api/client-data
- Server Data: POST http://localhost:${PORT}/api/server-data

Server configured for: ${config.server.address}:${config.server.port}
Twitch channel: ${config.twitch.channelName}

Press Ctrl+C to stop the server.
==========================================================
`);
  });
}

// Handle graceful shutdown
function gracefulShutdown() {
  console.log('Received shutdown signal. Closing server...');
  
  if (serverStatusInterval) {
    clearInterval(serverStatusInterval);
  }
  
  if (twitchClient) {
    twitchClient.disconnect();
  }
  
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startServer();
// Control Panel Main JavaScript
class OverlayControlPanel {
    constructor() {
        this.config = {
            overlayServerUrl: 'http://localhost:3002',
            wsUrl: 'ws://localhost:3002',
            updateInterval: 1000
        };
        
        this.websocket = null;
        this.isConnected = false;
        this.lastClientData = null;
        this.lastServerData = null;
        this.overlaySettings = this.loadSettings();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupWebSocket();
        this.loadAvailablePlaceholders();
        this.updateUI();
        this.startDataRefresh();
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const tabId = item.dataset.tab;
                this.switchTab(tabId);
            });
        });
        
        // Settings changes
        this.setupSettingsListeners();
        
        // Button actions
        document.getElementById('refresh-data').addEventListener('click', () => this.refreshData());
        document.getElementById('export-config').addEventListener('click', () => this.exportConfig());
        document.getElementById('import-config').addEventListener('click', () => this.importConfig());
        document.getElementById('refresh-preview').addEventListener('click', () => this.refreshPreview());
        document.getElementById('fullscreen-preview').addEventListener('click', () => this.fullscreenPreview());
        
        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        
        // Range input updates
        document.querySelectorAll('input[type="range"]').forEach(range => {
            range.addEventListener('input', (e) => {
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    valueSpan.textContent = e.target.value + (e.target.id.includes('opacity') ? '%' : '');
                }
            });
        });
    }
    
    setupSettingsListeners() {
        // Theme change
        document.getElementById('overlay-theme').addEventListener('change', (e) => {
            this.overlaySettings.theme = e.target.value;
            this.saveSettings();
            this.updateOverlay();
        });
        
        // Color change
        document.getElementById('primary-color').addEventListener('change', (e) => {
            this.overlaySettings.primaryColor = e.target.value;
            this.saveSettings();
            this.updateOverlay();
        });
        
        // Opacity change
        document.getElementById('background-opacity').addEventListener('input', (e) => {
            this.overlaySettings.backgroundOpacity = e.target.value;
            this.saveSettings();
            this.updateOverlay();
        });
        
        // Position change
        document.getElementById('overlay-position').addEventListener('change', (e) => {
            this.overlaySettings.position = e.target.value;
            this.saveSettings();
            this.updateOverlay();
        });
        
        // Scale change
        document.getElementById('overlay-scale').addEventListener('input', (e) => {
            this.overlaySettings.scale = e.target.value;
            this.saveSettings();
            this.updateOverlay();
        });
        
        // Element toggles
        ['coordinates', 'health', 'server-info'].forEach(element => {
            document.getElementById(`show-${element}`).addEventListener('change', (e) => {
                this.overlaySettings.elements[element].visible = e.target.checked;
                this.saveSettings();
                this.updateOverlay();
            });
        });
        
        // Data collection toggles
        ['client-data', 'server-data'].forEach(type => {
            document.getElementById(`enable-${type}`).addEventListener('change', (e) => {
                this.overlaySettings.dataCollection[type.replace('-', '')] = e.target.checked;
                this.saveSettings();
                this.sendConfigUpdate();
            });
        });
    }
    
    setupWebSocket() {
        try {
            this.websocket = new WebSocket(this.config.wsUrl + '/control-panel');
            
            this.websocket.onopen = () => {
                console.log('Connected to overlay server');
                this.isConnected = true;
                this.updateConnectionStatus();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('Error parsing WebSocket message:', e);
                }
            };
            
            this.websocket.onclose = () => {
                console.log('Disconnected from overlay server');
                this.isConnected = false;
                this.updateConnectionStatus();
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus();
            };
        } catch (e) {
            console.error('Failed to create WebSocket connection:', e);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'client_data':
                this.lastClientData = data;
                this.updateClientDataDisplay();
                break;
            case 'server_data':
                this.lastServerData = data;
                this.updateServerDataDisplay();
                break;
            case 'placeholder_data':
                this.updatePlaceholderPreview(data);
                break;
            case 'config_update':
                this.handleConfigUpdate(data);
                break;
        }
    }
    
    updateConnectionStatus() {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        
        if (this.isConnected) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Disconnected';
        }
    }
    
    updateClientDataDisplay() {
        if (!this.lastClientData) return;
        
        const data = this.lastClientData;
        
        // Update coordinates
        if (data.coordinates) {
            const coords = `${data.coordinates.x}, ${data.coordinates.y}, ${data.coordinates.z}`;
            document.getElementById('player-coords').textContent = coords;
        }
        
        // Update health
        if (data.health) {
            document.getElementById('player-health').textContent = `${data.health.health}/${data.health.maxHealth}`;
        }
        
        // Update dimension
        if (data.dimension) {
            const dimension = data.dimension.replace('minecraft:', '').replace('_', ' ');
            document.getElementById('player-dimension').textContent = 
                dimension.charAt(0).toUpperCase() + dimension.slice(1);
        }
        
        // Update client status
        document.getElementById('client-status').textContent = 'Connected';
        document.getElementById('client-status').className = 'value status-online';
        document.getElementById('client-last-update').textContent = new Date().toLocaleTimeString();
    }
    
    updateServerDataDisplay() {
        if (!this.lastServerData) return;
        
        const data = this.lastServerData;
        
        // Update server stats
        if (data.serverStats) {
            document.getElementById('players-online').textContent = 
                `${data.serverStats.onlinePlayers}/${data.serverStats.maxPlayers}`;
            
            if (data.serverStats.memoryUsagePercent) {
                document.getElementById('memory-usage').textContent = 
                    `${Math.round(data.serverStats.memoryUsagePercent)}%`;
            }
        }
        
        // Update TPS
        if (data.tps) {
            document.getElementById('server-tps').textContent = data.tps.tps1m.toFixed(1);
        }
        
        // Update server status
        document.getElementById('server-status').textContent = 'Connected';
        document.getElementById('server-status').className = 'value status-online';
        document.getElementById('server-last-update').textContent = new Date().toLocaleTimeString();
    }
    
    switchTab(tabId) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');
        
        // Special handling for preview tab
        if (tabId === 'preview') {
            this.refreshPreview();
        }
    }
    
    loadAvailablePlaceholders() {
        const placeholders = [
            '%player_name%',
            '%player_displayname%',
            '%player_health%',
            '%player_max_health%',
            '%player_food_level%',
            '%player_level%',
            '%player_exp%',
            '%player_gamemode%',
            '%player_world%',
            '%player_ping%',
            '%server_name%',
            '%server_online%',
            '%server_max_players%',
            '%server_tps%',
            '%world_name%',
            '%world_time%',
            '%world_weather%',
            '%overlay_enabled%',
            '%overlay_server_status%',
            '%overlay_tps_1m%',
            '%overlay_tps_5m%',
            '%overlay_tps_15m%',
            '%overlay_memory_used%',
            '%overlay_memory_max%',
            '%overlay_memory_usage_percent%'
        ];
        
        const container = document.getElementById('available-placeholders');
        container.innerHTML = '';
        
        placeholders.forEach(placeholder => {
            const item = document.createElement('div');
            item.className = 'placeholder-item';
            item.innerHTML = `
                <span>${placeholder}</span>
                <button class="btn btn-small" onclick="controlPanel.addPlaceholderToOverlay('${placeholder}')">Add</button>
            `;
            container.appendChild(item);
        });
    }
    
    addPlaceholderToOverlay(placeholder) {
        if (!this.overlaySettings.placeholders.includes(placeholder)) {
            this.overlaySettings.placeholders.push(placeholder);
            this.saveSettings();
            this.updateCustomPlaceholdersList();
            this.sendConfigUpdate();
        }
    }
    
    addCustomPlaceholder() {
        const input = document.getElementById('new-placeholder');
        const placeholder = input.value.trim();
        
        if (placeholder && !this.overlaySettings.placeholders.includes(placeholder)) {
            this.overlaySettings.placeholders.push(placeholder);
            this.saveSettings();
            this.updateCustomPlaceholdersList();
            this.sendConfigUpdate();
            input.value = '';
        }
    }
    
    updateCustomPlaceholdersList() {
        const container = document.getElementById('custom-placeholders');
        container.innerHTML = '';
        
        this.overlaySettings.placeholders.forEach((placeholder, index) => {
            const item = document.createElement('div');
            item.className = 'placeholder-item';
            item.innerHTML = `
                <span>${placeholder}</span>
                <button class="btn btn-small" onclick="controlPanel.removePlaceholder(${index})">Remove</button>
            `;
            container.appendChild(item);
        });
    }
    
    removePlaceholder(index) {
        this.overlaySettings.placeholders.splice(index, 1);
        this.saveSettings();
        this.updateCustomPlaceholdersList();
        this.sendConfigUpdate();
    }
    
    updatePlaceholderPreview(data) {
        const container = document.getElementById('placeholder-preview');
        container.innerHTML = '';
        
        if (data.placeholders) {
            Object.entries(data.placeholders).forEach(([key, value]) => {
                const line = document.createElement('div');
                line.innerHTML = `<strong>${key}:</strong> ${value}`;
                container.appendChild(line);
            });
        }
    }
    
    refreshPreview() {
        const iframe = document.getElementById('overlay-preview');
        iframe.src = this.config.overlayServerUrl + '/overlay-preview';
    }
    
    fullscreenPreview() {
        const url = this.config.overlayServerUrl + '/overlay-preview';
        window.open(url, '_blank', 'fullscreen=yes');
    }
    
    configureElement(elementType) {
        const modal = document.getElementById('element-config-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        
        title.textContent = `Configure ${elementType.charAt(0).toUpperCase() + elementType.slice(1)}`;
        
        // Generate configuration form based on element type
        body.innerHTML = this.generateElementConfigForm(elementType);
        
        modal.classList.add('active');
    }
    
    generateElementConfigForm(elementType) {
        const element = this.overlaySettings.elements[elementType] || {};
        
        return `
            <div class="form-group">
                <label for="element-x">X Position:</label>
                <input type="number" id="element-x" value="${element.x || 0}">
            </div>
            <div class="form-group">
                <label for="element-y">Y Position:</label>
                <input type="number" id="element-y" value="${element.y || 0}">
            </div>
            <div class="form-group">
                <label for="element-size">Font Size:</label>
                <input type="number" id="element-size" value="${element.fontSize || 16}" min="8" max="48">
            </div>
            <div class="form-group">
                <label for="element-color">Text Color:</label>
                <input type="color" id="element-color" value="${element.color || '#FFFFFF'}">
            </div>
            <div class="form-group">
                <label class="toggle">
                    <input type="checkbox" id="element-shadow" ${element.shadow ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                    Text Shadow
                </label>
            </div>
        `;
    }
    
    saveElementConfig() {
        // Implementation for saving element configuration
        this.closeModal();
    }
    
    closeModal() {
        document.getElementById('element-config-modal').classList.remove('active');
    }
    
    loadSettings() {
        const defaultSettings = {
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
        
        try {
            const saved = localStorage.getItem('overlaySettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (e) {
            return defaultSettings;
        }
    }
    
    saveSettings() {
        localStorage.setItem('overlaySettings', JSON.stringify(this.overlaySettings));
    }
    
    updateOverlay() {
        this.sendConfigUpdate();
    }
    
    sendConfigUpdate() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'config_update',
                settings: this.overlaySettings
            }));
        }
    }
    
    refreshData() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'refresh_request'
            }));
        }
    }
    
    exportConfig() {
        const config = {
            settings: this.overlaySettings,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'overlay-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const config = JSON.parse(e.target.result);
                        if (config.settings) {
                            this.overlaySettings = config.settings;
                            this.saveSettings();
                            this.updateUI();
                            this.updateOverlay();
                            alert('Configuration imported successfully!');
                        }
                    } catch (e) {
                        alert('Error importing configuration: ' + e.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    updateUI() {
        // Update form values from settings
        document.getElementById('overlay-theme').value = this.overlaySettings.theme;
        document.getElementById('primary-color').value = this.overlaySettings.primaryColor;
        document.getElementById('background-opacity').value = this.overlaySettings.backgroundOpacity;
        document.getElementById('overlay-position').value = this.overlaySettings.position;
        document.getElementById('overlay-scale').value = this.overlaySettings.scale;
        
        // Update element toggles
        Object.entries(this.overlaySettings.elements).forEach(([key, element]) => {
            const toggle = document.getElementById(`show-${key}`);
            if (toggle) toggle.checked = element.visible;
        });
        
        // Update data collection toggles
        document.getElementById('enable-client-data').checked = this.overlaySettings.dataCollection.clientdata;
        document.getElementById('enable-server-data').checked = this.overlaySettings.dataCollection.serverdata;
        
        // Update custom placeholders list
        this.updateCustomPlaceholdersList();
        
        // Update range value displays
        document.querySelectorAll('input[type="range"]').forEach(range => {
            const valueSpan = range.nextElementSibling;
            if (valueSpan && valueSpan.classList.contains('range-value')) {
                valueSpan.textContent = range.value + (range.id.includes('opacity') ? '%' : '');
            }
        });
    }
    
    startDataRefresh() {
        setInterval(() => {
            if (this.isConnected) {
                this.refreshData();
            }
        }, this.config.updateInterval);
    }
}

// Global functions for HTML onclick handlers
window.configureElement = (elementType) => controlPanel.configureElement(elementType);
window.addCustomPlaceholder = () => controlPanel.addCustomPlaceholder();
window.closeModal = () => controlPanel.closeModal();
window.saveElementConfig = () => controlPanel.saveElementConfig();

// Initialize the control panel
const controlPanel = new OverlayControlPanel();
window.controlPanel = controlPanel;
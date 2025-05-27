# Minecraft Streaming Overlay System - Installation Guide

## 🚀 Quick Start Installation

### Prerequisites
- **Server**: Paper/Spigot 1.21.5+ with Java 21
- **Client**: Minecraft 1.20.1+ with Fabric Loader
- **Overlay Server**: Node.js 18+ and npm

## 📦 Installation Steps

### 1. Server Installation (Spigot/Paper Plugin)

```bash
# Copy plugin to your server's plugins directory
cp jars/minecraft-overlay-plugin-1.0.0.jar /path/to/your/server/plugins/

# Start your server to generate config files
# Edit plugins/MinecraftOverlay/config.yml:
```

```yaml
# plugins/MinecraftOverlay/config.yml
overlay_server_url: "http://your-overlay-server:3002"
api_key: "your-secure-api-key-here"
update_interval: 1000
connection_timeout: 5000
retry_attempts: 3
retry_delay: 2000
```

### 2. Client Installation (Fabric Mod)

```bash
# Install Fabric Loader for Minecraft 1.20.1 from https://fabricmc.net/use/installer/

# Copy mod to your Minecraft mods directory
cp jars/fabric-mod-simple-1.0.0.jar ~/.minecraft/mods/

# Create config file: ~/.minecraft/config/minecraft-overlay-mod.json
```

```json
{
  "overlayServerUrl": "http://your-overlay-server:3002",
  "apiKey": "your-secure-api-key-here",
  "updateInterval": 1000,
  "enabled": true,
  "debugMode": false
}
```

### 3. Overlay System Installation

```bash
# Clone or download the overlay system
git clone <repository-url> minecraft-overlay-system
cd minecraft-overlay-system

# Install dependencies
cd enhanced-overlay && npm install
cd ../control-panel && npm install

# Start the overlay server
cd enhanced-overlay && npm start &

# Start the control panel
cd control-panel && npm run dev &
```

### 4. Configuration

1. **Access Control Panel**: http://localhost:52435
2. **Configure API Key**: Set the same API key in all components
3. **Customize Overlay**: Choose theme, elements, and positioning
4. **Test Connection**: Verify data is flowing from client and server

## 🔧 Configuration Files

### Server Config (plugins/MinecraftOverlay/config.yml)
```yaml
overlay_server_url: "http://localhost:3002"
api_key: "minecraft-overlay-2024"
update_interval: 1000
connection_timeout: 5000
retry_attempts: 3
retry_delay: 2000
placeholderapi:
  enabled: true
  custom_placeholders:
    overlay_coordinates: "X: %player_x%, Y: %player_y%, Z: %player_z%"
    overlay_health: "%player_health%/%player_max_health%"
```

### Client Config (~/.minecraft/config/minecraft-overlay-mod.json)
```json
{
  "overlayServerUrl": "http://localhost:3002",
  "apiKey": "minecraft-overlay-2024",
  "updateInterval": 1000,
  "enabled": true,
  "debugMode": false,
  "collectCoordinates": true,
  "collectHealth": true,
  "collectEffects": true,
  "collectPerformance": true
}
```

### Overlay Config (enhanced-overlay/config.json)
```json
{
  "port": 3002,
  "apiKey": "minecraft-overlay-2024",
  "cors": {
    "origin": "*",
    "credentials": true
  },
  "websocket": {
    "pingInterval": 25000,
    "pingTimeout": 5000
  },
  "twitch": {
    "enabled": true,
    "channel": "your-twitch-channel"
  }
}
```

## 🌐 Network Setup

### For Local Testing
- Use `http://localhost:3002` for all overlay_server_url settings
- Ensure all components use the same API key

### For Production/Remote Server
- Replace `localhost` with your server's IP or domain
- Configure firewall to allow port 3002
- Consider using SSL/HTTPS for production

### Example Production URLs
```
Overlay Server: https://overlay.yourdomain.com
Control Panel: https://overlay.yourdomain.com/control
API Endpoint: https://overlay.yourdomain.com/api
```

## 🔐 Security Recommendations

1. **Change Default API Key**: Use a strong, unique API key
2. **Firewall Configuration**: Restrict access to overlay server port
3. **SSL/TLS**: Use HTTPS in production environments
4. **Regular Updates**: Keep all components updated

## 🎯 Testing Your Installation

### 1. Test Server Plugin
```bash
# Check server logs for plugin loading
tail -f logs/latest.log | grep "MinecraftOverlay"

# Should see: "MinecraftOverlay plugin enabled successfully"
```

### 2. Test Client Mod
```bash
# Check Minecraft logs for mod loading
# Should see: "Minecraft Overlay Mod initialized"
```

### 3. Test Overlay System
```bash
# Access overlay at: http://localhost:3002
# Should display real-time data from client and server
```

### 4. Test Control Panel
```bash
# Access control panel at: http://localhost:52435
# Should allow theme customization and element configuration
```

## 🐛 Troubleshooting

### Common Issues

**Plugin Not Loading**
- Ensure Java 21 is installed
- Check Paper/Spigot version is 1.21.5+
- Verify PlaceholderAPI is installed

**Mod Not Working**
- Ensure Fabric Loader is installed for correct Minecraft version
- Check mod compatibility with other mods
- Verify config file syntax

**No Data in Overlay**
- Check API keys match across all components
- Verify network connectivity
- Check browser console for WebSocket errors

**Connection Timeouts**
- Increase timeout values in configs
- Check firewall settings
- Verify server is accessible

### Debug Mode
Enable debug mode in configs to get detailed logging:

```json
{
  "debugMode": true
}
```

## 📞 Support

For additional help:
1. Check the FINAL_PRODUCTION_SUMMARY.md for detailed information
2. Review logs in all components
3. Test network connectivity between components
4. Verify all configuration files are correct

---

**Installation Complete!** 🎉

Your Minecraft streaming overlay system is now ready for production use.
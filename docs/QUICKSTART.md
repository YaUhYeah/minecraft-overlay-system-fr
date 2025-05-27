# Quick Start Guide

## 1. Installation
Run the setup script:
```bash
./setup.sh
```

## 2. Start the System
```bash
./start-overlay-system.sh
```

## 3. Install Server Plugin
```bash
./install-server-plugin.sh /path/to/your/server/plugins
```

## 4. Configure Overlay
1. Open http://localhost:52435 in your browser
2. Configure your overlay settings
3. Test with the client mod

## 5. Stream Setup
1. Add browser source in OBS: http://localhost:3002
2. Set width: 1920, height: 1080
3. Enable "Shutdown source when not visible"
4. Position overlay as needed

## Troubleshooting
- Check that all services are running
- Verify firewall settings
- Check browser console for errors
- Review server logs for plugin issues

package com.yauhyeah.minecraftoverlay.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ModConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger("MinecraftOverlayConfig");
    private static final String CONFIG_FILE = "minecraft-overlay-mod.json";
    
    private final Path configPath;
    private final Gson gson;
    
    // Configuration values with defaults
    private String serverUrl = "http://localhost:3002";
    private String apiEndpoint = "/api/client-data";
    private int updateInterval = 1000; // milliseconds
    private boolean enableDebugLogging = false;
    private boolean enableDataCollection = true;
    private int connectionTimeout = 5000; // milliseconds
    private int maxRetries = 3;
    
    public ModConfig() {
        this.configPath = FabricLoader.getInstance().getConfigDir().resolve(CONFIG_FILE);
        this.gson = new GsonBuilder().setPrettyPrinting().create();
        loadConfig();
    }
    
    public void loadConfig() {
        try {
            if (Files.exists(configPath)) {
                String content = Files.readString(configPath);
                JsonObject config = JsonParser.parseString(content).getAsJsonObject();
                
                if (config.has("serverUrl")) {
                    serverUrl = config.get("serverUrl").getAsString();
                }
                if (config.has("apiEndpoint")) {
                    apiEndpoint = config.get("apiEndpoint").getAsString();
                }
                if (config.has("updateInterval")) {
                    updateInterval = config.get("updateInterval").getAsInt();
                }
                if (config.has("enableDebugLogging")) {
                    enableDebugLogging = config.get("enableDebugLogging").getAsBoolean();
                }
                if (config.has("enableDataCollection")) {
                    enableDataCollection = config.get("enableDataCollection").getAsBoolean();
                }
                if (config.has("connectionTimeout")) {
                    connectionTimeout = config.get("connectionTimeout").getAsInt();
                }
                if (config.has("maxRetries")) {
                    maxRetries = config.get("maxRetries").getAsInt();
                }
                
                LOGGER.info("Configuration loaded from {}", configPath);
            } else {
                saveConfig();
                LOGGER.info("Created default configuration at {}", configPath);
            }
        } catch (Exception e) {
            LOGGER.error("Failed to load configuration, using defaults", e);
            saveConfig();
        }
    }
    
    public void saveConfig() {
        try {
            JsonObject config = new JsonObject();
            config.addProperty("serverUrl", serverUrl);
            config.addProperty("apiEndpoint", apiEndpoint);
            config.addProperty("updateInterval", updateInterval);
            config.addProperty("enableDebugLogging", enableDebugLogging);
            config.addProperty("enableDataCollection", enableDataCollection);
            config.addProperty("connectionTimeout", connectionTimeout);
            config.addProperty("maxRetries", maxRetries);
            
            // Add comments as properties for documentation
            config.addProperty("_comment_serverUrl", "URL of the overlay server (change this for remote servers)");
            config.addProperty("_comment_updateInterval", "How often to send data in milliseconds (1000 = 1 second)");
            config.addProperty("_comment_connectionTimeout", "HTTP connection timeout in milliseconds");
            
            Files.createDirectories(configPath.getParent());
            Files.writeString(configPath, gson.toJson(config));
        } catch (IOException e) {
            LOGGER.error("Failed to save configuration", e);
        }
    }
    
    public void reload() {
        loadConfig();
    }
    
    // Getters
    public String getServerUrl() { return serverUrl; }
    public String getApiEndpoint() { return apiEndpoint; }
    public int getUpdateInterval() { return updateInterval; }
    public boolean isEnableDebugLogging() { return enableDebugLogging; }
    public boolean isEnableDataCollection() { return enableDataCollection; }
    public int getConnectionTimeout() { return connectionTimeout; }
    public int getMaxRetries() { return maxRetries; }
    
    public String getFullApiUrl() {
        return serverUrl + apiEndpoint;
    }
    
    // Setters
    public void setServerUrl(String serverUrl) {
        this.serverUrl = serverUrl;
        saveConfig();
    }
    
    public void setUpdateInterval(int updateInterval) {
        this.updateInterval = updateInterval;
        saveConfig();
    }
    
    public void setEnableDataCollection(boolean enableDataCollection) {
        this.enableDataCollection = enableDataCollection;
        saveConfig();
    }
}
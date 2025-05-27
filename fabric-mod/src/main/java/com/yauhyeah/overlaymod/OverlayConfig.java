package com.yauhyeah.overlaymod;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class OverlayConfig {
    private static final String CONFIG_FILE = "minecraft-overlay-client.json";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    
    // Server connection settings
    public String serverUrl = "http://localhost:3002";
    public String apiEndpoint = "/api/client-data";
    public boolean enabled = true;
    public int updateInterval = 100; // milliseconds
    
    // Data collection settings
    public boolean collectCoordinates = true;
    public boolean collectHealth = true;
    public boolean collectHunger = true;
    public boolean collectArmor = true;
    public boolean collectExperience = true;
    public boolean collectInventory = false;
    public boolean collectBiome = true;
    public boolean collectDimension = true;
    public boolean collectGameMode = true;
    public boolean collectFPS = true;
    public boolean collectPing = true;
    
    // Privacy settings
    public boolean hideCoordinatesFromStream = true;
    public boolean onlyShowToOverlay = true;
    
    private final Path configPath;
    
    public OverlayConfig() {
        this.configPath = FabricLoader.getInstance().getConfigDir().resolve(CONFIG_FILE);
        load();
    }
    
    public void load() {
        try {
            if (Files.exists(configPath)) {
                String json = Files.readString(configPath);
                OverlayConfig loaded = GSON.fromJson(json, OverlayConfig.class);
                copyFrom(loaded);
                MinecraftOverlayClient.LOGGER.info("Loaded configuration from {}", configPath);
            } else {
                save(); // Create default config
                MinecraftOverlayClient.LOGGER.info("Created default configuration at {}", configPath);
            }
        } catch (IOException e) {
            MinecraftOverlayClient.LOGGER.error("Failed to load configuration", e);
        }
    }
    
    public void save() {
        try {
            Files.createDirectories(configPath.getParent());
            String json = GSON.toJson(this);
            Files.writeString(configPath, json);
            MinecraftOverlayClient.LOGGER.debug("Saved configuration to {}", configPath);
        } catch (IOException e) {
            MinecraftOverlayClient.LOGGER.error("Failed to save configuration", e);
        }
    }
    
    private void copyFrom(OverlayConfig other) {
        if (other == null) return;
        
        this.serverUrl = other.serverUrl != null ? other.serverUrl : this.serverUrl;
        this.apiEndpoint = other.apiEndpoint != null ? other.apiEndpoint : this.apiEndpoint;
        this.enabled = other.enabled;
        this.updateInterval = other.updateInterval;
        this.collectCoordinates = other.collectCoordinates;
        this.collectHealth = other.collectHealth;
        this.collectHunger = other.collectHunger;
        this.collectArmor = other.collectArmor;
        this.collectExperience = other.collectExperience;
        this.collectInventory = other.collectInventory;
        this.collectBiome = other.collectBiome;
        this.collectDimension = other.collectDimension;
        this.collectGameMode = other.collectGameMode;
        this.collectFPS = other.collectFPS;
        this.collectPing = other.collectPing;
        this.hideCoordinatesFromStream = other.hideCoordinatesFromStream;
        this.onlyShowToOverlay = other.onlyShowToOverlay;
    }
    
    public boolean isEnabled() {
        return enabled;
    }
    
    public void toggleEnabled() {
        this.enabled = !this.enabled;
        save();
    }
    
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        save();
    }
    
    public String getFullApiUrl() {
        return serverUrl + apiEndpoint;
    }
}
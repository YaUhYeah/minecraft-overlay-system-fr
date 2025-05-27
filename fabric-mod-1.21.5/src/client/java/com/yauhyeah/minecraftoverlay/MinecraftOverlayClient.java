package com.yauhyeah.minecraftoverlay;

import com.google.gson.JsonObject;
import com.yauhyeah.minecraftoverlay.config.ModConfig;
import com.yauhyeah.minecraftoverlay.http.OverlayHttpClient;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public class MinecraftOverlayClient implements ClientModInitializer {
    public static final String MOD_ID = "minecraft-overlay-mod";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    
    private static MinecraftOverlayClient instance;
    private ModConfig config;
    private OverlayHttpClient httpClient;
    private int tickCounter = 0;
    private int updateInterval = 20; // Default 1 second (20 ticks)
    
    @Override
    public void onInitializeClient() {
        instance = this;
        LOGGER.info("Initializing Minecraft Overlay Client Mod for 1.21.5");
        
        // Initialize configuration
        config = new ModConfig();
        updateInterval = config.getUpdateInterval() / 50; // Convert ms to ticks (50ms per tick)
        
        // Initialize HTTP client
        httpClient = new OverlayHttpClient(config);
        
        // Register tick event for data collection
        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
        
        LOGGER.info("Minecraft Overlay Client Mod initialized successfully!");
    }
    
    private void onClientTick(MinecraftClient client) {
        if (client.player == null || client.world == null) {
            return;
        }
        
        tickCounter++;
        if (tickCounter >= updateInterval) {
            tickCounter = 0;
            collectAndSendData(client);
        }
    }
    
    private void collectAndSendData(MinecraftClient client) {
        try {
            ClientPlayerEntity player = client.player;
            if (player == null) return;
            
            JsonObject data = new JsonObject();
            
            // Player position
            Vec3d pos = player.getPos();
            data.addProperty("x", Math.round(pos.x * 100.0) / 100.0);
            data.addProperty("y", Math.round(pos.y * 100.0) / 100.0);
            data.addProperty("z", Math.round(pos.z * 100.0) / 100.0);
            
            // Player health and food
            data.addProperty("health", player.getHealth());
            data.addProperty("maxHealth", player.getMaxHealth());
            data.addProperty("food", player.getHungerManager().getFoodLevel());
            data.addProperty("maxFood", 20);
            data.addProperty("saturation", player.getHungerManager().getSaturationLevel());
            
            // Experience
            data.addProperty("level", player.experienceLevel);
            data.addProperty("experience", player.experienceProgress);
            data.addProperty("totalExperience", player.totalExperience);
            
            // World information
            World world = player.getWorld();
            Identifier dimensionId = world.getRegistryKey().getValue();
            data.addProperty("dimension", dimensionId.toString());
            data.addProperty("worldTime", world.getTimeOfDay());
            
            // Performance data
            data.addProperty("fps", client.getCurrentFps());
            if (client.getNetworkHandler() != null) {
                data.addProperty("ping", client.getNetworkHandler().getPlayerListEntry(player.getUuid()) != null ? 
                    client.getNetworkHandler().getPlayerListEntry(player.getUuid()).getLatency() : 0);
            } else {
                data.addProperty("ping", 0);
            }
            
            // Status effects
            List<JsonObject> effects = new ArrayList<>();
            for (StatusEffectInstance effect : player.getStatusEffects()) {
                JsonObject effectObj = new JsonObject();
                effectObj.addProperty("name", effect.getEffectType().getName().getString());
                effectObj.addProperty("duration", effect.getDuration());
                effectObj.addProperty("amplifier", effect.getAmplifier());
                effectObj.addProperty("ambient", effect.isAmbient());
                effects.add(effectObj);
            }
            data.add("effects", httpClient.getGson().toJsonTree(effects));
            
            // Gamemode
            data.addProperty("gamemode", player.getAbilities().creativeMode ? "creative" : 
                (player.getAbilities().invulnerable ? "spectator" : "survival"));
            
            // Additional data
            data.addProperty("timestamp", System.currentTimeMillis());
            data.addProperty("playerName", player.getName().getString());
            
            // Send data to overlay server
            httpClient.sendDataAsync(data);
            
        } catch (Exception e) {
            LOGGER.error("Error collecting player data: ", e);
        }
    }
    
    public static MinecraftOverlayClient getInstance() {
        return instance;
    }
    
    public ModConfig getConfig() {
        return config;
    }
    
    public void reloadConfig() {
        config.reload();
        updateInterval = config.getUpdateInterval() / 50;
        httpClient.updateConfig(config);
    }
}
package com.yauhyeah.overlaymod;

import com.google.gson.JsonObject;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.effect.StatusEffect;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.biome.Biome;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class DataCollector {
    private final OverlayConfig config;
    private final ScheduledExecutorService executor;
    private final HttpClient httpClient;
    private long lastUpdate = 0;
    
    public DataCollector(OverlayConfig config) {
        this.config = config;
        this.executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "OverlayDataCollector");
            t.setDaemon(true);
            return t;
        });
        this.httpClient = new HttpClient(config);
        
        // Start periodic data sending
        executor.scheduleAtFixedRate(this::sendDataToServer, 1, 1, TimeUnit.SECONDS);
    }
    
    public void tick(MinecraftClient client) {
        if (!config.isEnabled() || client.player == null || client.world == null) {
            return;
        }
        
        long now = System.currentTimeMillis();
        if (now - lastUpdate < config.updateInterval) {
            return;
        }
        
        lastUpdate = now;
        collectAndCacheData(client);
    }
    
    private JsonObject cachedData = new JsonObject();
    
    private void collectAndCacheData(MinecraftClient client) {
        try {
            ClientPlayerEntity player = client.player;
            ClientWorld world = client.world;
            
            JsonObject data = new JsonObject();
            data.addProperty("timestamp", System.currentTimeMillis());
            data.addProperty("type", "client_data");
            
            // Player coordinates
            if (config.collectCoordinates) {
                JsonObject coords = new JsonObject();
                coords.addProperty("x", Math.round(player.getX() * 100.0) / 100.0);
                coords.addProperty("y", Math.round(player.getY() * 100.0) / 100.0);
                coords.addProperty("z", Math.round(player.getZ() * 100.0) / 100.0);
                coords.addProperty("yaw", Math.round(player.getYaw() * 100.0) / 100.0);
                coords.addProperty("pitch", Math.round(player.getPitch() * 100.0) / 100.0);
                data.add("coordinates", coords);
            }
            
            // Health and hunger
            if (config.collectHealth) {
                JsonObject health = new JsonObject();
                health.addProperty("health", Math.round(player.getHealth() * 10.0) / 10.0);
                health.addProperty("maxHealth", Math.round(player.getMaxHealth() * 10.0) / 10.0);
                health.addProperty("absorption", Math.round(player.getAbsorptionAmount() * 10.0) / 10.0);
                data.add("health", health);
            }
            
            if (config.collectHunger) {
                JsonObject hunger = new JsonObject();
                hunger.addProperty("food", player.getHungerManager().getFoodLevel());
                hunger.addProperty("saturation", Math.round(player.getHungerManager().getSaturationLevel() * 10.0) / 10.0);
                data.add("hunger", hunger);
            }
            
            // Armor
            if (config.collectArmor) {
                data.addProperty("armor", player.getArmor());
            }
            
            // Experience
            if (config.collectExperience) {
                JsonObject exp = new JsonObject();
                exp.addProperty("level", player.experienceLevel);
                exp.addProperty("progress", Math.round(player.experienceProgress * 1000.0) / 1000.0);
                exp.addProperty("total", player.totalExperience);
                data.add("experience", exp);
            }
            
            // Biome
            if (config.collectBiome) {
                BlockPos pos = player.getBlockPos();
                Biome biome = world.getBiome(pos).value();
                Identifier biomeId = Registries.BIOME.getId(biome);
                data.addProperty("biome", biomeId.toString());
            }
            
            // Dimension
            if (config.collectDimension) {
                Identifier dimensionId = world.getRegistryKey().getValue();
                data.addProperty("dimension", dimensionId.toString());
            }
            
            // Game mode
            if (config.collectGameMode) {
                if (client.interactionManager != null) {
                    data.addProperty("gameMode", client.interactionManager.getCurrentGameMode().getName());
                }
            }
            
            // FPS
            if (config.collectFPS) {
                data.addProperty("fps", client.getCurrentFps());
            }
            
            // Ping
            if (config.collectPing && client.getNetworkHandler() != null) {
                if (client.getNetworkHandler().getPlayerListEntry(player.getUuid()) != null) {
                    data.addProperty("ping", client.getNetworkHandler().getPlayerListEntry(player.getUuid()).getLatency());
                }
            }
            
            // Status effects
            JsonObject effects = new JsonObject();
            for (StatusEffectInstance effect : player.getStatusEffects()) {
                StatusEffect statusEffect = effect.getEffectType();
                Identifier effectId = Registries.STATUS_EFFECT.getId(statusEffect);
                JsonObject effectData = new JsonObject();
                effectData.addProperty("duration", effect.getDuration());
                effectData.addProperty("amplifier", effect.getAmplifier());
                effectData.addProperty("ambient", effect.isAmbient());
                effects.add(effectId.toString(), effectData);
            }
            data.add("effects", effects);
            
            // Cache the data
            synchronized (this) {
                cachedData = data;
            }
            
        } catch (Exception e) {
            MinecraftOverlayClient.LOGGER.error("Error collecting client data", e);
        }
    }
    
    private void sendDataToServer() {
        if (!config.isEnabled()) {
            return;
        }
        
        JsonObject dataToSend;
        synchronized (this) {
            if (cachedData.size() == 0) {
                return;
            }
            dataToSend = cachedData.deepCopy();
        }
        
        httpClient.sendDataAsync(dataToSend);
    }
    
    public void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
        httpClient.shutdown();
    }
}
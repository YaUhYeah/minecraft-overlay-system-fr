package com.yauhyeah.overlaymod;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MinecraftOverlayClient implements ClientModInitializer {
    public static final String MOD_ID = "minecraft-overlay-client";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    
    private static KeyBinding toggleOverlayKey;
    private DataCollector dataCollector;
    private OverlayConfig config;
    
    @Override
    public void onInitializeClient() {
        LOGGER.info("Initializing Minecraft Overlay Client");
        
        // Initialize configuration
        config = new OverlayConfig();
        
        // Initialize data collector
        dataCollector = new DataCollector(config);
        
        // Register keybinding
        toggleOverlayKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.minecraft-overlay-client.toggle",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_F8,
            "category.minecraft-overlay-client"
        ));
        
        // Register tick event for data collection
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player != null && client.world != null) {
                dataCollector.tick(client);
            }
            
            // Handle keybinding
            while (toggleOverlayKey.wasPressed()) {
                config.toggleEnabled();
                if (config.isEnabled()) {
                    LOGGER.info("Overlay data collection enabled");
                } else {
                    LOGGER.info("Overlay data collection disabled");
                }
            }
        });
        
        LOGGER.info("Minecraft Overlay Client initialized successfully");
    }
    
    public static OverlayConfig getConfig() {
        return getInstance().config;
    }
    
    private static MinecraftOverlayClient instance;
    
    public MinecraftOverlayClient() {
        instance = this;
    }
    
    public static MinecraftOverlayClient getInstance() {
        return instance;
    }
}
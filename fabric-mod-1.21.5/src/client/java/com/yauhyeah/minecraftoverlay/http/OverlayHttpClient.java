package com.yauhyeah.minecraftoverlay.http;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.yauhyeah.minecraftoverlay.config.ModConfig;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class OverlayHttpClient {
    private static final Logger LOGGER = LoggerFactory.getLogger("OverlayHttpClient");
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    
    private OkHttpClient client;
    private ModConfig config;
    private final Gson gson;
    private boolean serverAvailable = true;
    private long lastFailureTime = 0;
    private static final long RETRY_DELAY = 30000; // 30 seconds
    
    public OverlayHttpClient(ModConfig config) {
        this.config = config;
        this.gson = new Gson();
        initializeClient();
    }
    
    private void initializeClient() {
        long timeoutSeconds = config.getConnectionTimeout() / 1000;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();
    }
    
    public void updateConfig(ModConfig newConfig) {
        this.config = newConfig;
        initializeClient();
    }
    
    public void sendDataAsync(JsonObject data) {
        if (!config.isEnableDataCollection()) {
            return;
        }
        
        // Don't spam failed requests
        if (!serverAvailable && System.currentTimeMillis() - lastFailureTime < RETRY_DELAY) {
            return;
        }
        
        RequestBody body = RequestBody.create(data.toString(), JSON);
        Request request = new Request.Builder()
            .url(config.getFullApiUrl())
            .post(body)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "MinecraftOverlayMod/1.0.0")
            .addHeader("X-Client-Type", "fabric-mod")
            .build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                if (serverAvailable) {
                    if (config.isEnableDebugLogging()) {
                        LOGGER.warn("Failed to send data to overlay server: {}", e.getMessage());
                    }
                    serverAvailable = false;
                    lastFailureTime = System.currentTimeMillis();
                }
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                try {
                    if (response.isSuccessful()) {
                        if (!serverAvailable) {
                            LOGGER.info("Reconnected to overlay server");
                            serverAvailable = true;
                        }
                        if (config.isEnableDebugLogging()) {
                            LOGGER.debug("Data sent successfully to overlay server");
                        }
                    } else {
                        if (serverAvailable) {
                            LOGGER.warn("Overlay server returned error: {} {}", 
                                response.code(), response.message());
                            serverAvailable = false;
                            lastFailureTime = System.currentTimeMillis();
                        }
                    }
                } finally {
                    response.close();
                }
            }
        });
    }
    
    public boolean isServerAvailable() {
        return serverAvailable;
    }
    
    public Gson getGson() {
        return gson;
    }
    
    public void shutdown() {
        if (client != null) {
            client.dispatcher().executorService().shutdown();
            client.connectionPool().evictAll();
        }
    }
}
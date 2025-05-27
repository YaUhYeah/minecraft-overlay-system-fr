package com.yauhyeah.overlaymod;

import com.google.gson.JsonObject;
import okhttp3.*;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class HttpClient {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    
    private final OkHttpClient client;
    private final OverlayConfig config;
    private boolean serverAvailable = true;
    private long lastFailureTime = 0;
    private static final long RETRY_DELAY = 30000; // 30 seconds
    
    public HttpClient(OverlayConfig config) {
        this.config = config;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .writeTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .retryOnConnectionFailure(false)
            .build();
    }
    
    public void sendDataAsync(JsonObject data) {
        if (!serverAvailable && System.currentTimeMillis() - lastFailureTime < RETRY_DELAY) {
            return; // Don't spam failed requests
        }
        
        RequestBody body = RequestBody.create(data.toString(), JSON);
        Request request = new Request.Builder()
            .url(config.getFullApiUrl())
            .post(body)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "MinecraftOverlayClient/1.0.0")
            .build();
        
        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                if (serverAvailable) {
                    MinecraftOverlayClient.LOGGER.warn("Failed to send data to overlay server: {}", e.getMessage());
                    serverAvailable = false;
                    lastFailureTime = System.currentTimeMillis();
                }
            }
            
            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    if (!serverAvailable) {
                        MinecraftOverlayClient.LOGGER.info("Reconnected to overlay server");
                        serverAvailable = true;
                    }
                } else {
                    if (serverAvailable) {
                        MinecraftOverlayClient.LOGGER.warn("Overlay server returned error: {} {}", 
                            response.code(), response.message());
                        serverAvailable = false;
                        lastFailureTime = System.currentTimeMillis();
                    }
                }
                response.close();
            }
        });
    }
    
    public void shutdown() {
        client.dispatcher().executorService().shutdown();
        client.connectionPool().evictAll();
    }
}
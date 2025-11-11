package com.cloudtunes.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.CastMediaControlIntent;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize Chromecast
        try {
            CastOptions castOptions = new CastOptions.Builder()
                .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
                .build();
            
            // CastContext will be initialized automatically by Capacitor
            // We just need to make sure the options are set
        } catch (Exception e) {
            // Silent fail - Chromecast might not be available
        }

        // Register custom plugins
        this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
            // Plugins will be auto-registered via Capacitor
        }});
    }
}

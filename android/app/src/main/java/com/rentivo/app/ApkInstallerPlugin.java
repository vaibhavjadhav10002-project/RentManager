package com.rentivo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Lets the web layer hand a locally-downloaded APK file straight to
 * Android's package installer, instead of routing through the system
 * browser's own download-then-tap-the-notification flow. This is the
 * last unavoidable step of a sideloaded (non-Play-Store) app update —
 * Android requires explicit user confirmation to install/replace a
 * package no matter what, there's no way for any app (without special
 * system/OEM signing permissions Rentivo doesn't have) to skip that
 * confirmation screen. This plugin exists to remove every step BEFORE
 * that one: the update JS downloads the APK in the background as soon as
 * one is detected (see src/lib/update/trigger.ts), and this plugin then
 * jumps straight to the install confirmation the moment the user taps
 * "Update Now" — no browser tab, no notification tray, no manually
 * opening the downloaded file.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("Missing 'path'");
            return;
        }
        // @capacitor/filesystem returns file:// URIs from getUri() — normalize
        // to a plain filesystem path before handing it to java.io.File.
        if (path.startsWith("file://")) {
            path = path.substring("file://".length());
        }
        try {
            File file = new File(path);
            if (!file.exists()) {
                call.reject("File does not exist: " + path);
                return;
            }
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start install: " + e.getMessage(), e);
        }
    }

    /**
     * Android 8+ requires the user to have granted this specific app
     * permission to install unknown apps at least once (a one-time OS
     * settings toggle — shown automatically the first time `install()`
     * fires if not yet granted, exactly like any other Android runtime
     * permission prompt). Exposed so the web layer can show an accurate
     * "you'll be asked to allow this once" hint instead of guessing.
     */
    @PluginMethod
    public void canInstallUnknownApps(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("value", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("value", true);
        }
        call.resolve(ret);
    }
}

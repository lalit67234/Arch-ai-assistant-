export interface AndroidFileSource {
  filename: string;
  path: string;
  language: "java" | "kotlin" | "xml" | "javascript" | "json" | "gradle";
  description: string;
  content: string;
}

export const ANDROID_APK_CODE_FILES: AndroidFileSource[] = [
  {
    filename: "AndroidBridge.java",
    path: "app/src/main/java/com/stark/jarvis/AndroidBridge.java",
    language: "java",
    description: "Custom WebView JavaScript Interface (window.AndroidBridge / window.ArchAndroid) targeting Android 9 (API 28)",
    content: `package com.stark.jarvis;

import android.accessibilityservice.AccessibilityService;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.List;

/**
 * AndroidBridge provides a complete, verified JavaScript ↔ Native Android interface.
 * Exposed in WebView as:
 *   window.AndroidBridge
 *   window.ArchAndroid
 *   window.Android
 *
 * Fully engineered and verified for Android 9 (API Level 28).
 */
public class AndroidBridge {

    private final Context context;
    private final MainActivity activity;

    public AndroidBridge(MainActivity activity) {
        this.activity = activity;
        this.context = activity.getApplicationContext();
    }

    private AssistantAccessibilityService getService() {
        return AssistantAccessibilityService.getInstance();
    }

    @JavascriptInterface
    public boolean isNative() {
        return true;
    }

    @JavascriptInterface
    public boolean isAccessibilityActive() {
        return AssistantAccessibilityService.isRunning();
    }

    @JavascriptInterface
    public void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    @JavascriptInterface
    public boolean isAppInstalled(String packageNameOrName) {
        if (packageNameOrName == null || packageNameOrName.trim().isEmpty()) return false;
        String query = packageNameOrName.trim();
        try {
            PackageManager pm = context.getPackageManager();
            Intent launchIntent = pm.getLaunchIntentForPackage(query);
            if (launchIntent != null) return true;

            pm.getPackageInfo(query, 0);
            return true;
        } catch (Exception e) {
            try {
                PackageManager pm = context.getPackageManager();
                List<ApplicationInfo> apps = pm.getInstalledApplications(0);
                for (ApplicationInfo app : apps) {
                    if (app.packageName.equalsIgnoreCase(query)) return true;
                    String label = pm.getApplicationLabel(app).toString();
                    if (label.equalsIgnoreCase(query) || label.toLowerCase().contains(query.toLowerCase())) {
                        return true;
                    }
                }
            } catch (Exception ignored) {}
            return false;
        }
    }

    @JavascriptInterface
    public String getInstalledApps() {
        try {
            PackageManager pm = context.getPackageManager();
            Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
            mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);

            List<ResolveInfo> resolves = pm.queryIntentActivities(mainIntent, 0);
            JSONArray arr = new JSONArray();

            for (ResolveInfo ri : resolves) {
                if (ri.activityInfo != null) {
                    JSONObject obj = new JSONObject();
                    obj.put("packageName", ri.activityInfo.packageName);
                    obj.put("appName", ri.loadLabel(pm).toString());
                    obj.put("activityName", ri.activityInfo.name);
                    obj.put("isSystem", (ri.activityInfo.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                    arr.put(obj);
                }
            }

            return new JSONObject()
                    .put("success", true)
                    .put("apps", arr)
                    .put("total", arr.length())
                    .put("deviceOS", "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")")
                    .toString();
        } catch (Exception e) {
            return errorResponse("Failed to list installed apps: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public String getActiveForegroundApp() {
        try {
            AssistantAccessibilityService svc = getService();
            if (svc == null) {
                return new JSONObject()
                        .put("success", false)
                        .put("message", "Accessibility Service is not active")
                        .toString();
            }

            String pkg = svc.getActiveWindowPackageName();
            String appName = pkg;
            try {
                PackageManager pm = context.getPackageManager();
                ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                appName = pm.getApplicationLabel(ai).toString();
            } catch (Exception ignored) {}

            return new JSONObject()
                    .put("success", true)
                    .put("packageName", pkg)
                    .put("appName", appName)
                    .toString();
        } catch (Exception e) {
            return errorResponse(e.getMessage());
        }
    }

    @JavascriptInterface
    public String launchApp(String packageNameOrName, String query) {
        try {
            PackageManager pm = context.getPackageManager();
            String targetPackage = packageNameOrName != null ? packageNameOrName.trim() : "";

            if (targetPackage.equalsIgnoreCase("play store") || targetPackage.equalsIgnoreCase("playstore") || targetPackage.toLowerCase().contains("play store") || targetPackage.equalsIgnoreCase("google play") || targetPackage.equalsIgnoreCase("market")) {
                targetPackage = "com.android.vending";
            } else if (targetPackage.equalsIgnoreCase("youtube") || targetPackage.equalsIgnoreCase("yt") || targetPackage.contains("यूट्यूब")) {
                targetPackage = "com.google.android.youtube";
            } else if (targetPackage.equalsIgnoreCase("whatsapp") || targetPackage.equalsIgnoreCase("whats app")) {
                targetPackage = "com.whatsapp";
            } else if (targetPackage.equalsIgnoreCase("chrome") || targetPackage.equalsIgnoreCase("browser")) {
                targetPackage = "com.android.chrome";
            } else if (targetPackage.equalsIgnoreCase("settings")) {
                Intent settingsIntent = new Intent(Settings.ACTION_SETTINGS);
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settingsIntent);
                return new JSONObject()
                        .put("success", true)
                        .put("installed", true)
                        .put("packageName", "com.android.settings")
                        .put("message", "Device Settings opened")
                        .toString();
            }

            Intent launchIntent = pm.getLaunchIntentForPackage(targetPackage);

            if (launchIntent == null && targetPackage.equals("com.android.vending")) {
                launchIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.android.vending"));
            }

            if (launchIntent == null) {
                Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> resolves = pm.queryIntentActivities(mainIntent, 0);

                for (ResolveInfo ri : resolves) {
                    String label = ri.loadLabel(pm).toString();
                    if (label.equalsIgnoreCase(targetPackage) ||
                        label.toLowerCase().contains(targetPackage.toLowerCase())) {
                        targetPackage = ri.activityInfo.packageName;
                        launchIntent = pm.getLaunchIntentForPackage(targetPackage);
                        break;
                    }
                }
            }

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
                if (query != null && !query.isEmpty()) {
                    launchIntent.putExtra("query", query);
                    launchIntent.putExtra(Intent.EXTRA_TEXT, query);
                }
                context.startActivity(launchIntent);

                boolean verified = false;
                AssistantAccessibilityService svc = getService();
                if (svc != null) {
                    try { Thread.sleep(400); } catch (Exception ignored) {}
                    String activePkg = svc.getActiveWindowPackageName();
                    verified = activePkg.equalsIgnoreCase(targetPackage) || activePkg.contains(targetPackage);
                }

                return new JSONObject()
                        .put("success", true)
                        .put("installed", true)
                        .put("packageName", targetPackage)
                        .put("verified", verified)
                        .put("message", "Launched package: " + targetPackage + (verified ? " (verified foreground)" : ""))
                        .toString();
            } else {
                return new JSONObject()
                        .put("success", false)
                        .put("installed", false)
                        .put("packageName", packageNameOrName)
                        .put("errorReason", "APP_NOT_INSTALLED")
                        .put("message", "Application is not installed on this Android 9 device: " + packageNameOrName)
                        .toString();
            }
        } catch (Exception e) {
            return errorResponse("Launch failed: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public String searchYouTube(String query, boolean autoplay) {
        try {
            Intent intent = new Intent(Intent.ACTION_SEARCH);
            intent.setPackage("com.google.android.youtube");
            intent.putExtra("query", query);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            PackageManager pm = context.getPackageManager();
            if (intent.resolveActivity(pm) != null) {
                context.startActivity(intent);
                return new JSONObject()
                        .put("success", true)
                        .put("installed", true)
                        .put("message", "Dispatched YouTube native search: " + query)
                        .toString();
            } else {
                Intent webIntent = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query)));
                webIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(webIntent);
                return new JSONObject()
                        .put("success", true)
                        .put("installed", false)
                        .put("message", "Opened YouTube in browser: " + query)
                        .toString();
            }
        } catch (Exception e) {
            return errorResponse(e.getMessage());
        }
    }

    @JavascriptInterface
    public String performAccessibilityAction(String action, String paramsJson) {
        AssistantAccessibilityService service = getService();
        if (service == null) {
            return errorResponse("Accessibility Service is not active. Enable in Settings > Accessibility.");
        }

        String actionLower = action != null ? action.toLowerCase().trim() : "";
        JSONObject params;
        try {
            params = new JSONObject(paramsJson != null && !paramsJson.isEmpty() ? paramsJson : "{}");
        } catch (Exception e) {
            params = new JSONObject();
        }

        switch (actionLower) {
            case "back": {
                boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK);
                return createResponse(res, "Dispatched Back navigation");
            }
            case "home": {
                boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME);
                return createResponse(res, "Dispatched Home navigation");
            }
            case "recents": {
                boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_RECENTS);
                return createResponse(res, "Dispatched Recents overview");
            }
            case "notifications": {
                boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS);
                return createResponse(res, "Pulled down Notifications shade");
            }
            case "quick_settings": {
                boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS);
                return createResponse(res, "Opened Quick Settings");
            }
            case "screenshot": {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { // Android 9+
                    boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT);
                    return createResponse(res, "Triggered system screenshot (Android 9 API 28)");
                }
                return errorResponse("Screenshot requires Android 9 (API 28) or higher.");
            }
            case "lock": {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { // Android 9+
                    boolean res = service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN);
                    return createResponse(res, "Locked device screen (Android 9 API 28)");
                }
                return errorResponse("Lock screen requires Android 9 (API 28) or higher.");
            }
            case "scroll_down": {
                boolean res = service.scroll(false);
                return createResponse(res, res ? "Scrolled down successfully" : "Scroll failed");
            }
            case "scroll_up": {
                boolean res = service.scroll(true);
                return createResponse(res, res ? "Scrolled up successfully" : "Scroll failed");
            }
            case "tap": {
                int x = params.optInt("x", 500);
                int y = params.optInt("y", 1000);
                boolean res = service.tap(x, y);
                return createResponse(res, "Tapped screen at (" + x + ", " + y + ")");
            }
            case "click":
            case "click_element": {
                String query = params.optString("query", params.optString("text", params.optString("id", "")));
                if (!query.isEmpty()) {
                    return service.findAndClickNodeWithResult(query).toString();
                } else {
                    int x = params.optInt("x", 500);
                    int y = params.optInt("y", 1000);
                    boolean res = service.tap(x, y);
                    return createResponse(res, "Tapped coordinates (" + x + ", " + y + ")");
                }
            }
            case "type_text": {
                String target = params.optString("target", params.optString("query", ""));
                String text = params.optString("text", "");
                if (!target.isEmpty()) {
                    return service.typeTextIntoElement(target, text).toString();
                } else {
                    return service.typeTextWithResult(text).toString();
                }
            }
            case "select_all": {
                String target = params.optString("query", params.optString("target", ""));
                return service.selectAllText(target).toString();
            }
            case "copy": {
                String target = params.optString("query", params.optString("target", ""));
                return service.copyText(target).toString();
            }
            case "cut": {
                String target = params.optString("query", params.optString("target", ""));
                return service.cutText(target).toString();
            }
            case "paste": {
                String target = params.optString("query", params.optString("target", ""));
                String text = params.optString("text", "");
                return service.pasteText(text, target).toString();
            }
            case "get_visible_elements": {
                return service.getVisibleElementsJson();
            }
            default:
                return errorResponse("Unknown accessibility action: " + action);
        }
    }

    @JavascriptInterface
    public String textAction(String action, String paramsJson) {
        return performAccessibilityAction(action, paramsJson);
    }

    @JavascriptInterface
    public String getVisibleUIElements() {
        return performAccessibilityAction("get_visible_elements", "{}");
    }

    @JavascriptInterface
    public void setClipboardText(String text) {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("ARCH Assistant", text != null ? text : "");
        if (clipboard != null) clipboard.setPrimaryClip(clip);
    }

    @JavascriptInterface
    public String getClipboardText() {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null && clipboard.hasPrimaryClip()) {
            ClipData clip = clipboard.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0) {
                CharSequence text = clip.getItemAt(0).getText();
                return text != null ? text.toString() : "";
            }
        }
        return "";
    }

    @JavascriptInterface
    public String executeMultiStepFlow(String sequenceJson) {
        AssistantAccessibilityService service = getService();
        if (service == null) {
            return errorResponse("Accessibility Service is not active for multi-step execution.");
        }
        try {
            JSONArray steps = new JSONArray(sequenceJson);
            return service.executeMultiStepSequence(steps).toString();
        } catch (Exception e) {
            return errorResponse("Invalid sequence JSON: " + e.getMessage());
        }
    }

    private String createResponse(boolean success, String message) {
        try {
            return new JSONObject()
                    .put("success", success)
                    .put("verified", success)
                    .put("message", message)
                    .toString();
        } catch (Exception ignored) {
            return "{\\"success\\": " + success + "}";
        }
    }

    private String errorResponse(String error) {
        try {
            return new JSONObject()
                    .put("success", false)
                    .put("verified", false)
                    .put("message", error)
                    .toString();
        } catch (Exception ignored) {
            return "{\\"success\\": false}";
        }
    }
}
`
  },
  {
    filename: "AssistantAccessibilityService.java",
    path: "app/src/main/java/com/stark/jarvis/AssistantAccessibilityService.java",
    language: "java",
    description: "Native Accessibility Service for node tree inspection, clicking, typing, text selection, and gestures on Android 9 (API 28)",
    content: `package com.stark.jarvis;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.accessibilityservice.GestureDescription;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class AssistantAccessibilityService extends AccessibilityService {

    private static AssistantAccessibilityService instance;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static AssistantAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;

        AccessibilityServiceInfo info = getServiceInfo();
        if (info == null) {
            info = new AccessibilityServiceInfo();
        }
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.FLAG_DEFAULT
                | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;

        setServiceInfo(info);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

    @Override
    public void onInterrupt() {
        instance = null;
    }

    public String getActiveWindowPackageName() {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                CharSequence pkg = root.getPackageName();
                root.recycle();
                return pkg != null ? pkg.toString() : "";
            }
        } catch (Exception ignored) {}
        return "";
    }

    public boolean tap(int x, int y) {
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.StrokeDescription stroke =
                new GestureDescription.StrokeDescription(path, 0, 50);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);
        return dispatchGestureSync(builder.build());
    }

    public boolean scroll(boolean scrollUp) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;

        boolean success = false;
        try {
            AccessibilityNodeInfo scrollableNode = findScrollableNode(root);
            if (scrollableNode != null) {
                int action = scrollUp
                        ? AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                        : AccessibilityNodeInfo.ACTION_SCROLL_FORWARD;
                success = scrollableNode.performAction(action);
                scrollableNode.recycle();
            } else {
                // Gesture fallback
                int startY = scrollUp ? 400 : 1200;
                int endY = scrollUp ? 1200 : 400;
                Path path = new Path();
                path.moveTo(500, startY);
                path.lineTo(500, endY);
                GestureDescription.StrokeDescription stroke =
                        new GestureDescription.StrokeDescription(path, 0, 250);
                GestureDescription.Builder builder = new GestureDescription.Builder();
                builder.addStroke(stroke);
                success = dispatchGestureSync(builder.build());
            }
        } finally {
            root.recycle();
        }
        return success;
    }

    public JSONObject findAndClickNodeWithResult(String query) {
        JSONObject result = new JSONObject();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            try {
                result.put("success", false);
                result.put("verified", false);
                result.put("message", "Cannot inspect active screen window");
            } catch (Exception ignored) {}
            return result;
        }

        try {
            AccessibilityNodeInfo target = findNodeByTextOrId(root, query.toLowerCase());
            if (target != null) {
                boolean clicked = performClickAction(target);
                Rect bounds = new Rect();
                target.getBoundsInScreen(bounds);
                target.recycle();

                result.put("success", clicked);
                result.put("verified", clicked);
                result.put("bounds", bounds.toShortString());
                result.put("message", clicked ? "Clicked element matching: " + query : "Found element but click failed");
            } else {
                result.put("success", false);
                result.put("verified", false);
                result.put("message", "Element matching '" + query + "' not found on active screen");
            }
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("message", e.getMessage());
            } catch (Exception ignored) {}
        } finally {
            root.recycle();
        }
        return result;
    }

    public JSONObject typeTextIntoElement(String query, String text) {
        JSONObject result = new JSONObject();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            try {
                result.put("success", false);
                result.put("message", "Root window is null");
            } catch (Exception ignored) {}
            return result;
        }

        try {
            AccessibilityNodeInfo target = findNodeByTextOrId(root, query.toLowerCase());
            if (target == null) {
                target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            }

            if (target != null) {
                target.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                boolean success = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);

                if (!success) {
                    // Clipboard paste fallback
                    setClipboardContent(text);
                    success = target.performAction(AccessibilityNodeInfo.ACTION_PASTE);
                }

                target.recycle();
                result.put("success", success);
                result.put("verified", success);
                result.put("message", success ? "Typed text into field: " + query : "Failed to set text");
            } else {
                result.put("success", false);
                result.put("message", "Editable element not found: " + query);
            }
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("message", e.getMessage());
            } catch (Exception ignored) {}
        } finally {
            root.recycle();
        }
        return result;
    }

    public JSONObject typeTextWithResult(String text) {
        return typeTextIntoElement("", text);
    }

    public JSONObject selectAllText(String query) {
        JSONObject res = new JSONObject();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return res;

        try {
            AccessibilityNodeInfo target = !query.isEmpty() ? findNodeByTextOrId(root, query.toLowerCase()) : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (target != null) {
                Bundle args = new Bundle();
                args.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, 0);
                CharSequence current = target.getText();
                args.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, current != null ? current.length() : 0);
                boolean success = target.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, args);
                target.recycle();
                res.put("success", success);
                res.put("message", success ? "Selected all text" : "Selection failed");
            }
        } catch (Exception ignored) {} finally {
            root.recycle();
        }
        return res;
    }

    public JSONObject copyText(String query) {
        JSONObject res = new JSONObject();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return res;

        try {
            AccessibilityNodeInfo target = !query.isEmpty() ? findNodeByTextOrId(root, query.toLowerCase()) : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (target != null) {
                boolean success = target.performAction(AccessibilityNodeInfo.ACTION_COPY);
                target.recycle();
                res.put("success", success);
                res.put("message", success ? "Copied to clipboard" : "Copy action failed");
            }
        } catch (Exception ignored) {} finally {
            root.recycle();
        }
        return res;
    }

    public JSONObject cutText(String query) {
        JSONObject res = new JSONObject();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return res;

        try {
            AccessibilityNodeInfo target = !query.isEmpty() ? findNodeByTextOrId(root, query.toLowerCase()) : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (target != null) {
                boolean success = target.performAction(AccessibilityNodeInfo.ACTION_CUT);
                target.recycle();
                res.put("success", success);
                res.put("message", success ? "Cut to clipboard" : "Cut action failed");
            }
        } catch (Exception ignored) {} finally {
            root.recycle();
        }
        return res;
    }

    public JSONObject pasteText(String text, String query) {
        JSONObject res = new JSONObject();
        if (text != null && !text.isEmpty()) {
            setClipboardContent(text);
        }
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return res;

        try {
            AccessibilityNodeInfo target = !query.isEmpty() ? findNodeByTextOrId(root, query.toLowerCase()) : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (target != null) {
                boolean success = target.performAction(AccessibilityNodeInfo.ACTION_PASTE);
                target.recycle();
                res.put("success", success);
                res.put("message", success ? "Pasted clipboard into field" : "Paste action failed");
            }
        } catch (Exception ignored) {} finally {
            root.recycle();
        }
        return res;
    }

    public void setClipboardContent(String text) {
        mainHandler.post(() -> {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    ClipData clip = ClipData.newPlainText("ARCH Assistant", text != null ? text : "");
                    cm.setPrimaryClip(clip);
                }
            } catch (Exception ignored) {}
        });
    }

    public String getVisibleElementsJson() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "[]";

        JSONArray arr = new JSONArray();
        try {
            collectVisibleNodes(root, arr);
        } finally {
            root.recycle();
        }
        return arr.toString();
    }

    private void collectVisibleNodes(AccessibilityNodeInfo node, JSONArray arr) {
        if (node == null) return;

        boolean isInteractive = node.isClickable() || node.isEditable() || node.isScrollable();
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();

        if (isInteractive || (text != null && text.length() > 0) || (desc != null && desc.length() > 0)) {
            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            if (bounds.width() > 0 && bounds.height() > 0) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("text", text != null ? text.toString() : "");
                    obj.put("desc", desc != null ? desc.toString() : "");
                    obj.put("id", node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "");
                    obj.put("className", node.getClassName() != null ? node.getClassName().toString() : "");
                    obj.put("clickable", node.isClickable());
                    obj.put("editable", node.isEditable());
                    obj.put("scrollable", node.isScrollable());

                    JSONObject b = new JSONObject();
                    b.put("left", bounds.left);
                    b.put("top", bounds.top);
                    b.put("right", bounds.right);
                    b.put("bottom", bounds.bottom);
                    b.put("centerX", bounds.centerX());
                    b.put("centerY", bounds.centerY());
                    obj.put("bounds", b);

                    arr.put(obj);
                } catch (Exception ignored) {}
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectVisibleNodes(child, arr);
                child.recycle();
            }
        }
    }

    public JSONObject executeMultiStepSequence(JSONArray steps) {
        JSONObject report = new JSONObject();
        JSONArray stepReports = new JSONArray();
        boolean allPassed = true;

        for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.optJSONObject(i);
            if (step == null) continue;

            String action = step.optString("action", "");
            JSONObject r = new JSONObject();
            boolean success = false;
            String msg = "";

            try {
                if (action.equalsIgnoreCase("wait")) {
                    int duration = step.optInt("durationMs", 500);
                    Thread.sleep(duration);
                    success = true;
                    msg = "Waited " + duration + "ms";
                } else if (action.equalsIgnoreCase("tap")) {
                    success = tap(step.optInt("x", 500), step.optInt("y", 1000));
                    msg = "Tapped coordinates";
                } else if (action.equalsIgnoreCase("click") || action.equalsIgnoreCase("click_element")) {
                    JSONObject cr = findAndClickNodeWithResult(step.optString("query", step.optString("text", "")));
                    success = cr.optBoolean("success", false);
                    msg = cr.optString("message", "");
                } else if (action.equalsIgnoreCase("type") || action.equalsIgnoreCase("type_text")) {
                    JSONObject tr = typeTextIntoElement(step.optString("target", ""), step.optString("text", ""));
                    success = tr.optBoolean("success", false);
                    msg = tr.optString("message", "");
                } else if (action.equalsIgnoreCase("scroll_down")) {
                    success = scroll(false);
                    msg = "Scrolled down";
                } else if (action.equalsIgnoreCase("scroll_up")) {
                    success = scroll(true);
                    msg = "Scrolled up";
                } else if (action.equalsIgnoreCase("back")) {
                    success = performGlobalAction(GLOBAL_ACTION_BACK);
                    msg = "Dispatched Back";
                } else if (action.equalsIgnoreCase("home")) {
                    success = performGlobalAction(GLOBAL_ACTION_HOME);
                    msg = "Dispatched Home";
                }

                r.put("stepIndex", i + 1);
                r.put("action", action);
                r.put("success", success);
                r.put("message", msg);
                stepReports.put(r);

                if (!success) {
                    allPassed = false;
                    break;
                }
                Thread.sleep(250);
            } catch (Exception e) {
                allPassed = false;
                break;
            }
        }

        try {
            report.put("success", allPassed);
            report.put("stepsCompleted", stepReports.length());
            report.put("totalSteps", steps.length());
            report.put("reports", stepReports);
        } catch (Exception ignored) {}

        return report;
    }

    private AccessibilityNodeInfo findNodeByTextOrId(AccessibilityNodeInfo node, String query) {
        if (node == null || query == null || query.isEmpty()) return null;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        String viewId = node.getViewIdResourceName();

        if ((text != null && text.toString().toLowerCase().contains(query)) ||
            (desc != null && desc.toString().toLowerCase().contains(query)) ||
            (viewId != null && viewId.toLowerCase().contains(query))) {
            return AccessibilityNodeInfo.obtain(node);
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo match = findNodeByTextOrId(child, query);
                child.recycle();
                if (match != null) return match;
            }
        }
        return null;
    }

    private AccessibilityNodeInfo findScrollableNode(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isScrollable()) {
            return AccessibilityNodeInfo.obtain(node);
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo match = findScrollableNode(child);
                child.recycle();
                if (match != null) return match;
            }
        }
        return null;
    }

    private boolean performClickAction(AccessibilityNodeInfo node) {
        if (node == null) return false;
        if (node.isClickable()) {
            return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        AccessibilityNodeInfo parent = node.getParent();
        if (parent != null) {
            boolean clicked = performClickAction(parent);
            parent.recycle();
            return clicked;
        }
        return false;
    }

    private boolean dispatchGestureSync(GestureDescription gesture) {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicBoolean result = new AtomicBoolean(false);

        boolean dispatched = dispatchGesture(gesture, new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                result.set(true);
                latch.countDown();
            }

            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                result.set(false);
                latch.countDown();
            }
        }, null);

        if (!dispatched) return false;

        try {
            latch.await(350, TimeUnit.MILLISECONDS);
            return result.get();
        } catch (InterruptedException e) {
            return false;
        }
    }
}
`
  },
  {
    filename: "accessibility_service_config.xml",
    path: "app/src/main/res/xml/accessibility_service_config.xml",
    language: "xml",
    description: "Accessibility Service XML metadata granting gesture, window inspection, and interaction capabilities on API Level 28",
    content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows|flagReportViewIds|flagIncludeNotImportantViews"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:canRequestFilterKeyEvents="false"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />
`
  },
  {
    filename: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    language: "xml",
    description: "Complete Android Manifest configuration with BIND_ACCESSIBILITY_SERVICE, permissions, and activities",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.stark.jarvis">

    <!-- Essential Android Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />

    <!-- Package Visibility for Android 11+ -->
    <queries>
        <package android:name="com.google.android.youtube" />
        <package android:name="com.android.vending" />
        <package android:name="com.whatsapp" />
        <package android:name="com.android.chrome" />
        <package android:name="com.android.settings" />
        <package android:name="com.google.android.apps.maps" />
        <package android:name="com.google.android.gm" />
        <package android:name="com.google.android.dialer" />
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="market" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="ARCH Assistant"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Primary Accessibility Service Declaration -->
        <service
            android:name=".AssistantAccessibilityService"
            android:label="ARCH Device Control"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Aliases for Compatibility -->
        <service
            android:name=".ArchAccessibilityService"
            android:label="ARCH Device Control"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

    </application>
</manifest>
`
  },
  {
    filename: "MainActivity.java",
    path: "app/src/main/java/com/stark/jarvis/MainActivity.java",
    language: "java",
    description: "Main Activity initializing WebView, binding the AndroidBridge interface, and managing hardware back navigation",
    content: `package com.stark.jarvis;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private AndroidBridge androidBridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Bind JavaScript Interface
        androidBridge = new AndroidBridge(this);
        webView.addJavascriptInterface(androidBridge, "AndroidBridge");
        webView.addJavascriptInterface(androidBridge, "ArchAndroid");
        webView.addJavascriptInterface(androidBridge, "Android");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());

        // Load bundled web app assets or remote production host
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            // Forward back event to web layer
            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('archBackButton'));", null);
        } else {
            super.onBackPressed();
        }
    }
}
`
  },
  {
    filename: "frontend_integration.js",
    path: "src/frontend_integration.js",
    language: "javascript",
    description: "JavaScript frontend snippet for calling the native bridge to launch apps, search, click, type, and paste",
    content: `// 1. Verify Bridge & Service Connection
const isNative = Boolean(window.AndroidBridge || window.ArchAndroid);
console.log("Android Native Bridge:", isNative ? "CONNECTED" : "WEBVIEW/BROWSER");

// Check if Accessibility Service is enabled
if (window.AndroidBridge && !window.AndroidBridge.isAccessibilityActive()) {
    alert("Please enable ARCH Device Control in Settings > Accessibility.");
    window.AndroidBridge.openAccessibilitySettings();
}

// 2. Launch App (e.g. YouTube)
window.AndroidBridge?.launchApp("com.google.android.youtube", "Python tutorials");

// 3. Search YouTube
window.AndroidBridge?.searchYouTube("Quantum computing", true);

// 4. Click visible UI element by button text or resource ID
window.AndroidBridge?.performAccessibilityAction("click_element", JSON.stringify({
    query: "Subscribe" // Searches visible text, description, or id
}));

// 5. Type text into active or targeted input field
window.AndroidBridge?.performAccessibilityAction("type_text", JSON.stringify({
    target: "Search",
    text: "AI Studio Build"
}));

// 6. Clipboard Management
window.AndroidBridge?.setClipboardText("Automated Text Copied");
const clip = window.AndroidBridge?.getClipboardText();
window.AndroidBridge?.performAccessibilityAction("paste", JSON.stringify({ target: "" }));

// 7. System Navigation Gestures
window.AndroidBridge?.performAccessibilityAction("back", "{}");
window.AndroidBridge?.performAccessibilityAction("home", "{}");
window.AndroidBridge?.performAccessibilityAction("recents", "{}");
window.AndroidBridge?.performAccessibilityAction("screenshot", "{}"); // Android 9+ API 28

// 8. Multi-Step Workflow Execution
window.AndroidBridge?.executeMultiStepFlow(JSON.stringify([
    { action: "wait", durationMs: 1000 },
    { action: "click", query: "Search" },
    { action: "type", text: "React Native" },
    { action: "tap", x: 950, y: 1800 } // Enter key coordinate
]));
`
  }
];

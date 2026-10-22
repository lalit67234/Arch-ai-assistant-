package com.stark.jarvis;

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

/**
 * JarvisAccessibilityService (also aliased as ArchAccessibilityService)
 * Comprehensive device control engine specifically optimized for Android 9 (API 28).
 * Handles gesture dispatching, UI tree inspection, smart clicking, text typing,
 * text selection, copy, cut, paste, and multi-step action execution with outcome verification.
 */
public class JarvisAccessibilityService extends AccessibilityService {

    private static JarvisAccessibilityService instance;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static JarvisAccessibilityService getInstance() {
        return instance;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;

        // Configure service for Android 9 (API 28)
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
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Active window and event monitoring
    }

    @Override
    public void onInterrupt() {
        // Interrupted
    }

    /**
     * Returns the package name of the active foreground window.
     */
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

    /**
     * Performs tap at specific coordinates with verified completion.
     */
    public boolean tap(int x, int y) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Path path = new Path();
            path.moveTo(x, y);
            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 50));
            return dispatchGestureSync(gestureBuilder.build(), 400);
        }
        return false;
    }

    /**
     * Performs long press at specific coordinates.
     */
    public boolean longPress(int x, int y) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Path path = new Path();
            path.moveTo(x, y);
            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, 800));
            return dispatchGestureSync(gestureBuilder.build(), 1100);
        }
        return false;
    }

    /**
     * Performs directional swipe with customizable start, end, and duration.
     */
    public boolean swipe(int startX, int startY, int endX, int endY, int durationMs) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Path path = new Path();
            path.moveTo(startX, startY);
            path.lineTo(endX, endY);
            GestureDescription.Builder gestureBuilder = new GestureDescription.Builder();
            gestureBuilder.addStroke(new GestureDescription.StrokeDescription(path, 0, Math.max(50, durationMs)));
            return dispatchGestureSync(gestureBuilder.build(), durationMs + 300);
        }
        return false;
    }

    /**
     * Synchronous gesture dispatcher that awaits completion callback.
     */
    private boolean dispatchGestureSync(GestureDescription gesture, long timeoutMs) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;
        final AtomicBoolean success = new AtomicBoolean(false);
        final CountDownLatch latch = new CountDownLatch(1);

        try {
            boolean initiated = dispatchGesture(gesture, new GestureResultCallback() {
                @Override
                public void onCompleted(GestureDescription gestureDescription) {
                    success.set(true);
                    latch.countDown();
                }

                @Override
                public void onCancelled(GestureDescription gestureDescription) {
                    success.set(false);
                    latch.countDown();
                }
            }, mainHandler);

            if (!initiated) return false;
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
            return success.get();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Smooth scroll gesture with node-based fallback.
     */
    public boolean scroll(boolean up) {
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int centerX = screenWidth / 2;

        int startY = up ? (int) (screenHeight * 0.35f) : (int) (screenHeight * 0.75f);
        int endY = up ? (int) (screenHeight * 0.75f) : (int) (screenHeight * 0.35f);

        boolean gestureOk = swipe(centerX, startY, centerX, endY, 300);
        if (gestureOk) return true;

        // Node-based scroll fallback
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                int action = up ? AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD : AccessibilityNodeInfo.ACTION_SCROLL_FORWARD;
                boolean scrolled = performScrollOnNode(root, action);
                root.recycle();
                return scrolled;
            }
        } catch (Exception ignored) {}

        return false;
    }

    private boolean performScrollOnNode(AccessibilityNodeInfo node, int action) {
        if (node == null) return false;
        if (node.isScrollable() && node.performAction(action)) {
            return true;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                boolean done = performScrollOnNode(child, action);
                child.recycle();
                if (done) return true;
            }
        }
        return false;
    }

    /**
     * Find and click node by query text, resource ID, or content description.
     * Uses dual-layer clicking:
     * 1. Accessibility ACTION_CLICK on node or parent.
     * 2. If ACTION_CLICK fails (common in custom/Flutter/React Native views), falls back to physical gesture tap on element coordinates!
     */
    public JSONObject findAndClickNodeWithResult(String query) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            res.put("query", query != null ? query : "");

            if (query == null || query.trim().isEmpty()) {
                res.put("message", "Search query was empty");
                return res;
            }

            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Unable to inspect active window (root node is null)");
                return res;
            }

            String cleanQuery = query.trim();
            AccessibilityNodeInfo targetNode = findBestMatchingNode(root, cleanQuery);

            if (targetNode == null) {
                root.recycle();
                res.put("message", "No visible UI element matching '" + cleanQuery + "' found on screen");
                return res;
            }

            Rect bounds = new Rect();
            targetNode.getBoundsInScreen(bounds);

            // Layer 1: Perform ACTION_CLICK on node or clickable parent
            boolean clickedAction = performClickOnNodeOrParent(targetNode);

            if (clickedAction) {
                res.put("success", true);
                res.put("method", "accessibility_action_click");
                res.put("message", "Successfully clicked element matching '" + cleanQuery + "'");
                res.put("bounds", boundsToJson(bounds));
                targetNode.recycle();
                root.recycle();
                return res;
            }

            // Layer 2: Physical gesture tap fallback at element center coordinates
            int centerX = bounds.centerX();
            int centerY = bounds.centerY();
            if (centerX > 0 && centerY > 0) {
                boolean tapped = tap(centerX, centerY);
                if (tapped) {
                    res.put("success", true);
                    res.put("method", "gesture_tap_coordinates");
                    res.put("message", "Successfully dispatched tap gesture at element center (" + centerX + ", " + centerY + ")");
                    res.put("bounds", boundsToJson(bounds));
                    targetNode.recycle();
                    root.recycle();
                    return res;
                }
            }

            targetNode.recycle();
            root.recycle();
            res.put("message", "Element found but could not execute click or tap gesture");
            return res;

        } catch (Exception e) {
            try {
                res.put("success", false);
                res.put("message", "Click failed: " + e.getMessage());
            } catch (Exception ignored) {}
            return res;
        }
    }

    public boolean findAndClickNode(String query) {
        JSONObject res = findAndClickNodeWithResult(query);
        return res.optBoolean("success", false);
    }

    public boolean clickByText(String targetText) {
        return findAndClickNode(targetText);
    }

    private AccessibilityNodeInfo findBestMatchingNode(AccessibilityNodeInfo root, String query) {
        String lowerQuery = query.toLowerCase();

        // 1. Exact or partial text match
        List<AccessibilityNodeInfo> textNodes = root.findAccessibilityNodeInfosByText(query);
        if (textNodes != null && !textNodes.isEmpty()) {
            for (AccessibilityNodeInfo n : textNodes) {
                if (n.isVisibleToUser()) return n;
            }
            return textNodes.get(0);
        }

        // 2. View ID match
        try {
            List<AccessibilityNodeInfo> idNodes = root.findAccessibilityNodeInfosByViewId(query);
            if (idNodes != null && !idNodes.isEmpty()) {
                for (AccessibilityNodeInfo n : idNodes) {
                    if (n.isVisibleToUser()) return n;
                }
                return idNodes.get(0);
            }
        } catch (Exception ignored) {}

        // 3. Deep traversal checking text, description, and view ID
        return traverseFind(root, lowerQuery);
    }

    private AccessibilityNodeInfo traverseFind(AccessibilityNodeInfo node, String lowerQuery) {
        if (node == null) return null;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        CharSequence viewId = node.getViewIdResourceName();

        boolean match = (text != null && text.toString().toLowerCase().contains(lowerQuery))
                || (desc != null && desc.toString().toLowerCase().contains(lowerQuery))
                || (viewId != null && viewId.toString().toLowerCase().contains(lowerQuery));

        if (match && node.isVisibleToUser()) {
            return node;
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo res = traverseFind(child, lowerQuery);
                if (res != null) {
                    return res;
                }
                child.recycle();
            }
        }
        return null;
    }

    private boolean performClickOnNodeOrParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo clickable = node;
        int depth = 0;
        while (clickable != null && !clickable.isClickable() && depth < 6) {
            clickable = clickable.getParent();
            depth++;
        }
        if (clickable != null && clickable.isClickable()) {
            return clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
        return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    /**
     * Type text into the active focused field, or automatically find the first editable field.
     */
    public JSONObject typeTextWithResult(String text) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            if (text == null) {
                res.put("message", "Text was null");
                return res;
            }

            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Cannot access active window");
                return res;
            }

            AccessibilityNodeInfo target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);

            // If no focused input, locate first editable field
            if (target == null) {
                target = findFirstEditableNode(root);
                if (target != null) {
                    performClickOnNodeOrParent(target);
                    try { Thread.sleep(150); } catch (Exception ignored) {}
                }
            }

            if (target == null) {
                root.recycle();
                res.put("message", "No editable input field found on current screen");
                return res;
            }

            // Layer 1: ACTION_SET_TEXT (Standard Android API 21+)
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            boolean setTextOk = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);

            if (setTextOk) {
                target.recycle();
                root.recycle();
                res.put("success", true);
                res.put("method", "ACTION_SET_TEXT");
                res.put("message", "Successfully entered text: \"" + (text.length() > 30 ? text.substring(0, 30) + "..." : text) + "\"");
                return res;
            }

            // Layer 2: Clipboard paste fallback
            boolean pasteOk = pasteTextIntoNode(target, text);
            target.recycle();
            root.recycle();

            if (pasteOk) {
                res.put("success", true);
                res.put("method", "CLIPBOARD_PASTE");
                res.put("message", "Successfully pasted text via clipboard");
                return res;
            }

            res.put("message", "Editable element refused text input");
            return res;

        } catch (Exception e) {
            try {
                res.put("success", false);
                res.put("message", "Typing error: " + e.getMessage());
            } catch (Exception ignored) {}
            return res;
        }
    }

    public boolean typeText(String text) {
        JSONObject res = typeTextWithResult(text);
        return res.optBoolean("success", false);
    }

    /**
     * Type text into a specific element by label or ID.
     */
    public JSONObject typeTextIntoElement(String query, String text) {
        JSONObject clickRes = findAndClickNodeWithResult(query);
        try { Thread.sleep(200); } catch (Exception ignored) {}
        return typeTextWithResult(text);
    }

    private AccessibilityNodeInfo findFirstEditableNode(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isEditable() && node.isVisibleToUser()) {
            return node;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                AccessibilityNodeInfo res = findFirstEditableNode(child);
                if (res != null) return res;
                child.recycle();
            }
        }
        return null;
    }

    /**
     * Select all text in active or target element (Android 9 API 28 compatible).
     */
    public JSONObject selectAllText(String query) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Root node null");
                return res;
            }

            AccessibilityNodeInfo target = null;
            if (query != null && !query.trim().isEmpty()) {
                target = findBestMatchingNode(root, query.trim());
            }
            if (target == null) {
                target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            }
            if (target == null) {
                target = findFirstEditableNode(root);
            }

            if (target == null) {
                root.recycle();
                res.put("message", "No text field found to select");
                return res;
            }

            CharSequence currentText = target.getText();
            int len = currentText != null ? currentText.length() : 5000;

            Bundle args = new Bundle();
            args.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, 0);
            args.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, len);
            boolean ok = target.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, args);

            if (!ok) {
                ok = target.performAction(AccessibilityNodeInfo.ACTION_SELECT);
            }

            target.recycle();
            root.recycle();

            res.put("success", ok);
            res.put("message", ok ? "Selected all text" : "Target element did not allow text selection");
            return res;
        } catch (Exception e) {
            try { res.put("success", false); res.put("message", e.getMessage()); } catch (Exception ignored) {}
            return res;
        }
    }

    /**
     * Copy text from active or target element.
     */
    public JSONObject copyText(String query) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Root node null");
                return res;
            }

            AccessibilityNodeInfo target = null;
            if (query != null && !query.trim().isEmpty()) {
                target = findBestMatchingNode(root, query.trim());
            }
            if (target == null) {
                target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            }
            if (target == null) {
                target = findFirstEditableNode(root);
            }

            if (target != null) {
                boolean ok = target.performAction(AccessibilityNodeInfo.ACTION_COPY);
                CharSequence text = target.getText();
                if (text != null && text.length() > 0) {
                    setClipboardContent(text.toString());
                    ok = true;
                }
                target.recycle();
                root.recycle();
                res.put("success", ok);
                res.put("message", ok ? "Copied text to clipboard" : "Copy action unsupported by element");
                return res;
            }

            root.recycle();
            res.put("message", "No target element available to copy from");
            return res;
        } catch (Exception e) {
            try { res.put("success", false); res.put("message", e.getMessage()); } catch (Exception ignored) {}
            return res;
        }
    }

    /**
     * Cut text from active or target element.
     */
    public JSONObject cutText(String query) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Root node null");
                return res;
            }

            AccessibilityNodeInfo target = null;
            if (query != null && !query.trim().isEmpty()) {
                target = findBestMatchingNode(root, query.trim());
            }
            if (target == null) {
                target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            }
            if (target == null) {
                target = findFirstEditableNode(root);
            }

            if (target != null) {
                CharSequence text = target.getText();
                if (text != null) {
                    setClipboardContent(text.toString());
                }
                boolean ok = target.performAction(AccessibilityNodeInfo.ACTION_CUT);
                if (!ok && text != null) {
                    // Fallback: clear text manually
                    Bundle args = new Bundle();
                    args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, "");
                    ok = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                }
                target.recycle();
                root.recycle();
                res.put("success", ok);
                res.put("message", ok ? "Cut text to clipboard" : "Cut action refused by element");
                return res;
            }

            root.recycle();
            res.put("message", "No target element to cut from");
            return res;
        } catch (Exception e) {
            try { res.put("success", false); res.put("message", e.getMessage()); } catch (Exception ignored) {}
            return res;
        }
    }

    /**
     * Paste text into active or target element.
     */
    public JSONObject pasteText(String textToPaste, String query) {
        JSONObject res = new JSONObject();
        try {
            res.put("success", false);
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                res.put("message", "Root node null");
                return res;
            }

            AccessibilityNodeInfo target = null;
            if (query != null && !query.trim().isEmpty()) {
                target = findBestMatchingNode(root, query.trim());
            }
            if (target == null) {
                target = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            }
            if (target == null) {
                target = findFirstEditableNode(root);
            }

            if (target == null) {
                root.recycle();
                res.put("message", "No editable element found to paste into");
                return res;
            }

            if (textToPaste != null && !textToPaste.isEmpty()) {
                setClipboardContent(textToPaste);
            }

            boolean ok = target.performAction(AccessibilityNodeInfo.ACTION_PASTE);

            if (!ok && textToPaste != null && !textToPaste.isEmpty()) {
                // Fallback to direct set text
                Bundle args = new Bundle();
                args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, textToPaste);
                ok = target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
            }

            target.recycle();
            root.recycle();
            res.put("success", ok);
            res.put("message", ok ? "Pasted text successfully" : "Paste action failed");
            return res;
        } catch (Exception e) {
            try { res.put("success", false); res.put("message", e.getMessage()); } catch (Exception ignored) {}
            return res;
        }
    }

    private boolean pasteTextIntoNode(AccessibilityNodeInfo node, String text) {
        try {
            setClipboardContent(text);
            return node.performAction(AccessibilityNodeInfo.ACTION_PASTE);
        } catch (Exception e) {
            return false;
        }
    }

    public void setClipboardContent(String text) {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) {
                ClipData clip = ClipData.newPlainText("ARCH", text);
                cm.setPrimaryClip(clip);
            }
        } catch (Exception ignored) {}
    }

    public String getClipboardContent() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null && cm.getPrimaryClip().getItemCount() > 0) {
                CharSequence text = cm.getPrimaryClip().getItemAt(0).getText();
                return text != null ? text.toString() : "";
            }
        } catch (Exception ignored) {}
        return "";
    }

    /**
     * Inspects active window hierarchy and returns JSON array of visible interactive UI elements.
     */
    public String getVisibleElementsJson() {
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) return "[]";

            StringBuilder json = new StringBuilder("[");
            boolean[] first = new boolean[]{true};
            collectVisibleElements(root, json, first, 0);
            json.append("]");
            root.recycle();
            return json.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    private void collectVisibleElements(AccessibilityNodeInfo node, StringBuilder json, boolean[] first, int depth) {
        if (node == null || depth > 18) return;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        CharSequence viewId = node.getViewIdResourceName();
        boolean isClickable = node.isClickable();
        boolean isEditable = node.isEditable();
        boolean isScrollable = node.isScrollable();

        if (node.isVisibleToUser() && (isClickable || isEditable || isScrollable || (text != null && text.length() > 0) || (desc != null && desc.length() > 0))) {
            if (!first[0]) json.append(",");
            first[0] = false;

            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);

            json.append("{");
            json.append("\"text\":").append(escapeJson(text != null ? text.toString() : "")).append(",");
            json.append("\"desc\":").append(escapeJson(desc != null ? desc.toString() : "")).append(",");
            json.append("\"id\":").append(escapeJson(viewId != null ? viewId.toString() : "")).append(",");
            json.append("\"className\":").append(escapeJson(node.getClassName() != null ? node.getClassName().toString() : "")).append(",");
            json.append("\"clickable\":").append(isClickable).append(",");
            json.append("\"editable\":").append(isEditable).append(",");
            json.append("\"scrollable\":").append(isScrollable).append(",");
            json.append("\"bounds\":{\"left\":").append(bounds.left).append(",\"top\":").append(bounds.top)
                    .append(",\"right\":").append(bounds.right).append(",\"bottom\":").append(bounds.bottom)
                    .append(",\"centerX\":").append(bounds.centerX()).append(",\"centerY\":").append(bounds.centerY()).append("}");
            json.append("}");
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectVisibleElements(child, json, first, depth + 1);
                child.recycle();
            }
        }
    }

    /**
     * Executes a multi-step sequence across apps with verified results.
     */
    public JSONObject executeMultiStepSequence(JSONArray steps) {
        JSONObject summary = new JSONObject();
        JSONArray stepReports = new JSONArray();
        boolean allPassed = true;

        try {
            for (int i = 0; i < steps.length(); i++) {
                JSONObject step = steps.getJSONObject(i);
                String action = step.optString("action", "");
                JSONObject report = new JSONObject();
                report.put("stepIndex", i + 1);
                report.put("action", action);

                boolean stepOk = false;
                switch (action.toLowerCase()) {
                    case "tap":
                        stepOk = tap(step.optInt("x", 500), step.optInt("y", 1000));
                        report.put("success", stepOk);
                        report.put("message", stepOk ? "Tapped coordinates" : "Tap failed");
                        break;

                    case "click":
                    case "click_element":
                        JSONObject cRes = findAndClickNodeWithResult(step.optString("query", step.optString("text", "")));
                        stepOk = cRes.optBoolean("success", false);
                        report.put("success", stepOk);
                        report.put("message", cRes.optString("message", ""));
                        break;

                    case "type":
                    case "type_text":
                        String targetQuery = step.optString("target", "");
                        JSONObject tRes;
                        if (!targetQuery.isEmpty()) {
                            tRes = typeTextIntoElement(targetQuery, step.optString("text", ""));
                        } else {
                            tRes = typeTextWithResult(step.optString("text", ""));
                        }
                        stepOk = tRes.optBoolean("success", false);
                        report.put("success", stepOk);
                        report.put("message", tRes.optString("message", ""));
                        break;

                    case "scroll_down":
                        stepOk = scroll(false);
                        report.put("success", stepOk);
                        report.put("message", stepOk ? "Scrolled down" : "Scroll failed");
                        break;

                    case "scroll_up":
                        stepOk = scroll(true);
                        report.put("success", stepOk);
                        report.put("message", stepOk ? "Scrolled up" : "Scroll failed");
                        break;

                    case "back":
                        stepOk = performGlobalAction(GLOBAL_ACTION_BACK);
                        report.put("success", stepOk);
                        report.put("message", "Dispatched back navigation");
                        break;

                    case "home":
                        stepOk = performGlobalAction(GLOBAL_ACTION_HOME);
                        report.put("success", stepOk);
                        report.put("message", "Dispatched home navigation");
                        break;

                    case "wait":
                        int waitMs = step.optInt("durationMs", 500);
                        try { Thread.sleep(waitMs); } catch (Exception ignored) {}
                        stepOk = true;
                        report.put("success", true);
                        report.put("message", "Waited " + waitMs + "ms");
                        break;

                    default:
                        report.put("success", false);
                        report.put("message", "Unrecognized sequence action: " + action);
                        stepOk = false;
                        break;
                }

                stepReports.put(report);
                if (!stepOk) {
                    allPassed = false;
                    if (step.optBoolean("breakOnError", true)) {
                        break;
                    }
                }

                // Small settle interval between multi-step actions
                int settleTime = step.optInt("settleMs", 250);
                if (settleTime > 0) {
                    try { Thread.sleep(settleTime); } catch (Exception ignored) {}
                }
            }

            summary.put("success", allPassed);
            summary.put("stepsCompleted", stepReports.length());
            summary.put("totalSteps", steps.length());
            summary.put("reports", stepReports);
            summary.put("activePackage", getActiveWindowPackageName());
            return summary;
        } catch (Exception e) {
            try {
                summary.put("success", false);
                summary.put("message", "Sequence failure: " + e.getMessage());
            } catch (Exception ignored) {}
            return summary;
        }
    }

    private JSONObject boundsToJson(Rect r) {
        JSONObject o = new JSONObject();
        try {
            o.put("left", r.left);
            o.put("top", r.top);
            o.put("right", r.right);
            o.put("bottom", r.bottom);
            o.put("centerX", r.centerX());
            o.put("centerY", r.centerY());
        } catch (Exception ignored) {}
        return o;
    }

    private String escapeJson(String s) {
        if (s == null) return "\"\"";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }
}

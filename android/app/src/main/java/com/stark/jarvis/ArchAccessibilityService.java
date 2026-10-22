package com.stark.jarvis;

/**
 * ArchAccessibilityService alias for JarvisAccessibilityService.
 * Ensures seamless compatibility when declared in AndroidManifest.xml as ArchAccessibilityService.
 */
public class ArchAccessibilityService extends JarvisAccessibilityService {
    public static ArchAccessibilityService getInstance() {
        JarvisAccessibilityService instance = JarvisAccessibilityService.getInstance();
        if (instance instanceof ArchAccessibilityService) {
            return (ArchAccessibilityService) instance;
        }
        return null;
    }
}

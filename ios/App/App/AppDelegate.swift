import UIKit
import Capacitor
import AVFoundation
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // capacitor.config.json points server.url at the live
        // https://conver.services/app — this app is really just a thin
        // native shell around that remote page, so every deploy to the
        // server is supposed to reach it automatically on next launch. But
        // WKWebView's on-disk HTTP cache persists across app updates (it
        // lives in the app container, which TestFlight/App Store updates
        // don't wipe), so it can go on serving an old cached copy of
        // index.html indefinitely with no visible error — confirmed via
        // server-side request logging: TestFlight requests were arriving
        // without even the debug instrumentation's own request header,
        // meaning the JS actually running predated that commit entirely.
        // Clearing the disk/memory HTTP cache (NOT cookies or localStorage
        // — that's where Supabase persists the signed-in session, and
        // wiping it would force a re-login on every single launch) before
        // this runs, in every launch, guarantees the webview always fetches
        // index.html fresh from conver.services instead of from its cache.
        let cacheTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeOfflineWebApplicationCache
        ]
        WKWebsiteDataStore.default().removeData(
            ofTypes: cacheTypes,
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) {}

        // Override point for customization after application launch.
        //
        // Without this, iOS mutes ALL HTML5 <audio> playback (every coach
        // TTS response) whenever the phone's physical silent/ringer switch
        // is flipped on — WKWebView audio respects that switch by default
        // unless the app explicitly configures its own audio session. This
        // is the documented, well-known cause of "the coach sometimes just
        // doesn't say anything, then works again later" — it isn't random,
        // it's the ringer switch position (or another app having changed
        // the shared session) at the moment playback starts. .playAndRecord
        // (not just .playback) because this app also records the mic in
        // the same session; .defaultToSpeaker routes playback out the
        // speaker instead of the tiny earpiece.
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to configure AVAudioSession: \(error)")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        //
        // Re-assert the audio session config from launch — if another app
        // (a phone call, Music, etc.) took over the shared audio session
        // while this one was backgrounded, iOS doesn't hand it back
        // automatically, and the next TTS playback could silently fail to
        // route through the speaker until this runs again.
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to re-activate AVAudioSession on resume: \(error)")
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
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

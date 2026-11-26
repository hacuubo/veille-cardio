import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
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
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // Notifications : iOS remet ici l'adresse de l'appareil ; on la transmet au module
    // Firebase (notifications du samedi), qui s'occupe du reste.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
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

// MARK: - Écran principal de Pause Cardio
//
// Remplace l'écran Capacitor par défaut (voir Main.storyboard) pour :
//  1. glisser dans la page les réglages propres à l'appli (public/appli.js) — le site
//     pausecardio.fr lui-même n'est pas modifié ;
//  2. donner à la page la hauteur exacte de la zone de l'heure et de la batterie ;
//  3. permettre de tirer la page vers le bas pour la recharger ;
//  4. dire à la page si les notifications sont configurées dans cette version.

class PauseCardioViewController: CAPBridgeViewController {

    private var scriptAppli: String?
    private var hautConnu: Int = 0
    private var observationChargement: NSKeyValueObservation?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = bridge?.webView else { return }

        // Capacitor bloque le rebond de la page : sans rebond, on ne peut pas tirer pour recharger
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true

        let controleur = webView.configuration.userContentController
        let pushConfigure = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil
        controleur.addUserScript(WKUserScript(source: "window.__pcPushConfig = \(pushConfigure ? "true" : "false");",
                                              injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // même fond que le site (clair ou sombre selon le réglage du téléphone), pour éviter un éclair blanc
        let fond = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0x0d / 255.0, green: 0x0d / 255.0, blue: 0x0d / 255.0, alpha: 1)
                : UIColor(red: 0xf9 / 255.0, green: 0xf9 / 255.0, blue: 0xf7 / 255.0, alpha: 1)
        }
        view.backgroundColor = fond
        webView.isOpaque = false
        webView.backgroundColor = fond
        webView.scrollView.backgroundColor = fond

        if let url = Bundle.main.url(forResource: "appli", withExtension: "js", subdirectory: "public"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            scriptAppli = source
            controleur.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }

        let tirer = UIRefreshControl()
        tirer.addTarget(self, action: #selector(recharger(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = tirer

        // Filet de sécurité : à la fin de chaque chargement, on redonne la hauteur de l'encoche
        // et on glisse les réglages s'ils manquent (appli.js ne s'applique qu'une fois).
        observationChargement = webView.observe(\.isLoading, options: [.new]) { [weak self] vue, _ in
            guard let self = self, !vue.isLoading else { return }
            self.appliquerHaut()
            if let source = self.scriptAppli { vue.evaluateJavaScript(source, completionHandler: nil) }
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        appliquerHaut()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        appliquerHaut()
    }

    // Hauteur de la zone de l'heure et de la batterie, mesurée par iOS (59 points sur un
    // iPhone récent), transmise à la page dans la variable CSS --pc-haut-natif.
    private func appliquerHaut() {
        guard let webView = bridge?.webView else { return }
        var haut = view.safeAreaInsets.top
        if haut <= 0, let barre = view.window?.windowScene?.statusBarManager?.statusBarFrame.height {
            haut = barre
        }
        let points = Int(haut.rounded())
        let bas = Int(view.safeAreaInsets.bottom.rounded())
        guard points > 0 else { return }
        let js = "(function(){window.__pcHautNatif=\(points);window.__pcBasNatif=\(bas);var r=document.documentElement;"
            + "if(r){r.style.setProperty('--pc-haut-natif','\(points)px');r.style.setProperty('--pc-bas-natif','\(bas)px');}})();"
        webView.evaluateJavaScript(js, completionHandler: nil)
        if points != hautConnu {
            hautConnu = points
            webView.configuration.userContentController.addUserScript(
                WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }

    @objc private func recharger(_ sender: UIRefreshControl) {
        bridge?.webView?.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { sender.endRefreshing() }
    }
}

import XCTest
@testable import PiWorkbench

/// Smoke tests for the piNative bridge injection script. Also guards that the
/// retired `webFetch` method stays removed (web_fetch now lives in the
/// community `pi-web-access` extension, not the native bridge).
final class PiNativeBridgeTests: XCTestCase {
  @MainActor
  func testInjectionScriptExposesExpectedMethods() {
    let script = PiNativeBridge.injectionScript
    let expected = [
      "pickWorkspaceDirectory",
      "pickFiles",
      "showNotification",
      "openPath",
      "restartServer",
      "preventSleep",
      "allowSleep",
      "setKeepAwakeAlways",
      "getPowerState",
      "copyImage",
      "saveImage",
    ]
    for method in expected {
      XCTAssertTrue(script.contains(method), "injectionScript should expose \(method)")
    }
  }

  @MainActor
  func testWebFetchRemovedFromBridge() {
    XCTAssertFalse(
      PiNativeBridge.injectionScript.contains("webFetch"),
      "webFetch should be removed from the native bridge (replaced by pi-web-access extension)"
    )
  }
}

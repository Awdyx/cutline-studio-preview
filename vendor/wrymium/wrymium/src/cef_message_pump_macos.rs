//! macOS CEF message pump: display-linked (CADisplayLink) + background throttle.

use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};

use objc2::define_class;
use objc2::msg_send;
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::{NSObject, ProtocolObject};
use objc2::ClassType;
use objc2::MainThreadOnly;
use objc2_app_kit::{
    NSApplication, NSApplicationDidBecomeActiveNotification,
    NSApplicationDidHideNotification, NSApplicationDidResignActiveNotification,
    NSApplicationDidUnhideNotification,
};
use objc2_foundation::{
    NSDefaultRunLoopMode, NSNotification, NSNotificationCenter, NSOperationQueue,
    NSObjectProtocol, NSRunLoop,
};
use objc2_quartz_core::CADisplayLink;

use cef::do_message_loop_work;

use core_foundation_sys::date::CFAbsoluteTimeGetCurrent;
use core_foundation_sys::runloop::{
    kCFRunLoopCommonModes, CFRunLoopAddTimer, CFRunLoopGetMain, CFRunLoopTimerCreate,
    CFRunLoopTimerRef, CFRunLoopTimerSetNextFireDate,
};

static APP_FOREGROUND: AtomicBool = AtomicBool::new(true);

/// Main-thread-only handles (set once during `install_message_pump`).
static mut SCHEDULE_TIMER: CFRunLoopTimerRef = std::ptr::null_mut();
static mut DISPLAY_LINK: Option<Retained<CADisplayLink>> = None;
static mut DISPLAY_TARGET: Option<Retained<DisplayLinkTarget>> = None;
static mut LIFECYCLE_OBSERVERS: Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>> = Vec::new();

fn set_foreground(foreground: bool) {
    APP_FOREGROUND.store(foreground, Ordering::Relaxed);
    // SAFETY: display link is created and only used on the main thread.
    unsafe {
        if let Some(link) = DISPLAY_LINK.as_deref() {
            link.setPaused(!foreground);
        }
    }
    if foreground {
        wrymium_log!(
            "[wrymium] CEF pump: foreground (CADisplayLink, display refresh rate)"
        );
    } else {
        wrymium_log!("[wrymium] CEF pump: background throttle (~1 Hz keepalive)");
    }
}

fn pump_cef() {
    autoreleasepool(|_| {
        do_message_loop_work();
    });
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    struct DisplayLinkTarget;

    impl DisplayLinkTarget {
        #[unsafe(method(onDisplayLink:))]
        fn on_display_link(&self, _sender: &CADisplayLink) {
            if APP_FOREGROUND.load(Ordering::Relaxed) {
                pump_cef();
            }
        }
    }

    unsafe impl NSObjectProtocol for DisplayLinkTarget {}
);

extern "C" fn schedule_timer_callback(_timer: CFRunLoopTimerRef, _info: *mut std::ffi::c_void) {
    if !APP_FOREGROUND.load(Ordering::Relaxed) {
        pump_cef();
    }
}

fn install_lifecycle_observers() {
    let center = NSNotificationCenter::defaultCenter();
    let queue = NSOperationQueue::mainQueue();

    let active = block2::RcBlock::new(|_: NonNull<NSNotification>| set_foreground(true));
    let obs_active = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(&NSApplicationDidBecomeActiveNotification),
            None,
            Some(&queue),
            &active,
        )
    };

    let resign = block2::RcBlock::new(|_: NonNull<NSNotification>| set_foreground(false));
    let obs_resign = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(&NSApplicationDidResignActiveNotification),
            None,
            Some(&queue),
            &resign,
        )
    };

    let hide = block2::RcBlock::new(|_: NonNull<NSNotification>| set_foreground(false));
    let obs_hide = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(&NSApplicationDidHideNotification),
            None,
            Some(&queue),
            &hide,
        )
    };

    let unhide = block2::RcBlock::new(|_: NonNull<NSNotification>| {
        if let Some(mtm) = objc2::MainThreadMarker::new() {
            if NSApplication::sharedApplication(mtm).isActive() {
                set_foreground(true);
            }
        }
    });
    let obs_unhide = unsafe {
        center.addObserverForName_object_queue_usingBlock(
            Some(&NSApplicationDidUnhideNotification),
            None,
            Some(&queue),
            &unhide,
        )
    };

    // SAFETY: main thread only; observers live for process lifetime.
    unsafe {
        LIFECYCLE_OBSERVERS = vec![obs_active, obs_resign, obs_hide, obs_unhide];
    }
}

/// Called from any thread when CEF requests earlier message-loop work.
pub fn on_schedule_message_pump_work(delay_ms: i64) {
    // SAFETY: CFRunLoopTimerSetNextFireDate is thread-safe (Apple docs / wrymium spike).
    unsafe {
        if SCHEDULE_TIMER.is_null() {
            return;
        }
        let fire = if delay_ms <= 0 {
            CFAbsoluteTimeGetCurrent()
        } else {
            CFAbsoluteTimeGetCurrent() + (delay_ms as f64 / 1000.0)
        };
        CFRunLoopTimerSetNextFireDate(SCHEDULE_TIMER, fire);
    }
    if delay_ms <= 0 {
        dispatch2::DispatchQueue::main().exec_async(pump_cef);
    }
}

pub fn install_message_pump() {
    let mtm = objc2::MainThreadMarker::new().expect("CEF pump must install on main thread");

    let target: Retained<DisplayLinkTarget> = unsafe { msg_send![DisplayLinkTarget::class(), new] };
    let sel = objc2::sel!(onDisplayLink:);
    let display_link =
        unsafe { CADisplayLink::displayLinkWithTarget_selector(&*target, sel) };

    let run_loop = NSRunLoop::mainRunLoop();
    unsafe {
        display_link.addToRunLoop_forMode(&run_loop, NSDefaultRunLoopMode);
    }

    unsafe {
        let now = CFAbsoluteTimeGetCurrent();
        SCHEDULE_TIMER = CFRunLoopTimerCreate(
            std::ptr::null(),
            now + 1.0,
            1.0,
            0,
            0,
            schedule_timer_callback,
            std::ptr::null_mut(),
        );
        CFRunLoopAddTimer(CFRunLoopGetMain(), SCHEDULE_TIMER, kCFRunLoopCommonModes);
        DISPLAY_TARGET = Some(target);
        DISPLAY_LINK = Some(display_link);
    }

    install_lifecycle_observers();

    let initially_active = NSApplication::sharedApplication(mtm).isActive();
    set_foreground(initially_active);

    wrymium_log!("[wrymium] macOS CADisplayLink CEF pump installed (Cutline)");
}

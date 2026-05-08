use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

use crate::error::AgentResult;
use crate::state::AppState;

pub fn install(app: &App, state: Arc<AppState>) -> AgentResult<()> {
    let handle = app.handle();
    let start =
        MenuItem::with_id(handle, "start", "Start workday", true, None::<&str>).map_err(box_err)?;
    let end =
        MenuItem::with_id(handle, "end", "End workday", true, None::<&str>).map_err(box_err)?;
    let private = MenuItem::with_id(
        handle,
        "private",
        "Toggle private session",
        true,
        None::<&str>,
    )
    .map_err(box_err)?;
    let separator = PredefinedMenuItem::separator(handle).map_err(box_err)?;
    let show =
        MenuItem::with_id(handle, "show", "Open WorkTrack", true, None::<&str>).map_err(box_err)?;
    let quit = MenuItem::with_id(handle, "quit", "Quit", true, None::<&str>).map_err(box_err)?;

    let menu = Menu::with_items(handle, &[&start, &end, &private, &separator, &show, &quit])
        .map_err(box_err)?;

    let s_for_menu = state.clone();
    let _ = TrayIconBuilder::with_id("worktrack-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("WorkTrack — monitoring active during workday")
        .on_menu_event(move |handle, event| {
            let s = s_for_menu.clone();
            match event.id.as_ref() {
                "start" => {
                    s.start_workday();
                }
                "end" => {
                    s.end_workday();
                }
                "private" => {
                    s.toggle_private();
                }
                "show" => {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "quit" => {
                    handle.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(handle)
        .map_err(box_err)?;

    Ok(())
}

fn box_err(e: tauri::Error) -> crate::error::AgentError {
    crate::error::AgentError::Internal(e.to_string())
}

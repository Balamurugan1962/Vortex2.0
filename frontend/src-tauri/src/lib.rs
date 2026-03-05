use serde::{Deserialize, Serialize};
use tauri::command;

const FASTAPI_URL: &str = "http://localhost:8000";

#[derive(Serialize, Deserialize)]
struct ApiResponse {
    status: String,
    message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Violation {
    pub id: Option<i32>,
    pub timestamp: String,
    pub event_type: String,
    pub confidence: f64,
}

#[command]
async fn start_exam_monitoring() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/start_exam", FASTAPI_URL))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to monitoring service: {}", e))?;
    
    if response.status().is_success() {
        Ok("Monitoring started".to_string())
    } else {
        Err("Failed to start monitoring".to_string())
    }
}

#[command]
async fn stop_exam_monitoring() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/stop_exam", FASTAPI_URL))
        .send()
        .await
        .map_err(|e| format!("Failed to stop monitoring: {}", e))?;
    
    if response.status().is_success() {
        Ok("Monitoring stopped".to_string())
    } else {
        Err("Failed to stop monitoring".to_string())
    }
}

#[command]
async fn check_screen_mirroring() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::display::{CGGetActiveDisplayList, CGDisplayIsInMirrorSet};
        
        let max_displays = 32;
        let mut active_displays = vec![0; max_displays];
        let mut display_count = 0;

        let result = unsafe {
            CGGetActiveDisplayList(
                max_displays as u32,
                active_displays.as_mut_ptr(),
                &mut display_count,
            )
        };

        if result == 0 { // kCGErrorSuccess
            for i in 0..display_count {
                let display_id = active_displays[i as usize];
                let is_mirrored = unsafe { CGDisplayIsInMirrorSet(display_id) };
                if is_mirrored != 0 {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

#[command]
async fn get_violations(limit: Option<i32>) -> Result<Vec<Violation>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/logs?limit={}", FASTAPI_URL, limit.unwrap_or(50));
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch violations: {}", e))?;
    
    if response.status().is_success() {
        let violations = response
            .json::<Vec<Violation>>()
            .await
            .map_err(|e| format!("Failed to parse violations: {}", e))?;
        Ok(violations)
    } else {
        Err("Failed to get violations".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_screenshots::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
        start_exam_monitoring,
        stop_exam_monitoring,
        get_violations,
        check_screen_mirroring
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

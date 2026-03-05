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

use tauri_plugin_shell::ShellExt;
use sysinfo::{System, Pid};

#[derive(serde::Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory_usage: u64,
}

#[tauri::command]
async fn get_running_apps() -> Result<Vec<ProcessInfo>, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let processes = sys.processes().values()
        .filter(|p| {
            let name = p.name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();
            let exe_path = p.exe().and_then(|path| path.to_str()).unwrap_or("").to_lowercase();
            
            // 1. MUST NOT be a system daemon (usually ends in 'd')
            if name.ends_with('d') { return false; }
            
            // 2. MUST NOT be a background component
            let is_background = name_lower.contains("helper") || 
                                name_lower.contains("extension") ||
                                name_lower.contains("agent") ||
                                name_lower.contains("service") ||
                                name_lower.contains("vortex");
            if is_background { return false; }

            // 3. MUST be a proper GUI Application bundle on macOS
            let is_gui_app = exe_path.contains(".app/contents/macos/");
            if !is_gui_app { return false; }

            // 4. Finally, check against our prohibited categories
            let is_browser = name_lower.contains("chrome") || name_lower.contains("safari") || 
                             name_lower.contains("firefox") || name_lower.contains("edge") ||
                             name_lower.contains("arc") || name_lower.contains("opera") ||
                             name_lower.contains("brave") || name_lower.contains("helium");
            
            let is_communication = name_lower.contains("whatsapp") || name_lower.contains("telegram") || 
                                   name_lower.contains("discord") || name_lower.contains("slack") || 
                                   name_lower.contains("skype") || name_lower.contains("messenger") ||
                                   name_lower.contains("antigravity") || name_lower.contains("zed");

            let is_ai_tool = name_lower.contains("claude") || name_lower.contains("chatgpt") || 
                             name_lower.contains("cursor") || name_lower.contains("copilot");

            let is_remote = name_lower.contains("teamviewer") || name_lower.contains("anydesk");

            is_browser || is_communication || is_ai_tool || is_remote
        })
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().into_owned(),
            cpu_usage: p.cpu_usage(),
            memory_usage: p.memory(),
        })
        .collect();
        
    Ok(processes)
}

#[tauri::command]
async fn kill_process(pid: u32) -> Result<(), String> {
    let mut sys = System::new_all();
    sys.refresh_all(); // Refresh to find the process
    if let Some(process) = sys.process(Pid::from(pid as usize)) {
        process.kill();
        Ok(())
    } else {
        Err("Process not found".to_string())
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
        check_screen_mirroring,
        get_running_apps,
        kill_process
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

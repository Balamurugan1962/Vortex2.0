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
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
        start_exam_monitoring,
        stop_exam_monitoring,
        get_violations
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

#[tauri::command]
fn write_file_direct(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_direct(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
fn register_file_association() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::env;
        
        let exe_path = env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_str().unwrap_or("");
        
        // Register .fin extension
        let _ = Command::new("cmd")
            .args(["/C", "reg", "add", "HKCU\\Software\\Classes\\.fin", "/ve", "/d", "OneFileFinance", "/f"])
            .output();
            
        // Register OneFileFinance progid
        let _ = Command::new("cmd")
            .args(["/C", "reg", "add", "HKCU\\Software\\Classes\\OneFileFinance", "/ve", "/d", "OneFileFinance Database", "/f"])
            .output();
            
        // DefaultIcon
        let icon_path = format!("{},0", exe_path_str);
        let _ = Command::new("cmd")
            .args(["/C", "reg", "add", "HKCU\\Software\\Classes\\OneFileFinance\\DefaultIcon", "/ve", "/d", &icon_path, "/f"])
            .output();
            
        // Command
        let cmd = format!("\"{}\" \"%1\"", exe_path_str);
        let _ = Command::new("cmd")
            .args(["/C", "reg", "add", "HKCU\\Software\\Classes\\OneFileFinance\\shell\\open\\command", "/ve", "/d", &cmd, "/f"])
            .output();
            
        Ok("File association registered".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Ok("File association registration is only supported on Windows for now.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![write_file_direct, read_file_direct, get_cli_args, register_file_association])
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

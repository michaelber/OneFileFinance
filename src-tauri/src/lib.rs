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
        use std::env;
        use std::process::Command;

        let exe_path = env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = exe_path.to_str().unwrap_or("");

        let _ = Command::new("cmd").args(["/C", "reg", "add", r#"HKCU\Software\Classes\.fin"#, "/ve", "/d", "OneFileFinance", "/f"]).output();
        let _ = Command::new("cmd").args(["/C", "reg", "add", r#"HKCU\Software\Classes\OneFileFinance"#, "/ve", "/d", "OneFileFinance Database", "/f"]).output();
        let icon_path = format!("{},0", exe_path_str);
        let _ = Command::new("cmd").args(["/C", "reg", "add", r#"HKCU\Software\Classes\OneFileFinance\DefaultIcon"#, "/ve", "/d", &icon_path, "/f"]).output();
        let cmd = format!("\"{}\" \"%1\"", exe_path_str);
        let _ = Command::new("cmd").args(["/C", "reg", "add", r#"HKCU\Software\Classes\OneFileFinance\shell\open\command"#, "/ve", "/d", &cmd, "/f"]).output();

        Ok("File association registered".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("File association registration is only supported on Windows for now.".to_string())
    }
}

#[tauri::command]
async fn open_auth_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use tauri::{Emitter, Manager};

    let app_clone = app.clone();
    let _window = WebviewWindowBuilder::new(&app, "bank-auth", WebviewUrl::External(url.parse().unwrap()))
        .title("Connect to Bank")
        .inner_size(600.0, 800.0)
        .center()
        .on_navigation(move |url| {
            let url_str = url.as_str();
            if url_str.starts_with("https://tauri.localhost/") || 
               url_str.starts_with("http://tauri.localhost/") || 
               url_str.starts_with("http://localhost:") {
                let _ = app_clone.emit("enablebanking-redirect", url_str);
                let _ = app_clone.get_webview_window("bank-auth").map(|w| w.close());
                return false; // prevent navigation
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            write_file_direct,
            read_file_direct,
            get_cli_args,
            register_file_association,
            open_auth_window
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

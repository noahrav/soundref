use std::fs;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
fn pick_folder() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder()?;
    Some(folder.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn get_projects_registry_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let file = path.join("projects.json");
    Ok(file.to_string_lossy().into_owned())
}

#[tauri::command]
fn pick_audio_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Audio Files", &["mp3", "wav", "flac", "ogg", "m4a", "aac"])
        .pick_file()?;
    Some(file.to_string_lossy().into_owned())
}

#[tauri::command]
fn pick_image_file() -> Option<String> {
    let file = rfd::FileDialog::new()
        .add_filter("Image Files", &["png", "jpg", "jpeg", "webp", "gif", "svg"])
        .pick_file()?;
    Some(file.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    let target_dir = if path_obj.is_file() {
        path_obj.parent().unwrap_or(path_obj)
    } else {
        path_obj
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(target_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(target_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(target_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn copy_file(from: String, to: String) -> Result<(), String> {
    let path_obj = Path::new(&to);
    if let Some(parent) = path_obj.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            pick_audio_file,
            pick_image_file,
            read_text_file,
            read_file_binary,
            write_text_file,
            create_dir,
            file_exists,
            get_projects_registry_path,
            open_folder,
            copy_file,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

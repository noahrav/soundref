use std::fs::{self, File};
use std::path::Path;
use tauri::Manager;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn validate_path(path_str: &str) -> Result<std::path::PathBuf, String> {
    if path_str.contains('\0') {
        return Err("Invalid path: contains null byte".to_string());
    }

    let path = Path::new(path_str);

    let path_buf = if path.exists() {
        path.canonicalize().map_err(|e| e.to_string())?
    } else {
        let parent = path.parent().ok_or("Invalid path: no parent directory")?;
        let parent_canon = if parent.exists() {
            parent.canonicalize().map_err(|e| e.to_string())?
        } else {
            parent.to_path_buf()
        };
        let file_name = path.file_name().ok_or("Invalid path: missing file name")?;
        parent_canon.join(file_name)
    };

    let is_temp = path_buf.starts_with(std::env::temp_dir());
    let is_home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(|h| path_buf.starts_with(Path::new(&h)))
        .unwrap_or(false);

    if !is_home && !is_temp {
        return Err(format!("Access denied: path '{}' is outside allowed directories", path_buf.display()));
    }

    Ok(path_buf)
}

#[tauri::command]
fn pick_folder() -> Option<String> {
    let folder = rfd::FileDialog::new().pick_folder()?;
    Some(folder.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let safe_path = validate_path(&path)?;
    fs::read_to_string(&safe_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let safe_path = validate_path(&path)?;
    if let Some(parent) = safe_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp_path = safe_path.with_extension("tmp");
    fs::write(&tmp_path, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, &safe_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    let safe_path = validate_path(&path)?;
    fs::create_dir_all(&safe_path).map_err(|e| e.to_string())
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
    let safe_path = validate_path(&path)?;
    let bytes = fs::read(&safe_path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let safe_path = validate_path(&path)?;
    let target_dir = if safe_path.is_file() {
        safe_path.parent().unwrap_or(&safe_path)
    } else {
        &safe_path
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
    let safe_from = validate_path(&from)?;
    let safe_to = validate_path(&to)?;
    if let Some(parent) = safe_to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&safe_from, &safe_to).map_err(|e| e.to_string())?;
    Ok(())
}

fn create_zip_archive_impl(src_dir: &str, dest_zip_path: &Path) -> Result<(), String> {
    let src_path = Path::new(src_dir);
    if !src_path.exists() || !src_path.is_dir() {
        return Err("Source directory does not exist or is not a directory".to_string());
    }

    let zip_file = File::create(dest_zip_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let dest_canonical = dest_zip_path.canonicalize().ok();

    for entry in WalkDir::new(src_path) {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        if let Some(ref dest_canon) = dest_canonical {
            if let Ok(entry_canon) = entry_path.canonicalize() {
                if entry_canon == *dest_canon {
                    continue;
                }
            }
        }

        let name = entry_path
            .strip_prefix(src_path)
            .map_err(|e| e.to_string())?;

        if name.as_os_str().is_empty() {
            continue;
        }

        let path_str = name.to_string_lossy().replace('\\', "/");

        if entry_path.is_dir() {
            zip.add_directory(path_str, options)
                .map_err(|e| e.to_string())?;
        } else if entry_path.is_file() {
            zip.start_file(path_str, options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(entry_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn export_project_zip(project_path: String, default_name: String) -> Result<Option<String>, String> {
    let default_filename = if default_name.to_lowercase().ends_with(".zip") {
        default_name
    } else {
        format!("{}.zip", default_name)
    };

    let destination = match rfd::FileDialog::new()
        .set_file_name(&default_filename)
        .add_filter("ZIP Archive", &["zip"])
        .save_file()
    {
        Some(path) => path,
        None => return Ok(None),
    };

    create_zip_archive_impl(&project_path, &destination)?;

    Ok(Some(destination.to_string_lossy().into_owned()))
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
            export_project_zip,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use zip::ZipArchive;

    #[test]
    fn test_write_and_read_text_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("sub/dir/test.txt");
        let path_str = file_path.to_string_lossy().to_string();

        let write_res = write_text_file(path_str.clone(), "Hello SoundRef".to_string());
        assert!(write_res.is_ok());

        assert!(file_exists(path_str.clone()));

        let read_res = read_text_file(path_str);
        assert_eq!(read_res.unwrap(), "Hello SoundRef");
    }

    #[test]
    fn test_copy_file() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src.txt");
        let dst = dir.path().join("nested/dst.txt");

        fs::write(&src, "Content to copy").unwrap();
        let copy_res = copy_file(
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        );
        assert!(copy_res.is_ok());

        assert!(dst.exists());
        let content = fs::read_to_string(dst).unwrap();
        assert_eq!(content, "Content to copy");
    }

    #[test]
    fn test_create_zip_archive_impl() {
        let src_dir = tempdir().unwrap();
        let project_folder = src_dir.path();

        let file1 = project_folder.join("soundref.json");
        fs::write(&file1, r#"{"name": "Test"}"#).unwrap();

        let assets_dir = project_folder.join("assets");
        fs::create_dir_all(&assets_dir).unwrap();
        let file2 = assets_dir.join("track.mp3");
        fs::write(&file2, vec![0u8, 1u8, 2u8, 3u8]).unwrap();

        let zip_dir = tempdir().unwrap();
        let zip_path = zip_dir.path().join("export.zip");

        let res = create_zip_archive_impl(project_folder.to_str().unwrap(), &zip_path);
        assert!(res.is_ok());
        assert!(zip_path.exists());

        let zip_file = File::open(&zip_path).unwrap();
        let mut archive = ZipArchive::new(zip_file).unwrap();

        assert!(archive.len() >= 2);
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();

        assert!(names.contains(&"soundref.json".to_string()));
        assert!(names.iter().any(|n| n.contains("track.mp3")));
    }

    #[test]
    fn test_create_zip_archive_non_existent_source() {
        let zip_dir = tempdir().unwrap();
        let zip_path = zip_dir.path().join("export.zip");

        let res = create_zip_archive_impl("/path/that/does/not/exist/12345", &zip_path);
        assert!(res.is_err());
        assert_eq!(
            res.unwrap_err(),
            "Source directory does not exist or is not a directory"
        );
    }
}

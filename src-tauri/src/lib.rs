use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
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
    Ok(path.to_path_buf())
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
fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
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
fn read_file_size(path: String) -> Result<u64, String> {
    let safe_path = validate_path(&path)?;
    let metadata = fs::metadata(&safe_path).map_err(|e| e.to_string())?;
    Ok(metadata.len())
}

#[tauri::command]
fn read_file_binary_chunk(path: String, offset: u64, length: u32) -> Result<tauri::ipc::Response, String> {
    use std::io::{Read, Seek, SeekFrom};
    let safe_path = validate_path(&path)?;
    let mut file = File::open(&safe_path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buffer = vec![0u8; length as usize];
    let bytes_read = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(bytes_read);
    Ok(tauri::ipc::Response::new(buffer))
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

use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU16, Ordering};

static MEDIA_SERVER_PORT: AtomicU16 = AtomicU16::new(0);

fn get_mime_from_extension(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_lowercase().as_str() {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "m4a" | "aac" => "audio/aac",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn percent_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&bytes[i+1..i+3]).unwrap_or(""), 16) {
                result.push(val);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).into_owned()
}

fn handle_media_client(mut stream: TcpStream) {
    use std::io::Write;
    let mut buffer = [0u8; 4096];
    let n = match stream.read(&mut buffer) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let req_str = String::from_utf8_lossy(&buffer[..n]);
    let mut lines = req_str.lines();
    let req_line = match lines.next() {
        Some(l) => l,
        None => return,
    };

    let parts: Vec<&str> = req_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }

    let method = parts[0];
    let uri = parts[1];

    if method == "OPTIONS" {
        let _ = stream.write_all(
            b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Content-Type, Accept, Origin\r\n\r\n"
        );
        return;
    }

    let is_head = method == "HEAD";

    let mut range_header = None;

    for line in lines {
        if line.is_empty() {
            break;
        }
        if line.to_lowercase().starts_with("range:") {
            range_header = Some(line.trim()["range:".len()..].trim().to_string());
        }
    }

    let query_prefix = "/stream?path=";
    let file_path_raw = if uri.starts_with(query_prefix) {
        &uri[query_prefix.len()..]
    } else {
        return;
    };

    let path_part = file_path_raw.split('&').next().unwrap_or(file_path_raw);
    let decoded_path = percent_decode(path_part);
    let safe_path = match validate_path(&decoded_path) {
        Ok(p) => p,
        Err(_) => {
            let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\n");
            return;
        }
    };

    let mut file = match File::open(&safe_path) {
        Ok(f) => f,
        Err(_) => {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n");
            return;
        }
    };

    let total_size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return,
    };

    let mime = get_mime_from_extension(&safe_path);

    if let Some(range_str) = range_header {
        let range_val = range_str.trim().strip_prefix("bytes=").unwrap_or(&range_str);
        let range_parts: Vec<&str> = range_val.split('-').collect();
        let start: u64 = range_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
        let end: u64 = if range_parts.len() > 1 && !range_parts[1].is_empty() {
            range_parts[1].parse().unwrap_or(total_size - 1)
        } else {
            total_size - 1
        };

        let end = end.min(total_size.saturating_sub(1));
        if start > end || start >= total_size {
            let resp = format!(
                "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                total_size
            );
            let _ = stream.write_all(resp.as_bytes());
            return;
        }

        let content_length = end - start + 1;
        let header = format!(
            "HTTP/1.1 206 Partial Content\r\nContent-Type: {}\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Content-Type, Accept, Origin\r\nConnection: keep-alive\r\n\r\n",
            mime, start, end, total_size, content_length
        );

        if stream.write_all(header.as_bytes()).is_err() {
            return;
        }

        if is_head {
            return;
        }

        if file.seek(SeekFrom::Start(start)).is_err() {
            return;
        }

        let mut remaining = content_length;
        let mut chunk_buf = [0u8; 65536];
        while remaining > 0 {
            let to_read = (remaining as usize).min(chunk_buf.len());
            match file.read(&mut chunk_buf[..to_read]) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    if stream.write_all(&chunk_buf[..bytes_read]).is_err() {
                        break;
                    }
                    remaining -= bytes_read as u64;
                }
                Err(_) => break,
            }
        }
    } else {
        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Content-Type, Accept, Origin\r\nConnection: keep-alive\r\n\r\n",
            mime, total_size
        );

        if stream.write_all(header.as_bytes()).is_err() {
            return;
        }

        if is_head {
            return;
        }

        let mut chunk_buf = [0u8; 65536];
        loop {
            match file.read(&mut chunk_buf) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    if stream.write_all(&chunk_buf[..bytes_read]).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }
}

pub fn start_media_server() -> u16 {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[MediaServer] Failed to bind: {}", e);
            return 0;
        }
    };

    let port = match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(_) => return 0,
    };

    MEDIA_SERVER_PORT.store(port, Ordering::SeqCst);

    std::thread::spawn(move || {
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    std::thread::spawn(move || {
                        handle_media_client(stream);
                    });
                }
                Err(_) => {}
            }
        }
    });

    port
}

#[tauri::command]
fn get_media_server_port() -> u16 {
    let port = MEDIA_SERVER_PORT.load(Ordering::SeqCst);
    if port == 0 {
        start_media_server()
    } else {
        port
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    start_media_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            pick_audio_file,
            pick_image_file,
            read_text_file,
            read_file_binary,
            read_file_size,
            read_file_binary_chunk,
            get_media_server_port,
            write_text_file,
            create_dir,
            file_exists,
            get_home_dir,
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
    use std::io::Write;
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

    #[test]
    fn test_media_streaming_server() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_song.mp3");
        fs::write(&file_path, b"FAKE_AUDIO_SAMPLE_DATA_1234567890").unwrap();

        let port = start_media_server();
        assert!(port > 0);

        let mut client = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
        let req = format!(
            "GET /stream?path={} HTTP/1.1\r\nRange: bytes=5-15\r\n\r\n",
            file_path.to_string_lossy()
        );
        client.write_all(req.as_bytes()).unwrap();

        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();

        let response_str = String::from_utf8_lossy(&response);
        assert!(response_str.starts_with("HTTP/1.1 206 Partial Content"));
        assert!(response_str.contains("Content-Range: bytes 5-15/33"));
        assert!(response_str.contains("AUDIO_SAMPL"));
    }

    #[test]
    fn test_media_streaming_server_head_request() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("song.wav");
        fs::write(&file_path, b"RIFF____WAVEfmt 1234567890data____PCM").unwrap();

        let port = start_media_server();
        let mut client = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
        let req = format!(
            "HEAD /stream?path={} HTTP/1.1\r\n\r\n",
            file_path.to_string_lossy()
        );
        client.write_all(req.as_bytes()).unwrap();

        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();

        let response_str = String::from_utf8_lossy(&response);
        assert!(response_str.starts_with("HTTP/1.1 200 OK"));
        assert!(response_str.contains("Content-Type: audio/wav"));
        assert!(response_str.contains("Accept-Ranges: bytes"));
        assert!(response_str.contains("Access-Control-Allow-Origin: *"));
        assert!(response_str.ends_with("\r\n\r\n"));
    }

    #[test]
    fn test_media_streaming_server_options_request() {
        let port = start_media_server();
        let mut client = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
        let req = "OPTIONS /stream?path=test.mp3 HTTP/1.1\r\n\r\n";
        client.write_all(req.as_bytes()).unwrap();

        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();

        let response_str = String::from_utf8_lossy(&response);
        assert!(response_str.starts_with("HTTP/1.1 204 No Content"));
        assert!(response_str.contains("Access-Control-Allow-Methods: GET, HEAD, OPTIONS"));
        assert!(response_str.contains("Access-Control-Allow-Headers: Range, Content-Type, Accept, Origin"));
    }

    #[test]
    fn test_media_streaming_server_range_out_of_bounds() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("short.mp3");
        fs::write(&file_path, b"12345").unwrap();

        let port = start_media_server();
        let mut client = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
        let req = format!(
            "GET /stream?path={} HTTP/1.1\r\nRange: bytes=50-100\r\n\r\n",
            file_path.to_string_lossy()
        );
        client.write_all(req.as_bytes()).unwrap();

        let mut response = Vec::new();
        client.read_to_end(&mut response).unwrap();

        let response_str = String::from_utf8_lossy(&response);
        assert!(response_str.starts_with("HTTP/1.1 416 Range Not Satisfiable"));
        assert!(response_str.contains("Content-Range: bytes */5"));
    }

    #[test]
    fn test_percent_decode_and_mime_types() {
        assert_eq!(percent_decode("My%20Track%20%231.mp3"), "My Track #1.mp3");
        assert_eq!(percent_decode("%2Fhome%2Fuser%2Fsong.wav"), "/home/user/song.wav");

        assert_eq!(get_mime_from_extension(Path::new("song.mp3")), "audio/mpeg");
        assert_eq!(get_mime_from_extension(Path::new("song.wav")), "audio/wav");
        assert_eq!(get_mime_from_extension(Path::new("song.flac")), "audio/flac");
        assert_eq!(get_mime_from_extension(Path::new("song.ogg")), "audio/ogg");
        assert_eq!(get_mime_from_extension(Path::new("song.m4a")), "audio/aac");
        assert_eq!(get_mime_from_extension(Path::new("cover.png")), "image/png");
        assert_eq!(get_mime_from_extension(Path::new("cover.webp")), "image/webp");
    }
}

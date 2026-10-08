use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

fn is_portable_directory(root: &Path) -> bool {
    root.join("portable.flag").is_file()
        || fs::read_to_string(root.join("README.txt"))
            .is_ok_and(|text| text.starts_with("RapidRAW portable"))
}

/// A marker is required so an installed build never writes beside its executable.
pub fn portable_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let root = std::env::current_exe().ok()?.parent()?.to_path_buf();
        if is_portable_directory(&root) {
            return Some(root);
        }
    }
    None
}

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match portable_root() {
        Some(root) => root.join("data"),
        None => app.path().app_data_dir().map_err(|e| e.to_string())?,
    };
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app data directory {}: {e}", dir.display()))?;
    Ok(dir)
}

pub fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match portable_root() {
        Some(root) => root.join("data").join("config"),
        None => app.path().app_config_dir().map_err(|e| e.to_string())?,
    };
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app config directory {}: {e}", dir.display()))?;
    Ok(dir)
}

fn copy_missing_tree(source: &Path, destination: &Path) -> Result<(), String> {
    if source.is_file() {
        if !destination.exists() {
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(source, destination)
                .map_err(|e| format!("Cannot copy {}: {e}", source.display()))?;
        }
    } else if source.is_dir() {
        fs::create_dir_all(destination).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            if file_type.is_file() || file_type.is_dir() {
                copy_missing_tree(&entry.path(), &destination.join(entry.file_name()))?;
            }
        }
    }
    Ok(())
}

/// One-time, non-destructive migration for older portable copies that stored
/// persistent data in the system app-data directory. Fresh ZIPs start clean.
pub fn migrate_legacy_portable_data(app: &AppHandle) -> Result<(), String> {
    let Some(root) = portable_root() else {
        return Ok(());
    };
    let destination = app_data_dir(app)?;
    let migration_marker = destination.join(".legacy-data-checked");
    if migration_marker.exists() {
        return Ok(());
    }

    if root.join("rapidraw.db").exists() || !root.join("portable.flag").exists() {
        let source = app.path().app_data_dir().map_err(|e| e.to_string())?;
        for name in ["settings.json", "albums", "luts", "models", "library"] {
            copy_missing_tree(&source.join(name), &destination.join(name))?;
        }
        let legacy_config = app.path().app_config_dir().map_err(|e| e.to_string())?;
        copy_missing_tree(
            &legacy_config.join("window_state.json"),
            &destination.join("config").join("window_state.json"),
        )?;
    }

    fs::write(&migration_marker, b"").map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_detection_requires_marker_or_legacy_readme() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!is_portable_directory(dir.path()));
        fs::write(dir.path().join("portable.flag"), b"").unwrap();
        assert!(is_portable_directory(dir.path()));
        fs::remove_file(dir.path().join("portable.flag")).unwrap();
        fs::write(dir.path().join("README.txt"), "RapidRAW portable\n").unwrap();
        assert!(is_portable_directory(dir.path()));
    }

    #[test]
    fn migration_copy_never_overwrites_existing_data() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir_all(source.join("albums")).unwrap();
        fs::create_dir_all(destination.join("albums")).unwrap();
        fs::write(source.join("albums/albums.json"), "old").unwrap();
        fs::write(source.join("settings.json"), "settings").unwrap();
        fs::write(destination.join("albums/albums.json"), "new").unwrap();
        copy_missing_tree(&source, &destination).unwrap();
        assert_eq!(
            fs::read_to_string(destination.join("albums/albums.json")).unwrap(),
            "new"
        );
        assert_eq!(
            fs::read_to_string(destination.join("settings.json")).unwrap(),
            "settings"
        );
    }
}

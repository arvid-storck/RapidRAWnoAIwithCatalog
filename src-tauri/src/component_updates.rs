use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::AppHandle;

const LENSFUN_CONTENTS_API: &str = "https://api.github.com/repos/lensfun/lensfun/contents/data/db";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentUpdateResult {
    component: String,
    version: String,
    restart_required: bool,
}

fn component_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = match crate::portable_paths::portable_root() {
        Some(portable) => portable.join("components"),
        None => crate::portable_paths::app_data_dir(app)?.join("components"),
    };
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

pub fn initialize_component_environment(app: &AppHandle) {
    if let Ok(root) = component_root(app) {
        unsafe {
            std::env::set_var("RAPIDRAW_COMPONENT_DIR", root);
        }
    }
}

#[derive(serde::Deserialize)]
struct GithubFile {
    name: String,
    download_url: Option<String>,
    sha: String,
}

#[tauri::command]
pub async fn update_lensfun(app_handle: AppHandle) -> Result<ComponentUpdateResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("RapidRAW-Lensfun-Updater")
        .build()
        .map_err(|e| e.to_string())?;
    let files: Vec<GithubFile> = client
        .get(LENSFUN_CONTENTS_API)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let root = component_root(&app_handle)?.join("lensfun");
    let staging = root.join("staging");
    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let mut version = String::new();
    for file in files.into_iter().filter(|f| {
        f.name.ends_with(".xml")
            || f.name.ends_with(".dtd")
            || f.name.ends_with(".xsd")
            || f.name == "timestamp.txt"
    }) {
        let Some(url) = file.download_url else {
            continue;
        };
        let bytes = client
            .get(url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        fs::write(staging.join(&file.name), bytes).map_err(|e| e.to_string())?;
        version = file.sha;
    }
    if !staging.join("lensfun-database.dtd").exists() {
        return Err("Lensfun-hämtningen innehöll ingen giltig databas.".into());
    }
    let current = root.join("current");
    let previous = root.join("previous");
    if previous.exists() {
        fs::remove_dir_all(&previous).map_err(|e| e.to_string())?;
    }
    if current.exists() {
        fs::rename(&current, &previous).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, &current).map_err(|e| e.to_string())?;
    fs::write(root.join("version.txt"), &version).map_err(|e| e.to_string())?;
    Ok(ComponentUpdateResult {
        component: "lensfun".into(),
        version,
        restart_required: true,
    })
}

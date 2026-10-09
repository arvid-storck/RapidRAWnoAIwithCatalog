use crate::file_management::{self, parse_virtual_path};
use rayon::prelude::*;
use std::fs;
use tauri::AppHandle;
pub const COLOR_TAG_PREFIX: &str = "color:";

#[tauri::command]
pub fn set_flag_for_paths(
    paths: Vec<String>,
    flag: Option<String>,
    app_handle: AppHandle,
) -> Result<(), String> {
    if flag
        .as_deref()
        .is_some_and(|value| value != "pick" && value != "reject")
    {
        return Err("Invalid image flag".into());
    }
    paths.par_iter().try_for_each(|path| {
        modify_tags_for_path(path, &app_handle, |tags| {
            tags.retain(|tag| !tag.starts_with("flag:"));
            if let Some(flag) = &flag {
                tags.push(format!("flag:{}", flag));
            }
        })
    })
}
fn modify_tags_for_path(
    path_str: &str,
    app_handle: &AppHandle,
    modify_fn: impl Fn(&mut Vec<String>),
) -> Result<(), String> {
    let (source_path, sidecar_path) = parse_virtual_path(path_str);

    let mut metadata = crate::exif_processing::load_sidecar(&sidecar_path);

    let mut tags = metadata.tags.unwrap_or_default();
    modify_fn(&mut tags);

    tags.sort_unstable();
    tags.dedup();

    if tags.is_empty() {
        metadata.tags = None;
    } else {
        metadata.tags = Some(tags);
    }

    let json_string = serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?;
    fs::write(&sidecar_path, json_string).map_err(|e| e.to_string())?;

    if let Ok(settings) = crate::load_settings(app_handle.clone())
        && settings.enable_xmp_sync.unwrap_or(false)
    {
        let create_if_missing = settings.create_xmp_if_missing.unwrap_or(false);
        file_management::sync_metadata_to_xmp(&source_path, &metadata, create_if_missing);
    }

    Ok(())
}

#[tauri::command]
pub fn add_tag_for_paths(
    paths: Vec<String>,
    tag: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    paths.par_iter().for_each(|path| {
        let tag_clone = tag.clone();
        if let Err(e) = modify_tags_for_path(path, &app_handle, |tags| {
            if !tags.contains(&tag_clone) {
                tags.push(tag_clone.clone());
            }
        }) {
            log::error!("Failed to add tag to {}: {}", path, e);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn remove_tag_for_paths(
    paths: Vec<String>,
    tag: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    paths.par_iter().for_each(|path| {
        let tag_clone = tag.clone();
        if let Err(e) = modify_tags_for_path(path, &app_handle, |tags| {
            tags.retain(|t| t != &tag_clone);
        }) {
            log::error!("Failed to remove tag from {}: {}", path, e);
        }
    });
    Ok(())
}

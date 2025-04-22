use ic_cdk_macros::*;
use candid::{CandidType, Deserialize};
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
struct Video {
    id: String,
    title: String,
    description: String,
    chunks: Vec<Vec<u8>>,
    hash: String,
}

#[derive(CandidType, Deserialize)]
enum UploadResult {
    #[serde(rename = "ok")]
    Ok(()),
    #[serde(rename = "err")]
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum VideoChunkResult {
    #[serde(rename = "ok")]
    Ok(Vec<u8>),
    #[serde(rename = "err")]
    Err(String),
}

#[derive(CandidType, Deserialize)]
struct VideoInfo {
    title: String,
    description: String,
    hash: String,
}

#[derive(CandidType, Deserialize)]
enum VideoInfoResult {
    #[serde(rename = "ok")]
    Ok(String),
    #[serde(rename = "err")]
    Err(String),
}

thread_local! {
    static VIDEOS: RefCell<HashMap<String, Video>> = RefCell::new(HashMap::new());
}

//dfx canister call streamingservice_backend greet everyone
#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

use env_logger;
use log::{error, warn, info, debug};
use std::env;

#[update]
fn upload_video_chunk(video_id: String, chunk: Vec<u8>, chunk_index: u32) -> UploadResult {
    VIDEOS.with(|videos| {
        ic_cdk::println!("Starting upload_video_chunk for video_id: {}", video_id);
        let mut videos = videos.borrow_mut();
        
        // 存在しないvideo_idの場合は新しいビデオエントリを作成
        if !videos.contains_key(&video_id) {
            ic_cdk::println!("Creating new video entry for video_id: {}", video_id);
            videos.insert(video_id.clone(), Video {
                id: video_id.clone(),
                title: "".to_string(),
                description: "".to_string(),
                chunks: Vec::new(),
                hash: "".to_string()
            });
        }
        
        // 以降は既存のビデオ処理
        match videos.get_mut(&video_id) {
            Some(video) => {
                ic_cdk::println!("Processing chunk {} for video_id: {}", chunk_index, video_id);
                while video.chunks.len() <= chunk_index as usize {
                    video.chunks.push(Vec::new());
                }
                video.chunks[chunk_index as usize] = chunk;
                ic_cdk::println!("Successfully processed chunk {} for video_id: {}", chunk_index, video_id);
                UploadResult::Ok(())
            },
            None => {
                ic_cdk::println!("Error: Failed to create video entry for video_id: {}", video_id);
                UploadResult::Err("Failed to create video entry".to_string())
            }
        }
    })
}

#[query]
fn get_video_chunk(video_id: String, chunk_index: u32) -> VideoChunkResult {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            if let Some(chunk) = video.chunks.get(chunk_index as usize) {
                VideoChunkResult::Ok(chunk.clone())
            } else {
                VideoChunkResult::Err("Chunk not found".to_string())
            }
        } else {
            VideoChunkResult::Err("Video not found".to_string())
        }
    })
}

#[update]
fn create_video(title: String, description: String) -> String {
    let video_id = ic_cdk::api::time().to_string();
    let hash = "";
    let video = Video {
        id: video_id.clone(),
        title,
        description,
        chunks: Vec::new(),
        hash: hash.to_string()
    };
    
    VIDEOS.with(|videos| {
        videos.borrow_mut().insert(video_id.clone(), video);
    });
    
    video_id
}

#[query]
fn get_video_info(video_id: String) -> VideoInfoResult {
    ic_cdk::println!("Starting get_video_info for video_id: {}", video_id);
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        videos.iter()
            .map(|(id, video)| (
                ic_cdk::println!("{}", format!("title: {}, description: {}", video.title.clone(), video.description.clone())
            )));
        if let Some(video) = videos.get(&video_id) {
            ic_cdk::println!("video.title: {}", video.title);
            VideoInfoResult::Ok(video.title.clone())
        } else {
            VideoInfoResult::Err("Video not found".to_string())
        }
    })
}

#[query]
fn get_video_list() -> Vec<(String, String, String, String)> {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        videos.iter()
            .map(|(id, video)| (
                id.clone(),
                video.title.clone(),
                video.description.clone(),
                video.hash.clone()
            ))
            .collect()
    })
} 
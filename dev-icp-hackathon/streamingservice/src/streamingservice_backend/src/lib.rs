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
}

thread_local! {
    static VIDEOS: RefCell<HashMap<String, Video>> = RefCell::new(HashMap::new());
}

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[update]
fn upload_video_chunk(video_id: String, chunk: Vec<u8>, chunk_index: u32) -> Result<(), String> {
    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if let Some(video) = videos.get_mut(&video_id) {
            while video.chunks.len() <= chunk_index as usize {
                video.chunks.push(Vec::new());
            }
            video.chunks[chunk_index as usize] = chunk;
            Ok(())
        } else {
            Err("Video not found".to_string())
        }
    })
}

#[query]
fn get_video_chunk(video_id: String, chunk_index: u32) -> Result<Vec<u8>, String> {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            if let Some(chunk) = video.chunks.get(chunk_index as usize) {
                Ok(chunk.clone())
            } else {
                Err("Chunk not found".to_string())
            }
        } else {
            Err("Video not found".to_string())
        }
    })
}

#[update]
fn create_video(title: String, description: String) -> String {
    let video_id = ic_cdk::api::time().to_string();
    let video = Video {
        id: video_id.clone(),
        title,
        description,
        chunks: Vec::new(),
    };
    
    VIDEOS.with(|videos| {
        videos.borrow_mut().insert(video_id.clone(), video);
    });
    
    video_id
}

#[query]
fn get_video_info(video_id: String) -> Result<(String, String), String> {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            Ok((video.title.clone(), video.description.clone()))
        } else {
            Err("Video not found".to_string())
        }
    })
}

#[query]
fn get_video_list() -> Vec<(String, String, String)> {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        videos.iter()
            .map(|(id, video)| (id.clone(), video.title.clone(), video.description.clone()))
            .collect()
    })
} 
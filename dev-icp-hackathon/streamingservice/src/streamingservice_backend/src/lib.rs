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
    playlist: Option<String>, // 追加
}

#[derive(CandidType, Deserialize)]
enum UploadResult {
    //NOTE: #[serde(rename = "ok")] をつけないと Cannot find field hash _17724_ になる
    //Cannot find field hash となるときはClassをResponse に設定したほうが良い
    #[serde(rename = "ok")]
    Ok(String),
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
enum GetHlsPlaylistResult {
    #[serde(rename = "ok")]
    Ok(String),
    #[serde(rename = "err")]
    Err(String),
}


#[derive(CandidType, Deserialize)]
enum GetHlsSegmentResult {
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

#[derive(CandidType, Deserialize)]
enum DeleteVideoResult {
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

#[update]
fn upload_video_chunk(video_id: String, chunk_index: u32, chunk: Vec<u8>) -> UploadResult {
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
                hash: "".to_string(),
                playlist: None
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
                UploadResult::Ok("ok".to_string())
            },
            None => {
                ic_cdk::println!("Error: Failed to create video entry for video_id: {}", video_id);
                UploadResult::Err("Failed to create video entry".to_string())
            }
        }
    })
}

// HLS用: TSセグメントアップロードAPI
#[update]
fn upload_video_segment(video_id: String, ts_segment: Vec<u8>, segment_index: u32) -> UploadResult {
    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if !videos.contains_key(&video_id) {
            videos.insert(video_id.clone(), Video {
                id: video_id.clone(),
                title: "".to_string(),
                description: "".to_string(),
                chunks: Vec::new(),
                hash: "".to_string(),
                playlist: None
            });
        }
        match videos.get_mut(&video_id) {
            Some(video) => {
                while video.chunks.len() <= segment_index as usize {
                    video.chunks.push(Vec::new());
                }
                video.chunks[segment_index as usize] = ts_segment;
                UploadResult::Ok(video_id.clone().to_string())
            },
            None => UploadResult::Err("Failed to create video entry".to_string())
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
        hash: hash.to_string(),
        playlist: None
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



// HLS用プレイリスト(m3u8)を返すAPI
#[query]
fn get_hls_playlist(video_id: String, _canister_id: String) -> GetHlsPlaylistResult {
    ic_cdk::println!("get_hls_playlist: {}", video_id);
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            if let Some(playlist) = &video.playlist {
                ic_cdk::println!("playlist: {}", playlist);
                GetHlsPlaylistResult::Ok(playlist.clone())
            } else {
                GetHlsPlaylistResult::Err("Playlist not found".to_string())
            }
        } else {
            GetHlsPlaylistResult::Err("Video not found".to_string())
        }
    })
}

// HLS用セグメント(ts)を返すAPI（現状はmp4チャンクそのまま返却）
#[query]
fn get_hls_segment(video_id: String, segment_index: u32) -> GetHlsSegmentResult {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            if let Some(chunk) = video.chunks.get(segment_index as usize) {
                // 本来はMPEG-TS変換が必要だが、ここではバイナリをそのまま返す
                GetHlsSegmentResult::Ok(chunk.clone())
            } else {
                GetHlsSegmentResult::Err("Segment not found".to_string())
            }
        } else {
            GetHlsSegmentResult::Err("Video not found".to_string())
        }
    })
}

#[update]
fn upload_playlist(video_id: String, playlist_text: String) -> UploadResult {
    VIDEOS.with(|videos| {
        let mut videos: std::cell::RefMut<'_, HashMap<String, Video>> = videos.borrow_mut();
        if let Some(video) = videos.get_mut(&video_id) {
            ic_cdk::println!("Upload playlist: {}", playlist_text);
            video.playlist = Some(playlist_text.clone());
            ic_cdk::println!("Uploaded playlist");
            UploadResult::Ok("OK".to_string())
        } else {
            UploadResult::Err("Video not found".to_string())
        }
    })
}

#[update]
fn upload_ts_segment(video_id: String, segment_index: u32, ts_data: Vec<u8>) -> UploadResult {
    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if let Some(video) = videos.get_mut(&video_id) {
            while video.chunks.len() <= segment_index as usize {
                video.chunks.push(Vec::new());
            }
            video.chunks[segment_index as usize] = ts_data;
            ic_cdk::println!("Uploaded TS segment");
            UploadResult::Ok("OK".to_string())
        } else {
            UploadResult::Err("Video not found".to_string())
        }
    })
}

// 動画を削除するAPI
#[update]
fn delete_video(video_id: String) -> DeleteVideoResult {
    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if videos.remove(&video_id).is_some() {
            DeleteVideoResult::Ok("Video deleted successfully".to_string())
        } else {
            DeleteVideoResult::Err("Video not found".to_string())
        }
    })
}
use ic_cdk_macros::*;
use candid::{CandidType, Deserialize};
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
struct Video {
    id: String,
    title: String,
    description: String,
    segments: Vec<SegmentInfo>,
    hash: String,
    playlist: Option<String>,
    thumbnail: Option<Vec<u8>>,
    version: String
}

// 各セグメントのアップロード状態を保持する構造体
#[derive(CandidType, Deserialize, Clone, Default)] // Defaultを追加しておくと初期化が楽になる
pub struct SegmentInfo {
    pub chunks: Vec<Vec<u8>>, // このセグメントに属するチャンクデータのリスト
    pub total_chunk_count: u32, // このセグメントで期待されるチャンクの総数
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
enum GetHlsSegmentChunkResult {
    #[serde(rename = "ok")]
    Ok(Vec<u8>),
    #[serde(rename = "err")]
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum SegmentChunkResult {
    #[serde(rename = "ok")]
    Ok(SegmentChunkResponse),
    #[serde(rename = "err")]
    Err(String),
}

// セグメントチャンク取得成功時のレスポンスデータ構造
#[derive(CandidType, Deserialize, Clone)] // Cloneが必要な場合は追加
pub struct SegmentChunkResponse {
    pub segment_chunk_data: Vec<u8>, // 取得したチャンクのデータ
    pub total_chunk_count: u32, // そのセグメントのチャンク総数
}

#[derive(CandidType, Deserialize)]
enum SegmentChunkInfoResult {
    #[serde(rename = "ok")]
    Ok(Vec<SegmentChunkInfo>),
    #[serde(rename = "err")]
    Err(String),
}
// セグメント情報
#[derive(CandidType, Deserialize, Clone)]
pub struct SegmentChunkInfo {
    pub segment_id: u32,
    pub total_chunk_count: u32, // そのセグメントのチャンク総数
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

#[derive(CandidType, Deserialize)]
enum ThumbnailResult {
    #[serde(rename = "ok")]
    Ok(Vec<u8>),
    #[serde(rename = "err")]
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum DownloadVideoResult {
    #[serde(rename = "ok")]
    Ok(Vec<u8>),
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

// #[update]
// fn upload_video_chunk(version: String, video_id: String, chunk_index: u32, chunk: Vec<u8>) -> UploadResult {
//     VIDEOS.with(|videos| {
//         ic_cdk::println!("Starting upload_video_chunk for video_id: {}", video_id);
//         let mut videos = videos.borrow_mut();
        
//         // 存在しないvideo_idの場合は新しいビデオエントリを作成
//         if !videos.contains_key(&video_id) {
//             ic_cdk::println!("Creating new video entry for video_id: {}", video_id);
//             videos.insert(video_id.clone(), Video {
//                 id: video_id.clone(),
//                 title: "".to_string(),
//                 description: "".to_string(),
//                 segments: Vec::new(),
//                 hash: "".to_string(),
//                 playlist: None,
//                 thumbnail: None,
//                 version: version.to_string(),
//             });
//         }
        
//         // 以降は既存のビデオ処理
//         match videos.get_mut(&video_id) {
//             Some(video) => {
//                 ic_cdk::println!("Processing chunk {} for video_id: {}", chunk_index, video_id);
//                 while video.segments.len() <= chunk_index as usize {
//                     video.segments.push(Vec::new());
//                 }
//                 video.segments[chunk_index as usize] = chunk;
//                 ic_cdk::println!("Successfully processed chunk {} for video_id: {}", chunk_index, video_id);
//                 UploadResult::Ok("ok".to_string())
//             },
//             None => {
//                 ic_cdk::println!("Error: Failed to create video entry for video_id: {}", video_id);
//                 UploadResult::Err("Failed to create video entry".to_string())
//             }
//         }
//     })
// }

// // HLS用: TSセグメントアップロードAPI
// #[update]
// fn upload_video_segment(version: String, video_id: String, ts_segment: Vec<u8>, segment_index: u32) -> UploadResult {
//     VIDEOS.with(|videos| {
//         let mut videos = videos.borrow_mut();
//         if !videos.contains_key(&video_id) {
//             videos.insert(video_id.clone(), Video {
//                 id: video_id.clone(),
//                 title: "".to_string(),
//                 description: "".to_string(),
//                 segments: Vec::new(),
//                 hash: "".to_string(),
//                 playlist: None,
//                 thumbnail: None,
//                 version: version.to_string()
//             });
//         }
//         match videos.get_mut(&video_id) {
//             Some(video) => {
//                 while video.segments.len() <= segment_index as usize {
//                     video.segments.push(Vec::new());
//                 }
//                 video.segments[segment_index as usize] = ts_segment;
//                 UploadResult::Ok(video_id.clone().to_string())
//             },
//             None => UploadResult::Err("Failed to create video entry".to_string())
//         }
//     })
// }

// #[query]
// fn get_video_chunk(video_id: String, chunk_index: u32) -> VideoChunkResult {
//     VIDEOS.with(|videos| {
//         let videos = videos.borrow();
//         if let Some(video) = videos.get(&video_id) {
//             if let Some(chunk) = video.segments.get(chunk_index as usize) {
//                 VideoChunkResult::Ok(chunk.clone())
//             } else {
//                 VideoChunkResult::Err("Chunk not found".to_string())
//             }
//         } else {
//             VideoChunkResult::Err("Video not found".to_string())
//         }
//     })
// }

#[update]
fn create_video(version: String, title: String, description: String) -> String {
    let video_id = ic_cdk::api::time().to_string();
    let hash = "";
    let video = Video {
        id: video_id.clone(),
        title,
        description,
        segments: Vec::new(),
        hash: hash.to_string(),
        playlist: None,
        thumbnail: None,
        version: version.to_string()
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
            .map(|(_id, video)| (
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

// // HLS用セグメント(ts)を返すAPI（現状はmp4チャンクそのまま返却）
// #[query]
// fn get_hls_segment(video_id: String, segment_index: u32) -> GetHlsSegmentChunkResult {
//     VIDEOS.with(|videos| {
//         let videos = videos.borrow();
//         if let Some(video) = videos.get(&video_id) {
//             if let Some(chunk) = video.segments.get(segment_index as usize) {
//                 // 本来はMPEG-TS変換が必要だが、ここではバイナリをそのまま返す
//                 GetHlsSegmentChunkResult::Ok(chunk.clone())
//             } else {
//                 GetHlsSegmentChunkResult::Err("Segment not found".to_string())
//             }
//         } else {
//             GetHlsSegmentChunkResult::Err("Video not found".to_string())
//         }
//     })
// }

#[update]
fn upload_playlist(version: String,video_id: String, playlist_text: String) -> UploadResult {
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

//TODO: セグメントファイルがチャンクに分かれているので、チャンクを結合してセグメントファイルにしなければならない
#[update]
fn upload_ts_segment_chunk(
    version: String, 
    video_id: String, 
    segment_index: u32, 
    chunk_index: u32, 
    total_chunk_count: u32,
    segment_chunk_data: Vec<u8>
) -> UploadResult {

    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if let Some(video) = videos.get_mut(&video_id) {

            // video.segments が segment_index まで格納できるように Vec を拡張
            // ここでの video.segments は Vec<Vec<Vec<u8>>> です
            while video.segments.len() <= segment_index as usize {
                video.segments.push(SegmentInfo::default());
            }

            // 指定された segment_index に対応するチャンクリストを取得
            let segment_chunks = &mut video.segments[segment_index as usize];
            if segment_chunks.total_chunk_count == 0 { // 初めて設定する場合のみ
                segment_chunks.total_chunk_count = total_chunk_count;
            }
            // segment_chunks が chunk_index まで格納できるように Vec を拡張
            // ここでの segment_chunks は Vec<Vec<u8>> (チャンクリスト) です
            while segment_chunks.chunks.len() <= chunk_index as usize {
                segment_chunks.chunks.push(Vec::new()); // 各チャンク用に新しいデータVec<u8>を初期化
            }

            // 指定された chunk_index の位置にチャンクデータを格納
            segment_chunks.chunks[chunk_index as usize] = segment_chunk_data;

            // ic_cdk::println!(ts_data.len()); // チャンクのサイズ
            ic_cdk::println!("Uploaded TS chunk for segment {}, chunk {}", segment_index, chunk_index);

            // 注: ここではチャンクを格納しただけで、結合はしていません。
            // 結合処理は別途必要になります。

            UploadResult::Ok("OK".to_string())
        } else {
            UploadResult::Err("Video not found".to_string())
        }
    })
}


/// 指定された video_id のセグメントの情報を返却する
/// video_id: 動画のID
#[query]
fn get_segment_info(video_id: String) -> SegmentChunkInfoResult {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();

        if let Some(video) = videos.get(&video_id) {
            let mut segment_chunk_info_list = Vec::new(); // Changed variable name for clarity
            for (index, segment_info) in video.segments.iter().enumerate() {
                segment_chunk_info_list.push(SegmentChunkInfo {
                    segment_id: index as u32,
                    total_chunk_count: segment_info.total_chunk_count,
                });
            }
            SegmentChunkInfoResult::Ok(segment_chunk_info_list)
        } else {
            // 指定された動画が存在しない
            SegmentChunkInfoResult::Err(format!("Video not found with ID {}", video_id))
        }
    })
}

/// 指定されたセグメントのチャンクを結合して完全なセグメントデータを取得する
/// video_id: 動画のID
/// segment_index: 結合したいセグメントのインデックス
/// 戻り値: 成功した場合は結合された Vec<u8>、失敗した場合はエラーメッセージ
#[query] // データの読み取りのみ行う場合は #[query] を使用 (状態を変更しない場合)
fn get_segment_chunk(video_id: String, segment_index: u32, chunk_index: u32) -> SegmentChunkResult {
    VIDEOS.with(|videos| {
        let videos = videos.borrow(); // 読み取り専用でアクセス

        // 1. 動画が存在するか確認
        if let Some(video) = videos.get(&video_id) {

            // 2. セグメントインデックスが有効か確認
            if (segment_index as usize) < video.segments.len() {
                let segment_chunks = &video.segments[segment_index as usize];
                let chunk_data_vec = &segment_chunks.chunks[chunk_index as usize]; // これは &Vec<u8> 型
                ic_cdk::println!("segment index: {} chunk index: {}", segment_index, chunk_index);
                SegmentChunkResult::Ok(SegmentChunkResponse {
                    segment_chunk_data: chunk_data_vec.clone(),
                    total_chunk_count: segment_chunks.total_chunk_count,
                })

            } else {
                // 指定されたセグメントが存在しない
                SegmentChunkResult::Err(format!("Segment index {} out of bounds for video {}", segment_index, video_id))
            }
        } else {
            // 指定された動画が存在しない
            SegmentChunkResult::Err(format!("Video not found with ID {}", video_id))
        }
    })
}

// /// 指定されたセグメントのチャンクを結合して完全なセグメントデータを取得する
// /// video_id: 動画のID
// /// segment_index: 結合したいセグメントのインデックス
// /// 戻り値: 成功した場合は結合された Vec<u8>、失敗した場合はエラーメッセージ
// #[query] // データの読み取りのみ行う場合は #[query] を使用 (状態を変更しない場合)
// fn combine_segment_chunks(video_id: String, segment_index: u32) -> SegmentChunkResult {
//     VIDEOS.with(|videos| {
//         let videos = videos.borrow(); // 読み取り専用でアクセス

//         // 1. 動画が存在するか確認
//         if let Some(video) = videos.get(&video_id) {

//             // 2. セグメントインデックスが有効か確認
//             if (segment_index as usize) < video.segments.len() {
//                 let segment_chunks = &video.segments[segment_index as usize];

//                 // 3. チャンクを結合するための新しい Vec<u8> を作成
//                 let mut combined_data: Vec<u8> = Vec::new();
//                 // 結合後の合計サイズを事前に計算しておくと、効率が良い場合がありますが、
//                 // Simpleに extend_from_slice を使用します。

//                 // 4. 各チャンクデータを結合済みデータに追加
//                 // 保存されているチャンクの Vec<Vec<u8>> を順番に結合します。
//                 for chunk in segment_chunks.iter() {
//                     combined_data.extend_from_slice(chunk);
//                 }

//                 // 5. 結合されたデータを返す
//                 ic_cdk::println!("Combined data for segment {}", segment_index);
//                 SegmentChunkResult::Ok(combined_data)

//             } else {
//                 // 指定されたセグメントが存在しない
//                 SegmentChunkResult::Err(format!("Segment index {} out of bounds for video {}", segment_index, video_id))
//             }
//         } else {
//             // 指定された動画が存在しない
//             SegmentChunkResult::Err(format!("Video not found with ID {}", video_id))
//         }
//     })
// }

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

#[update]
fn upload_thumbnail(version: String, video_id: String, thumbnail_data: Vec<u8>) -> UploadResult {
    VIDEOS.with(|videos| {
        let mut videos = videos.borrow_mut();
        if let Some(video) = videos.get_mut(&video_id) {
            video.thumbnail = Some(thumbnail_data);
            UploadResult::Ok("Thumbnail uploaded successfully".to_string())
        } else {
            UploadResult::Err("Video not found".to_string())
        }
    })
}

#[query]
fn get_thumbnail(video_id: String) -> ThumbnailResult {
    VIDEOS.with(|videos| {
        let videos = videos.borrow();
        if let Some(video) = videos.get(&video_id) {
            if let Some(thumbnail) = &video.thumbnail {
                ThumbnailResult::Ok(thumbnail.clone())
            } else {
                ThumbnailResult::Err("Thumbnail not found".to_string())
            }
        } else {
            ThumbnailResult::Err("Video not found".to_string())
        }
    })
}

// #[query]
// fn download_video(video_id: String) -> DownloadVideoResult {
//     VIDEOS.with(|videos| {
//         let videos = videos.borrow();
//         if let Some(video) = videos.get(&video_id) {
//             // プレイリストを取得
//             if let Some(playlist) = &video.playlist {
//                 // セグメントを結合して1つのバイナリデータを作成
//                 let mut combined_data = Vec::new();
                
//                 // プレイリストからセグメントの順序を取得
//                 let segment_lines: Vec<&str> = playlist
//                     .split('\n')
//                     .filter(|line| line.ends_with(".ts"))
//                     .collect();

//                 // セグメントを順番に結合
//                 for (index, _) in segment_lines.iter().enumerate() {
//                     if let Some(chunk) = video.segments.get(index) {
//                         combined_data.extend_from_slice(chunk);
//                     }
//                 }

//                 if combined_data.is_empty() {
//                     return DownloadVideoResult::Err("No video data found".to_string());
//                 }

//                 DownloadVideoResult::Ok(combined_data)
//             } else {
//                 DownloadVideoResult::Err("Playlist not found".to_string())
//             }
//         } else {
//             DownloadVideoResult::Err("Video not found".to_string())
//         }
//     })
// }
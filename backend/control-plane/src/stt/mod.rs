use crate::api::AppState;
use tokio_tungstenite::connect_async;
use futures::{SinkExt, StreamExt};
use serde_json::json;

pub async fn run(_st: AppState) {
    if let Ok(url) = std::env::var("ELEVENLABS_WS_URL") {
        if let Ok((mut ws, _)) = connect_async(url).await {
            let _ = ws.send(tokio_tungstenite::tungstenite::Message::Text(
                json!({"hello":"world"}).to_string()
            )).await;
            while let Some(_msg) = ws.next().await {}
        }
    }
}

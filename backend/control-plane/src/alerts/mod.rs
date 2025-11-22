use crate::api::AppState;
use serde_json::json;

pub async fn notify_owner(id: &str, _st: &AppState) -> anyhow::Result<()> {
    if let Ok(hook) = std::env::var("SLACK_WEBHOOK_URL") {
        let _ = reqwest::Client::new().post(&hook)
            .json(&json!({"text": format!("SurveiLens alert {}", id)})).send().await?;
    }
    Ok(())
}
pub async fn notify_responder(id: &str, _st: &AppState) -> anyhow::Result<()> {
    if let Ok(hook) = std::env::var("SLACK_WEBHOOK_URL_RESPONDER") {
        let _ = reqwest::Client::new().post(&hook)
            .json(&json!({"text": format!("Responder escalation {}", id)})).send().await?;
    }
    Ok(())
}

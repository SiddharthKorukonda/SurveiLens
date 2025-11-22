use crate::api::AppState;
use serde_json::{json, Value};
use std::time::Duration;

pub fn enrich_async(alert: Value, st: AppState) {
    tokio::spawn(async move {
        if let Ok(ns_url) = std::env::var("NEURALSEEK_ENDPOINT") {
            let redacted = build_redacted(&alert);
            if let Ok(resp) = reqwest::Client::new()
                .post(ns_url).bearer_auth(std::env::var("NEURALSEEK_API_KEY").unwrap_or_default())
                .json(&redacted).timeout(Duration::from_secs(5))
                .send().await {
                if let Ok(mut cns) = resp.json::<Value>().await {
                    let id = alert["id"].as_str().unwrap_or_default().to_string();
                    let v = st.alerts.get(&id).map(|x| x.value().clone()).unwrap_or(alert.clone());
                    let mut v2 = v.clone();
                    v2["cns"] = cns.take();
                    st.alerts.insert(id.clone(), v2.clone());
                }
            }
        }
    });
}

fn build_redacted(a: &Value) -> Value {
    json!({
      "site": a["site_id"], "camera": a["camera_id"], "time_local": a["ts"],
      "objects": a["objects"].as_array().unwrap_or(&vec![]).iter().map(|o| o["name"].clone()).collect::<Vec<_>>(),
      "actions": a["actions"].as_array().unwrap_or(&vec![]).iter().map(|o| o["name"].clone()).collect::<Vec<_>>(),
      "zones": a["zones"], "audio_flags": a["audio_flags"], "audio_phrases": [],
      "sops": [ "ATM loiter after-hours threshold 0.70", "Escalate if voice raised + concealment" ]
    })
}

use crate::api::AppState;
use serde_json::json;
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

fn root() -> PathBuf { PathBuf::from("surveilens/backend/data/jsonlogs") }

pub async fn maybe_emit(key: &str, rec: &serde_json::Value, st: &AppState) -> anyhow::Result<()> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let last = st.last_quiet.get(key).map(|x| *x.value()).unwrap_or(0);

    let level = rec["level_local"].as_str().unwrap_or("none");
    if level=="medium" || level=="high" {
        let out = json!({
          "ts": rec["ts"], "site_id": rec["site_id"], "camera_id": rec["camera_id"],
          "status": "threat", "level": level, "risk": rec["risk_local"],
          "reason": "local_risk", "objects": rec["objects"], "actions": rec["actions"],
          "zones": rec["zones"], "audio_flags": rec["audio_flags"], "audio_phrases": []
        });
        write_one(&out)?;
        st.last_quiet.insert(key.to_string(), now);
    } else if now.saturating_sub(last) >= 15 {
        let out = json!({
          "ts": rec["ts"], "site_id": rec["site_id"], "camera_id": rec["camera_id"],
          "status": "no_threat", "window_sec": 15
        });
        write_one(&out)?;
        st.last_quiet.insert(key.to_string(), now);
    }
    Ok(())
}

fn write_one(v: &serde_json::Value) -> anyhow::Result<()> {
    let p = root().join(format!("{}_{}_{}.json",
        v["site_id"].as_str().unwrap_or("site"),
        v["camera_id"].as_str().unwrap_or("cam"),
        v["ts"].as_str().unwrap_or("ts")));
    fs::create_dir_all(p.parent().unwrap())?;
    fs::write(p, serde_json::to_vec(v)?)?;
    Ok(())
}

pub async fn latest_for(site: &str, cam: &str) -> anyhow::Result<serde_json::Value> {
    let dir = root();
    let mut latest: Option<(std::time::SystemTime, std::path::PathBuf)> = None;
    if let Ok(read) = std::fs::read_dir(&dir) {
        for e in read.flatten() {
            let n = e.file_name().to_string_lossy().to_string();
            if n.starts_with(&format!("{}_{}", site, cam)) {
                let md = e.metadata().ok();
                let mt = md.and_then(|m| m.modified().ok()).unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                if latest.as_ref().map(|(t,_)| mt> *t).unwrap_or(true) { latest = Some((mt, e.path())); }
            }
        }
    }
    if let Some((_, p)) = latest {
        let b = fs::read(p)?; Ok(serde_json::from_slice(&b)?)
    } else {
        Ok(json!({}))
    }
}

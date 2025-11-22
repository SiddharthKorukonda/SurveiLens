use axum::{
    extract::{Path, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Serialize)]
pub struct OkResp { pub ok: bool }

#[derive(Deserialize)]
pub struct StartQuery { pub rtsp: Option<String> }

pub async fn post_start(
    Path((site, cam)): Path<(String, String)>,
    Query(q): Query<StartQuery>,
) -> Result<Json<Value>, StatusCode> {
    let rtsp = q.rtsp
        .or_else(|| std::env::var("DEFAULT_RTSP").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let ack = crate::grpc_client::send_start(&site, &cam, &rtsp)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    Ok(Json(json!({ "ok": ack.ok, "msg": ack.msg })))
}

pub async fn post_stop(
    Path((site, cam)): Path<(String, String)>
) -> Result<Json<OkResp>, StatusCode> {
    let _ack = crate::grpc_client::send_stop(&site, &cam)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(Json(OkResp { ok: true }))
}

#[derive(Deserialize)]
pub struct PolicyCompileBody {
    pub site_id: String,
    pub camera_id: String,
    #[serde(flatten)]
    pub params: serde_json::Value,
}

pub async fn post_policy_compile(
    Json(body): Json<PolicyCompileBody>
) -> Result<Json<OkResp>, StatusCode> {
    crate::policy::compile_and_push(&body.site_id, &body.camera_id, body.params)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(OkResp { ok: true }))
}

pub async fn get_health() -> Json<Value> {
    Json(json!({ "ok": true, "service": "control-plane" }))
}

pub mod proto;
mod grpc_client;
mod policy;
mod api;

use axum::{Router, routing::{get, post}};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Bind address for HTTP (Axum)
    let bind = std::env::var("RUST_HTTP_BIND").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    println!("surveilens-control-plane HTTP listening on http://{bind}");

    let app = Router::new()
        // Cameras
        .route("/api/cameras/:site/:cam/start", post(api::post_start))
        .route("/api/cameras/:site/:cam/stop",  post(api::post_stop))
        // Policy
        .route("/api/policy/compile", post(api::post_policy_compile))
        // Health
        .route("/health", get(api::get_health))
        .layer(TraceLayer::new_for_http());

    axum::serve(listener, app).await?;
    Ok(())
}

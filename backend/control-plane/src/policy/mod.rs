use anyhow::Result;

pub async fn compile_and_push(site_id: &str, camera_id: &str, params_json: serde_json::Value) -> Result<()> {
    let json_params = serde_json::to_string(&params_json)?;
    crate::grpc_client::send_setparams(site_id, camera_id, json_params).await?;
    Ok(())
}

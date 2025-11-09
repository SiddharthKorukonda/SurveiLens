import boto3
from .config import Config

def _s3():
    return boto3.client(
        "s3",
        endpoint_url=Config.VULTR_ENDPOINT,
        aws_access_key_id=Config.VULTR_KEY,
        aws_secret_access_key=Config.VULTR_SECRET
    )

def presign_clip(clip_key: str, expires=300):
    if Config.DEMO_MODE or not (Config.VULTR_ENDPOINT and Config.VULTR_BUCKET and Config.VULTR_KEY and Config.VULTR_SECRET):
        return f"https://example.invalid/{clip_key}?token=demo"
    s3 = _s3()
    return s3.generate_presigned_url("get_object", Params={"Bucket": Config.VULTR_BUCKET, "Key": clip_key}, ExpiresIn=expires)

def upload_bytes(key: str, data: bytes, content_type="application/octet-stream"):
    s3 = _s3()
    s3.put_object(Bucket=Config.VULTR_BUCKET, Key=key, Body=data, ContentType=content_type)
    return key

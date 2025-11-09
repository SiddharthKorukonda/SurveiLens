from typing import Optional
try:
    from elevenlabs.client import ElevenLabs
except Exception:
    ElevenLabs = None
from .config import Config
from .storage import upload_bytes

def generate_voice_brief(text: str, key_prefix: str) -> Optional[str]:
    if Config.DEMO_MODE or not (Config.ELEVEN_API_KEY and ElevenLabs and Config.ELEVEN_VOICE_ID):
        return None
    client = ElevenLabs(api_key=Config.ELEVEN_API_KEY)
    audio = client.text_to_speech.convert(voice_id=Config.ELEVEN_VOICE_ID, output_format="mp3_44100_128", text=text)
    data = b"".join(audio)
    key = f"{key_prefix}/brief.mp3"
    upload_bytes(key, data, "audio/mpeg")
    return key

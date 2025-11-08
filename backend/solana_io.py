import json
from solana.rpc.api import Client
from solana.transaction import Transaction
from solana.system_program import TransferParams, transfer
from solana.keypair import Keypair
from .config import Config

def _signer():
    key = Config.SOLANA_SIGNER_PRIVATE_KEY or ""
    if not key:
        return None
    try:
        arr = json.loads(key)
        return Keypair.from_secret_key(bytes(arr))
    except Exception:
        try:
            return Keypair.from_base58_string(key)
        except Exception:
            return None

def write_receipt_memo(hash_hex: str):
    kp = _signer()
    if kp is None:
        return "demo-" + hash_hex[:16]
    client = Client(Config.SOLANA_RPC)
    tx = Transaction()
    tx.add(transfer(TransferParams(from_pubkey=kp.public_key, to_pubkey=kp.public_key, lamports=1)))
    resp = client.send_transaction(tx, kp, opts={"skip_preflight": True})
    sig = resp.get("result")
    return sig or "unknown"

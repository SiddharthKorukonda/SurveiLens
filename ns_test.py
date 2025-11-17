#!/usr/bin/env python3
"""
ns_test.py — NeuralSeek mAIstro smoke test (Incident_Summarizer -> Governor)
Loads .env automatically and supports your env names:
  NEURALSEEK_ENDPOINT, NEURALSEEK_API_KEY,
  NEURALSEEK_AGENT_INCIDENT_SUMMARIZER, NEURALSEEK_AGENT_GOVERNOR
"""

import os
import sys
import json
import time
import base64
import argparse
from typing import Optional, Dict, Any, List

import requests

# --- auto-load .env if present ---
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass


# -------------------------
# NeuralSeek client
# -------------------------
class NeuralSeekClient:
    """
    Two modes:
      1) Direct endpoint (NEURALSEEK_ENDPOINT) + Authorization: Bearer <key>
      2) Base/instance path (base/v1/{instance}/maistro) + apiKey header
    """
    def __init__(
        self,
        endpoint: Optional[str] = None,
        base_url: Optional[str] = None,
        instance: Optional[str] = None,
        api_key: Optional[str] = None,
        auth_mode: str = "bearer",   # 'bearer' or 'apikey'
        timeout: float = 8.0,
    ):
        self.endpoint = (endpoint or os.getenv("NEURALSEEK_ENDPOINT") or "").strip()
        self.base_url = (base_url or os.getenv("NEURALSEEK_BASE_URL") or "https://api.neuralseek.com").rstrip("/")
        self.instance = (instance or os.getenv("NEURALSEEK_INSTANCE") or "").strip()
        self.api_key = (api_key or os.getenv("NEURALSEEK_API_KEY") or "").strip()
        self.auth_mode = (auth_mode or os.getenv("NEURALSEEK_AUTH_MODE") or "bearer").lower()
        self.timeout = float(timeout)

        # Determine if enabled
        if self.endpoint:
            self.enabled = bool(self.api_key)
        else:
            self.enabled = bool(self.instance and self.api_key)

    def _url(self) -> str:
        if self.endpoint:
            return self.endpoint
        return f"{self.base_url}/v1/{self.instance}/maistro"

    def _headers(self) -> Dict[str, str]:
        if self.auth_mode == "apikey" and not self.endpoint:
            return {"Content-Type": "application/json", "apiKey": self.api_key}
        # default to bearer
        return {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}

    def call_agent(self, agent: str, vars_dict: Optional[Dict[str, Any]] = None, input_text: Optional[str] = None) -> Dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("NeuralSeek not configured (missing endpoint/instance or api key).")
        payload = {"agent": agent}
        if vars_dict is not None:
            payload["vars"] = vars_dict
        if input_text:
            payload["input"] = input_text
        resp = requests.post(self._url(), headers=self._headers(), json=payload, timeout=self.timeout)
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text}


# -------------------------
# Helpers
# -------------------------
def b64_from_file(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def build_event_payload(args) -> Dict[str, Any]:
    weapons = [w.strip() for w in (args.weapons or "").split(",") if w.strip()]
    actions = [a.strip() for a in (args.actions or "").split(",") if a.strip()]
    snaps: List[str] = []
    for p in args.snapshots or []:
        try:
            snaps.append(b64_from_file(p))
        except Exception as e:
            print(f"[WARN] Could not read snapshot '{p}': {e}")

    return {
        "people_count": args.people,
        "weapons_detected": weapons,
        "actions_detected": actions,
        "danger_score": float(args.danger_score),
        "danger_level": args.danger_level.lower(),
        "transcript": args.transcript or "",
        "snapshots_b64": snaps,
    }


def run_neuralseek_governor(ns: NeuralSeekClient, event_payload: dict, policy: dict,
                            incident_agent: str, governor_agent: str) -> Dict[str, Any]:
    # 1) Incident_Summarizer
    summarizer_raw = ns.call_agent(agent=incident_agent, vars_dict=event_payload)

    # extract summary (common shapes)
    summary_text = None
    if isinstance(summarizer_raw, dict):
        summary_text = summarizer_raw.get("summary") \
            or (summarizer_raw.get("neuralseek") or {}).get("summary") \
            or summarizer_raw.get("output")
    if not summary_text:
        summary_text = "Possible risk detected based on recent frames and transcript."

    # 2) Governor
    gov_vars = dict(event_payload)
    gov_vars["summary"] = summary_text
    gov_vars["policy"] = policy
    governor_raw = ns.call_agent(agent=governor_agent, vars_dict=gov_vars)

    # normalize result
    ns_body = governor_raw.get("neuralseek") if isinstance(governor_raw, dict) else None
    if not ns_body and isinstance(governor_raw, dict):
        ns_body = governor_raw

    level = (ns_body or {}).get("escalation_level") or (ns_body or {}).get("level")
    action = (ns_body or {}).get("action")
    confidence = (ns_body or {}).get("confidence")

    result = {
        "escalation_level": level,
        "summary": summary_text,
        "action": action,
        "confidence": float(confidence) if confidence is not None else None,
        "policy": policy,
        "summarizer_raw": summarizer_raw,
        "governor_raw": governor_raw,
    }
    return result


# -------------------------
# CLI
# -------------------------
def parse_args():
    p = argparse.ArgumentParser(description="NeuralSeek mAIstro agent smoke test (Incident_Summarizer -> Governor)")
    # Auth / routing
    p.add_argument("--auth-mode", choices=["bearer", "apikey"], default=os.getenv("NEURALSEEK_AUTH_MODE", "bearer"))
    p.add_argument("--endpoint", default=os.getenv("NEURALSEEK_ENDPOINT", ""), help="Direct NeuralSeek endpoint (Bearer)")
    p.add_argument("--base-url", default=os.getenv("NEURALSEEK_BASE_URL", "https://api.neuralseek.com"))
    p.add_argument("--instance", default=os.getenv("NEURALSEEK_INSTANCE", ""))
    p.add_argument("--api-key", default=os.getenv("NEURALSEEK_API_KEY", ""))
    p.add_argument("--timeout", type=float, default=8.0)

    # Agents (support both your names and the generic ones)
    incident_default = (
        os.getenv("NEURALSEEK_INCIDENT_AGENT")
        or os.getenv("NEURALSEEK_AGENT_INCIDENT_SUMMARIZER")
        or "Incident_Summarizer"
    )
    governor_default = (
        os.getenv("NEURALSEEK_GOVERNOR_AGENT")
        or os.getenv("NEURALSEEK_AGENT_GOVERNOR")
        or "Governor"
    )
    p.add_argument("--incident-agent", default=incident_default)
    p.add_argument("--governor-agent", default=governor_default)

    # Dummy event payload
    p.add_argument("--people", type=int, default=1)
    p.add_argument("--weapons", default="knife", help="Comma-separated, e.g. 'knife,gun'")
    p.add_argument("--actions", default="", help="Comma-separated, e.g. 'running,shouting'")
    p.add_argument("--danger-score", type=float, default=0.92)
    p.add_argument("--danger-level", choices=["low", "medium", "high"], default="high")
    p.add_argument("--transcript", default="He has a knife. Call security now.")
    p.add_argument("--snapshots", nargs="*", default=[], help="Optional image paths to include as base64")

    # Fallback policy
    p.add_argument("--med-threshold", type=float, default=float(os.getenv("NS_MED_THRESHOLD", "0.4")))
    p.add_argument("--high-threshold", type=float, default=float(os.getenv("NS_HIGH_THRESHOLD", "0.7")))

    # Output
    p.add_argument("--out", default="", help="Optional file to write the combined JSON result")
    p.add_argument("--pretty", action="store_true", help="Pretty-print JSON")

    return p.parse_args()


def main():
    args = parse_args()

    ns = NeuralSeekClient(
        endpoint=args.endpoint or None,
        base_url=args.base_url or None,
        instance=args.instance or None,
        api_key=args.api_key or None,
        auth_mode=args.auth_mode,
        timeout=args.timeout,
    )

    if not ns.enabled:
        print("[ERROR] NeuralSeek not configured.")
        if args.auth_mode == "bearer":
            print("  Need --endpoint (or NEURALSEEK_ENDPOINT) and --api-key (or NEURALSEEK_API_KEY).")
        else:
            print("  Need --base-url + --instance + --api-key (or env vars).")
        return 2

    event_payload = build_event_payload(args)
    policy = {"med_threshold": args.med_threshold, "high_threshold": args.high_threshold}

    try:
        t0 = time.time()
        result = run_neuralseek_governor(
            ns,
            event_payload,
            policy,
            incident_agent=args.incident_agent,
            governor_agent=args.governor_agent,
        )
        dt = (time.time() - t0)

        level = (result.get("escalation_level") or "")
        action = (result.get("action") or "")
        status = "OK" if (level or action) else "WARN"

        if args.pretty:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(result, ensure_ascii=False))
        print(f"\n[ns_test] status={status} elapsed={dt:.2f}s level={level!r} action={action!r}")

        if args.out:
            try:
                with open(args.out, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=2 if args.pretty else None, ensure_ascii=False)
                print(f"[ns_test] wrote {args.out}")
            except Exception as e:
                print(f"[WARN] Could not write --out file: {e}")

        return 0 if status == "OK" else 1

    except requests.HTTPError as he:
        try:
            body = he.response.text
        except Exception:
            body = "<no body>"
        print(f"[ERROR] HTTP {he.response.status_code}: {body}")
        return 3
    except Exception as e:
        print("[ERROR] NeuralSeek self-test failed:", repr(e))
        return 4


if __name__ == "__main__":
    sys.exit(main())

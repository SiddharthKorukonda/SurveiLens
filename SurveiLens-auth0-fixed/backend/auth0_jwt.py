import json
from functools import wraps
from flask import request, jsonify
from jose import jwt
import requests
import os

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
API_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ALGORITHMS = ["RS256"]

class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code

def get_token_auth_header():
    auth = request.headers.get("Authorization", None)
    if not auth:
        raise AuthError({"code": "authorization_header_missing","description": "Authorization header is expected"}, 401)
    parts = auth.split()
    if parts[0].lower() != "bearer":
        raise AuthError({"code": "invalid_header","description": "Authorization header must start with Bearer"}, 401)
    if len(parts) == 1:
        raise AuthError({"code": "invalid_header","description": "Token not found"}, 401)
    if len(parts) > 2:
        raise AuthError({"code": "invalid_header","description": "Authorization header must be Bearer token"}, 401)
    return parts[1]

def requires_auth(required_scopes=None, roles=None, require_mfa=False):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = get_token_auth_header()
            jsonurl = requests.get(f"https://{AUTH0_DOMAIN}/.well-known/jwks.json", timeout=10)
            jwks = jsonurl.json()
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}
            for key in jwks.get("keys", []):
                if key.get("kid") == unverified_header.get("kid"):
                    rsa_key = {
                        "kty": key.get("kty"),
                        "kid": key.get("kid"),
                        "use": key.get("use"),
                        "n": key.get("n"),
                        "e": key.get("e")
                    }
            if not rsa_key:
                raise AuthError({"code": "invalid_header", "description": "Unable to find appropriate key"}, 401)

            payload = jwt.decode(token, rsa_key, algorithms=ALGORITHMS, audience=API_AUDIENCE, issuer=f"https://{AUTH0_DOMAIN}/")
            # RBAC permissions
            token_perms = set(payload.get("permissions", []))
            if required_scopes:
                needed = set(required_scopes)
                if not token_perms:
                    token_perms = set(payload.get("scope", "").split())
                if not needed.issubset(token_perms):
                    raise AuthError({"code": "insufficient_scope", "description": "Missing permission"}, 403)
            # Roles from custom claim
            if roles:
                roles_claim = payload.get("https://surveilens/roles", [])
                if not any(r in roles_claim for r in roles):
                    raise AuthError({"code":"insufficient_role","description":"Missing role"},403)
            # Optional MFA step-up
            if require_mfa:
                amr = payload.get("amr", [])
                if "mfa" not in amr:
                    raise AuthError({"code":"mfa_required","description":"MFA not satisfied"},403)

            request.auth_payload = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator

import os, time, functools, requests
from flask import request, abort
from jose import jwt

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "https://surveilens/api")
JWKS_CACHE = None
JWKS_CACHE_AT = 0

def _get_jwks():
    global JWKS_CACHE, JWKS_CACHE_AT
    if not AUTH0_DOMAIN:
        return {"keys":[]}
    now = time.time()
    if JWKS_CACHE and now - JWKS_CACHE_AT < 3600:
        return JWKS_CACHE
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    r = requests.get(url, timeout=5)
    r.raise_for_status()
    JWKS_CACHE = r.json()
    JWKS_CACHE_AT = now
    return JWKS_CACHE

def requires_auth(required_scopes=None, roles=None, m2m=False):
    def wrap(f):
        @functools.wraps(f)
        def inner(*args, **kwargs):
            auth = request.headers.get("Authorization")
            if not auth:
                abort(401, "Missing Authorization")
            parts = auth.split()
            if parts[0].lower() != "bearer" or len(parts) != 2:
                abort(401, "Bad Authorization")
            token = parts[1]

            if os.getenv("DEMO_MODE","true").lower()=="true" and not AUTH0_DOMAIN:
                request.jwt_payload = {"permissions":["*"],"https://surveilens/roles":["admin","dispatcher"],"site_id":os.getenv("SITE_ID","site-01")}
                return f(*args, **kwargs)

            unverified_header = jwt.get_unverified_header(token)
            jwks = _get_jwks()
            rsa_key = next((k for k in jwks["keys"] if k.get("kid")==unverified_header.get("kid")), None)
            if not rsa_key:
                abort(401, "No matching JWK")

            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=AUTH0_AUDIENCE,
                issuer=f"https://{AUTH0_DOMAIN}/"
            )

            if required_scopes:
                perms = payload.get("permissions", []) or payload.get("scope","").split()
                if "*" not in perms and not all(s in perms for s in required_scopes):
                    abort(403, "Insufficient scope")
            if roles:
                role_claim = payload.get("https://surveilens/roles", [])
                if not any(r in role_claim for r in roles):
                    abort(403, "Missing required role")

            request.jwt_payload = payload
            return f(*args, **kwargs)
        return inner
    return wrap

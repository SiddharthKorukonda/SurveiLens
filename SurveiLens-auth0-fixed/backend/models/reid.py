def assign_global_ids(tracklets):
    for t in tracklets or []:
        t["global_id"] = t.get("local_id")
    return tracklets

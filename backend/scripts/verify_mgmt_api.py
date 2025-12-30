import urllib.request
import json
import os

API_BASE = "http://localhost:8000/api/v1"
TOKEN = "token_for_ukatru" # Assuming we can get a token or run in a context where auth is bypassed/seeded

def call_api(path, method="GET", data=None):
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    if data:
        req.add_header("Content-Type", "application/json")
        body = json.dumps(data).encode("utf-8")
        req.data = body
    
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return True
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error calling {method} {path}: {e}")
        return None

# 1. List teams
teams = call_api("/management/teams")
if teams:
    print(f"Found {len(teams)} teams.")
    target_team = teams[0]
    print(f"Testing with team: {target_team['team_nm']} (ID: {target_team['id']})")
    
    # 2. Update team
    updated = call_api(f"/management/teams/{target_team['id']}", method="PATCH", data={"description": "Updated via script"})
    if updated:
        print(f"Team updated: {updated['description']}")
    
    # 3. List code locations
    locs = call_api("/management/code-locations")
    if locs:
        team_locs = [l for l in locs if l['team_id'] == target_team['id']]
        if team_locs:
            target_loc = team_locs[0]
            print(f"Testing with code location: {target_loc['location_nm']} (ID: {target_loc['id']})")
            
            # 4. Update code location
            updated_loc = call_api(f"/management/code-locations/{target_loc['id']}", method="PATCH", data={"repo_url": "https://github.com/updated/repo"})
            if updated_loc:
                print(f"Code location updated: {updated_loc['repo_url']}")
        else:
            print("No code locations found for this team.")
else:
    print("No teams found.")

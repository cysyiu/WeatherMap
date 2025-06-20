import json
import os

# Path to your GeoJSON file for rain data. Adjust the filename if needed.
geojson_path = 'Data/latest_rain.geojson'

# Read the GeoJSON
with open(geojson_path, 'r', encoding='utf-8') as f:
    geo_data = json.load(f)

# Update each feature's Data_url property to point to the local JSON file:
for feature in geo_data['features']:
    old_url = feature['properties'].get('Data_url', '')
    # Check that the URL ends with '.json' (assuming that all rain data URLs do)
    if old_url.endswith('.json'):
        # Extract the filename from the old URL (e.g., "Rain_0.json")
        file_name = os.path.basename(old_url)
        # Redirect the Data_url to your local path (adjust if you change the folder structure)
        feature['properties']['Data_url'] = f"Data/Rain_data/{file_name}"

# Write back the updated GeoJSON
with open(geojson_path, 'w', encoding='utf-8') as f:
    json.dump(geo_data, f, indent=2, ensure_ascii=False)

print("GeoJSON updated to use local rain JSON paths.")

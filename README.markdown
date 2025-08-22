# Hong Kong Weather Map

A web-based interactive map displaying real-time weather data for Hong Kong, utilizing data from the Hong Kong Observatory's open APIs. Built with Leaflet.js, this application visualizes temperature, humidity, rainfall, and wind data, along with weather warnings and forecasts.

## Features

- **Interactive Map**: Displays weather data at various weather stations across Hong Kong using Leaflet.js.
- **Weather Elements**: Toggle between:
  - Temperature (°C)
  - Relative Humidity (%)
  - Rainfall (mm)
  - Wind (direction and speed with wind barbs)
- **Real-Time Data**: Fetches current weather conditions, warnings, and a 7-day forecast from the Hong Kong Observatory.
- **Warning Icons**: Displays multiple weather warning icons (e.g., typhoon signals, rainstorm warnings) in the weather box, aligned to the right below the divider.
- **Geolocation**: Includes a "My Location" control to center the map on the user's current position.
- **Home Control**: Resets the map view to Hong Kong's center.
- **Responsive Design**: Optimized for various screen sizes with a clean, semi-transparent UI.

## Prerequisites

- A modern web browser (e.g., Chrome, Firefox, Safari).
- A local or remote web server to host the application (due to CORS restrictions with file:// URLs).
- Internet access to fetch data from the Hong Kong Observatory APIs and external libraries.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/hong-kong-weather-map.git
   cd hong-kong-weather-map
   ```

2. **Project Structure**:
   ```
   hong-kong-weather-map/
   ├── index.html
   ├── js/
   │   ├── weather.js
   │   ├── leaflet-windbarb.js
   ├── style.css
   ├── Data/
   │   ├── latest_temperature.geojson
   │   ├── latest_humidity.geojson
   │   ├── latest_rainfall.geojson
   │   ├── latest_wind.geojson
   └── README.md
   ```
   Ensure the `Data/` folder contains the required GeoJSON files and `img/` contains `home.png` for the home control icon.

3. **Set Up a Local Server**:
   To avoid CORS issues, serve the project using a local web server. For example, using Python:
   ```bash
   python -m http.server 8000
   ```
   Then, access the application at `http://localhost:8000`.

## Dependencies

The project uses the following external libraries, loaded via CDN:
- **Leaflet.js** (v1.9.4): For rendering the interactive map.
- **Leaflet.LocateControl** (v0.79.0): For geolocation functionality.
- **Leaflet-WindBarb**: Custom plugin for rendering wind barbs (included as `leaflet-windbarb.js`).

No additional installations are required for these dependencies, as they are fetched at runtime.

## Usage

1. **Open the Application**:
   Navigate to `http://localhost:8000` (or your hosted URL) in your browser.

2. **Interact with the Map**:
   - Use the **Weather Element Selector** (bottom-left) to switch between temperature, humidity, rainfall, or wind data.
   - Click on weather stations to view detailed popups (e.g., station name, value).
   - Hover over stations to see tooltips with station names.
   - Use the **Zoom Controls** (top-right) to zoom in/out.
   - Click **My Location** to center the map on your position.
   - Click **Home** to reset the view to Hong Kong's center.

3. **View Weather Information**:
   - **Current Weather Box** (top-left): Shows the current weather icon, multiple warning icons (if any), and update time.
   - **Warning Message Bar** (top-center): Displays scrolling weather warnings or a "no warning" message.
   - **Weather Forecast Box** (bottom-right): Lists a 7-day forecast with dates, icons, and temperature ranges. Toggle visibility with the `>`/`<<` button.

## Data Sources

- **Hong Kong Observatory Open Data APIs**:
  - Current Weather: `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en`
  - Weather Forecast: `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=en`
  - Weather Warnings: `https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en`
- **Map Tiles**: Hong Kong GeoData Store (`https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/...`).
- **Station Data**: GeoJSON files in the `Data/` folder, with linked CSV/JSON data URLs for each station.

## Notes

- The `Data/` folder's GeoJSON files must be updated periodically to reflect the latest weather station data URLs.
- The `leaflet-windbarb.js` plugin is included locally due to its specific customization for this project.
- Warning icons are fetched from `https://www.hko.gov.hk/en/wxinfo/dailywx/images/` and displayed only for active warnings (excluding `CANCEL`).
- The application updates weather data every 60 seconds and warnings every 5 minutes.

## Contributing

Contributions are welcome! Please:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit your changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Hong Kong Observatory** for providing open weather data.
- **Leaflet.js** community for the mapping library and plugins.
- **Manuel Bär** for the Leaflet.WindBarbs plugin.

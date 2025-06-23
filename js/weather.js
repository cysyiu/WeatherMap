const HONG_KONG_CENTER = [22.3964, 114.1095]; // [lat, lng] for Leaflet

// Map compass points to degrees (clockwise from North = 0°)
const COMPASS_TO_DEGREES = {
    'North': 0, 'Northeast': 45, 'East': 90, 'Southeast': 135,
    'South': 180, 'Southwest': 225, 'West': 270, 'Northwest': 315,
    'Calm': 0, // For 0-speed wind barb
    'Variable': null // Handle separately
};

// Warning code to icon mapping
const WARNING_ICONS = {
    'WFIREY': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/firey.gif',
    'WFIRER': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/firer.gif',
    'WFROST': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/frost.gif',
    'WHOT': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/vhot.gif',
    'WCOLD': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/cold.gif',
    'WMSGNL': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/sms.gif',
    'WRAINA': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/raina.gif',
    'WRAINR': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/rainr.gif',
    'WRAINB': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/rainb.gif',
    'WFNTSA': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/ntfl.gif',
    'WL': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/landslip.gif',
    'TC1': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc1.gif',
    'TC3': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc3.gif',
    'TC8NE': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc8ne.gif',
    'TC8SE': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc8b.gif',
    'TC8NW': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc8d.gif',
    'TC8SW': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc8c.gif',
    'TC9': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc9.gif',
    'TC10': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tc10.gif',
    'WTMW': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/tsunami-warn.gif',
    'WTS': 'https://www.hko.gov.hk/en/wxinfo/dailywx/images/ts.gif',
    'CANCEL': null
};

async function fetchWeatherData() {
    try {
        const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        console.log('Weather API Response:', data);
        return data;
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        return {};
    }
}

async function fetchWeatherForecast() {
    try {
        const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=en');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch weather forecast:', error);
        return {};
    }
}

async function fetchWarningData() {
    try {
        const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        console.log('Warning API Response:', data);
        return data;
    } catch (error) {
        console.error('Failed to fetch warning data:', error);
        return {};
    }
}

async function fetchWeatherStations(weatherElement) {
    try {
        let geojsonFile;
        if (weatherElement === 'humidity') geojsonFile = 'Data/latest_humidity.geojson';
        else if (weatherElement === 'wind') geojsonFile = 'Data/latest_wind.geojson';
        else if (weatherElement === 'rainfall') geojsonFile = 'Data/latest_rainfall.geojson';
        else geojsonFile = 'Data/latest_temperature.geojson';
        const response = await fetch(geojsonFile);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const geojson = await response.json();
        const features = await Promise.all(geojson.features.map(async (feature) => {
            const dataUrl = feature.properties.Data_url;
            try {
                const dataResponse = await fetch(dataUrl);
                if (!dataResponse.ok) throw new Error(`HTTP error! Status: ${dataResponse.status}`);
                if (weatherElement === 'rainfall') {
                    const jsonData = await dataResponse.json();
                    feature.properties.value = parseFloat(jsonData.value);
                } else {
                    const csvText = await dataResponse.text();
                    const lines = csvText.split('\n').filter(line => line.trim() !== '');
                    const headers = lines[0].split(',').map(header => header.trim());
                    if (weatherElement === 'wind') {
                        const dirIndex = headers.indexOf('10-Minute Mean Wind Direction(Compass points)');
                        const speedIndex = headers.indexOf('10-Minute Mean Speed(km/hour)');
                        if (dirIndex === -1 || speedIndex === -1) {
                            throw new Error('Wind direction or speed columns not found in CSV');
                        }
                        const data = lines[1].split(',').map(value => value.trim());
                        feature.properties.direction = data[dirIndex];
                        feature.properties.speed_kmh = parseFloat(data[speedIndex]);
                        feature.properties.speed_knots = isNaN(feature.properties.speed_kmh) ? null : feature.properties.speed_kmh / 1.852; // Convert km/h to knots
                        console.log(`Station ${feature.properties.AutomaticWeatherStation_en}: direction=${feature.properties.direction}, speed_knots=${feature.properties.speed_knots}`);
                    } else {
                        let valueIndex;
                        if (weatherElement === 'humidity') valueIndex = headers.indexOf('Relative Humidity(percent)');
                        else valueIndex = headers.indexOf('Air Temperature(degree Celsius)');
                        if (valueIndex === -1) throw new Error(`${weatherElement === 'humidity' ? 'Relative Humidity(%)' : 'Air Temperature(degree Celsius)'} column not found in CSV`);
                        const data = lines[1].split(',').map(value => value.trim());
                        feature.properties.value = parseFloat(data[valueIndex]);
                    }
                }
                return feature;
            } catch (error) {
                console.error(`Failed to fetch data for ${feature.properties.AutomaticWeatherStation_en}:`, error);
                if (weatherElement === 'wind') {
                    feature.properties.direction = null;
                    feature.properties.speed_kmh = null;
                    feature.properties.speed_knots = null;
                } else {
                    feature.properties.value = null;
                }
                return feature;
            }
        }));
        geojson.features = features.filter(feature => 
            weatherElement === 'wind' ? 
            (feature.properties.direction !== null) : // Allow 'Calm', 'Variable'
            feature.properties.value !== null && !isNaN(feature.properties.value)
        );
        console.log(`Filtered ${weatherElement} features:`, geojson.features.length, geojson.features);
        return geojson;
    } catch (error) {
        console.error(`Failed to fetch ${weatherElement} stations:`, error);
        return { type: 'FeatureCollection', features: [] };
    }
}

const map = L.map('map', {
    zoomControl: true // Ensure default zoom control is enabled
}).setView(HONG_KONG_CENTER, 11);
map.zoomControl.setPosition('topright'); // Place zoom control at top-right
L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png', {
    attribution: '© Hong Kong Observatory',
    maxZoom: 18
}).addTo(map);
L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png', {
    maxZoom: 18
}).addTo(map);

let stationLayer;

// Check if Leaflet.windbarb is loaded
if (typeof L.WindBarb === 'undefined') {
    console.error('Leaflet.windbarb plugin is not loaded. Please ensure js/leaflet-windbarb.js is included and accessible.');
}

async function addWeatherStationsLayer(weatherElement) {
    if (stationLayer) {
        map.removeLayer(stationLayer);
    }
    const stationsGeoJson = await fetchWeatherStations(weatherElement);
    console.log(`Adding ${weatherElement} layer with ${stationsGeoJson.features.length} features`);
    stationLayer = L.geoJSON(stationsGeoJson, {
        pointToLayer: (feature, latlng) => {
            const stationName = feature.properties.AutomaticWeatherStation_en;
            if (weatherElement === 'wind') {
                const direction = feature.properties.direction;
                const speed_knots = feature.properties.speed_knots;
                
                // Handle NaN speed
                if (speed_knots === null || isNaN(speed_knots)) {
                    console.log(`NaN speed for ${stationName}, showing 'M'`);
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: '<div style="font-size: 14px; font-weight: bold; color: black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;">M</div>',
                            className: '',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    });
                }
                
                // Handle Variable direction
                if (direction === 'Variable') {
                    console.log(`Variable direction for ${stationName}, showing 'VRB'`);
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: '<div style="font-size: 14px; font-weight: bold; color: black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;">VRB</div>',
                            className: '',
                            iconSize: [30, 20],
                            iconAnchor: [15, 10]
                        })
                    });
                }
                
                // Check if WindBarb is available
                if (typeof L.WindBarb === 'undefined') {
                    console.warn(`WindBarb plugin not available for ${stationName}, using fallback marker`);
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: 'red',
                        fillOpacity: 1,
                        stroke: false
                    });
                }
                
                // Handle Calm direction
                if (direction === 'Calm') {
                    console.log(`Calm direction for ${stationName}, showing 0-speed wind barb`);
                    const icon = L.WindBarb.icon({
                        lat: latlng.lat,
                        deg: 0,
                        speed: 0,
                        pointRadius: 5,
                        strokeLength: 20
                    });
                    return L.marker(latlng, { icon: icon });
                }
                
                // Normal wind barb
                if (!COMPASS_TO_DEGREES[direction] && direction !== 'Calm') {
                    console.warn(`Invalid wind direction for ${stationName}: ${direction}`);
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: 'red',
                        fillOpacity: 1,
                        stroke: false
                    });
                }
                const degrees = COMPASS_TO_DEGREES[direction];
                console.log(`Rendering wind barb for ${stationName}: speed_knots=${speed_knots}, direction=${direction}`);
                const icon = L.WindBarb.icon({
                    lat: latlng.lat,
                    deg: degrees,
                    speed: speed_knots,
                    pointRadius: 5,
                    strokeLength: 20
                });
                return L.marker(latlng, { icon: icon });
            } else {
                // Temperature, Humidity, Rainfall: Show only the reading
                const value = feature.properties.value;
                if (value === null || isNaN(value)) {
                    console.warn(`Invalid value for ${stationName}: ${value}`);
                    return null;
                }
                const label = weatherElement === 'humidity' ? `${value}%` :
                              weatherElement === 'rainfall' ? `${value} mm` :
                              `${value}°C`;
                return L.marker(latlng, {
                    icon: L.divIcon({
                        html: `<div style="font-size: 14px; font-weight: bold; color: black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;">${label}</div>`,
                        className: '',
                        iconSize: [50, 20],
                        iconAnchor: [25, 10]
                    })
                });
            }
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.AutomaticWeatherStation_en) {
                const stationName = feature.properties.AutomaticWeatherStation_en;
                layer.bindPopup(() => {
                    if (weatherElement === 'wind') {
                        const direction = feature.properties.direction;
                        const speed_kmh = feature.properties.speed_kmh;
                        if (direction === 'Variable') return `${stationName}: Variable direction`;
                        if (direction === 'Calm') return `${stationName}: Calm`;
                        if (speed_kmh === null || isNaN(speed_kmh)) return `${stationName}: Missing speed`;
                        return `${stationName}: ${direction}, ${speed_kmh.toFixed(1)} km/h`;
                    } else {
                        const value = feature.properties.value;
                        return `${stationName}: ${weatherElement === 'humidity' ? `${value}%` : weatherElement === 'rainfall' ? `${value} mm` : `${value}°C`}`;
                    }
                });
                layer.on('mouseover', () => {
                    layer.bindTooltip(stationName, {
                        offset: [0, -20],
                        direction: 'top'
                    }).openTooltip();
                });
                layer.on('mouseout', () => {
                    layer.closeTooltip();
                });
            }
        }
    }).addTo(map);
}

function createWarningMessageBar() {
    const warningBar = document.createElement('div');
    warningBar.className = 'warning-message-bar';
    const messageSpan = document.createElement('span');
    messageSpan.className = 'warning-message-text';
    warningBar.appendChild(messageSpan);
    warningBar.style.display = 'block';
    document.getElementById('map').appendChild(warningBar);

    async function updateWarningMessage() {
        try {
            const weatherData = await fetchWeatherData();
            const message = weatherData.warningMessage || 'There is no weather warning in force.';
            messageSpan.textContent = message;
            warningBar.style.backgroundColor = weatherData.warningMessage ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 128, 0, 0.8)';
        } catch (error) {
            console.error('Failed to fetch warning message:', error);
            messageSpan.textContent = 'Failed to fetch weather data.';
            warningBar.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
        }
    }

    updateWarningMessage();
    setInterval(updateWarningMessage, 300000); // 5 minutes
}

function createWeatherBox() {
    const weatherBox = document.createElement('div');
    weatherBox.className = 'weather-box';
    const title = document.createElement('div');
    title.className = 'weather-title';
    title.textContent = 'Current Weather';
    const weatherIcon = document.createElement('img');
    weatherIcon.className = 'weather-icon';
    const divider = document.createElement('hr');
    divider.className = 'weather-divider';
    const warningIconsContainer = document.createElement('div');
    warningIconsContainer.className = 'warning-icons';
    const timeUpdate = document.createElement('div');
    timeUpdate.className = 'weather-time';
    
    async function updateWeather() {
        try {
            const weatherData = await fetchWeatherData();
            const warningData = await fetchWarningData();
            
            // Update weather icon
            const iconValue = weatherData.icon && weatherData.icon[0];
            if (iconValue) {
                weatherIcon.src = `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${iconValue}.png`;
            }
            
            // Update warning icons
            warningIconsContainer.innerHTML = ''; // Clear previous icons
            if (warningData && Object.keys(warningData).length > 0) {
                Object.keys(warningData).forEach(code => {
                    if (WARNING_ICONS[code] && code !== 'CANCEL') {
                        const warningIcon = document.createElement('img');
                        warningIcon.src = WARNING_ICONS[code];
                        warningIcon.className = 'warning-icon';
                        warningIconsContainer.appendChild(warningIcon);
                    }
                });
            }
            
            // Update time
            if (weatherData.temperature && weatherData.temperature.recordTime) {
                const date = new Date(weatherData.temperature.recordTime);
                const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true };
                timeUpdate.textContent = `Updated: ${date.toLocaleString('en-US', options).replace(',', '')}`;
            }
        } catch (error) {
            console.error('Failed to update weather box:', error);
        }
    }
    
    updateWeather();
    setInterval(updateWeather, 60000);
    
    weatherBox.appendChild(title);
    weatherBox.appendChild(weatherIcon);
    weatherBox.appendChild(divider);
    weatherBox.appendChild(warningIconsContainer);
    weatherBox.appendChild(timeUpdate);
    document.getElementById('map').appendChild(weatherBox);
}

function createWeatherForecast() {
    const weatherFBox = document.createElement('div');
    weatherFBox.className = 'weather-forecast-box';
    const title = document.createElement('div');
    title.className = 'weather-forecast-title';
    title.textContent = 'Weather Forecast';
    const toggleButton = document.createElement('div');
    toggleButton.className = 'toggle-button';
    toggleButton.textContent = '>';
    
    async function updateWeatherForecast() {
        try {
            const weatherFData = await fetchWeatherForecast();
            const forecastList = document.createElement('ul');
            forecastList.className = 'weather-forecast-list';
            weatherFData.weatherForecast.slice(0, 7).forEach(forecast => {
                const listItem = document.createElement('li');
                listItem.className = 'weather-forecast-item';
                const forecastDate = document.createElement('div');
                forecastDate.className = 'forecast-date';
                forecastDate.innerHTML = formatForecastDate(forecast.forecastDate);
                const forecastIcon = document.createElement('img');
                forecastIcon.className = 'forecast-icon';
                forecastIcon.src = `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${forecast.ForecastIcon}.png`;
                const forecastTemps = document.createElement('div');
                forecastTemps.className = 'forecast-temps';
                forecastTemps.innerHTML = `Max: ${forecast.forecastMaxtemp.value}°C<br>Min: ${forecast.forecastMintemp.value}°C`;
                listItem.appendChild(forecastDate);
                listItem.appendChild(forecastIcon);
                listItem.appendChild(forecastTemps);
                forecastList.appendChild(listItem);
            });
            weatherFBox.innerHTML = '';
            weatherFBox.appendChild(title);
            weatherFBox.appendChild(forecastList);
        } catch (error) {
            console.error('Failed to update forecast:', error);
        }
    }
    
    function formatForecastDate(forecastDate) {
        const year = forecastDate.substring(0, 4);
        const month = forecastDate.substring(4, 6);
        const day = forecastDate.substring(6, 8);
        const date = new Date(year, month - 1, day);
        const options = { weekday: 'short' };
        const dayOfWeek = new Intl.DateTimeFormat('en-US', options).format(date);
        return `${day}/${month}<span style="font-size: 12px;">(${dayOfWeek})</span>`;
    }
    
    toggleButton.addEventListener('click', () => {
        if (weatherFBox.style.display === 'none') {
            weatherFBox.style.display = 'block';
            toggleButton.textContent = '>';
        } else {
            weatherFBox.style.display = 'none';
            toggleButton.textContent = '<';
        }
    });
    
    updateWeatherForecast();
    document.getElementById('map').appendChild(weatherFBox);
    document.getElementById('map').appendChild(toggleButton);
}

function createWeatherSelector() {
    const selectorDiv = document.createElement('div');
    selectorDiv.className = 'weather-selector';
    const title = document.createElement('div');
    title.className = 'weather-selector-title';
    title.textContent = 'Weather Element:';
    const select = document.createElement('select');
    select.innerHTML = `
        <option value="temperature">Temperature</option>
        <option value="humidity">Relative Humidity</option>
        <option value="rainfall">Rainfall (mm)</option>
        <option value="wind">Wind</option>
    `;
    select.addEventListener('change', (e) => {
        const weatherElement = e.target.value;
        addWeatherStationsLayer(weatherElement);
    });
    selectorDiv.appendChild(title);
    selectorDiv.appendChild(select);
    document.getElementById('map').appendChild(selectorDiv);
}

document.addEventListener('DOMContentLoaded', () => {
    const weatherElement = 'temperature';
    addWeatherStationsLayer(weatherElement);
    createWarningMessageBar();
    createWeatherBox();
    createWeatherForecast();
    createWeatherSelector();

    // Add geolocation control below zoom
    L.control.locate({
        position: 'topright',
        strings: { title: 'My Location' },
        setView: 'untilPanOrZoom'
    }).addTo(map);

    // Add home control below geolocation
    L.control.home = L.Control.extend({
        options: {
            position: 'topright'
        },
        onAdd: function(map) {
            const container = L.DomUtil.create('a', 'leaflet-control-home');
            container.href = '#';
            container.title = 'Home';
            container.onclick = (e) => {
                e.preventDefault();
                map.setView(HONG_KONG_CENTER, 11);
            };
            return container;
        }
    });
    new L.control.home().addTo(map);
});

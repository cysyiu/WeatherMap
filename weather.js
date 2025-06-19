const HONG_KONG_CENTER = [114.1095, 22.3964];
const RAINFALL_RANGES = [0, 20, 40, 60, 80, 100];

// Map compass points to degrees (clockwise from North = 0°)
const COMPASS_TO_DEGREES = {
    'North': 0, 'Northeast': 45, 'East': 90, 'Southeast': 135,
    'South': 180, 'Southwest': 225, 'West': 270, 'Northwest': 315
};

async function fetchWeatherData() {
    try {
        const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        console.log('Weather API Response:', data); // Debug: Log the full API response
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

async function fetchWeatherStations(weatherElement) {
    try {
        let geojsonFile;
        if (weatherElement === 'humidity') geojsonFile = 'Data/latest_humidity.geojson';
        else if (weatherElement === 'wind') geojsonFile = 'Data/latest_wind.geojson';
        else geojsonFile = 'Data/latest_temperature.geojson';
        const response = await fetch(geojsonFile);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const geojson = await response.json();
        const features = await Promise.all(geojson.features.map(async (feature) => {
            const csvUrl = feature.properties.Data_url;
            try {
                const csvResponse = await fetch(csvUrl);
                if (!csvResponse.ok) throw new Error(`HTTP error! Status: ${csvResponse.status}`);
                const csvText = await csvResponse.text();
                const lines = csvText.split('\n').filter(line => line.trim() !== '');
                const headers = lines[0].split(',').map(header => header.trim());
                if (weatherElement === 'wind') {
                    const dirIndex = headers.indexOf('10-Minute Mean Wind Direction(Compass points)');
                    const speedIndex = headers.indexOf('10-Minute Mean Speed(km/hour)');
                    const gustIndex = headers.indexOf('10-Minute Maximum Gust(km/hour)');
                    if (dirIndex === -1 || speedIndex === -1 || gustIndex === -1) {
                        throw new Error('Wind columns not found in CSV');
                    }
                    const data = lines[1].split(',').map(value => value.trim());
                    feature.properties.direction = data[dirIndex];
                    feature.properties.speed_kmh = parseFloat(data[speedIndex]); // Store in km/h for display
                    feature.properties.speed_ms = feature.properties.speed_kmh * 0.277778; // Convert to m/s for getWindBarb
                    feature.properties.gust = parseFloat(data[gustIndex]);
                } else {
                    const valueIndex = weatherElement === 'humidity' ? 
                        headers.indexOf('Relative Humidity(percent)') : 
                        headers.indexOf('Air Temperature(degree Celsius)');
                    if (valueIndex === -1) throw new Error(`${weatherElement === 'humidity' ? 'Relative Humidity(%)' : 'Air Temperature(degree Celsius)'} column not found in CSV`);
                    const data = lines[1].split(',').map(value => value.trim());
                    feature.properties.value = parseFloat(data[valueIndex]);
                }
                return feature;
            } catch (error) {
                console.error(`Failed to fetch CSV for ${feature.properties.AutomaticWeatherStation_en}:`, error);
                if (weatherElement === 'wind') {
                    feature.properties.direction = null;
                    feature.properties.speed_kmh = null;
                    feature.properties.speed_ms = null;
                    feature.properties.gust = null;
                } else {
                    feature.properties.value = null;
                }
                return feature;
            }
        }));
        geojson.features = features.filter(feature => 
            weatherElement === 'wind' ? 
            (feature.properties.direction && feature.properties.speed_ms !== null && feature.properties.gust !== null) : 
            feature.properties.value !== null
        );
        return geojson;
    } catch (error) {
        console.error(`Failed to fetch ${weatherElement} stations:`, error);
        return { type: 'FeatureCollection', features: [] };
    }
}

function getRainfallColor(value) {
    const maxRainfall = 100;
    const minOpacity = 0;
    const opacity = Math.max(minOpacity, Math.min(value / maxRainfall, 1) * 0.7);
    return `rgba(0, 0, 255, ${opacity})`;
}

function getStationStyle(feature, weatherData, hover = false) {
    const stationName = feature.get('AutomaticWeatherStation_en');
    const weatherElement = document.querySelector('.weather-selector select').value;
    
    if (weatherElement === 'wind') {
        const direction = feature.get('direction');
        const speed_ms = feature.get('speed_ms');
        const gust = feature.get('gust');
        if (!direction || speed_ms === null || gust === null) {
            return new ol.style.Style({});
        }
        const degrees = COMPASS_TO_DEGREES[direction] || 0;
        const radians = degrees * Math.PI / 180;
        const svgPath = getWindBarb(speed_ms); // From GetWindBarb.js
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250">${svgPath}</svg>`;
        const svgUrl = 'data:image/svg+xml;base64,' + btoa(svg);
        return new ol.style.Style({
            image: new ol.style.Icon({
                src: svgUrl,
                scale: 0.1, // Adjust size to fit map
                rotation: radians,
                anchor: [0.5, 0.5] // Center at station
            }),
            text: new ol.style.Text({
                text: `${gust} km/h`,
                fill: new ol.style.Fill({ color: 'black' }),
                stroke: new ol.style.Stroke({ color: 'white', width: 3 }),
                font: 'bold 12px Arial',
                offsetY: -20 // Above the barb
            })
        });
    } else {
        const value = feature.get('value');
        if (!value) {
            return new ol.style.Style({});
        }
        return new ol.style.Style({
            image: new ol.style.Circle({
                radius: hover ? 6 : 4,
                fill: new ol.style.Fill({ color: hover ? 'red' : 'blue' }),
                stroke: new ol.style.Stroke({ color: 'white', width: 2 })
            }),
            text: new ol.style.Text({
                text: weatherElement === 'humidity' ? `${value}%` : `${value}°C`,
                fill: new ol.style.Fill({ color: 'black' }),
                stroke: new ol.style.Stroke({ color: 'white', width: 3 }),
                font: 'bold 14px Arial',
                offsetY: -10
            })
        });
    }
}

function getDistrictStyle(feature, weatherData) {
    const districtName = feature.get('ENAME').toUpperCase();
    const rainfallData = weatherData.rainfall.data.find(r => {
        const normalizedPlace = r.place.replace(' District', '').toUpperCase();
        return districtName === normalizedPlace;
    });
    
    let fillColor = 'rgba(0, 0, 255, 0.1)';
    if (rainfallData) {
        fillColor = getRainfallColor(rainfallData.max);
    }
    
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'blue',
            width: 1
        }),
        fill: new ol.style.Fill({
            color: fillColor
        })
    });
}

const map = new ol.Map({
    target: 'map',
    layers: [
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png'
            })
        }),
        new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png'
            })
        })
    ],
    view: new ol.View({
        center: ol.proj.fromLonLat(HONG_KONG_CENTER),
        zoom: 10.3
    }),
    controls: [
        new ol.control.Zoom(),
        new ol.control.Attribution(),
        new ol.control.Control({
            element: (() => {
                const button = document.createElement('button');
                button.className = 'ol-zoom-in ol-geocoder';
                button.title = 'My Location';
                const img = document.createElement('img');
                img.src = 'img/myLocation.png';
                img.alt = 'My Location';
                img.style.width = '20px';
                img.style.height = '20px';
                button.appendChild(img);
                button.onclick = () => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                            const coords = [position.coords.longitude, position.coords.latitude];
                            const transformedCoords = ol.proj.fromLonLat(coords);
                            const marker = new ol.Feature({
                                geometry: new ol.geom.Point(transformedCoords)
                            });
                            const iconStyle = new ol.style.Style({
                                image: new ol.style.Circle({
                                    radius: 6,
                                    fill: new ol.style.Fill({ color: 'red' }),
                                    stroke: new ol.style.Stroke({ color: 'white', width: 2 })
                                })
                            });
                            marker.setStyle(iconStyle);
                            const vectorSource = new ol.source.Vector({
                                features: [marker]
                            });
                            const vectorLayer = new ol.layer.Vector({
                                source: vectorSource,
                                zIndex: 50
                            });
                            map.getLayers().forEach(layer => {
                                if (layer.getSource() instanceof ol.source.Vector && layer !== districtLayer && layer !== stationLayer) {
                                    map.removeLayer(layer);
                                }
                            });
                            map.addLayer(vectorLayer);
                            map.getView().animate({
                                center: transformedCoords,
                                zoom: 15,
                                duration: 1500
                            });
                            setTimeout(() => {
                                map.removeLayer(vectorLayer);
                            }, 3000);
                        }, (error) => {
                            let message = 'Unable to retrieve your location.';
                            switch (error.code) {
                                case error.PERMISSION_DENIED:
                                    message = 'Location access denied. Please enable location permissions in your browser settings and try again.';
                                    break;
                                case error.POSITION_UNAVAILABLE:
                                    message = 'Location information is unavailable. Please check your device\'s location services.';
                                    break;
                                case error.TIMEOUT:
                                    message = 'The request to get your location timed out. Please try again.';
                                    break;
                                default:
                                    message = 'An unknown error occurred while retrieving your location.';
                                    break;
                            }
                            alert(message);
                            console.error('Error retrieving location: ', error);
                        });
                    } else {
                        alert('Geolocation is not supported by this browser. Please use a modern browser that supports geolocation.');
                    }
                };
                return button;
            })()
        }),
        new ol.control.Control({
            element: (() => {
                const button = document.createElement('button');
                button.className = 'ol-zoom-out ol-home';
                button.title = 'Home';
                const img = document.createElement('img');
                img.src = 'img/home.png';
                img.alt = 'Home';
                img.style.width = '20px';
                img.style.height = '20px';
                button.appendChild(img);
                button.onclick = () => {
                    map.getView().animate({
                        center: ol.proj.fromLonLat(HONG_KONG_CENTER),
                        zoom: 10.3,
                        duration: 1500
                    });
                };
                return button;
            })()
        })
    ]
});

let districtLayer, stationLayer;

async function initializeDistrictLayer(weatherElement) {
    if (districtLayer) {
        map.removeLayer(districtLayer);
    }
    const geojson = await fetch('https://services3.arcgis.com/6j1KwZfY2fZrfNMR/arcgis/rest/services/Hong_Kong_18_Districts/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson').then(res => res.json());
    const weatherData = await fetchWeatherData();
    const vectorSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(geojson, {
            featureProjection: 'EPSG:3857'
        })
    });
    districtLayer = new ol.layer.Vector({
        source: vectorSource,
        style: weatherElement === 'rainfall' ? (feature) => getDistrictStyle(feature, weatherData) : new ol.style.Style({}),
        zIndex: 1
    });
    map.addLayer(districtLayer);
}

async function addWeatherStationsLayer(weatherElement) {
    if (stationLayer) {
        map.removeLayer(stationLayer);
    }
    const stationsGeoJson = await fetchWeatherStations(weatherElement);
    const stationSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(stationsGeoJson, {
            featureProjection: 'EPSG:3857'
        })
    });
    stationLayer = new ol.layer.Vector({
        source: stationSource,
        style: (weatherElement === 'temperature' || weatherElement === 'humidity' || weatherElement === 'wind') ? 
            (feature) => getStationStyle(feature, null) : new ol.style.Style({}),
        zIndex: 2
    });
    map.addLayer(stationLayer);
}

function initializePopup() {
    const container = document.createElement('div');
    container.className = 'ol-popup';
    const closer = document.createElement('a');
    closer.className = 'ol-popup-closer';
    container.appendChild(closer);
    const content = document.createElement('div');
    container.appendChild(content);
    const popup = new ol.Overlay({
        element: container,
        autoPan: true,
        autoPanAnimation: {
            duration: 250
        }
    });
    closer.onclick = () => {
        popup.setPosition(undefined);
        closer.blur();
        return false;
    };
    return { popup, content };
}

function initializeHoverOverlay() {
    const container = document.createElement('div');
    container.className = 'ol-hover-popup';
    const content = document.createElement('div');
    content.className = 'ol-hover-content';
    container.appendChild(content);
    const overlay = new ol.Overlay({
        element: container,
        offset: [0, 10],
        positioning: 'top-center'
    });
    map.addOverlay(overlay);
    return { overlay, content };
}

function createWarningMessageBar() {
    const warningBar = document.createElement('div');
    warningBar.className = 'warning-message-bar';
    warningBar.style.display = 'block';
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Map element not found in DOM');
        return;
    }
    mapElement.appendChild(warningBar);

    async function updateWarningMessage() {
        const weatherData = await fetchWeatherData();
        if (typeof weatherData.warningMessage === 'string' && weatherData.warningMessage.trim() !== '') {
            warningBar.textContent = weatherData.warningMessage;
            warningBar.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        } else {
            warningBar.textContent = 'There is no warning in force';
            warningBar.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
        }
    }

    updateWarningMessage();
    setInterval(updateWarningMessage, 60000);
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
    const timeUpdate = document.createElement('div');
    timeUpdate.className = 'weather-time';
    
    async function updateWeather() {
        const weatherData = await fetchWeatherData();
        const iconValue = weatherData.icon[0];
        weatherIcon.src = `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${iconValue}.png`;
        if (weatherData.temperature && weatherData.temperature.recordTime) {
            const date = new Date(weatherData.temperature.recordTime);
            const options = {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };
            timeUpdate.textContent = `Updated: ${date.toLocaleString('en-US', options).replace(',', '')}`;
        }
    }
    
    updateWeather();
    setInterval(updateWeather, 60000);
    
    weatherBox.appendChild(title);
    weatherBox.appendChild(weatherIcon);
    weatherBox.appendChild(divider);
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
        weatherFBox.appendChild(title);
        weatherFBox.appendChild(forecastList);
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
        <option value="rainfall">Rainfall</option>
        <option value="wind">Wind</option>
    `;
    select.addEventListener('change', (e) => {
        const weatherElement = e.target.value;
        initializeDistrictLayer(weatherElement);
        addWeatherStationsLayer(weatherElement);
    });
    selectorDiv.appendChild(title);
    selectorDiv.appendChild(select);
    document.getElementById('map').appendChild(selectorDiv);
}

async function handleMapClick(evt, popupContent, popup, weatherElement) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        return {feature: feature, layer: layer};
    });
    
    if (feature) {
        if (feature.feature.get('ENAME') && weatherElement === 'rainfall') {
            const districtName = feature.feature.get('ENAME');
            const weatherData = await fetchWeatherData();
            const normalizedDistrictName = districtName.toUpperCase();
            const rainfallData = weatherData.rainfall.data.find(r => {
                const normalizedPlace = r.place.replace(' District', '').toUpperCase();
                return normalizedDistrictName === normalizedPlace;
            });
            const geometry = feature.feature.getGeometry();
            const center = ol.extent.getCenter(geometry.getExtent());
            if (rainfallData) {
                popupContent.innerHTML = `${districtName}: ${rainfallData.max} mm`;
                popup.setPosition(center);
            }
        } else if (feature.feature.get('AutomaticWeatherStation_en')) {
            const stationName = feature.feature.get('AutomaticWeatherStation_en');
            if (weatherElement === 'wind') {
                const direction = feature.feature.get('direction');
                const speed_kmh = feature.feature.get('speed_kmh');
                const gust = feature.feature.get('gust');
                if (direction && speed_kmh !== null && gust !== null) {
                    popupContent.innerHTML = `${stationName}: ${direction}, ${speed_kmh} km/h, Max Gust ${gust} km/h`;
                    popup.setPosition(evt.coordinate);
                }
            } else if (weatherElement === 'temperature' || weatherElement === 'humidity') {
                const value = feature.feature.get('value');
                if (value) {
                    popupContent.innerHTML = `${stationName}: ${weatherElement === 'humidity' ? `${value}%` : `${value}°C`}`;
                    popup.setPosition(evt.coordinate);
                }
            }
        }
    }
}

let cachedWeatherData = {};
async function updateCachedWeatherData() {
    try {
        cachedWeatherData = await fetchWeatherData();
    } catch (error) {
        console.error('Failed to update cached weather data:', error);
        cachedWeatherData = {};
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const weatherElement = 'temperature';
    initializeDistrictLayer(weatherElement);
    addWeatherStationsLayer(weatherElement);
    const { popup, content } = initializePopup();
    const { overlay: hoverOverlay, content: hoverContent } = initializeHoverOverlay();
    map.addOverlay(popup);
    createWarningMessageBar();
    createWeatherBox();
    createWeatherForecast();
    createWeatherSelector();
    
    map.on('click', (evt) => handleMapClick(evt, content, popup, document.querySelector('.weather-selector select').value));
    
    let lastHoveredFeature = null;
    
    updateCachedWeatherData();
    setInterval(updateCachedWeatherData, 60000);
    
    map.on('pointermove', (evt) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
            if (layer === stationLayer && feature.get('AutomaticWeatherStation_en')) {
                return feature;
            }
        });
        
        if (feature && (document.querySelector('.weather-selector select').value === 'temperature' || 
                        document.querySelector('.weather-selector select').value === 'humidity' || 
                        document.querySelector('.weather-selector select').value === 'wind')) {
            if (feature !== lastHoveredFeature) {
                const stationName = feature.get('AutomaticWeatherStation_en');
                if (stationName) {
                    hoverContent.innerHTML = stationName;
                    hoverOverlay.setPosition(evt.coordinate);
                }
                if (lastHoveredFeature) {
                    lastHoveredFeature.setStyle(getStationStyle(lastHoveredFeature, null, false));
                }
                feature.setStyle(getStationStyle(feature, null, true));
                lastHoveredFeature = feature;
            }
        } else {
            hoverOverlay.setPosition(undefined);
            if (lastHoveredFeature) {
                lastHoveredFeature.setStyle(getStationStyle(lastHoveredFeature, null, false));
                lastHoveredFeature = null;
            }
        }
    });
});

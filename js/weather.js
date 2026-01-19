// Map compass points to degrees (clockwise from North = 0°)
const HONG_KONG_CENTER = [22.3964, 114.1095]; // [lat, lng] for Leaflet

let currentWeatherElement = 'temperature';

const COMPASS_TO_DEGREES = {
    'North': 360, 'Northeast': 45, 'East': 90, 'Southeast': 135,
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
        //console.log('Weather API Response:', data);
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
        //console.log('Warning API Response:', data);
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

        const geoResponse = await fetch(geojsonFile);
        if (!geoResponse.ok) throw new Error(`GeoJSON fetch failed: ${geoResponse.status}`);
        const geojson = await geoResponse.json();

        const dataResponse = await fetch(`http://35.212.228.195/weather/${weatherElement}.json`);
        if (!dataResponse.ok) throw new Error(`Data fetch failed: ${dataResponse.status}`);
        const allData = await dataResponse.json();

        const features = geojson.features.map(feature => {
            // Determine station key based on element (matching logic you provided)
            let stationKey;
            if (weatherElement === 'rainfall') {
                stationKey = feature.properties.automaticWeatherStationID;
            } else {
                stationKey = feature.properties.AutomaticWeatherStation_en;
            }

            if (!stationKey) return null;

            const stationData = allData.filter(d => d.station === stationKey);
            if (stationData.length === 0) return null;

            // Sort by observation time (ascending for chart)
            stationData.sort((a, b) => new Date(a.observation_time_hk) - new Date(b.observation_time_hk));

            const latest = stationData[stationData.length - 1]; // Latest = last after ascending sort

            // Extract values according to actual JSON structure
            if (weatherElement === 'wind') {
                feature.properties.direction = latest.wind_dir || null;
                feature.properties.speed_kmh = parseFloat(latest.wind_speed_kmh) || null;
                feature.properties.speed_knots = 
                    (feature.properties.speed_kmh !== null && !isNaN(feature.properties.speed_kmh))
                    ? feature.properties.speed_kmh / 1.852
                    : null;
            } else {
                let rawValue;
                if (weatherElement === 'temperature')      rawValue = latest.temperature;
                else if (weatherElement === 'humidity')    rawValue = latest.rel_humidity_pct;
                else if (weatherElement === 'rainfall')    rawValue = latest.rainfall_mm;

                feature.properties.value = parseFloat(rawValue);
                if (isNaN(feature.properties.value)) feature.properties.value = null;
            }

            feature.properties.allData = stationData; // Keep full sorted history for chart
            return feature;
        }).filter(f => f !== null);

        // Improved filtering - keep stations with valid latest data
        geojson.features = features.filter(feature => {
            if (weatherElement === 'wind') {
                return feature.properties.direction !== null && 
                       feature.properties.speed_knots !== null && 
                       !isNaN(feature.properties.speed_knots);
            } else {
                return feature.properties.value !== null && !isNaN(feature.properties.value);
            }
        });

        console.log(`Loaded ${geojson.features.length} valid ${weatherElement} stations`);
        return geojson;

    } catch (error) {
        console.error(`Failed to load ${weatherElement} data:`, error);
        return { type: 'FeatureCollection', features: [] };
    }
}

const map = L.map('map', {
    zoomControl: true
}).setView(HONG_KONG_CENTER, 11);
map.zoomControl.setPosition('topright');
L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/wgs84/{z}/{x}/{y}.png', {
    attribution: '© Hong Kong Observatory',
    maxZoom: 18
}).addTo(map);
L.tileLayer('https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/label/hk/en/wgs84/{z}/{x}/{y}.png', {
    maxZoom: 18
}).addTo(map);

let stationLayer;

if (typeof L.WindBarb === 'undefined') {
    console.error('Leaflet.windbarb plugin is not loaded. Please ensure js/leaflet-windbarb.js is included.');
}

async function addWeatherStationsLayer(weatherElement) {
    if (stationLayer) {
        map.removeLayer(stationLayer);
    }
    const stationsGeoJson = await fetchWeatherStations(weatherElement);
    //console.log(`Adding ${weatherElement} layer with ${stationsGeoJson.features.length} features`);
    stationLayer = L.geoJSON(stationsGeoJson, {
        pointToLayer: (feature, latlng) => {
            const stationName = feature.properties.AutomaticWeatherStation_en;
            if (weatherElement === 'wind') {
                const direction = feature.properties.direction;
                const speed_knots = feature.properties.speed_knots;
                if (speed_knots === null || isNaN(speed_knots)) {
                    //console.log(`NaN speed for ${stationName}, showing 'M'`);
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: '<div style="font-size: 14px; font-weight: bold; color: black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;">M</div>',
                            className: '',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    });
                }
                if (direction === 'Variable') {
                    //console.log(`Variable direction for ${stationName}, showing 'VRB'`);
                    return L.marker(latlng, {
                        icon: L.divIcon({
                            html: '<div style="font-size: 14px; font-weight: bold; color: black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;">VRB</div>',
                            className: '',
                            iconSize: [30, 20],
                            iconAnchor: [15, 10]
                        })
                    });
                }
                if (typeof L.WindBarb === 'undefined') {
                    console.warn(`WindBarb plugin not available for ${stationName}, using fallback marker`);
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: 'red',
                        fillOpacity: 1,
                        stroke: false
                    });
                }
                if (direction === 'Calm') {
                    //console.log(`Calm direction for ${stationName}, showing 0-speed wind barb`);
                    const icon = L.WindBarb.icon({
                        lat: latlng.lat,
                        deg: 0,
                        speed: 0,
                        pointRadius: 5,
                        strokeLength: 20
                    });
                    return L.marker(latlng, { icon: icon });
                }
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
                //console.log(`Rendering wind barb for ${stationName}: speed_knots=${speed_knots}, direction=${direction}`);
                const icon = L.WindBarb.icon({
                    lat: latlng.lat,
                    deg: degrees,
                    speed: speed_knots,
                    pointRadius: 5,
                    strokeLength: 20
                });
                return L.marker(latlng, { icon: icon });
            } else {
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

				layer.bindPopup('', { minWidth: 420 });

				layer.on('popupopen', (e) => {
					const popupContent = e.popup._contentNode;
					popupContent.innerHTML = '<div id="chart-container" style="width:100%; height:340px;"></div>';

					const allDataSorted = feature.properties.allData; // already sorted ascending

					// Convert observation_time_hk to milliseconds (Highcharts needs this)
					const times = allDataSorted.map(d => {
						const date = new Date(d.observation_time_hk);
						return isNaN(date.getTime()) ? null : date.getTime();
					});

					let series = [];
					let yAxisTitle = '';
					let tooltipExtra = null;

					if (currentWeatherElement === 'wind') {
						const speeds = allDataSorted.map(d => {
							const val = parseFloat(d.wind_speed_kmh);
							return isNaN(val) ? null : val;
						});

						series = [{
							name: 'Wind Speed (km/h)',
							data: times.map((t, i) => t !== null ? [t, speeds[i]] : null).filter(Boolean),
							color: '#1e88e5',
							marker: { enabled: true, radius: 4 }
						}];

						yAxisTitle = 'Wind Speed (km/h)';

						tooltipExtra = function () {
							const dir = allDataSorted[this.index]?.wind_dir || 'N/A';
							return `<br/>Direction: <b>${dir}</b>`;
						};
					} else {
						let valueField, unit, name, color;

						switch (currentWeatherElement) {
							case 'temperature':
								valueField = 'temperature';
								unit = '°C';
								name = 'Temperature';
								color = '#ff7043';
								break;
							case 'humidity':
								valueField = 'rel_humidity_pct';
								unit = '%';
								name = 'Relative Humidity';
								color = '#42a5f5';
								break;
							case 'rainfall':
								valueField = 'rainfall_mm';
								unit = 'mm';
								name = 'Rainfall';
								color = '#26a69a';
								break;
						}

						const values = allDataSorted.map(d => {
							const val = parseFloat(d[valueField]);
							return isNaN(val) ? null : val;
						});

						series = [{
							name: `${name} (${unit})`,
							data: times.map((t, i) => t !== null ? [t, values[i]] : null).filter(Boolean),
							color: color,
							marker: { enabled: true, radius: 4 }
						}];

						yAxisTitle = `${name} (${unit})`;
					}

					Highcharts.chart('chart-container', {
						chart: {
							type: 'line',
							zoomType: 'x',
							panning: true,
							panKey: 'shift',
							spacingBottom: 15
						},
						title: {
							text: `${stationName} – Last 12 Hours`
						},
						xAxis: {
							type: 'datetime',
							title: { text: 'Time (HKT)' },
							dateTimeLabelFormats: {
								millisecond: '%H:%M:%S',
								second: '%H:%M:%S',
								minute: '%H:%M',
								hour: '%H:%M',
								day: '%e %b %H:%M',
								week: '%e %b',
								month: '%b \'%y',
								year: '%Y'
							},
							crosshair: true
						},
						yAxis: {
							title: { text: yAxisTitle },
							min: currentWeatherElement === 'humidity' ? 0 : undefined,
							max: currentWeatherElement === 'humidity' ? 100 : undefined,
							gridLineDashStyle: 'dash'
						},
						tooltip: {
							shared: true,
							crosshairs: true,
							xDateFormat: '%Y-%m-%d %H:%M', // Clean display: 2026-01-19 14:45
							pointFormat: '<span style="color:{point.color}">\u25CF</span> <b>{point.y}</b>' +
										 (tooltipExtra ? tooltipExtra.call(this) : '')
						},
						series: series,
						credits: { enabled: false },
						legend: { enabled: false },
						exporting: { enabled: false }
					});
				});

				layer.on('mouseover', () => {
					layer.bindTooltip(stationName, { offset: [0, -25], direction: 'top' }).openTooltip();
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

    // Create warning label (we'll control its visibility)
    const warningLabel = document.createElement('div');
    warningLabel.className = 'warning-label';
    warningLabel.textContent = 'Warning Signal';

    const warningIconsContainer = document.createElement('div');
    warningIconsContainer.className = 'warning-icons';

    const timeUpdate = document.createElement('div');
    timeUpdate.className = 'weather-time';

    async function updateWeather() {
        try {
            const weatherData = await fetchWeatherData();
            const warningData = await fetchWarningData();

            // Weather icon
            const iconValue = weatherData.icon && weatherData.icon[0];
            weatherIcon.src = iconValue 
                ? `https://www.hko.gov.hk/images/HKOWxIconOutline/pic${iconValue}.png`
                : '';

            // Warning icons & label visibility
            warningIconsContainer.innerHTML = '';

            const hasWarnings = warningData && Object.keys(warningData).length > 0;

            // Only show label if there are active warnings
            warningLabel.style.display = hasWarnings ? 'block' : 'none';

            if (hasWarnings) {
                Object.entries(warningData).forEach(([key, warning]) => {
                    const code = warning.code || key;
                    if (WARNING_ICONS[code] && code !== 'CANCEL') {
                        const img = document.createElement('img');
                        img.src = WARNING_ICONS[code];
                        img.className = 'warning-icon';
                        img.title = warning.name || code;
                        img.onerror = () => console.error(`Failed to load warning icon: ${code}`);
                        warningIconsContainer.appendChild(img);
                    }
                });
            }

            // Timestamp logic remains the same...
            let updateTimeText = 'Updated: —';

			try {
				const resp = await fetch(`http://35.212.228.195/weather/${currentWeatherElement}.json`);
				if (resp.ok) {
					const jsonData = await resp.json();
					let latestTime = new Date(0);
					jsonData.forEach(d => {
						const t = new Date(d.observation_time_hk);
						if (!isNaN(t.getTime()) && t > latestTime) {
							latestTime = t;
						}
					});
					if (latestTime > new Date(0)) {
						const options = { 
							day: 'numeric', 
							month: 'short', 
							hour: '2-digit', 
							minute: '2-digit', 
							hour12: true 
						};
						updateTimeText = `Updated: ${latestTime.toLocaleString('en-US', options).replace(',', '')}`;
					}
				}
			} catch (err) {
				console.warn(`Could not get timestamp for ${currentWeatherElement}:`, err);
				// Fallback: try to use rhrread temperature time
				if (weatherData.temperature && weatherData.temperature.recordTime) {
					const fallback = new Date(weatherData.temperature.recordTime);
					if (!isNaN(fallback.getTime())) {
						const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true };
						updateTimeText = `Updated: ${fallback.toLocaleString('en-US', options).replace(',', '')}`;
					}
				}
			}

			timeUpdate.textContent = updateTimeText;

        } catch (error) {
            console.error('Failed to update weather box:', error);
            timeUpdate.textContent = 'Updated: —';
            warningLabel.style.display = 'none'; // hide on error too
        }
    }

    window.updateWeather = updateWeather;
    updateWeather();
    setInterval(updateWeather, 60000);

    // Append elements
    weatherBox.appendChild(title);
    weatherBox.appendChild(weatherIcon);
    weatherBox.appendChild(divider);
    weatherBox.appendChild(warningLabel);           // ← conditional visibility
    weatherBox.appendChild(warningIconsContainer);
    weatherBox.appendChild(timeUpdate);

    document.getElementById('map').appendChild(weatherBox);
}

function updateLayout() {
    const isMobile = window.innerWidth <= 600;
    const weatherBox = document.querySelector('.weather-box');
    const warningBar = document.querySelector('.warning-message-bar');
    const mapContainer = document.getElementById('map');
    const weatherFBox = document.querySelector('.weather-forecast-box');
    const weatherFTitle = document.querySelector('.weather-forecast-title');
    const weatherSelector = document.querySelector('.weather-selector');

    if (!weatherBox || !warningBar || !mapContainer || !weatherFBox || !weatherFTitle || !weatherSelector) {
        console.error('One or more elements not found:', { weatherBox, warningBar, mapContainer, weatherFBox, weatherFTitle, weatherSelector });
        return;
    }

    if (isMobile) {
        const weatherBoxHeight = weatherBox.offsetHeight || 80;
        const warningBarHeight = warningBar.offsetHeight || 40;
        const weatherFTitleHeight = weatherFTitle.offsetHeight || 30;
        const weatherFBoxHeight = weatherFBox.offsetHeight || 100;

        warningBar.style.top = `${weatherBoxHeight}px`;
        mapContainer.style.top = `${weatherBoxHeight + warningBarHeight}px`;
        
        if (weatherFBox.classList.contains('collapsed')) {
            mapContainer.style.bottom = `${weatherFTitleHeight}px`;
            weatherSelector.style.bottom = `${weatherFTitleHeight}px`;
        } else {
            mapContainer.style.bottom = `${weatherFBoxHeight}px`;
            weatherSelector.style.bottom = `${weatherFBoxHeight}px`;
        }

        const mapHeight = window.innerHeight - (weatherBoxHeight + warningBarHeight + (weatherFBox.classList.contains('collapsed') ? weatherFTitleHeight : weatherFBoxHeight));
        //console.log(`Mobile Map Layout: top=${weatherBoxHeight + warningBarHeight}px, bottom=${weatherFBox.classList.contains('collapsed') ? weatherFTitleHeight : weatherFBoxHeight}px, calculated height=${mapHeight}px`);
        if (mapHeight <= 0) {
            console.warn('Map height is non-positive, setting minimum height');
            mapContainer.style.height = '200px';
        } else {
            mapContainer.style.height = 'auto';
        }
    } else {
        const weatherFBoxHeight = weatherFBox.offsetHeight || 100;
        const weatherFTitleHeight = weatherFTitle.offsetHeight || 30;
        if (weatherFBox.classList.contains('collapsed')) {
            mapContainer.style.bottom = `${weatherFTitleHeight}px`;
        } else {
            mapContainer.style.bottom = `${weatherFBoxHeight}px`;
        }
        mapContainer.style.top = '0';
        mapContainer.style.height = '97vh';
    }

    setTimeout(() => {
        map.invalidateSize();
        //console.log('Map invalidated size');
    }, 100);
}

function createWeatherForecast() {
    const weatherFBox = document.createElement('div');
    weatherFBox.className = 'weather-forecast-box';
    const title = document.createElement('div');
    title.className = 'weather-forecast-title';
    title.textContent = 'Weather Forecast';
    
    weatherFBox.addEventListener('touchstart', (e) => {
        if (e.target === title) return; // Allow clicks on title, prevent map interaction otherwise
        e.stopPropagation();
    }, { passive: false });
    weatherFBox.addEventListener('touchmove', (e) => {
        if (e.target === title) return;
        e.stopPropagation();
    }, { passive: false });
    
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
            updateLayout();
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
    
    title.addEventListener('click', () => {
        if (weatherFBox.classList.contains('collapsed')) {
            weatherFBox.classList.remove('collapsed');
        } else {
            weatherFBox.classList.add('collapsed');
        }
        updateLayout();
    });
    
    if (window.innerWidth <= 600) {
        weatherFBox.classList.add('collapsed');
    } else {
        weatherFBox.classList.remove('collapsed');
    }
    
    updateWeatherForecast();
    document.getElementById('map').appendChild(weatherFBox);
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
        currentWeatherElement = e.target.value;
        addWeatherStationsLayer(currentWeatherElement)
            .then(() => {
                if (window.updateWeather) {
                    window.updateWeather();  // Refresh timestamp for new element
                }
            })
            .catch(error => console.error('Failed to update layer or weather box:', error));
    });
    selectorDiv.appendChild(title);
    selectorDiv.appendChild(select);
    document.getElementById('map').appendChild(selectorDiv);
}

document.addEventListener('DOMContentLoaded', async () => {
    const weatherElement = 'temperature';
    await addWeatherStationsLayer(weatherElement);
    createWarningMessageBar();
    createWeatherBox();
    createWeatherForecast();
    createWeatherSelector();

    L.control.locate({
        position: 'topright',
        strings: { title: 'My Location' },
        setView: 'untilPanOrZoom'
    }).addTo(map);

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

    setTimeout(() => {
        updateLayout();
        //console.log('Initial map layout applied');
    }, 100);
});

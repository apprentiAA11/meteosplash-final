
/* ==========================================================================
   🔧 PATCH STABILITÉ – AJOUTÉ AUTOMATIQUEMENT
   But :
   - éviter tout crash JS silencieux
   - garantir que tous les boutons restent actifs
   ========================================================================== */

/* --- Heure locale ville (SAFE) --- */
let cityTimeOffsetMinutes = 0;

function getCityLocalDate() {
  const now = new Date();
  return new Date(now.getTime() + cityTimeOffsetMinutes * 60000);
}

function updateCityTimeAndTheme() {
  try {
    applyTheme();
  } catch (e) {
    console.warn("applyTheme indisponible", e);
  }
}

/* --- Sécurité DOMContentLoaded (anti double init) --- */
if (!window.__meteosplashInitBound__) {
  window.__meteosplashInitBound__ = true;
} else {
  console.warn("Init déjà exécuté – évité");
}


/* ==========================================================================
   Météo Splash – Script v4.6
   Version INTERMEDIAIRE (stabilité maximale)
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. SELECTEURS + ÉTATS GLOBAUX
--------------------------------------------------------------------------- */

const cityInput = document.getElementById("city-input");
const autocompleteList = document.getElementById("autocomplete-list");

const btnGeolocate = document.getElementById("btn-geolocate");
const btnSpeak = document.getElementById("btn-speak");
const btnThemeToggle = document.getElementById("btn-theme-toggle");
const btnRadar = document.getElementById("btn-radar");
const toast = document.getElementById("toast");

const radarOverlay = document.getElementById("radar-overlay");
const btnCloseRadar = document.getElementById("btn-close-radar");
const radarTabRain = document.getElementById("radar-tab-rain");
const radarTabWind = document.getElementById("radar-tab-wind");
const radarTabTemp = document.getElementById("radar-tab-temp");
const radarWindowText = document.getElementById("radar-window-text");
const radarPlay = document.getElementById("radar-play");
const radarGrid = document.getElementById("radar-grid");
const radarTimelineSlider = document.getElementById("radar-timeline-slider");
const radarModeToggle = document.getElementById("radar-mode-toggle");

const cityList = document.getElementById("city-list");
const btnReset = document.getElementById("btn-reset");
const sortSelect = document.getElementById("sort-select");

const detailsTitle = document.getElementById("details-title");
const detailsSubtitle = document.getElementById("details-subtitle");
const detailsCurrent = document.getElementById("details-current");
const detailsHistory = document.getElementById("details-history");
const btnHistory = document.getElementById("btn-history");

const windCompass = document.getElementById("wind-compass");
const windArrow = windCompass ? windCompass.querySelector(".compass-arrow") : null;
const windLineMain = document.getElementById("wind-line-main");
const windLineSub = document.getElementById("wind-line-sub");

const detailsTip = document.getElementById("details-tip");

const forecastList = document.getElementById("forecast-list");
const dayOverlay = document.getElementById("day-overlay");
const btnCloseDay = document.getElementById("btn-close-day");
const dayOverlayTitle = document.getElementById("day-overlay-title");
const dayOverlaySubtitle = document.getElementById("day-overlay-subtitle");
const chartTemp = document.getElementById("chart-temp");
const chartRain = document.getElementById("chart-rain");
const chartWind = document.getElementById("chart-wind");
const chartHumidity = document.getElementById("chart-humidity");

const dayTabTemp = document.getElementById("day-tab-temp");
const dayTabRain = document.getElementById("day-tab-rain");
const dayTabWind = document.getElementById("day-tab-wind");
const dayTabHumidity = document.getElementById("day-tab-humidity");
const dayGraphTemp = document.getElementById("chart-temp");
const dayGraphRain = document.getElementById("chart-rain");
const dayGraphWind = document.getElementById("chart-wind");
const dayGraphHumidity = document.getElementById("chart-humidity");

const btnForecast7 = document.getElementById("btn-forecast-7");
const btnForecast14 = document.getElementById("btn-forecast-14");

let selectedCity = null;
let weatherCache = {};
let cities = [];
let lastForecastData = null;
let currentDaySeries = null;

/* --------------------------------------------------------------------------
   2. UTILITAIRES
-------------------------------------------------------------------------- */

function degreeToCardinal(angle) {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round((angle % 360) / 45) % 8;
  return directions[index];
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { weekday: "short" });
}

function selectCityByIndex(idx) {
  if (idx >= 0 && idx < cities.length) {
    loadCityWeather(cities[idx]);
  }
}

function updateTip(j) {
  if (!detailsTip) return;

  if (!selectedCity || !j) {
    detailsTip.textContent = "Ajoute une ville ou active la géolocalisation.";
    return;
  }

  const c = j.current;
  let tip = "";

  if (c.temperature_2m <= 0) {
    tip = "Pense à bien te couvrir, il gèle aujourd’hui.";
  } else if (c.rain > 0 || c.precipitation > 0) {
    tip = "Prends un parapluie avant de sortir.";
  } else if (c.wind_speed_10m >= 40) {
    tip = "Le vent souffle fort, garde un œil sur ton parapluie.";
  } else if (c.temperature_2m >= 28) {
    tip = "Bois beaucoup d’eau, il fait très chaud aujourd’hui.";
  } else {
    tip = "Journée plutôt calme côté météo.";
  }

  detailsTip.textContent = tip;
}

/* --------------------------------------------------------------------------
   3. FOND ANIMÉ SELON MÉTÉO
-------------------------------------------------------------------------- */

let themeMode = "auto"; // "auto" | "day" | "night"

function applyWeatherBackground(code) {
  const body = document.body;

  if (code === null) {
    body.classList.remove(
      "weather-clear",
      "weather-cloudy",
      "weather-rain",
      "weather-snow",
      "weather-storm"
    );
    return;
  }

  let cls = "";

  if (code === 0) cls = "weather-clear";
  else if ([1, 2, 3].includes(code)) cls = "weather-cloudy";
  else if ([45, 48].includes(code)) cls = "weather-cloudy";
  else if ([51, 53, 55, 56, 57].includes(code)) cls = "weather-rain";
  else if ([61, 63, 65, 66, 67].includes(code)) cls = "weather-rain";
  else if ([71, 73, 75, 77].includes(code)) cls = "weather-snow";
  else if ([80, 81, 82].includes(code)) cls = "weather-rain";
  else if ([95, 96, 99].includes(code)) cls = "weather-storm";

  if (themeMode !== "auto") {
    return;
  }

  const hour = getCityLocalDate().getHours();
  const baseTheme = hour >= 18 || hour < 7 ? "theme-night" : "theme-day";

  body.className = `${baseTheme} ${cls}`;
}

/* --------------------------------------------------------------------------
   4. THÈME JOUR / NUIT / AUTO
-------------------------------------------------------------------------- */

function applyTheme() {
  const body = document.body;

  if (themeMode === "auto") {
    const hour = getCityLocalDate().getHours();
    const baseTheme = hour >= 18 || hour < 7 ? "theme-night" : "theme-day";

    if (
      !body.classList.contains("weather-clear") &&
      !body.classList.contains("weather-cloudy") &&
      !body.classList.contains("weather-rain") &&
      !body.classList.contains("weather-snow") &&
      !body.classList.contains("weather-storm")
    ) {
      body.className = baseTheme;
    } else {
      body.classList.remove("theme-day", "theme-night");
      body.classList.add(baseTheme);
    }
  } else if (themeMode === "day") {
    document.body.classList.remove("theme-night");
    document.body.classList.add("theme-day");
  } else if (themeMode === "night") {
    document.body.classList.remove("theme-day");
    document.body.classList.add("theme-night");
  }

  if (lastForecastData) {
    // les prochains graphes utiliseront le bon thème
  }
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    if (themeMode === "auto") {
      themeMode = "day";
      btnThemeToggle.textContent = "☀ Jour";
    } else if (themeMode === "day") {
      themeMode = "night";
      btnThemeToggle.textContent = "🌙 Nuit";
    } else if (themeMode === "night") {
      themeMode = "auto";
      btnThemeToggle.textContent = "🌓 Auto";
    }
    applyTheme();
  });
}

/* --------------------------------------------------------------------------
   5. AUTO-COMPLÉTION VILLES (API geocoding)
-------------------------------------------------------------------------- */

let autocompleteItems = [];
let autocompleteSelectedIndex = -1;

const stateCodeMap = {
  Californie: "CA",
  Floride: "FL",
  "New York": "NY",
  Nevada: "NV",
  Texas: "TX",
  Washington: "WA",
};

function refreshAutocompleteSelection() {
  const items = autocompleteList.querySelectorAll(".autocomplete-item");
  items.forEach((li, idx) => {
    if (idx === autocompleteSelectedIndex) li.classList.add("selected");
    else li.classList.remove("selected");
  });
}

if (cityInput) {
  cityInput.addEventListener("keydown", (e) => {
    if (!autocompleteList || !autocompleteList.childElementCount) return;

    const maxIndex = autocompleteList.childElementCount - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      autocompleteSelectedIndex =
        autocompleteSelectedIndex < maxIndex ? autocompleteSelectedIndex + 1 : maxIndex;
      refreshAutocompleteSelection();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      autocompleteSelectedIndex =
        autocompleteSelectedIndex > 0 ? autocompleteSelectedIndex - 1 : 0;
      refreshAutocompleteSelection();
    } else if (e.key === "Enter") {
      if (autocompleteSelectedIndex >= 0) {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll(".autocomplete-item");
        const target = items[autocompleteSelectedIndex];
        if (target) {
          target.click();
        }
      }
    } else if (e.key === "Escape") {
      autocompleteList.innerHTML = "";
      autocompleteSelectedIndex = -1;
    }
  });

  cityInput.addEventListener("input", async () => {
    const query = cityInput.value.trim();
    autocompleteList.innerHTML = "";

    if (!query) return;

    try {
      autocompleteSelectedIndex = -1;

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=10&language=fr&format=json`;

      const r = await fetch(url);
      const j = await r.json();

      if (!j.results) return;

      autocompleteItems = [];
      j.results.forEach((item) => {
        const li = document.createElement("li");
        li.className = "autocomplete-item";

        const main = document.createElement("span");
        main.className = "autocomplete-main";
        let regionLabel = "";
        if (item.admin1) {
          const code = stateCodeMap[item.admin1] ? ` ${stateCodeMap[item.admin1]}` : "";
          regionLabel = `, ${item.admin1}${code}`;
        }
        main.textContent = `${item.name}${regionLabel} — ${item.country}`;

        const meta = document.createElement("span");
        meta.className = "autocomplete-meta";
        meta.textContent = `Lat ${item.latitude.toFixed(2)} • Lon ${item.longitude.toFixed(
          2
        )}`;

        li.appendChild(main);
        li.appendChild(meta);
        autocompleteItems.push(li);

        li.addEventListener("click", () => {
          addCity({
            name: item.name,
            country: item.country,
            lat: item.latitude,
            lon: item.longitude,
          });
          autocompleteList.innerHTML = "";
          autocompleteSelectedIndex = -1;
          cityInput.value = "";
        });

        autocompleteList.appendChild(li);
      });
    } catch (err) {
      console.error("Erreur geocoding", err);
    }
  });
}

/* --------------------------------------------------------------------------
   6. GÉOLOCALISATION
-------------------------------------------------------------------------- */

function showToast(message, type = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast toast-visible";
  if (type === "error") toast.classList.add("toast-error");
  if (type === "success") toast.classList.add("toast-success");
  setTimeout(() => {
    toast.classList.remove("toast-visible");
  }, 1800);
}

function setGeolocateIdle() {
  if (!btnGeolocate) return;
  btnGeolocate.disabled = false;
  btnGeolocate.classList.remove("location-loading", "location-success");
  btnGeolocate.textContent = "📍 Ma position";
}

function setGeolocateLoading() {
  if (!btnGeolocate) return;
  btnGeolocate.disabled = true;
  btnGeolocate.classList.remove("location-success");
  btnGeolocate.classList.add("location-loading");
  btnGeolocate.textContent = "📍 Recherche…";
}

function setGeolocateSuccess(cityName) {
  if (!btnGeolocate) return;
  btnGeolocate.disabled = false;
  btnGeolocate.classList.remove("location-loading");
  btnGeolocate.classList.add("location-success");
  btnGeolocate.textContent = "✅ Position trouvée";
  if (cityName) {
    showToast(`Position détectée : ${cityName}`, "success");
  }
  setTimeout(() => {
    setGeolocateIdle();
  }, 1200);
}

function setGeolocateError(message) {
  showToast(message || "Impossible de déterminer votre position.", "error");
  setGeolocateIdle();
}

async function geolocateByIp() {
  try {
    const r = await fetch("https://ipapi.co/json/");
    const j = await r.json();
    if (!j || !j.city || !j.latitude || !j.longitude) {
      setGeolocateError("Impossible de récupérer votre position approximative.");
      return;
    }

    addCity({
      name: j.city,
      country: j.country_name || "—",
      lat: j.latitude,
      lon: j.longitude,
      isCurrentLocation: true,
    });
    setGeolocateSuccess(j.city);
  } catch (err) {
    console.error("Erreur géoloc IP", err);
    setGeolocateError("Impossible de déterminer votre position.");
  }
}

if (btnGeolocate) {
  btnGeolocate.addEventListener("click", () => {
    setGeolocateLoading();

    if (!navigator.geolocation) {
      geolocateByIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try {
          const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=fr`;
          const r = await fetch(url);
          const j = await r.json();
          const info = j?.results?.[0];
          const cityName =
            info?.name || `Position (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
          const countryName = info?.country || "—";

          addCity({
            name: cityName,
            country: countryName,
            lat,
            lon,
            isCurrentLocation: true,
          });
          setGeolocateSuccess(cityName);
        } catch (err) {
          console.error("Erreur géocodage inverse", err);
          geolocateByIp();
        }
      },
      async (err) => {
        console.warn("Erreur géolocalisation navigateur", err);
        geolocateByIp();
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  });
}

/* --------------------------------------------------------------------------
   7. AJOUT / SUPPRESSION DE VILLES
-------------------------------------------------------------------------- */

function addCity(ci) {
  const existingIndex = cities.findIndex(
    (x) =>
      x.name === ci.name &&
      Math.abs(x.lat - ci.lat) < 0.01 &&
      Math.abs(x.lon - ci.lon) < 0.01
  );

  if (existingIndex !== -1) {
    if (ci.isCurrentLocation) {
      cities.forEach((c) => {
        c.isCurrentLocation = false;
      });
      cities[existingIndex].isCurrentLocation = true;
      saveCities();
      renderCityList();
      highlightCity(existingIndex);
    }
    loadCityWeather(cities[existingIndex]);
    return;
  }

  if (ci.isCurrentLocation) {
    cities.forEach((c) => {
      c.isCurrentLocation = false;
    });
  }

  cities.push(ci);
  saveCities();
  renderCityList();
  loadCityWeather(ci);

  if (ci.isCurrentLocation) {
    const idx = cities.length - 1;
    highlightCity(idx);
  }
}

function removeCity(idx) {
  cities.splice(idx, 1);
  renderCityList();
  saveCities();

  if (cities.length > 0) {
    loadCityWeather(cities[0]);
  } else {
    detailsTitle.textContent = "Aucune ville sélectionnée";
    detailsSubtitle.textContent = "Ajoute une ville ou utilise “Ma position”.";
    detailsCurrent.innerHTML = "";
    if (windLineMain) windLineMain.textContent = "Vent : —";
    if (windLineSub) windLineSub.textContent = "Rafales : —";
    forecastList.innerHTML = "";
    applyWeatherBackground(null);
    updateTip(null);
  }
}

function saveCities() {
  localStorage.setItem("meteosplash-cities", JSON.stringify(cities));
}

function loadSavedCities() {
  const raw = localStorage.getItem("meteosplash-cities");
  if (raw) {
    cities = JSON.parse(raw);
    renderCityList();
  }
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
    cities = [];
    saveCities();
    renderCityList();
  });
}

/* --------------------------------------------------------------------------
   8. AFFICHAGE LISTE DES VILLES
-------------------------------------------------------------------------- */

function renderCityList() {
  if (!cityList) return;
  cityList.innerHTML = "";

  if (sortSelect && sortSelect.value === "alpha") {
    cities.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortSelect && sortSelect.value === "temp") {
    cities.sort((a, b) => {
      const Ta = weatherCache[a.name]?.current?.temperature_2m ?? -9999;
      const Tb = weatherCache[b.name]?.current?.temperature_2m ?? -9999;
      return Tb - Ta;
    });
  }

  cities.forEach((ci, idx) => {
    const el = document.createElement("div");
    el.className = "city-item";
    el.dataset.index = idx;

    const tempVal = weatherCache[ci.name]?.current?.temperature_2m ?? "—";
    const badge = ci.isCurrentLocation
      ? '<span class="city-badge-location">Ma position</span>'
      : "";

    el.innerHTML = `
      <div class="city-main">
        <span class="city-name">${ci.name}</span>
        <span class="city-meta">${ci.country} • ${ci.lat.toFixed(
          2
        )}, ${ci.lon.toFixed(2)}</span>
      </div>
      <span class="city-temp">${tempVal}°</span>
      ${badge}
      <button class="city-remove">✕</button>
    `;

    el.addEventListener("click", (e) => {
      if (e.target.classList.contains("city-remove")) {
        removeCity(idx);
        e.stopPropagation();
        return;
      }
      loadCityWeather(ci);
    });

    cityList.appendChild(el);
  });
}

function highlightCity(index) {
  if (!cityList) return;
  const item = cityList.querySelector(`.city-item[data-index="${index}"]`);
  if (!item) return;
  item.classList.add("city-item-highlight");
  setTimeout(() => {
    item.classList.remove("city-item-highlight");
  }, 1200);
}

/* --------------------------------------------------------------------------
   9. CHARGER LES DONNÉES MÉTÉO
-------------------------------------------------------------------------- */

async function loadCityWeather(ci) {
  selectedCity = ci;

  detailsTitle.textContent = ci.name;
  detailsSubtitle.textContent = `Lat ${ci.lat.toFixed(
    2
  )}, Lon ${ci.lon.toFixed(2)}`;

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${ci.lat}&longitude=${ci.lon}` +
      "&current=temperature_2m,relative_humidity_2m,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code" +
      "&hourly=temperature_2m,precipitation,rain,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_gusts_10m,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
      "&forecast_days=14" +
      "&timezone=auto";

    const r = await fetch(url);
    const j = await r.json();

    weatherCache[ci.name] = j;

    renderCurrent(j);
    renderWind(j);
    applyRainFX(j);
    renderForecast(j);
    activateForecastClicks();
    applyWeatherBackground(j.current.weather_code);
    renderCityList();
    updateTip(j);
    // --- Timezone logic ---
    if (j.utc_offset_seconds !== undefined) {
      cityTimeOffsetMinutes = j.utc_offset_seconds / 60;
      updateCityTimeAndTheme();
    }

  } catch (err) {
    console.error("Erreur météo", err);
    alert("Impossible de récupérer la météo.");
  }
}

/* --------------------------------------------------------------------------
   10. AFFICHAGE METEO ACTUELLE
-------------------------------------------------------------------------- */

function renderCurrent(j) {
  if (!detailsCurrent) return;
  const c = j.current;

  detailsCurrent.innerHTML = `
    <div class="detail-block">
      <div class="detail-label">Température</div>
      <div class="detail-value">${c.temperature_2m}°C</div>
      <div class="detail-sub">Ressenti : ${c.temperature_2m}°C</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Humidité</div>
      <div class="detail-value">${Math.min(100, c.relative_humidity_2m)}%</div>
      <div class="detail-sub">Nuages : ${c.cloud_cover}%</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Précipitations</div>
      <div class="detail-value">${c.precipitation} mm</div>
      <div class="detail-sub">Pluie : ${c.rain} mm</div>
    </div>

    <div class="detail-block">
      <div class="detail-label">Neige</div>
      <div class="detail-value">${c.snowfall} mm</div>
      <div class="detail-sub">Averse : ${c.showers} mm</div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   11. Boussole du vent
-------------------------------------------------------------------------- */

function renderWind(j) {
  if (!windArrow) return;
  const c = j.current;
  const dir = c.wind_direction_10m;
  const speed = c.wind_speed_10m;
  const gust = c.wind_gusts_10m;

  windArrow.style.transform = `translate(-50%, -50%) rotate(${dir}deg)`;

  if (windLineMain) {
    windLineMain.textContent = `Vent : ${degreeToCardinal(dir)} (${speed} km/h)`;
  }
  if (windLineSub) {
    windLineSub.textContent = `Rafales : ${gust} km/h`;
  }
}

/* --------------------------------------------------------------------------
   13. PRÉVISIONS 7 & 14 jours
-------------------------------------------------------------------------- */

if (btnForecast7) {
  btnForecast7.addEventListener("click", () => {
    btnForecast7.classList.add("pill-button-active");
    btnForecast14 && btnForecast14.classList.remove("pill-button-active");
    if (selectedCity) {
      renderForecast(weatherCache[selectedCity.name], 7);
      activateForecastClicks();
    }
  });
}

if (btnForecast14) {
  btnForecast14.addEventListener("click", () => {
    btnForecast14.classList.add("pill-button-active");
    btnForecast7 && btnForecast7.classList.remove("pill-button-active");
    if (selectedCity) {
      renderForecast(weatherCache[selectedCity.name], 14);
      activateForecastClicks();
    }
  });
}

function renderForecast(j, days = 7) {
  if (!forecastList) return;
  const d = j.daily;
  lastForecastData = j;

  forecastList.innerHTML = "";

  for (let i = 0; i < days; i++) {
    const day = d.time[i];
    const code = d.weather_code[i];
    const tmax = d.temperature_2m_max[i];
    const tmin = d.temperature_2m_min[i];
    const rain = d.precipitation_sum[i];
    const prob = d.precipitation_probability_max[i];
    const wind = d.wind_speed_10m_max[i];

    const item = document.createElement("div");
    item.className = "forecast-item";
    item.dataset.dayIndex = i;

    item.innerHTML = `
      <div class="forecast-line">
        <span class="f-day">${formatDayShort(day)} ${new Date(day).getDate()}</span>
        <span class="f-wind">${wind} km/h</span>
        <span class="f-icon" data-tooltip="${labelForWeatherCode(code)}">${iconForWeatherCode(code)}</span>
        <span class="f-temps">Max ${tmax}° · Min ${tmin}°</span>
        <span class="f-rain">${rain} mm</span>
        <span class="f-prob">${prob}%</span>
      </div>
    `;

    forecastList.appendChild(item);
  }
}



function activateForecastClicks() {
  const items = document.querySelectorAll(".forecast-item");
  items.forEach((item) => {
    const idx = parseInt(item.dataset.dayIndex, 10);
    if (Number.isNaN(idx)) return;
    item.onclick = () => {
      openDayOverlay(idx);
    };
  });
}

function labelForWeatherCode(code) {
  if (code === 0) return "Ciel clair";
  if ([1, 2, 3].includes(code)) return "Partiellement nuageux";
  if ([45, 48].includes(code)) return "Brouillard";
  if ([51, 53, 55].includes(code)) return "Bruine ou pluie légère";
  if ([61, 63, 65].includes(code)) return "Pluie";
  if ([71, 73, 75].includes(code)) return "Neige";
  if ([80, 81, 82].includes(code)) return "Averses";
  if ([95, 96, 99].includes(code)) return "Orage";
  return "Conditions variables";
}

function iconForWeatherCode(code) {
  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅";
  if ([45, 48].includes(code)) return "🌫";
  if ([51, 53, 55].includes(code)) return "🌦";
  if ([61, 63, 65].includes(code)) return "🌧";
  if ([71, 73, 75].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈";
  return "🌡";
}

/* --------------------------------------------------------------------------
   14. DÉTAIL JOUR (graphiques température / pluie / vent)
-------------------------------------------------------------------------- */

function openDayOverlay(dayIndex) {
  if (!lastForecastData || !selectedCity) return;
  const d = lastForecastData.daily;
  const h = lastForecastData.hourly;

  const dayStr = d.time[dayIndex];
  const baseDate = new Date(dayStr + "T00:00:00");
  const nextDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

  const times = h.time.map((t) => new Date(t));
  const hours = [];
  const temps = [];
  const rains = [];
  const winds = [];
  const humidities = [];

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t >= baseDate && t < nextDate) {
      hours.push(t.getHours());
      temps.push(h.temperature_2m[i]);
      rains.push(h.precipitation[i]);
      winds.push(h.wind_speed_10m[i]);
      if (h.relative_humidity_2m) {
        humidities.push(Math.min(100, h.relative_humidity_2m[i]));
      }
    }
  }

  if (dayOverlayTitle) {
    dayOverlayTitle.textContent = `Détail pour ${selectedCity.name}`;
  }
  if (dayOverlaySubtitle) {
    dayOverlaySubtitle.textContent = new Date(dayStr).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  // Sauvegarde des séries pour chaque onglet (Temp / Pluie / Vent / Humidité)
  currentDaySeries = {
    hours,
    temps,
    rains,
    winds,
    humidities,
  };

  // Onglet par défaut : Température (traçage + animation luxe)
  setActiveDayTab("temp");

  if (dayOverlay) {
    dayOverlay.classList.add("active");
    document.body.classList.add("no-scroll");
  }
}

function closeDayOverlay() {
  if (!dayOverlay) return;
  dayOverlay.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

if (btnCloseDay) {
  btnCloseDay.addEventListener("click", closeDayOverlay);
}

if (dayOverlay) {
  dayOverlay.addEventListener("click", (e) => {
    if (e.target.classList.contains("overlay-backdrop")) {
      closeDayOverlay();
    }
  });
}

function setActiveDayTab(kind) {
  if (!dayTabTemp || !dayTabRain || !dayTabWind || !dayTabHumidity) return;
  if (!dayGraphTemp || !dayGraphRain || !dayGraphWind || !dayGraphHumidity) return;

  dayTabTemp.classList.remove("pill-button-active");
  dayTabRain.classList.remove("pill-button-active");
  dayTabWind.classList.remove("pill-button-active");
  dayTabHumidity.classList.remove("pill-button-active");

  dayGraphTemp.classList.remove("active-day-graph");
  dayGraphRain.classList.remove("active-day-graph");
  dayGraphWind.classList.remove("active-day-graph");
  dayGraphHumidity.classList.remove("active-day-graph");

  if (kind === "temp") {
    dayTabTemp.classList.add("pill-button-active");
    dayGraphTemp.classList.add("active-day-graph");
  } else if (kind === "rain") {
    dayTabRain.classList.add("pill-button-active");
    dayGraphRain.classList.add("active-day-graph");
  } else if (kind === "wind") {
    dayTabWind.classList.add("pill-button-active");
    dayGraphWind.classList.add("active-day-graph");
  } else if (kind === "humidity") {
    dayTabHumidity.classList.add("pill-button-active");
    dayGraphHumidity.classList.add("active-day-graph");
  }

  // Re-dessine le graphe actif avec animation Luxe si les données du jour sont présentes
  if (!currentDaySeries) return;
  const { hours, temps, rains, winds, humidities } = currentDaySeries;

  if (kind === "temp" && chartTemp && temps.length) {
    drawSimpleLineChart(chartTemp, hours, temps, "°C");
  } else if (kind === "rain" && chartRain && rains.length) {
    drawSimpleLineChart(chartRain, hours, rains, "mm");
  } else if (kind === "wind" && chartWind && winds.length) {
    drawSimpleLineChart(chartWind, hours, winds, "km/h");
  } else if (kind === "humidity" && chartHumidity && humidities.length) {
    drawSimpleLineChart(chartHumidity, hours, humidities, "%");
  }
}

/* ==========================================================
   PATCH JS FINAL – Onglets Détail Jour (syntax OK)
   ========================================================== */

if (dayTabTemp && dayTabRain && dayTabWind && dayTabHumidity) {
  dayTabTemp.addEventListener("click", () => setActiveDayTab("temp"));
  dayTabRain.addEventListener("click", () => setActiveDayTab("rain"));
  dayTabWind.addEventListener("click", () => setActiveDayTab("wind"));
  dayTabHumidity.addEventListener("click", () => setActiveDayTab("humidity"));
}

/* ==========================================================
   PATCH STABLE – Radar overlay blindé
   ========================================================== */

if (btnRadar && radarOverlay) {
  btnRadar.addEventListener("click", () => {
    radarOverlay.classList.add("active");
    document.body.classList.add("no-scroll");
  });
}

if (btnCloseRadar && radarOverlay) {
  btnCloseRadar.addEventListener("click", () => {
    radarOverlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
  });
}

radarOverlay?.querySelector(".overlay-backdrop")?.addEventListener("click", () => {
  radarOverlay.classList.remove("active");
  document.body.classList.remove("no-scroll");
});

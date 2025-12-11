/* ==========================================================================
   Météo Splash – Script v4.6
   Version INTERMEDIAIRE (stabilité maximale)
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. SELECTEURS + ÉTATS GLOBAUX
--------------------------------------------------------------------------- */
let hasValidLocation = false;
let cityLocalHour = null;
let citySunriseHour = null;
let citySunsetHour = null;

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

  // Nettoyage météo
  body.classList.remove(
    "weather-clear",
    "weather-cloudy",
    "weather-rain",
    "weather-snow",
    "weather-storm"
  );

  if (code === null) return;

  let cls = "";

  if (code === 0) cls = "weather-clear";
  else if ([1, 2, 3].includes(code)) cls = "weather-cloudy";
  else if ([45, 48].includes(code)) cls = "weather-cloudy";
  else if ([51, 53, 55, 56, 57].includes(code)) cls = "weather-rain";
  else if ([61, 63, 65, 66, 67].includes(code)) cls = "weather-rain";
  else if ([71, 73, 75, 77].includes(code)) cls = "weather-snow";
  else if ([80, 81, 82].includes(code)) cls = "weather-rain";
  else if ([95, 96, 99].includes(code)) cls = "weather-storm";

  if (cls) body.classList.add(cls);

  // ✅ le thème jour/nuit est géré EXCLUSIVEMENT par applyTheme()
}


/* --------------------------------------------------------------------------
   4. THÈME JOUR / NUIT / AUTO
-------------------------------------------------------------------------- */

function applyTheme() {
  const body = document.body;

  if (themeMode === "auto") {

    const hour =
      typeof cityLocalHour === "number"
        ? cityLocalHour
        : new Date().getHours();

    let isNight;
    if (citySunriseHour !== null && citySunsetHour !== null) {
      isNight = hour < citySunriseHour || hour >= citySunsetHour;
    } else {
      isNight = hour >= 21 || hour < 7;
    }

    const baseTheme = isNight ? "theme-night" : "theme-day";

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
    body.classList.remove("theme-night");
    body.classList.add("theme-day");

  } else if (themeMode === "night") {
    body.classList.remove("theme-day");
    body.classList.add("theme-night");
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
   hasValidLocation = true; // ✅ VERROU DÉFINITIF
  if (!btnGeolocate) return;
  btnGeolocate.disabled = false;
  btnGeolocate.classList.remove("location-loading");
  btnGeolocate.classList.add("location-success");
  btnGeolocate.textContent = "✅ Position trouvée";
  if (cityName) {
   hideToast(); // ✅ IMPORTANT
   showToast(`Position détectée : ${cityName}`, "success");
  }
  setTimeout(() => {
    setGeolocateIdle();
  }, 1200);
}

function setGeolocateError(message) {
   if (hasValidLocation) return; // ✅ BLOQUE LE TOAST ROUGE
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

    const lat = j.latitude;
    const lon = j.longitude;

    addCity({
      name: j.city,
      country: j.country_name || "—",
      lat,
      lon,
      isCurrentLocation: true,
    });

    hideToast(); // ✅ efface tout message d’erreur précédent

    suggestNearbyCity(lat, lon); // ✅ maintenant OK

    setGeolocateSuccess(j.city);
  } catch (err) {
  console.error("Erreur géoloc IP", err);
  if (!hasValidLocation) {
    setGeolocateError("Impossible de déterminer votre position.");
  }
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
  updateAddCityButtonVisibility();
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
  cities = [];
  saveCities();
  renderCityList();
  updateAddCityButtonVisibility();
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
    updateAddCityButtonVisibility();

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


function updateCityClockFromOffset(offsetSeconds) {
  const clock = document.getElementById("radar-clock");
  if (!clock || typeof offsetSeconds !== "number") return;

  const nowUtc = Date.now() + new Date().getTimezoneOffset() * 60000;
  const local = new Date(nowUtc + offsetSeconds * 1000);

  cityLocalHour = local.getHours(); // ✅ utilisé par le mode Auto

  const hh = String(local.getHours()).padStart(2, "0");
  const mm = String(local.getMinutes()).padStart(2, "0");
  clock.textContent = `${hh}:${mm}`;
}


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
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset" +
      "&forecast_days=14" +
      "&timezone=auto";

    const r = await fetch(url);
    const j = await r.json();

    // Lever / coucher du soleil (jour courant) – heures locales
    if (j.daily && j.daily.sunrise && j.daily.sunset) {
      const sr = new Date(j.daily.sunrise[0]);
      const ss = new Date(j.daily.sunset[0]);
      citySunriseHour = sr.getHours() + sr.getMinutes() / 60;
      citySunsetHour  = ss.getHours() + ss.getMinutes() / 60;
    } else {
      citySunriseHour = null;
      citySunsetHour = null;
      // Lever / coucher du soleil calculés
      applyTheme(); // ✅ recalcul auto jour / nuit SOLAIRE

    }


    weatherCache[ci.name] = j;

    renderCurrent(j);
    renderWind(j);
    applyRainFX(j);
    renderForecast(j);
        activateForecastClicks();
    applyWeatherBackground(j.current.weather_code);
    renderCityList();
    updateTip(j);

    // ✅ MAJ automatique des prévisions 24h pour la ville courante
    if (typeof timeline24h !== "undefined" && timeline24h) {
      timeline24h.classList.remove("hidden");
      renderTimeline24h(j);
    }

    // --- Timezone logic ---

    // --- Timezone logic ---
    if (j.utc_offset_seconds !== undefined) {
      updateCityClockFromOffset(j.utc_offset_seconds);
      applyTheme(); // ✅ recalcul avec heure LOCALE
    }

  } catch (err) {
    console.error("Erreur météo", err);
    alert("Impossible de récupérer la météo.");
  }
}
function renderTimeline24h(j) {
  const container = document.getElementById("timeline-24h");
  if (!container || !j?.hourly) return;

  container.innerHTML = "";

  const now = new Date();
  const times = j.hourly.time;
  const temps = j.hourly.temperature_2m;
  const codes = j.hourly.weather_code;

  let added = 0;

  for (let i = 0; i < times.length && added < 24; i++) {
    const t = new Date(times[i]);
    if (t < now) continue;

    const item = document.createElement("div");
    item.className = "hour-item";

    if (t.getHours() === now.getHours()) {
      item.classList.add("current");
    }

    item.innerHTML = `
      <div class="hour-time">${t.getHours()}h</div>
      <div class="hour-icon">${iconForWeatherCode(codes[i])}</div>
      <div class="hour-temp">${Math.round(temps[i])}°</div>
    `;

    container.appendChild(item);
    added++;
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

const btn24h = document.getElementById("btn-24h");
const timeline24h = document.getElementById("timeline-24h");

if (btn24h && timeline24h) {
  btn24h.addEventListener("click", () => {
    if (!lastForecastData) return;

    timeline24h.classList.toggle("hidden");

    if (!timeline24h.classList.contains("hidden")) {
      renderTimeline24h(lastForecastData);
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

if (dayTabTemp && dayTabRain && dayTabWind && dayTabHumidity) {
  dayTabTemp.addEventListener("click", () => setActiveDayTab("temp"));
  dayTabRain.addEventListener("click", () => setActiveDayTab("rain"));
  dayTabWind.addEventListener("click", () => setActiveDayTab("wind"));
  dayTabHumidity.addEventListener("click", () => setActiveDayTab("humidity"));
}

if (forecastList) {
  forecastList.addEventListener("click", (e) => {
    const item = e.target.closest(".forecast-item");
    if (!item) return;
    const idx = Number(item.dataset.dayIndex ?? -1);
    if (idx >= 0) {
      openDayOverlay(idx);
    }
  });
}

/* petit moteur de graphique maison */


function drawSimpleLineChart(canvas, labels, values, unit) {
  if (!canvas || !canvas.getContext || !labels.length || !values.length) {
    const ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  // ========== Préparation HiDPI (net sur tous les écrans) ==========
  const dpr = window.devicePixelRatio || 1;
  let rect = canvas.getBoundingClientRect();
  let cssWidth = rect.width;
  let cssHeight = rect.height;

  // Si le canvas est caché (display:none), sa taille vaut 0 : on prend alors la taille du parent
  if (!cssWidth || !cssHeight) {
    const parent = canvas.parentElement || canvas.closest(".day-popup") || canvas.closest(".day-overlay");
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      cssWidth = parentRect.width || 800;
      cssHeight = parentRect.height ? Math.min(parentRect.height * 0.45, 260) : 220;
    } else {
      cssWidth = 800;
      cssHeight = 220;
    }
  }

  // Taille CSS par défaut si encore indéfinie
  if (!cssWidth) cssWidth = 800;
  if (!cssHeight) cssHeight = 220;

  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const width = cssWidth;
  const height = cssHeight;

  const isNight = document.body.classList.contains("theme-night");
  const axisColor = isNight ? "rgba(240,240,255,0.9)" : "rgba(40,40,60,0.8)";
  const gridColor = isNight ? "rgba(240,240,255,0.25)" : "rgba(0,0,0,0.08)";
  const textColor = isNight ? "rgba(240,240,255,0.95)" : "rgba(30,30,50,0.9)";

  const paddingLeft = 44;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 30;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // 1) Nettoyage et clamp des valeurs selon l'unité
  let cleanValues = values.map((v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  });

  if (unit === "%") {
    cleanValues = cleanValues.map((v) => Math.min(100, Math.max(0, v)));
  }
  if (unit === "mm" || unit === "km/h") {
    cleanValues = cleanValues.map((v) => Math.max(0, v));
  }

  let minVal = Math.min(...cleanValues);
  let maxVal = Math.max(...cleanValues);

  if (unit === "%") {
    minVal = 0;
    maxVal = 100;
  } else {
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const paddingValue = (maxVal - minVal) * 0.15;
    minVal -= paddingValue;
    maxVal += paddingValue;

    if (unit === "mm" || unit === "km/h") {
      minVal = Math.max(0, minVal);
    }
  }

  const range = maxVal - minVal || 1;

  function xForIndex(i) {
    if (labels.length === 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (plotWidth * i) / (labels.length - 1);
  }

  function yForValue(v) {
    const ratio = (v - minVal) / range;
    return paddingTop + plotHeight * (1 - ratio);
  }

  // Pré-calcul des points
  const points = cleanValues.map((v, i) => ({
    x: xForIndex(i),
    y: yForValue(v),
  }));

  // Couleur de courbe par type
  let color = "#ff6f61"; // Température
  if (unit === "mm") color = "#4a90e2";    // Pluie
  if (unit === "km/h") color = "#34c759";  // Vent
  if (unit === "%") color = "#af52de";     // Humidité

  // ======= FONCTION DE DESSIN STATIQUE (axes + grille + labels) =======
  function drawStaticFrame() {
    // Grille horizontale (lignes sur demi‑pixel)
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridLines = 3;
    for (let i = 0; i <= gridLines; i++) {
      const y = Math.round(paddingTop + (plotHeight * i) / gridLines) + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(paddingLeft) + 0.5, y);
      ctx.lineTo(Math.round(paddingLeft + plotWidth) + 0.5, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.2;
    const xAxisY = Math.round(paddingTop + plotHeight) + 0.5;
    const yAxisX = Math.round(paddingLeft) + 0.5;

    ctx.beginPath();
    ctx.moveTo(yAxisX, Math.round(paddingTop) + 0.5);
    ctx.lineTo(yAxisX, xAxisY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(yAxisX, xAxisY);
    ctx.lineTo(Math.round(paddingLeft + plotWidth) + 0.5, xAxisY);
    ctx.stroke();

    // Labels Y
    ctx.fillStyle = textColor;
    ctx.font =
      "11px system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const stepsY = 3;
    let previousLabel = null;
    for (let i = 0; i <= stepsY; i++) {
      const ratio = i / stepsY;
      const val = maxVal - range * ratio;
      let labelVal = val;

      if (unit === "%") {
        if (labelVal < 0) labelVal = 0;
        if (labelVal > 100) labelVal = 100;
        labelVal = Math.round(labelVal);
      } else if (unit === "km/h" || unit === "°C") {
        labelVal = Math.round(labelVal);
        if (unit === "km/h" && labelVal < 0) labelVal = 0;
      } else if (unit === "mm") {
        labelVal = Math.round(labelVal * 10) / 10;
        if (Math.abs(labelVal) < 0.05) labelVal = 0;
      } else {
        labelVal = Math.round(labelVal);
      }

      let label = "";
      if (unit === "°C") label = `${labelVal}°C`;
      else if (unit === "mm") {
        const str =
          labelVal % 1 === 0 ? labelVal.toFixed(0) : labelVal.toFixed(1);
        label = `${str}mm`;
      } else if (unit === "km/h") label = `${labelVal}km/h`;
      else if (unit === "%") label = `${labelVal}%`;
      else label = String(labelVal);

      if (label === previousLabel) {
        continue;
      }
      previousLabel = label;

      const y = yForValue(val);
      ctx.fillText(label, paddingLeft - 6, y);
    }

    // Labels X
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    let stepX = 1;
    if (labels.length > 8) {
      stepX = Math.ceil(labels.length / 8);
    }

    for (let i = 0; i < labels.length; i += stepX) {
      const x = xForIndex(i);
      const y = paddingTop + plotHeight + 4;
      ctx.fillText(labels[i], x, y);
    }
  }

  // ========== ANIMATION LUXE (courbe + points + léger glow) ==========
  const duration = 480; // ms
  const start = performance.now();
  const animId = (canvas._msAnimId || 0) + 1;
  canvas._msAnimId = animId;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function renderFrame(now) {
    if (canvas._msAnimId !== animId) return; // une nouvelle anim a commencé

    const elapsed = now - start;
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeInOutCubic(t);

    // On redessine tout à chaque frame pour rester net
    ctx.clearRect(0, 0, width, height);
    drawStaticFrame();

    // Déterminer jusqu'où dessiner la courbe
    const lastIndexFloat = (points.length - 1) * eased;
    const lastIndex = Math.floor(lastIndexFloat);
    const frac = lastIndexFloat - lastIndex;

    // Glow léger
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color + "66";
    ctx.shadowBlur = 10;

    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else if (i <= lastIndex) {
        ctx.lineTo(pt.x, pt.y);
      } else if (i === lastIndex + 1 && frac > 0) {
        const prev = points[lastIndex];
        const nx = prev.x + (pt.x - prev.x) * frac;
        const ny = prev.y + (pt.y - prev.y) * frac;
        ctx.lineTo(nx, ny);
      }
    });
    ctx.stroke();

    // Points
    ctx.shadowBlur = 8;
    points.forEach((pt, i) => {
      if (i > lastIndex + 1) return;
      let factor = 0.7;
      if (i === lastIndex || i === lastIndex + 1) {
        factor = 0.7 + 0.3 * eased;
      }
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.4 * factor, 0, Math.PI * 2);
      ctx.fill();
    });

    // Réinitialiser les ombres pour éviter de polluer le reste
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    if (t < 1) {
      requestAnimationFrame(renderFrame);
    }
  }

  requestAnimationFrame(renderFrame);
}
/* --------------------------------------------------------------------------
   15. MÉTÉO PARLÉE
-------------------------------------------------------------------------- */

if (btnSpeak) {
  btnSpeak.addEventListener("click", () => {
    if (!selectedCity) {
      speech("Aucune ville n'est sélectionnée pour la météo parlée.");
      return;
    }

    const j = weatherCache[selectedCity.name];
    if (!j || !j.current) {
      speech("Les données ne sont pas encore disponibles.");
      return;
    }

    const c = j.current;

    const text = `
    Voici la météo pour ${selectedCity.name} :
    Température actuelle ${c.temperature_2m} degrés.
    Humidité ${Math.min(100, c.relative_humidity_2m)} pour cent.
    Vent ${c.wind_speed_10m} kilomètres par heure,
    direction ${degreeToCardinal(c.wind_direction_10m)}.
  `;

    speech(text);
  });
}

function speech(txt) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(txt);
  utter.lang = "fr-FR";
  synth.speak(utter);
}

/* --------------------------------------------------------------------------
   16. RADAR POPUP (RainViewer + Open-Meteo + Temp + Vent)
-------------------------------------------------------------------------- */

/**
 * - RainViewer : radar réel pour les 2 dernières heures (pluie).
 * - Open-Meteo : timeline animée pour les prochaines heures (pluie / vent / température).
 * - OpenWeather : tuiles vent / température.
 * - Bouton "Radar réel / Radar futur".
 * - Bouton "Résumé pluie -2 h".
 */

const OPENWEATHER_API_KEY = "c63f9893f5d21327a9c390818db9f240";
const RAINVIEWER_API_URL = "https://api.rainviewer.com/public/weather-maps.json";

let radarTemporalMode = "real"; // "real" | "future"
let radarVariable = "rain";     // "rain" | "wind" | "temp"

let radarMapInstance = null;
let radarBaseLayer = null;
let radarTileLayer = null;
let radarFutureOverlay = null;

// RainViewer (radar réel -2 h)
let rainviewerMeta = null;
let rainviewerPastFrames = [];
let rainviewerHost = "";
let rainviewerTileLayer = null;
let rainviewerAnimTimer = null;

// Timeline animation (Open-Meteo)
let radarTimelinePlaying = false;
let radarTimelineTimer = null;

// Bouton résumé pluie -2 h
let radarSummaryButton = null;
const radarLegend = document.querySelector(".radar-legend");

if (radarLegend) {
  radarSummaryButton = document.createElement("button");
  radarSummaryButton.id = "radar-summary-button";
  radarSummaryButton.className = "pill-button radar-summary-button";
  radarSummaryButton.textContent = "Résumé pluie -2 h";
  radarLegend.appendChild(radarSummaryButton);
}

/* 16.1 – Utilitaires RainViewer & Open-Meteo */

async function loadRainviewerMeta() {
  if (rainviewerMeta) return;
  try {
    const res = await fetch(RAINVIEWER_API_URL);
    const data = await res.json();
    rainviewerMeta = data;
    rainviewerHost = data.host || "https://tilecache.rainviewer.com";
    if (data.radar && Array.isArray(data.radar.past)) {
      const arr = data.radar.past;
      rainviewerPastFrames = arr.slice(Math.max(0, arr.length - 12));
    }
  } catch (err) {
    console.error("Erreur RainViewer:", err);
  }
}

function applyRainviewerFrame(index) {
  if (!radarMapInstance || !rainviewerPastFrames.length) return;

  if (rainviewerTileLayer) {
    radarMapInstance.removeLayer(rainviewerTileLayer);
    rainviewerTileLayer = null;
  }

  const frame = rainviewerPastFrames[index];
  if (!frame || !frame.path) return;

  const url = `${rainviewerHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

  rainviewerTileLayer = L.tileLayer(url, {
    opacity: 0.8,
  });
  rainviewerTileLayer.addTo(radarMapInstance);
}

function startRainviewerAnimation() {
  stopRainviewerAnimation();
  if (!radarMapInstance || !rainviewerPastFrames.length) return;

  let idx = 0;
  applyRainviewerFrame(idx);

  rainviewerAnimTimer = setInterval(() => {
    idx = (idx + 1) % rainviewerPastFrames.length;
    applyRainviewerFrame(idx);
  }, 650);
}

function stopRainviewerAnimation() {
  if (rainviewerAnimTimer) {
    clearInterval(rainviewerAnimTimer);
    rainviewerAnimTimer = null;
  }
  if (radarMapInstance && rainviewerTileLayer) {
    radarMapInstance.removeLayer(rainviewerTileLayer);
    rainviewerTileLayer = null;
  }
}

function getRadarBaseIndex(hourlyTimes) {
  const now = new Date();
  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = new Date(hourlyTimes[i]);
    if (t >= now) return i;
  }
  return 0;
}

function updateRadarWindowLabel(baseIndex, startIndex, horizonHours) {
  if (!radarWindowText) return;
  const diffHours = Math.max(0, startIndex - baseIndex);
  const startH = diffHours;
  const endH = diffHours + horizonHours;
  if (diffHours === 0) {
    radarWindowText.textContent = `Maintenant → +${horizonHours} h`;
  } else {
    radarWindowText.textContent = `+${startH} h → +${endH} h`;
  }
}

/* 16.1 bis – Carte Leaflet (vue monde + zoom ville) */

function ensureRadarMap() {
  // 1. Création de la carte si besoin
  if (!radarMapInstance) {
    radarMapInstance = L.map("radar-map", {
      zoomControl: false,
      attributionControl: false,
    });
  }

  // 2. Fond de carte OSM : zoom proche ET vue monde
  if (!radarBaseLayer) {
    radarBaseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 15, // zoom ville
      minZoom: 2,  // vue monde
    });
    radarBaseLayer.addTo(radarMapInstance);
  }

  // 3. Si aucune ville → vue monde
  if (!selectedCity || !selectedCity.lat || !selectedCity.lon) {
    radarMapInstance.setView([20, 0], 3);
    return;
  }

  // 4. Ville sélectionnée → zoom proche
  radarMapInstance.setView([selectedCity.lat, selectedCity.lon], 13);
}

/* 16.2 – Timeline radar (pluie / vent / température) */

function getOpenWeatherLayerName() {
  if (radarVariable === "wind") return "wind_new";
  if (radarVariable === "temp") return "temp_new";
  return "precipitation_new";
}

function refreshOpenWeatherLayer() {
  if (!radarMapInstance) return;

  if (radarTemporalMode === "real" && radarVariable === "rain") {
    if (radarTileLayer) {
      radarMapInstance.removeLayer(radarTileLayer);
      radarTileLayer = null;
    }
    return;
  }

  if (radarTileLayer) {
    radarMapInstance.removeLayer(radarTileLayer);
    radarTileLayer = null;
  }

  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "A_METTRE_ICI") {
    return;
  }

  const layerName = getOpenWeatherLayerName();
  const url = `https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;

  radarTileLayer = L.tileLayer(url, {
    opacity: 0.7,
  });
  radarTileLayer.addTo(radarMapInstance);
}

function updateFutureOverlay(variable, intensity) {
  if (!radarMapInstance || !selectedCity) return;

  if (radarFutureOverlay) {
    radarMapInstance.removeLayer(radarFutureOverlay);
    radarFutureOverlay = null;
  }

  if (!intensity || intensity === 0) {
    return;
  }

  let fillColor = "rgba(79,141,255,0.25)";
  let fillOpacity = 0.25;

  if (variable === "rain") {
    if (intensity === 1) {
      fillColor = "rgba(74,157,255,0.25)";
      fillOpacity = 0.25;
    } else if (intensity === 2) {
      fillColor = "rgba(245,208,52,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(255,74,74,0.40)";
      fillOpacity = 0.40;
    }
  } else if (variable === "wind") {
    if (intensity === 1) {
      fillColor = "rgba(53,214,156,0.25)";
      fillOpacity = 0.25;
    } else if (intensity === 2) {
      fillColor = "rgba(255,154,60,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(255,74,74,0.40)";
      fillOpacity = 0.40;
    }
  } else if (variable === "temp") {
    if (intensity === 1) {
      fillColor = "rgba(15,23,42,0.35)";
      fillOpacity = 0.35;
    } else if (intensity === 2) {
      fillColor = "rgba(251,191,36,0.32)";
      fillOpacity = 0.32;
    } else if (intensity === 3) {
      fillColor = "rgba(185,28,28,0.40)";
      fillOpacity = 0.40;
    }
  }

  radarFutureOverlay = L.circle([selectedCity.lat, selectedCity.lon], {
    radius: 25000,
    color: "transparent",
    fillColor,
    fillOpacity,
    stroke: false,
  });

  radarFutureOverlay.addTo(radarMapInstance);
}

function applyRadarGridModeClass() {
  if (!radarGrid) return;
  radarGrid.classList.remove("radar-grid-rain", "radar-grid-wind", "radar-grid-temp");
  if (radarVariable === "rain") radarGrid.classList.add("radar-grid-rain");
  else if (radarVariable === "wind") radarGrid.classList.add("radar-grid-wind");
  else if (radarVariable === "temp") radarGrid.classList.add("radar-grid-temp");
}

function renderRadarTimeline() {
  if (!radarGrid || !selectedCity) return;
  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) return;

  const h = data.hourly;
  const baseIndex = getRadarBaseIndex(h.time);

  let horizonHours = 12;
  let maxOffset = 0;

  if (radarVariable === "rain") {
    if (radarTemporalMode === "future") {
      horizonHours = 3;
      maxOffset = 12;
    } else {
      horizonHours = 12;
      maxOffset = Math.min(12, Math.max(0, h.time.length - baseIndex - horizonHours));
    }
  } else {
    const maxPossible = Math.max(0, h.time.length - baseIndex - horizonHours);
    maxOffset = Math.min(36, maxPossible);
  }

  let offset = 0;
  if (radarTimelineSlider) {
    radarTimelineSlider.min = "0";
    radarTimelineSlider.max = String(maxOffset);
    offset = Math.min(maxOffset, Number(radarTimelineSlider.value || "0"));
  }

  let startIndex = baseIndex + offset;
  const maxStart = Math.max(0, h.time.length - horizonHours);
  if (startIndex < 0) startIndex = 0;
  if (startIndex > maxStart) startIndex = maxStart;

  radarGrid.innerHTML = "";
  updateRadarWindowLabel(baseIndex, startIndex, horizonHours);

  let overlayIntensity = 0;
  const midIndexInWindow = Math.floor(horizonHours / 2);

  for (let i = 0; i < horizonHours; i++) {
    const idx = startIndex + i;
    if (idx >= h.time.length) break;
    const time = new Date(h.time[idx]);

    let value = 0;
    let intensity = 0;

    if (radarVariable === "rain") {
      value =
        h.rain && h.rain[idx] != null
          ? h.rain[idx]
          : h.precipitation && h.precipitation[idx] != null
          ? h.precipitation[idx]
          : 0;
      if (value === 0) intensity = 0;
      else if (value < 0.2) intensity = 1;
      else if (value < 1) intensity = 2;
      else intensity = 3;
    } else if (radarVariable === "wind") {
      value =
        h.wind_speed_10m && h.wind_speed_10m[idx] != null ? h.wind_speed_10m[idx] : 0;
      if (value < 15) intensity = 1;
      else if (value < 35) intensity = 2;
      else intensity = 3;
    } else if (radarVariable === "temp") {
      value =
        h.temperature_2m && h.temperature_2m[idx] != null ? h.temperature_2m[idx] : 0;
      if (value < 0) intensity = 1;
      else if (value < 20) intensity = 2;
      else intensity = 3;
    }

    const hourLabel = time.getHours().toString().padStart(2, "0") + "h";

    const cell = document.createElement("div");
    cell.className = "radar-cell";
    cell.dataset.intensity = intensity.toString();
    cell.innerHTML = `
      <div class="radar-bar"></div>
      <div class="radar-hour">${hourLabel}</div>
    `;
    radarGrid.appendChild(cell);

    if (i === midIndexInWindow) {
      overlayIntensity = intensity;
    }
  }

  if (radarTemporalMode === "future") {
    updateFutureOverlay(radarVariable, overlayIntensity);
  } else if (radarFutureOverlay && radarMapInstance) {
    radarMapInstance.removeLayer(radarFutureOverlay);
    radarFutureOverlay = null;
  }
}
function updateRadarLegend() {
  const lr = document.querySelector(".legend-rain");
  const lw = document.querySelector(".legend-wind");
  const lt = document.querySelector(".legend-temp");

  if (!lr || !lw || !lt) return;

  lr.classList.add("hidden");
  lw.classList.add("hidden");
  lt.classList.add("hidden");

  if (radarVariable === "rain") lr.classList.remove("hidden");
  if (radarVariable === "wind") lw.classList.remove("hidden");
  if (radarVariable === "temp") lt.classList.remove("hidden");
}
function updateLegend() {
  const container = document.getElementById("legend-container");
  if (!container) return;

  container.classList.remove("hidden");

  const groups = container.querySelectorAll(".legend-group");
  groups.forEach(g => g.classList.add("hidden"));

  const active = container.querySelector(`[data-type="${radarVariable}"]`);
  if (active) active.classList.remove("hidden");
}

function resetRadarTimelineToNow() {
  if (!selectedCity) return;
  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) return;

  const h = data.hourly;
  const baseIndex = getRadarBaseIndex(h.time);

  let horizonHours = 12;
  let maxOffset = 0;

  if (radarVariable === "rain" && radarTemporalMode === "future") {
    horizonHours = 3;
    maxOffset = 12;
  } else if (radarVariable === "rain") {
    horizonHours = 12;
    maxOffset = Math.min(12, Math.max(0, h.time.length - baseIndex - horizonHours));
  } else {
    horizonHours = 12;
    const maxPossible = Math.max(0, h.time.length - baseIndex - horizonHours);
    maxOffset = Math.min(36, maxPossible);
  }

  if (radarTimelineSlider) {
    radarTimelineSlider.min = "0";
    radarTimelineSlider.max = String(maxOffset);
    radarTimelineSlider.value = "0";
  }

  updateRadarWindowLabel(baseIndex, baseIndex, horizonHours);
  renderRadarTimeline();
}

/* 16.3 – Pluie / Vent / Temp : changement d'onglet & ouverture radar */

function setRadarMode(kind) {
  radarVariable = kind;
  applyRadarGridModeClass();
   updateRadarLegend();

  if (radarTabRain && radarTabWind && radarTabTemp) {
    radarTabRain.classList.remove("radar-tab-active");
    radarTabWind.classList.remove("radar-tab-active");
    radarTabTemp.classList.remove("radar-tab-active");

    if (kind === "rain") radarTabRain.classList.add("radar-tab-active");
    else if (kind === "wind") radarTabWind.classList.add("radar-tab-active");
    else if (kind === "temp") radarTabTemp.classList.add("radar-tab-active");
  }

  if (radarTemporalMode === "real" && radarVariable === "rain") {
    loadRainviewerMeta().then(() => {
      startRainviewerAnimation();
    });
  } else {
    stopRainviewerAnimation();
    refreshOpenWeatherLayer();
  }

  resetRadarTimelineToNow();
   updateLegend();
}

function openRadarOverlay() {
  if (!selectedCity) {
    showToast("Ajoute d'abord une ville pour afficher le radar.");
    return;
  }

  radarOverlay.classList.remove("hidden");
  radarOverlay.classList.add("active");
  document.body.classList.add("no-scroll");

  setTimeout(() => {
    ensureRadarMap();
    if (radarMapInstance) {
      radarMapInstance.invalidateSize();
    }

    applyRadarGridModeClass();
     updateLegend();


    if (radarTemporalMode === "real" && radarVariable === "rain") {
      loadRainviewerMeta().then(() => {
        startRainviewerAnimation();
      });
    } else {
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
    }

    resetRadarTimelineToNow();
  }, 60);
}

/* 16.4 – Résumé pluie des 2 dernières heures */

function summarizePastRain() {
  if (!selectedCity) {
    showToast("Aucune ville sélectionnée.", "error");
    return;
  }

  const data = weatherCache[selectedCity.name];
  if (!data || !data.hourly || !data.hourly.time || !data.hourly.time.length) {
    showToast("Données météo indisponibles.", "error");
    return;
  }

  const h = data.hourly;
  const times = h.time.map((t) => new Date(t));
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let totalRain = 0;
  let maxRain = 0;
  let firstRainTime = null;
  let lastRainTime = null;

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t >= twoHoursAgo && t <= now) {
      const val =
        h.rain && h.rain[i] != null
          ? h.rain[i]
          : h.precipitation && h.precipitation[i] != null
          ? h.precipitation[i]
          : 0;
      if (val > 0) {
        totalRain += val;
        maxRain = Math.max(maxRain, val);
        if (!firstRainTime) firstRainTime = t;
        lastRainTime = t;
      }
    }
  }

  if (!firstRainTime) {
    showToast("Aucune pluie détectée sur les 2 dernières heures.", "info");
    return;
  }

  const formatHour = (d) =>
    d.getHours().toString().padStart(2, "0") +
    "h" +
    d.getMinutes().toString().padStart(2, "0");

  let maxLabel = "";
  if (maxRain < 0.2) maxLabel = "faible";
  else if (maxRain < 1) maxLabel = "modérée";
  else maxLabel = "forte / très forte";

  const msg = `Pluie entre ${formatHour(firstRainTime)} et ${formatHour(
    lastRainTime
  )} · cumul ~${totalRain.toFixed(1)} mm · intensité max ${maxLabel}.`;

  showToast(msg, "success");
}

/* 16.5 – Animation timeline & écouteurs */

function startRadarTimelineAnimation() {
  if (!radarTimelineSlider) return;
  radarTimelinePlaying = true;
  radarPlay.textContent = "⏸";
  if (radarTimelineTimer) {
    clearInterval(radarTimelineTimer);
  }

  radarTimelineTimer = setInterval(() => {
    if (!radarTimelineSlider) return;
    const max = Number(radarTimelineSlider.max || "0");
    let val = Number(radarTimelineSlider.value || "0");
    if (val >= max) {
      val = 0;
    } else {
      val += 1;
    }
    radarTimelineSlider.value = String(val);
    renderRadarTimeline();
  }, 900);
}

function stopRadarTimelineAnimation() {
  radarTimelinePlaying = false;
  radarPlay.textContent = "▶︎";
  if (radarTimelineTimer) {
    clearInterval(radarTimelineTimer);
    radarTimelineTimer = null;
  }
}

/* --- Écouteurs RADAR --- */

if (btnRadar && radarOverlay) {
  btnRadar.addEventListener("click", openRadarOverlay);
}

if (btnCloseRadar) {
  btnCloseRadar.addEventListener("click", () => {
    radarOverlay.classList.remove("active");
    radarOverlay.classList.add("hidden");
    document.body.classList.remove("no-scroll");
    stopRainviewerAnimation();
    stopRadarTimelineAnimation();
    if (radarFutureOverlay && radarMapInstance) {
      radarMapInstance.removeLayer(radarFutureOverlay);
      radarFutureOverlay = null;
    }
  });
}

if (radarTabRain && radarTabWind && radarTabTemp) {
  radarTabRain.addEventListener("click", () => setRadarMode("rain"));
  radarTabWind.addEventListener("click", () => setRadarMode("wind"));
  radarTabTemp.addEventListener("click", () => setRadarMode("temp"));
}

if (radarTimelineSlider) {
  radarTimelineSlider.addEventListener("input", () => {
    renderRadarTimeline();
  });
}

if (radarModeToggle) {
  radarModeToggle.addEventListener("click", () => {
    radarTemporalMode = radarTemporalMode === "real" ? "future" : "real";
    radarModeToggle.textContent =
      radarTemporalMode === "real" ? "Radar réel" : "Radar futur";

    if (radarTemporalMode === "real" && radarVariable === "rain") {
      stopRadarTimelineAnimation();
      loadRainviewerMeta().then(() => {
        startRainviewerAnimation();
      });
    } else {
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
      resetRadarTimelineToNow();
    }
  });
}

if (radarPlay) {
  radarPlay.addEventListener("click", () => {
    if (radarTemporalMode === "real" && radarVariable === "rain") {
      radarTemporalMode = "future";
      radarModeToggle.textContent = "Radar futur";
      stopRainviewerAnimation();
      refreshOpenWeatherLayer();
      resetRadarTimelineToNow();
    }

    if (radarTimelinePlaying) {
      stopRadarTimelineAnimation();
    } else {
      startRadarTimelineAnimation();
    }
  });
}

if (radarSummaryButton) {
  radarSummaryButton.addEventListener("click", summarizePastRain);
}

/* --------------------------------------------------------------------------
   17. INITIALISATION
-------------------------------------------------------------------------- */

function init() {
  loadSavedCities();
  applyTheme();
}

document.addEventListener("DOMContentLoaded", () => {
  if (dayOverlay) {
    dayOverlay.classList.remove("active", "active-day-overlay");
  }
});


/* --------------------------------------------------------------------------
   15. HISTORIQUE METEO (ONGLET DISCRET)
-------------------------------------------------------------------------- */

async function fetchHistoricalWeather(ci, dateStr) {
  if (!ci || !dateStr) return null;

  try {
    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${ci.lat}&longitude=${ci.lon}` +
      `&start_date=${dateStr}&end_date=${dateStr}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
      "&timezone=auto";

    const r = await fetch(url);
    const j = await r.json();

    // Lever / coucher du soleil (jour courant) – heures locales
    if (j.daily && j.daily.sunrise && j.daily.sunset) {
      const sr = new Date(j.daily.sunrise[0]);
      const ss = new Date(j.daily.sunset[0]);
      citySunriseHour = sr.getHours() + sr.getMinutes() / 60;
      citySunsetHour  = ss.getHours() + ss.getMinutes() / 60;
    } else {
      citySunriseHour = null;
      citySunsetHour = null;
    }

    if (!j || !j.daily || !j.daily.time || !j.daily.time.length) {
      return null;
    }
    return {
      date: j.daily.time[0],
      tmax: j.daily.temperature_2m_max[0],
      tmin: j.daily.temperature_2m_min[0],
      rain: j.daily.precipitation_sum[0],
      wind: j.daily.wind_speed_10m_max[0],
    };
  } catch (err) {
    console.error("Erreur historique", err);
    return null;
  }
}

function enterHistoryMode() {
  if (!selectedCity || !detailsHistory || !detailsCurrent) {
    showToast("Sélectionne d'abord une ville.", "info");
    return;
  }

  // masque l'affichage actuel + boussole
  detailsCurrent.classList.add("hidden");
  const windBlock = document.querySelector(".wind-block");
  if (windBlock) windBlock.classList.add("hidden");

  // prépare la carte historique (un seul bloc)
  const today = new Date();
  const defaultYear = Math.max(today.getFullYear() - 1, 1925);
  const def = new Date(today);
  def.setFullYear(defaultYear);
  const defStr = formatDateISO(def);

  detailsHistory.classList.remove("hidden");
  detailsHistory.innerHTML = `
    <div class="detail-label">Historique météo</div>
    <div class="history-controls">
      <label class="history-label" for="history-date">Date :</label>
      <input id="history-date" class="history-date-input" type="date" min="1925-01-01" max="${formatDateISO(today)}" value="${defStr}" />
      <button id="btn-history-load" class="pill-button history-load-button">Afficher</button>
    </div>
    <div id="history-result" class="history-result">
      <p class="history-hint">Choisis une date pour voir la météo passée.</p>
    </div>
    <div class="history-footer">
      <button id="btn-history-back" class="ghost-button history-back-button">⬅ Retour aux données actuelles</button>
    </div>
  `;

  const btnLoad = document.getElementById("btn-history-load");
  const inputDate = document.getElementById("history-date");
  const btnBack = document.getElementById("btn-history-back");

  if (btnLoad && inputDate) {
    btnLoad.addEventListener("click", async () => {
      const d = inputDate.value;
      if (!d) return;
      const res = await fetchHistoricalWeather(selectedCity, d);
      const resultEl = document.getElementById("history-result");
      if (!resultEl) return;

      if (!res) {
        resultEl.innerHTML =
          '<p class="history-error">Données indisponibles pour cette date. Essaie une autre date.</p>';
        return;
      }

      resultEl.innerHTML = `
        <div class="history-values">
          <div class="history-line"><span>Date :</span><span>${new Date(
            res.date
          ).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span></div>
          <div class="history-line"><span>Température max :</span><span>${res.tmax}°C</span></div>
          <div class="history-line"><span>Température min :</span><span>${res.tmin}°C</span></div>
          <div class="history-line"><span>Pluie :</span><span>${res.rain} mm</span></div>
          <div class="history-line"><span>Vent max :</span><span>${res.wind} km/h</span></div>
        </div>
      `;
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", exitHistoryMode);
  }
}

function exitHistoryMode() {
  if (!detailsHistory || !detailsCurrent) return;
  detailsHistory.classList.add("hidden");
  detailsHistory.innerHTML = "";
  detailsCurrent.classList.remove("hidden");
  const windBlock = document.querySelector(".wind-block");
  if (windBlock) windBlock.classList.remove("hidden");
}

// bouton dans le header des détails
if (btnHistory) {
  btnHistory.addEventListener("click", enterHistoryMode);
}

/* ===========================================================
   PLUIE REALISTE – INITIALISATION & CONTROLE
   =========================================================== */

let rainInitialized = false;
let rainCanvas = null;
let rainCtx = null;

/* ==== RAIN VISUAL TUNING (SAFE OVERRIDE) ==== */
const RAIN_MIN_LENGTH = 6;
const RAIN_MAX_LENGTH = 12;
const RAIN_MIN_SPEED  = 7;
const RAIN_MAX_SPEED  = 12;
const RAIN_WIDTH      = 0.8;
/* =========================================== */

let rainDrops = [];
let rainRunning = false;
let rainVX = 0;

function initRainScene() {
  if (rainInitialized) return;
  const scene = document.getElementById("rain-scene");
  if (!scene) return;
  rainInitialized = true;

  rainCanvas = document.createElement("canvas");
  rainCanvas.id = "rain-canvas";
  rainCanvas.style.position = "absolute";
  rainCanvas.style.inset = "0";
  rainCanvas.style.width = "100%";
  rainCanvas.style.height = "100%";
  rainCanvas.style.pointerEvents = "none";
  scene.appendChild(rainCanvas);

  rainCtx = rainCanvas.getContext("2d");
  resizeRainCanvas();
  window.addEventListener("resize", resizeRainCanvas);
}

function resizeRainCanvas() {
  if (!rainCanvas || !rainCtx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = rainCanvas.getBoundingClientRect();
  rainCanvas.width = rect.width * dpr;
  rainCanvas.height = rect.height * dpr;
  rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createRainDrops(intensity) {
  if (!rainCanvas) return;
  rainDrops = [];

  const rect = rainCanvas.getBoundingClientRect();
  const width = rect.width || window.innerWidth;
  const height = rect.height || window.innerHeight;

  const count = Math.min(220, Math.floor(100 + intensity * 160));

  for (let i = 0; i < count; i++) {
    rainDrops.push({
      x: Math.random() * width,
      y: Math.random() * height,
      len: Math.random(),
      speed: 55 + Math.random() * 55,   // ✅ très rapide
      thickness: 0.6 + Math.random() * 0.5,
      alpha: 0.25 + Math.random() * 0.25
    });
  }
}


function startRain(intensity) {
  if (!rainCanvas || !rainCtx) initRainScene();
  if (!rainCanvas || !rainCtx) return;
  createRainDrops(intensity);
  if (!rainRunning) {
    rainRunning = true;
    requestAnimationFrame(animateRain);
  }
}

function stopRain() {
  rainRunning = false;
  if (rainCtx && rainCanvas) {
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
  }
}

function animateRain() {
  if (!rainRunning || !rainCtx || !rainCanvas) return;

  const dpr = window.devicePixelRatio || 1;
  const w = rainCanvas.width;
  const h = rainCanvas.height;
  const viewW = w / dpr;
  const viewH = h / dpr;

  rainCtx.clearRect(0, 0, w, h);

  // angle constant, PAS de trig par goutte
  const dx = rainVX * 0.015;

  for (const d of rainDrops) {
    const len = 18 + d.len * 28;

    rainCtx.beginPath();
    rainCtx.strokeStyle = `rgba(255,255,255,${d.alpha})`;
    rainCtx.lineWidth = d.thickness;
    rainCtx.moveTo(d.x, d.y);
    rainCtx.lineTo(d.x + dx, d.y + len);
    rainCtx.stroke();

    // ✅ gravité PURE : on descend toujours
    d.x += dx;
    d.y += d.speed;

    if (d.y > viewH + 40) {
      d.y = -40 - Math.random() * 60;
      d.x = Math.random() * viewW;
    }
  }

  if (rainRunning) requestAnimationFrame(animateRain);
}


function applyRainFX(j) {
  if (!j || !j.current) {
    document.body.classList.remove("weather-rain");
    stopRain();
    return;
  }

  const c = j.current;
  const rainAmt = (c.rain ?? c.precipitation ?? 0);
  const windSpeed = c.wind_speed_10m ?? 0;

  if (rainAmt <= 0) {
    document.body.classList.remove("weather-rain");
    stopRain();
    return;
  }

  document.body.classList.add("weather-rain");
  initRainScene();

  // ✅ vent = dérive horizontale légère
  rainVX = windSpeed * 2;

  const intensity = Math.min(1.5, 0.5 + rainAmt / 2.5);
  startRain(intensity);
}

function updateRadarClock(isoTime, timezone) {
  const el = document.getElementById("radar-clock");
  if (!el || !isoTime) return;
  try {
    const d = new Date(isoTime);
    const opts = { hour: '2-digit', minute: '2-digit', timeZone: timezone || 'UTC' };
    el.textContent = new Intl.DateTimeFormat('fr-FR', opts).format(d);
  } catch(e) {}
}



/* -------------------------------------------------
   HORLOGE LOCALE AUTO (mise à jour continue)
------------------------------------------------- */
let radarClockTimer = null;

function startRadarClock(timezone) {
  const el = document.getElementById("radar-clock");
  if (!el || !timezone) return;

  if (radarClockTimer) clearInterval(radarClockTimer);

  const update = () => {
    try {
      const now = new Date();
      const local = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      const h = String(local.getHours()).padStart(2, "0");
      const m = String(local.getMinutes()).padStart(2, "0");
      el.textContent = `${h}:${m}`;
    } catch (e) {}
  };

  update();
  radarClockTimer = setInterval(update, 30000); // toutes les 30 secondes
}


/* ================= HORLOGE LOCALE (SAFE PATCH) ================= */
let __radarClockTimerSafe = null;
function startRadarClockSafe(timezone) {
  const el = document.getElementById("radar-clock");
  if (!el || !timezone) return;

  if (__radarClockTimerSafe) clearInterval(__radarClockTimerSafe);

  const tick = () => {
    try {
      const now = new Date();
      const local = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      const h = String(local.getHours()).padStart(2, "0");
      const m = String(local.getMinutes()).padStart(2, "0");
      el.textContent = `${h}:${m}`;
    } catch (e) {}
  };

  tick();
  __radarClockTimerSafe = setInterval(tick, 30000);
}


/* --------------------------------------------------------------------------
   Heure locale + thème auto basé sur la ville sélectionnée
-------------------------------------------------------------------------- */



// Update every minute
function suggestNearbyCity(currentLat, currentLon) {
  if (!cities || cities.length === 0) return;

  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  let closest = null;
  let minDist = Infinity;

  cities.forEach(c => {
    const d = distanceKm(currentLat, currentLon, c.lat, c.lon);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  });

  if (closest && minDist < 30) {
    showToast(
      `Position approximative. Utiliser ${closest.name} ?`,
      "action",
      {
        label: "Oui",
        onClick: () => selectCity(closest)
      }
    );
  }
}

/* @PATCH Prévisions 24h – ajout non destructif */
(function(){
  const btnAddCityHeader = document.getElementById("btn-add-city");
  const addCityPanel = document.getElementById("add-city-panel");
  const cityInput = document.getElementById("city-input");
  if (btnAddCityHeader && addCityPanel && cityInput){
    btnAddCityHeader.addEventListener("click", ()=>{
      addCityPanel.scrollIntoView({behavior:"smooth",block:"center"});
      setTimeout(()=>cityInput.focus(),200);
    });
  }

  const btn24h = document.getElementById("btn-24h");
  if (!btn24h) return;

  function openNext24Hours(){
    if (typeof lastForecastData === "undefined" || !lastForecastData || !selectedCity){
      if (typeof showToast === "function") showToast("Ajoute d'abord une ville.", "info");
      return;
    }
    if (typeof dayOverlay === "undefined") return;

    const h = lastForecastData.hourly;
    const now = new Date();
    const end = new Date(now.getTime()+24*3600*1000);
    const times = h.time.map(t=>new Date(t));

    const hours=[], temps=[], rains=[], winds=[], humidities=[];
    for(let i=0;i<times.length;i++){
      if(times[i]>=now && times[i]<=end){
        hours.push(times[i].getHours());
        temps.push(h.temperature_2m[i]);
        rains.push(h.precipitation[i]);
        winds.push(h.wind_speed_10m[i]);
        if (h.relative_humidity_2m) humidities.push(h.relative_humidity_2m[i]);
      }
    }
    if(!hours.length){
      for(let i=0;i<Math.min(24,times.length);i++){
        hours.push(times[i].getHours());
        temps.push(h.temperature_2m[i]);
        rains.push(h.precipitation[i]);
        winds.push(h.wind_speed_10m[i]);
        if (h.relative_humidity_2m) humidities.push(h.relative_humidity_2m[i]);
      }
    }
    currentDaySeries = {hours,temps,rains,winds,humidities};
    if (typeof setActiveDayTab === "function") setActiveDayTab("temp");
    if (typeof dayOverlayTitle!=="undefined") dayOverlayTitle.textContent = `Prochaines 24 h · ${selectedCity.name}`;
    if (typeof dayOverlaySubtitle!=="undefined"){
      dayOverlaySubtitle.textContent = `De ${now.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} à ${end.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`;
    }
    dayOverlay.classList.add("active");
    document.body.classList.add("no-scroll");
  }
  btn24h.addEventListener("click", openNext24Hours);
})();


/* @PATCH AddCityPopup – popup réutilisant le panneau existant */
(function(){
  const btnAddCityHeader = document.getElementById("btn-add-city");
  const overlay = document.getElementById("add-city-overlay");
  const closeBtn = document.getElementById("btn-close-add-city");
  const popupSlot = document.getElementById("add-city-popup-slot");
  const panel = document.getElementById("add-city-panel");
  const input = document.getElementById("city-input");

  if(!btnAddCityHeader || !overlay || !panel) return;

  const originalParent = panel.parentElement;
  const originalNext = panel.nextSibling;

  function openPopup(){
    popupSlot.appendChild(panel);
    overlay.classList.add("active");
    document.body.classList.add("no-scroll");
    setTimeout(()=>input && input.focus(),150);
  }

  function closePopup(){
    if(originalNext){
      originalParent.insertBefore(panel, originalNext);
    } else {
      originalParent.appendChild(panel);
    }
    overlay.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }

  btnAddCityHeader.addEventListener("click", openPopup);
  closeBtn && closeBtn.addEventListener("click", closePopup);
  overlay.querySelector(".overlay-backdrop")
    .addEventListener("click", closePopup);
})();


/* @PATCH AddCityPopup AutoClose */
(function(){
  const overlay = document.getElementById("add-city-overlay");
  const panel = document.getElementById("add-city-panel");
  if(!overlay || !panel) return;

  // observe clicks inside autocomplete or city list
  panel.addEventListener("click", (e)=>{
    const li = e.target.closest("li");
    if(!li) return;

    // delay to let existing logic finish (fetch / render)
    setTimeout(()=>{
      overlay.classList.remove("active");
      document.body.classList.remove("no-scroll");
    },150);
  });
})();
function updateAddCityButtonVisibility() {
  const btnAddCity = document.getElementById("btn-add-city");
  if (!btnAddCity) return;

  // on considère qu'une "vraie" ville ≠ position
  const hasRealCity = cities.some(c => !c.isCurrentLocation);

  if (!hasRealCity) {
    btnAddCity.classList.add("hidden");
  } else {
    btnAddCity.classList.remove("hidden");
  }
}



// ===== PATCH 24H TIMELINE TOGGLE =====
const _btn24h = document.getElementById("btn-24h");
const _timeline24h = document.getElementById("timeline-24h");

if (_btn24h && _timeline24h) {
  _btn24h.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lastForecastData) return;

    _timeline24h.classList.toggle("hidden");
    if (!_timeline24h.classList.contains("hidden")) {
      renderTimeline24h(lastForecastData);
    }
  });
}
// ====================================


// ===============================
// ✅ FINAL LOGIQUE : MAJ AU CLIC VILLE
// ===============================

// point d'entrée UNIQUE quand on choisit une ville
async function selectCity(city) {
  if (!city || !city.lat || !city.lon) return;
  await loadCityWeather(city.lat, city.lon, city.name);
}

// surcharge sécurisée du click sur une ville
document.addEventListener("click", e => {
  const cityEl = e.target.closest("[data-lat][data-lon]");
  if (!cityEl) return;

  const city = {
    name: cityEl.dataset.name || "",
    lat: cityEl.dataset.lat,
    lon: cityEl.dataset.lon
  };

  selectCity(city);
});
// === Flèches de scroll pour la timeline 24h ===
document.addEventListener("DOMContentLoaded", () => {
  const timeline = document.getElementById("timeline-24h");
  if (!timeline) return;

  // évite double-wrapper si jamais le script est chargé 2 fois
  if (timeline.parentElement && timeline.parentElement.classList.contains("timeline-24h-wrapper")) {
    return;
  }

  const parent = timeline.parentElement;
  if (!parent) return;

  const wrapper = document.createElement("div");
  wrapper.className = "timeline-24h-wrapper";
  parent.insertBefore(wrapper, timeline);

  const arrowLeft = document.createElement("button");
  arrowLeft.className = "timeline-arrow timeline-arrow-left";
  arrowLeft.type = "button";
  arrowLeft.textContent = "‹";

  const arrowRight = document.createElement("button");
  arrowRight.className = "timeline-arrow timeline-arrow-right";
  arrowRight.type = "button";
  arrowRight.textContent = "›";

  wrapper.appendChild(arrowLeft);
  wrapper.appendChild(timeline);
  wrapper.appendChild(arrowRight);

  const scrollAmount = 3 * 56; // ~ 3 cartes

  arrowLeft.addEventListener("click", (e) => {
    e.stopPropagation();
    timeline.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });

  arrowRight.addEventListener("click", (e) => {
    e.stopPropagation();
    timeline.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });
});



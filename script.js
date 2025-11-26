/* ========================================================================== */
/* CONFIGURATION                                                              */
/* ========================================================================== */

const OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_WEATHER = "https://api.open-meteo.com/v1/forecast";

const STORAGE_CITIES = "meteosplash_v4_cities";
const STORAGE_THEME = "meteosplash_v4_theme";

let cities = [];
let selectedCity = null;

/* ========================================================================== */
/* SHORTCUTS                                                                  */
/* ========================================================================== */

const $ = id => document.getElementById(id);

/* ========================================================================== */
/* INIT                                                                        */
/* ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    loadCities();

    renderCities();

    $("btn-theme-toggle").addEventListener("click", toggleTheme);
    $("btn-geolocate").addEventListener("click", detectPosition);
    $("btn-speak").addEventListener("click", speakWeather);

    $("btn-add-city").addEventListener("click", addCityFromInput);
    $("city-input").addEventListener("keyup", handleInputKey);

    $("sort-select").addEventListener("change", () => {
        sortCities();
        renderCities();
    });
});

/* ========================================================================== */
/* AUTOCOMPLETE                                                               */
/* ========================================================================== */

let autocompleteTimer = null;

$("city-input").addEventListener("input", e => {
    clearTimeout(autocompleteTimer);
    const q = e.target.value.trim();
    if (!q) {
        $("autocomplete-list").innerHTML = "";
        return;
    }
    autocompleteTimer = setTimeout(() => fetchAutocomplete(q), 300);
});

async function fetchAutocomplete(q) {
    try {
        const url = `${OPEN_METEO_GEOCODE}?name=${encodeURIComponent(q)}&count=8&language=fr`;
        const res = await fetch(url);
        const data = await res.json();
        renderAutocomplete(data.results || []);
    } catch (err) {
        console.error("Autocomplete error:", err);
    }
}

function renderAutocomplete(list) {
    const ul = $("autocomplete-list");
    ul.innerHTML = "";
    list.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.name}, ${item.country}`;
        li.addEventListener("click", () => {
            $("city-input").value = item.name;
            ul.innerHTML = "";
        });
        ul.appendChild(li);
    });
}

/* ========================================================================== */
/* AJOUT DE VILLE                                                             */
/* ========================================================================== */

async function addCityFromInput() {
    const name = $("city-input").value.trim();
    if (!name) return;

    const city = await geocodeCity(name);
    if (!city) {
        alert("Ville introuvable !");
        return;
    }

    cities.push(city);
    saveCities();

    $("city-input").value = "";
    $("autocomplete-list").innerHTML = "";

    sortCities();
    renderCities();
}

async function geocodeCity(query) {
    try {
        const url = `${OPEN_METEO_GEOCODE}?name=${encodeURIComponent(query)}&count=1&language=fr`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.results || !data.results.length) return null;

        const c = data.results[0];

        return {
            id: `${c.latitude},${c.longitude}`,
            name: c.name,
            country: c.country,
            lat: c.latitude,
            lon: c.longitude
        };
    } catch (err) {
        return null;
    }
}

function handleInputKey(e) {
    if (e.key === "Enter") addCityFromInput();
}

/* ========================================================================== */
/* SAUVEGARDE LOCALSTORAGE                                                    */
/* ========================================================================== */

function saveCities() {
    localStorage.setItem(STORAGE_CITIES, JSON.stringify(cities));
}

function loadCities() {
    try {
        const raw = localStorage.getItem(STORAGE_CITIES);
        cities = raw ? JSON.parse(raw) : [];
    } catch {
        cities = [];
    }
}

function saveTheme() {
    localStorage.setItem(STORAGE_THEME, document.body.classList.contains("theme-day") ? "day" : "night");
}

function loadTheme() {
    const t = localStorage.getItem(STORAGE_THEME);
    if (t === "day") document.body.classList.add("theme-day");
}

/* ========================================================================== */
/* TRI DES VILLES                                                             */
/* ========================================================================== */

function sortCities() {
    const mode = $("sort-select").value;

    if (mode === "alpha") {
        cities.sort((a, b) => a.name.localeCompare(b.name));
    } else if (mode === "temp") {
        cities.sort((a, b) => (a.temp ?? 0) - (b.temp ?? 0));
    } else if (mode === "pleasant") {
        cities.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    }
}

/* ========================================================================== */
/* AFFICHAGE LISTE DES VILLES                                                 */
/* ========================================================================== */

async function renderCities() {
    const root = $("city-list");
    root.innerHTML = "";

    for (const c of cities) {
        const meteo = await fetchWeather(c.lat, c.lon);
        c.temp = meteo.temp;
        c.score = meteo.score;
        saveCities();

        const div = document.createElement("div");
        div.className = "city-item";

        div.innerHTML = `
            <div class="city-info">
                <h3>${c.name} <span style="opacity:0.6">${c.country}</span></h3>
                <p>Temp : ${meteo.temp}°C</p>
            </div>
            <button class="icon-button" onclick="removeCity('${c.id}')">❌</button>
        `;

        div.addEventListener("click", () => showDetails(c));
        root.appendChild(div);
    }
}

/* ========================================================================== */
/* SUPPRESSION                                                                */
/* ========================================================================== */

function removeCity(id) {
    cities = cities.filter(c => c.id !== id);
    saveCities();
    renderCities();
    $("details").innerHTML = "";
}

/* ========================================================================== */
/* DÉTAILS MÉTÉO                                                              */
/* ========================================================================== */

async function showDetails(c) {
    selectedCity = c;
    const meteo = await fetchWeather(c.lat, c.lon);

    $("details-title").textContent = `${c.name} (${c.country})`;

    $("details").innerHTML = `
        <p><b>Température :</b> ${meteo.temp}°C</p>
        <p><b>Ressenti :</b> ${meteo.feels}°C</p>
        <p><b>Humidité :</b> ${meteo.humidity}%</p>
        <p><b>Vent :</b> ${meteo.wind} km/h — Direction ${meteo.windDir}°</p>
        <p><b>Pression :</b> ${meteo.pressure} hPa</p>
        <p><b>Précipitations :</b> ${meteo.precip} mm</p>
    `;

    updateRadar(c.lat, c.lon);
}

/* ========================================================================== */
/* FETCH MÉTÉO                                                                */
/* ========================================================================== */

async function fetchWeather(lat, lon) {
    const url = `${OPEN_METEO_WEATHER}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,pressure_msl,precipitation,temperature_2m,windspeed_10m,winddirection_10m`;

    const res = await fetch(url);
    const data = await res.json();

    const cw = data.current_weather;

    return {
        temp: Math.round(cw.temperature),
        feels: Math.round((data.hourly.temperature_2m[0] ?? cw.temperature)),
        humidity: data.hourly.relativehumidity_2m[0] ?? 0,
        precip: data.hourly.precipitation[0] ?? 0,
        pressure: Math.round(data.hourly.pressure_msl[0] ?? 0),
        wind: Math.round(cw.windspeed),
        windDir: cw.winddirection,
        score: Math.abs(cw.temperature - 22) + Math.abs((data.hourly.relativehumidity_2m[0] ?? 50) - 50) / 2
    };
}

/* ========================================================================== */
/* RADAR                                                                      */
/* ========================================================================== */

function updateRadar(lat, lon) {
    $("radar-frame").src =
        `https://www.rainviewer.com/map.html?loc=${lat},${lon},7&oFa=0&oFc=0&oC=0&layer=radar&sm=1&sn=1`;
}

/* ========================================================================== */
/* GÉOLOCALISATION                                                            */
/* ========================================================================== */

function detectPosition() {
    if (!navigator.geolocation) {
        alert("La géolocalisation n’est pas supportée.");
        return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const city = {
            id: `${lat},${lon}`,
            name: "Ma position",
            country: "",
            lat,
            lon
        };

        showDetails(city);
    }, () => {
        alert("Impossible de récupérer la position.");
    });
}

/* ========================================================================== */
/* MÉTÉO PARLÉE                                                               */
/* ========================================================================== */

function speakWeather() {
    if (!selectedCity) {
        alert("Sélectionne une ville d’abord.");
        return;
    }

    const text = `Voici la météo pour ${selectedCity.name}. Température ${selectedCity.temp} degrés. Vent ${
        selectedCity.wind
    } kilomètres heure. Humidité ${selectedCity.humidity} pour cent. Bonne journée !`;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "fr-FR";
    speechSynthesis.speak(utter);
}

/* ========================================================================== */
/* THÈME JOUR/NUIT                                                            */
/* ========================================================================== */

function toggleTheme() {
    document.body.classList.toggle("theme-day");
    saveTheme();
}

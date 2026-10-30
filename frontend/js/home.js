
const API_BASE = "http://127.0.0.1:5000";

// =====================================
// SAFE HTML TEXT
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// =====================================
// NAVBAR
// =====================================

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const profileBtn = document.getElementById("profileBtn");

function getLoggedInUser() {
    try {
        const savedUser = localStorage.getItem("user");
        if (!savedUser) return null;
        return JSON.parse(savedUser);
    } catch (error) {
        console.error("User data error:", error);
        return null;
    }
}

function updateNavbar() {
    const user = getLoggedInUser();
    const loggedIn = Boolean(user && typeof user === "object");

    if (loginBtn) loginBtn.style.display = loggedIn ? "none" : "inline";
    if (registerBtn) registerBtn.style.display = loggedIn ? "none" : "inline";
    if (logoutBtn) logoutBtn.style.display = loggedIn ? "inline" : "none";
    if (profileBtn) profileBtn.style.display = loggedIn ? "inline" : "none";
}

updateNavbar();


// =====================================
// LOGOUT
// =====================================

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function (event) {
        event.preventDefault();

        if (logoutBtn.dataset.loggingOut === "true") return;

        logoutBtn.dataset.loggingOut = "true";
        logoutBtn.textContent = "Logging out...";

        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: "POST",
                credentials: "include"
            });
        } catch (error) {
            console.error("Logout API error:", error);
        } finally {
            localStorage.removeItem("user");
            updateNavbar();
            window.location.replace("home.html");
        }
    });
}


// =====================================
// GET PRODUCT IMAGE
// =====================================

async function getProductImage(productId) {
    try {
        const response = await fetch(
            `${API_BASE}/api/products/${encodeURIComponent(productId)}`,
            { credentials: "include" }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const product = data.product;

        if (!data.success || !product) return null;

        return product.image_url || product.image_path || null;

    } catch (error) {
        console.error("Image loading error:", error);
        return null;
    }
}


// =====================================
// CREATE PRODUCT CARD
// =====================================

function createProductCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.cursor = "pointer";

    const imageBox = document.createElement("div");
    imageBox.className = "product-image";
    imageBox.innerHTML = "<span>🛍️</span>";

    const img = document.createElement("img");
    img.alt = product.title || "Product image";

    img.style.cssText =
        "width:100%;height:100%;object-fit:contain;display:none;";

    img.onerror = function () {
        img.style.display = "none";

        if (!imageBox.querySelector("span")) {
            imageBox.innerHTML = "<span>🛍️</span>";
        }
    };

    img.onload = function () {
        img.style.display = "block";

        const placeholder = imageBox.querySelector("span");
        if (placeholder) placeholder.remove();
    };

    imageBox.appendChild(img);

    const info = document.createElement("div");
    info.className = "product-info";

    info.innerHTML = `
        <div class="product-category">
            ${escapeHTML(product.category || "Other")}
        </div>

        <div class="product-title">
            ${escapeHTML(product.title || "Untitled product")}
        </div>

        <div class="product-description">
            ${escapeHTML(product.description || "")}
        </div>

        <div class="product-price">
            ₹${Number(product.price || 0).toLocaleString("en-IN")}
        </div>

        <div class="product-condition">
            Condition: ${escapeHTML(product.condition_type || "Not specified")}
        </div>

        <div class="product-seller">
            Seller: ${escapeHTML(product.seller || "Unknown")}
        </div>
    `;

    card.append(imageBox, info);

    card.addEventListener("click", function () {
        window.location.href =
            `product.html?id=${encodeURIComponent(product.id)}`;
    });

    if (product.id != null) {
        getProductImage(product.id).then(imagePath => {
            if (!imagePath) return;

            const imageURL =
                imagePath.startsWith("http://") ||
                imagePath.startsWith("https://")
                    ? imagePath
                    : `${API_BASE}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;

            img.src = imageURL;
        });
    }

    return card;
}


// =====================================
// LOAD ALL PRODUCTS WITH FILTERS
// =====================================

async function loadProducts() {
    const container = document.getElementById("productsContainer");

    if (!container) return;

    const params = new URLSearchParams();

    const fields = {
        search: "searchInput",
        category: "categoryFilter",
        min_price: "minPrice",
        max_price: "maxPrice",
        condition: "conditionFilter",
        sort: "sortFilter"
    };

    for (const [param, elementId] of Object.entries(fields)) {
        const element = document.getElementById(elementId);

        if (element && element.value.trim() !== "") {
            params.append(param, element.value.trim());
        }
    }

    container.innerHTML = "<p>Loading all products...</p>";

    try {
        const response = await fetch(
            `${API_BASE}/api/products?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            container.innerHTML = "<p>Unable to load products.</p>";
            return;
        }

        container.innerHTML = "";

        if (!data.products || data.products.length === 0) {
            container.innerHTML = "<p>No products found.</p>";
            return;
        }

        data.products.forEach(product => {
            container.appendChild(createProductCard(product));
        });

    } catch (error) {
        console.error("Product loading error:", error);
        container.innerHTML = "<p>Unable to connect to server.</p>";
    }
}


// =====================================
// CITY-BASED PRODUCTS
// =====================================

async function loadCityProducts(city) {
    const container = document.getElementById("cityProducts");
    const selectedCityText = document.getElementById("selectedCityText");

    if (!container || !selectedCityText) return;

    if (!city) {
        container.innerHTML = "";
        selectedCityText.textContent = "";
        return;
    }

    selectedCityText.textContent = `Products available in ${city}`;
    container.innerHTML = "<p>Loading city products...</p>";

    try {
        const response = await fetch(
            `${API_BASE}/api/products/city?city=${encodeURIComponent(city)}`
        );

        const data = await response.json();

        container.innerHTML = "";

        if (
            !response.ok ||
            !data.success ||
            !data.products ||
            data.products.length === 0
        ) {
            container.innerHTML =
                `<p>No products found in ${escapeHTML(city)}.</p>`;
            return;
        }

        data.products.forEach(product => {
            container.appendChild(createProductCard(product));
        });

    } catch (error) {
        console.error("City products error:", error);
        container.innerHTML = "<p>Unable to load city products.</p>";
    }
}


// =====================================
// CITY SELECTION
// =====================================

const citySelect = document.getElementById("citySelect");
const saveCityBtn = document.getElementById("saveCityBtn");

// Restore saved city in dropdown ONLY.
// Do not automatically load city products.
// Always show the default prompt when opening the homepage
if (citySelect) {
    citySelect.selectedIndex = 0;
}

// Initial city section message
const selectedCityText = document.getElementById("selectedCityText");
const cityProducts = document.getElementById("cityProducts");

if (selectedCityText) {
    selectedCityText.textContent = "Select your city to find local products";
}

if (cityProducts) {
    cityProducts.innerHTML = "";
}

// Load city products only after clicking Save City.
if (saveCityBtn && citySelect) {
    saveCityBtn.addEventListener("click", function () {
        const city = citySelect.value;

        if (!city) {
            alert("Please select your city.");
            return;
        }

        localStorage.setItem("thriftbuy_city", city);
        loadCityProducts(city);
    });
}


// =====================================
// SEARCH BUTTON
// =====================================

const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {
    searchBtn.addEventListener("click", loadProducts);
}


// =====================================
// SEARCH USING ENTER KEY
// =====================================

const searchInput = document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            loadProducts();
        }
    });
}


// =====================================
// INITIAL PAGE LOAD
// =====================================

// Always display all products when the homepage opens.
loadProducts();

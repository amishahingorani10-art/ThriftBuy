
const API_BASE = "http://127.0.0.1:5000/api";

document.addEventListener("DOMContentLoaded", loadProduct);

async function loadProduct() {
    const productId = new URLSearchParams(window.location.search).get("id");

    if (!productId || !/^\d+$/.test(productId)) {
        showMessage("Invalid product ID.");
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/products/${encodeURIComponent(productId)}`
        );

        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.message || "Product not found.");
        }

        const product = result.product || result;

        if (!product || !product.id) {
            throw new Error("Product not found.");
        }

        displayProduct(product);
    } catch (error) {
        console.error("Product loading error:", error);
        showMessage(error.message || "Unable to load product. Please try again.");
    }
}

function displayProduct(product) {
    const container =
        document.querySelector("#productDetails") ||
        document.querySelector(".product-details") ||
        document.querySelector(".product-container") ||
        document.querySelector("main") ||
        document.body;

    const title = escapeHTML(product.title || "Untitled product");
    const category = escapeHTML(product.category || "General");
    const description = escapeHTML(
        product.description || "No description provided."
    );
    const brand = escapeHTML(product.brand || "Not specified");
    const condition = escapeHTML(product.condition_type || "Not specified");
    const seller = escapeHTML(product.seller || "Seller");
    const price = Number(product.price || 0);
    const originalPrice = Number(product.original_price || 0);
    const negotiable = Number(product.is_negotiable) === 1;
    const imagePath = product.image_path || product.image_url || "";

    // Check whether the logged-in user owns this product
let currentUser = null;

try {
    currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch (error) {
    currentUser = null;
}

const isOwner =
    currentUser &&
    Number(currentUser.id) === Number(product.seller_id);

console.log("Product seller ID:", product.seller_id);
console.log("Logged-in user:", currentUser);
console.log("Is owner:", isOwner);

    const imageURL = imagePath
        ? (imagePath.startsWith("http://") || imagePath.startsWith("https://")
            ? imagePath
            : `http://127.0.0.1:5000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`)
        : "";

    const formatPrice = value =>
        "₹" + value.toLocaleString("en-IN", {
            maximumFractionDigits: 2
        });

    // Image functionality will be completed later.
    container.innerHTML = `
        <section class="product-detail-layout">
            <div class="product-detail-image">
        <img
            id="productDetailImage"
            alt="${title}"
            style="width:100%;height:350px;object-fit:contain;display:none;"
        >
        <div id="productImagePlaceholder" class="image-placeholder">
            Product image not available
        </div>
        </div>

            <div class="product-detail-info">
                <p class="product-category">${category}</p>

                <h1>${title}</h1>

                <h2 class="product-price">${formatPrice(price)}</h2>

                ${
                    originalPrice > price
                        ? `<p class="original-price">
                               Original price: <del>${formatPrice(originalPrice)}</del>
                           </p>`
                        : ""
                }

                <p class="product-description">${description}</p>

                <div class="product-attributes">
                    <p><strong>Brand:</strong> ${brand}</p>
                    <p><strong>Condition:</strong> ${condition}</p>
                    <p><strong>Negotiable:</strong> ${negotiable ? "Yes" : "No"}</p>
                    ${
                        product.city
                            ? `<p><strong>City:</strong> ${escapeHTML(product.city)}</p>`
                            : ""
                    }
                </div>

                <div class="seller-card">
                    <h3>Seller</h3>
                    <p>${seller}</p>
                    ${isOwner ? `
    <button type="button" id="editProductButton">
        Edit Product
    </button>
` : ""}

                    <button type="button" id="contactSellerButton">
                        Contact Seller
                    </button>

                    <button type="button" id="addToCartButton">
                        Add to Cart
                    </button>

                    <p id="productActionMessage" role="status" aria-live="polite"></p>
                </div>
            </div>
        </section>

        <style>
            .product-detail-layout {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
                max-width: 1150px;
                margin: 40px auto;
                padding: 32px;
                background: white;
                border-radius: 14px;
                box-shadow: 0 5px 20px #00000012;
            }

            .product-detail-image {
                min-height: 350px;
                background: #f0f0f0;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                color: #666;
            }

            .product-detail-info h1 {
                font-size: 36px;
                margin: 10px 0;
            }

            .product-category {
                color: #777;
                text-transform: uppercase;
            }

            .product-price {
                font-size: 28px;
                margin: 16px 0;
            }

            .product-description {
                margin: 24px 0;
                white-space: pre-wrap;
            }

            .product-attributes p {
                margin: 12px 0;
            }

            .seller-card {
                background: #f5f5f5;
                padding: 20px;
                border-radius: 10px;
                margin-top: 28px;
            }

            .seller-card button {
                display: block;
                width: 100%;
                padding: 15px;
                margin-top: 12px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
            }

            #contactSellerButton {
                background: #222;
                color: white;
            }

            #addToCartButton {
                background: #2864e8;
                color: white;
            }

            .seller-card button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            #productActionMessage {
                margin-top: 12px;
            }

            @media (max-width: 700px) {
                .product-detail-layout {
                    grid-template-columns: 1fr;
                    margin: 16px;
                    padding: 18px;
                }

                .product-detail-info h1 {
                    font-size: 28px;
                }
            }
        </style>
    `;

    const image = document.getElementById("productDetailImage");
const placeholder = document.getElementById("productImagePlaceholder");

if (imageURL) {
    image.onload = () => {
        image.style.display = "block";
        placeholder.style.display = "none";
    };

    image.onerror = () => {
        image.style.display = "none";
        placeholder.style.display = "block";    
        placeholder.textContent = "Image could not be loaded";
        console.error("Image URL failed:", imageURL);
    };

    image.src = imageURL;
}
    document.getElementById("addToCartButton").addEventListener("click", () => {
        addToCart(product.id);
    });

    document.getElementById("contactSellerButton").addEventListener("click", () => {
        contactSeller(product);
    });
    const editButton = document.getElementById("editProductButton");

if (editButton) {
    editButton.addEventListener("click", () => {
        window.location.href =
            `sell.html?id=${encodeURIComponent(product.id)}`;
    });
}
}

async function addToCart(productId) {
    const message = document.getElementById("productActionMessage");
    const button = document.getElementById("addToCartButton");
    const user = localStorage.getItem("user");

    if (!user) {
        message.textContent = "Please log in before adding products to your cart.";
        return;
    }

    button.disabled = true;
    button.textContent = "Adding...";

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ product_id: productId })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message || data.error || "Could not add product to cart."
            );
        }

        message.textContent = data.message || "Product added to cart successfully!";
    } catch (error) {
        console.error("Add to cart error:", error);
        message.textContent = error.message || "Unable to add product to cart.";
    } finally {
        button.disabled = false;
        button.textContent = "Add to Cart";
    }
}



function contactSeller(product) {
    window.location.href =
        `seller-details.html?id=${encodeURIComponent(product.id)}`;
}


function showMessage(message) {
    const container =
        document.querySelector("#productDetails") ||
        document.querySelector(".product-details") ||
        document.querySelector(".product-container") ||
        document.querySelector("main") ||
        document.body;

    container.textContent = message;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

/* =========================
   LOGOUT FROM PRODUCT PAGE
========================= */

document.addEventListener("DOMContentLoaded", function () {
    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async function (event) {
        event.preventDefault();

        logoutBtn.textContent = "Logging out...";
        logoutBtn.style.pointerEvents = "none";

        try {
            await fetch(`${API_BASE.replace(/\/api$/, "")}/api/auth/logout`, {
                method: "POST",
                credentials: "include"
            });
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            // Clear local login information even if the server is unreachable.
            localStorage.removeItem("user");
            window.location.href = "login.html";
        }
    });
});


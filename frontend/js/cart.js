
const API_BASE = "http://127.0.0.1:5000/api";

document.addEventListener("DOMContentLoaded", loadCart);

async function loadCart() {
    const container = getCartContainer();

    if (!localStorage.getItem("user")) {
        container.innerHTML = `
            <div class="cart-empty">
                <h2>Please log in</h2>
                <p>Log in to view your shopping cart.</p>
                <a href="login.html">Login</a>
            </div>
        `;
        return;
    }

    container.innerHTML = "<p>Loading your cart...</p>";

    try {
        const response = await fetch(`${API_BASE}/cart`, {
            method: "GET",
            credentials: "include"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.error || "Unable to load cart.");
        }

        const items = Array.isArray(result)
            ? result
            : result.items || result.cart || result.products || [];

        renderCart(items);
    } catch (error) {
        console.error("Cart loading error:", error);
        container.innerHTML = `
            <div class="cart-empty">
                <h2>Unable to load cart</h2>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="loadCart()">Try Again</button>
            </div>
        `;
    }
}

function getCartContainer() {
    let container =
        document.querySelector("#cartItems") ||
        document.querySelector("#cart-items") ||
        document.querySelector(".cart-items") ||
        document.querySelector("#cartContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "cartItems";
        document.body.appendChild(container);
    }

    return container;
}

function renderCart(items) {
    const container = getCartContainer();

    if (!items.length) {
        container.innerHTML = `
            <div class="cart-empty">
                <h2>Your cart is empty</h2>
                <p>Explore THRIFTBUY and find something you like.</p>
                <a href="home.html">Continue Shopping</a>
            </div>
        `;

        updateSummary(0, 0);
        return;
    }

    let total = 0;

    container.innerHTML = `
        <div class="cart-products">
            ${items.map(item => {
                const productId = item.product_id ?? item.id;
                const title = item.title || item.name || "Product";
                const price = Number(item.price || 0);
                const imagePath = item.image_path || item.image_url || "";
                const imageURL = getProductImageURL(imagePath);

                total += price;

                return `
                    <article
                        class="cart-product"
                        data-product-id="${escapeHTML(productId)}"
                        tabindex="0"
                        role="link"
                        aria-label="View details for ${escapeHTML(title)}"
                        style="display:flex;gap:20px;align-items:center;
                        background:#fff;padding:20px;margin-bottom:16px;
                        border-radius:14px;box-shadow:0 4px 15px #0000000d;
                        cursor:pointer;">

                        <div class="cart-product-image"
                            style="width:150px;height:130px;flex-shrink:0;
                            background:#f0f0f0;border-radius:10px;overflow:hidden;
                            display:flex;align-items:center;justify-content:center;">

                            <img
                                src="${escapeHTML(imageURL)}"
                                alt="${escapeHTML(title)}"
                                style="width:100%;height:100%;object-fit:contain;
                                ${imageURL ? "" : "display:none;"}"
                                onerror="this.style.display='none';
                                this.nextElementSibling.style.display='flex';">

                            <div style="display:${imageURL ? "none" : "flex"};
                                width:100%;height:100%;align-items:center;
                                justify-content:center;color:#777;text-align:center;">
                                Image unavailable
                            </div>
                        </div>

                        <div style="flex:1;min-width:0;">
                            <h3 style="margin:0 0 10px;">
                                ${escapeHTML(title)}
                            </h3>

                            <p style="margin:8px 0;color:#2864e8;font-weight:bold;">
                                ₹${price.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}
                            </p>

                            <p style="margin:6px 0;color:#666;">
                                Seller: ${escapeHTML(
                                    item.seller_name || item.username || item.seller || "Seller"
                                )}
                            </p>

                            <p style="margin:6px 0;color:#666;">
                                Condition: ${escapeHTML(
                                    item.condition_type || item.condition || "Not specified"
                                )}
                            </p>

                            <p style="margin:6px 0;color:#666;">
                                City: ${escapeHTML(item.city || "Not specified")}
                            </p>

                            <small style="color:#2864e8;">
                                Click to view product details
                            </small>
                        </div>

                        <button type="button"
                            class="remove-cart-button"
                            data-product-id="${escapeHTML(productId)}"
                            style="padding:12px 18px;background:white;color:#e53935;
                            border:1px solid #e53935;border-radius:8px;cursor:pointer;">
                            Remove
                        </button>
                    </article>
                `;
            }).join("")}
        </div>
    `;

    // Open product details when the product card is clicked.
    container.querySelectorAll(".cart-product").forEach(card => {
        function openProduct() {
            const productId = card.dataset.productId;

            if (!productId || productId === "undefined") {
                alert("Product ID is missing.");
                return;
            }

            window.location.href =
                `product.html?id=${encodeURIComponent(productId)}`;
        }

        card.addEventListener("click", openProduct);

        // Also support keyboard navigation.
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openProduct();
            }
        });
    });

    // Remove button should remove the product, not open its details.
    container.querySelectorAll(".remove-cart-button").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            removeFromCart(button.dataset.productId, button);
        });
    });

    updateSummary(items.length, total);
}

function getProductImageURL(imagePath) {
    if (!imagePath) return "";

    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
        return imagePath;
    }

    return `http://127.0.0.1:5000${
        imagePath.startsWith("/") ? "" : "/"
    }${imagePath}`;
}

async function removeFromCart(productId, button) {
    if (!productId) {
        alert("Product ID is missing.");
        return;
    }

    button.disabled = true;
    button.textContent = "Removing...";

    try {
        const response = await fetch(
            `${API_BASE}/cart/${encodeURIComponent(productId)}`,
            {
                method: "DELETE",
                credentials: "include"
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.message || result.error || "Could not remove this product."
            );
        }

        await loadCart();
    } catch (error) {
        console.error("Remove cart item error:", error);
        alert(error.message);
        button.disabled = false;
        button.textContent = "Remove";
    }
}

function updateSummary(itemCount, total) {
    const itemCountElement =
        document.querySelector("#cartItemCount") ||
        document.querySelector("#itemCount") ||
        document.querySelector(".item-count");

    const totalElement =
        document.querySelector("#cartTotal") ||
        document.querySelector("#totalAmount") ||
        document.querySelector(".cart-total");

    if (itemCountElement) {
        itemCountElement.textContent = itemCount;
    }

    if (totalElement) {
        totalElement.textContent = `₹${total.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Logout from the cart page
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function (event) {
        event.preventDefault();

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/api/auth/logout",
                {
                    method: "POST",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                console.error("Logout request failed:", response.status);
            }
        } catch (error) {
            console.error("Logout request error:", error);
        } finally {
            localStorage.removeItem("user");
            window.location.href = "home.html";
        }
    });
}

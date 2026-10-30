
const API_BASE = "http://127.0.0.1:5000/api";

document.addEventListener("DOMContentLoaded", loadSellerDetails);

async function loadSellerDetails() {
    const productId = new URLSearchParams(window.location.search).get("id");
    const message = document.getElementById("sellerMessage");
    const whatsappButton = document.getElementById("whatsappButton");

    if (!productId || !/^\d+$/.test(productId)) {
        message.textContent = "Invalid product ID.";
        document.getElementById("sellerName").textContent = "Unavailable";
        document.getElementById("sellerCity").textContent = "Unavailable";
        document.getElementById("sellerPhone").textContent = "Unavailable";
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/products/${encodeURIComponent(productId)}`
        );
        const result = await response.json();

        if (!response.ok || result.success === false) {
            throw new Error(result.message || "Unable to load seller details.");
        }

        const product = result.product || result;

        document.getElementById("sellerName").textContent =
            product.seller || "Not provided";

        document.getElementById("sellerCity").textContent =
            product.seller_city || "Not provided";

        document.getElementById("sellerPhone").textContent =
            product.seller_phone || "Not provided";

        if (product.seller_phone) {
            whatsappButton.disabled = false;
            whatsappButton.addEventListener("click", function () {
                contactSeller(product);
            });
        } else {
            message.textContent = "The seller has not provided a phone number.";
        }
    } catch (error) {
        console.error("Seller details error:", error);
        message.textContent = error.message || "Unable to load seller details.";
    }
}

function contactSeller(product) {
    let phone = String(product.seller_phone || "").replace(/\D/g, "");

    // Format common Indian phone-number formats for WhatsApp.
    if (phone.length === 10) {
        phone = "91" + phone;
    } else if (phone.length === 11 && phone.startsWith("0")) {
        phone = "91" + phone.slice(1);
    }

    if (phone.length < 11 || phone.length > 15) {
        document.getElementById("sellerMessage").textContent =
            "The seller's phone number format is invalid.";
        return;
    }

    const message = encodeURIComponent(
        `Hi, I am interested in your product on THRIFTBUY. Is it still available?`
    );

    window.open(
        `https://wa.me/${phone}?text=${message}`,
        "_blank",
        "noopener,noreferrer"
    );
}

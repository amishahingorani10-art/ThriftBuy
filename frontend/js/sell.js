
console.log("SELL.JS WITH ADD AND EDIT SUPPORT LOADED");

const API_BASE = "http://127.0.0.1:5000";
const sellForm = document.getElementById("sellForm");
const productId = new URLSearchParams(window.location.search).get("id");
const isEditMode = Boolean(productId && /^\d+$/.test(productId));

const message = document.getElementById("sellMessage");
const button = document.getElementById("sellButton");
const imageInput = document.getElementById("productImage");

// Update the page title and button when editing.
if (isEditMode) {
    document.querySelector(".auth-card h1").textContent = "Edit Product";
    button.textContent = "Save Changes";
    loadProductForEditing();
}

// Load the existing product into the form.
async function loadProductForEditing() {
    message.textContent = "Loading product details...";

    try {
        const response = await fetch(
            `${API_BASE}/api/products/${encodeURIComponent(productId)}`,
            { credentials: "include" }
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.product) {
            throw new Error(data.message || "Unable to load product.");
        }

        const product = data.product;

        document.getElementById("title").value = product.title || "";
        document.getElementById("description").value =
            product.description || "";
        document.getElementById("price").value = product.price ?? "";
        document.getElementById("originalPrice").value =
            product.original_price ?? "";
        document.getElementById("brand").value = product.brand || "";
        document.getElementById("category").value =
            String(product.category_id || "");
        document.getElementById("condition").value =
            product.condition_type || "";
        document.getElementById("productCity").value =
            product.city || "";
        document.getElementById("negotiable").checked =
            Number(product.is_negotiable) === 1 ||
            product.is_negotiable === true;

        // Show the current image without requiring a new upload.
        if (product.image_path) {
            const preview = document.getElementById("imagePreview");
            const img = document.createElement("img");
            img.alt = "Current product image";
            img.src = product.image_path.startsWith("http")
                ? product.image_path
                : `${API_BASE}${product.image_path}`;

            preview.replaceChildren(img);
        }

        message.textContent = "Edit your product details below.";
    } catch (error) {
        console.error("Load product for editing error:", error);
        message.textContent = error.message;
        button.disabled = true;
    }
}

sellForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const imageFile = imageInput ? imageInput.files[0] : null;

    const title = document.getElementById("title").value.trim();
    const price = document.getElementById("price").value;
    const category = document.getElementById("category").value;
    const city = document.getElementById("productCity").value;

    if (!title || !price || !category || !city) {
        message.textContent =
            "Title, price, category and city are required.";
        return;
    }

    if (Number(price) <= 0) {
        message.textContent = "Selling price must be greater than zero.";
        return;
    }

    if (imageFile) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(imageFile.type)) {
            message.textContent = "Choose a JPG, PNG, or WebP image.";
            return;
        }

        if (imageFile.size > 5 * 1024 * 1024) {
            message.textContent = "Image must be 5 MB or smaller.";
            return;
        }
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append(
        "description",
        document.getElementById("description").value.trim()
    );
    formData.append("price", price);
    formData.append(
        "original_price",
        document.getElementById("originalPrice").value
    );
    formData.append(
        "brand",
        document.getElementById("brand").value.trim()
    );
    formData.append("category_id", category);
    formData.append(
        "condition_type",
        document.getElementById("condition").value
    );
    formData.append("city", city);
    formData.append(
        "is_negotiable",
        String(document.getElementById("negotiable").checked)
    );

    if (imageFile) {
        formData.append("productImage", imageFile);
    }

    button.disabled = true;
    message.textContent = isEditMode
        ? "Saving product changes..."
        : "Uploading product and image...";

    try {
        const url = isEditMode
            ? `${API_BASE}/api/products/${encodeURIComponent(productId)}`
            : `${API_BASE}/api/products`;

        const response = await fetch(url, {
            method: isEditMode ? "PUT" : "POST",
            credentials: "include",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || `Request failed (${response.status}).`
            );
        }

        message.textContent = isEditMode
            ? "Product updated successfully!"
            : "Product and image uploaded successfully!";

        const savedId = isEditMode ? productId : data.product_id;

        setTimeout(() => {
            window.location.href =
                `product.html?id=${encodeURIComponent(savedId)}`;
        }, 1000);

    } catch (error) {
        console.error("Save product error:", error);
        message.textContent =
            error.message || "Unable to connect to the backend.";
    } finally {
        button.disabled = false;
    }
});

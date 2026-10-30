
const API_BASE = "http://127.0.0.1:5000";

// ====================
// PASSWORD VALIDATION
// ====================

function validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push("at least 8 characters");
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("one capital letter");
    }

    if (!/[a-z]/.test(password)) {
        errors.push("one small letter");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("one number");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push("one special character");
    }

    return errors;
}

// ====================
// REGISTER
// ====================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const phone = document.getElementById("registerPhone").value.trim();
        const city = document.getElementById("registerCity").value;
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("registerMessage");
        const submitButton = registerForm.querySelector('button[type="submit"]');

        message.style.color = "red";

        // Required fields
        if (!name || !email || !phone || !city || !password || !confirmPassword) {
            message.textContent = "Please fill in all required fields.";
            return;
        }

        // Email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            message.textContent = "Please enter a valid email address.";
            return;
        }

        // Phone validation
        if (!/^[0-9]{10}$/.test(phone)) {
            message.textContent = "Please enter a valid 10-digit phone number.";
            return;
        }

        // Password strength
        const passwordErrors = validatePassword(password);

        if (passwordErrors.length > 0) {
            message.textContent =
                "Password must contain " + passwordErrors.join(", ") + ".";
            return;
        }

        // Confirm password
        if (password !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            return;
        }

        message.style.color = "#555";
        message.textContent = "Creating your account...";

        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    city: city,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                message.style.color = "green";
                message.textContent =
                    "Registration successful! Redirecting to login...";

                registerForm.reset();

                setTimeout(() => {
                    window.location.href = "login.html";
                }, 1200);

            } else {
                message.style.color = "red";
                message.textContent =
                    data.message || "Registration failed.";
            }

        } catch (error) {
            console.error("Registration error:", error);

            message.style.color = "red";
            message.textContent =
                "Unable to connect to server. Please check Flask.";

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// ====================
// LOGIN
// ====================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;
        const message = document.getElementById("loginMessage");

        if (!email || !password) {
            message.style.color = "red";
            message.textContent = "Please enter your email and password.";
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            message.style.color = "red";
            message.textContent = "Please enter a valid email address.";
            return;
        }

        message.style.color = "#555";
        message.textContent = "Logging in...";

        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem("user", JSON.stringify(data.user));

                message.style.color = "green";
                message.textContent = "Login successful!";

                setTimeout(() => {
                    if (data.user.role === "admin") {
                        window.location.href = "admin.html";
                    } else {
                        window.location.href = "home.html";
                    }
                }, 500);

            } else {
                message.style.color = "red";
                message.textContent =
                    data.message || "Invalid email or password.";
            }

        } catch (error) {
            console.error("Login error:", error);

            message.style.color = "red";
            message.textContent = "Unable to connect to server.";

        }
    });
}

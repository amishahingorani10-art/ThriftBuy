
const LOGOUT_API = "http://127.0.0.1:5000/api/auth/logout";

document.getElementById("logoutBtn")?.addEventListener("click", async function (event) {
    event.preventDefault();

    try {
        await fetch(LOGOUT_API, {
            method: "POST",
            credentials: "include"
        });
    } catch (error) {
        console.error("Logout request failed:", error);
    } finally {
        localStorage.removeItem("user");
        window.location.href = "login.html";
    }
});

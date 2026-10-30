const API_BASE = "http://127.0.0.1:5000";


// =========================
// LOAD PROFILE
// =========================

async function loadProfile() {

    try {

        const response = await fetch(
            `${API_BASE}/api/auth/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();


        if (!data.success) {

            window.location.href = "login.html";

            return;
        }


        const user = data.user;


        document.getElementById("profileName").value =
            user.name || "";

        document.getElementById("profileEmail").value =
            user.email || "";

        document.getElementById("profilePhone").value =
            user.phone || "";

        document.getElementById("profileCity").value =
            user.city || "";


    } catch (error) {

        console.error(error);

        document.getElementById("profileMessage").textContent =
            "Unable to load profile.";

    }
}


// =========================
// UPDATE PROFILE
// =========================

const profileForm =
    document.getElementById("profileForm");


profileForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const name =
            document.getElementById("profileName").value.trim();

        const phone =
            document.getElementById("profilePhone").value.trim();

        const city =
            document.getElementById("profileCity").value;

        const message =
            document.getElementById("profileMessage");


        if (!name || !city) {

            message.textContent =
                "Name and city are required.";

            return;
        }


        try {

            const response = await fetch(
                `${API_BASE}/api/auth/profile`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        name: name,
                        phone: phone,
                        city: city
                    })
                }
            );


            const data =
                await response.json();


            if (data.success) {

                message.textContent =
                    "Profile updated successfully!";


                // Update saved user information
                const savedUser =
                    JSON.parse(
                        localStorage.getItem("user")
                    );


                if (savedUser) {

                    savedUser.name = name;
                    savedUser.city = city;

                    localStorage.setItem(
                        "user",
                        JSON.stringify(savedUser)
                    );

                }

            } else {

                message.textContent =
                    data.message;

            }


        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to update profile.";

        }

    }
);


// =========================
// LOAD PROFILE ON PAGE OPEN
// =========================

loadProfile();
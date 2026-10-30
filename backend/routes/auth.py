
from flask import Blueprint, request, jsonify, session
import mysql.connector
import re
from werkzeug.security import generate_password_hash, check_password_hash
from config import DB_CONFIG

auth = Blueprint("auth", __name__)


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def validate_password(password):
    return (
        len(password) >= 8
        and re.search(r"[A-Z]", password)
        and re.search(r"[a-z]", password)
        and re.search(r"[0-9]", password)
        and re.search(r"[^A-Za-z0-9]", password)
    )


# =========================
# REGISTER
# =========================

@auth.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip()
    city = (data.get("city") or "").strip()

    if not name or not email or not password or not city:
        return jsonify({
            "success": False,
            "message": "Name, email, password and city are required."
        }), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({
            "success": False,
            "message": "Please enter a valid email address."
        }), 400

    if not validate_password(password):
        return jsonify({
            "success": False,
            "message": (
                "Password must have at least 8 characters, "
                "one uppercase letter, one lowercase letter, "
                "one number and one special character."
            )
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check duplicate email
        cursor.execute(
            "SELECT id FROM users WHERE LOWER(TRIM(email)) = %s LIMIT 1",
            (email,)
        )

        if cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "This email is already registered. Use another email."
            }), 409

        # Check duplicate name, ignoring case and surrounding spaces
        cursor.execute(
            "SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(%s) LIMIT 1",
            (name,)
        )

        if cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "This name is already registered. Choose another name."
            }), 409

        hashed_password = generate_password_hash(password)

        cursor.execute(
            """
            INSERT INTO users (name, email, password, phone, city)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (name, email, hashed_password, phone, city)
        )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Registration successful."
        }), 201

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "This name or email may already be registered."
        }), 409

    except Exception:
        if connection:
            connection.rollback()

        auth.logger.exception("Registration failed")

        return jsonify({
            "success": False,
            "message": "Registration failed. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# LOGIN
# =========================

@auth.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, email, password, city, role
            FROM users
            WHERE LOWER(TRIM(email)) = %s
            """,
            (email,)
        )

        user = cursor.fetchone()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({
                "success": False,
                "message": "Invalid email or password."
            }), 401

        session["user_id"] = user["id"]

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "city": user["city"],
                "role": user["role"]
            }
        }), 200

    except Exception:
        auth.logger.exception("Login failed")

        return jsonify({
            "success": False,
            "message": "Login failed. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# LOGOUT
# =========================

@auth.route("/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "success": True,
        "message": "Logout successful."
    }), 200


# =========================
# CURRENT USER
# =========================

@auth.route("/me", methods=["GET"])
def current_user():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Not logged in."
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, email, phone, city, profile_image, role
            FROM users
            WHERE id = %s
            """,
            (user_id,)
        )

        user = cursor.fetchone()

        if not user:
            session.clear()
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        return jsonify({
            "success": True,
            "user": user
        }), 200

    except Exception:
        auth.logger.exception("Fetching current user failed")

        return jsonify({
            "success": False,
            "message": "Unable to fetch user details."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# UPDATE PROFILE
# =========================

@auth.route("/profile", methods=["PUT"])
def update_profile():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Not logged in."
        }), 401

    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    city = (data.get("city") or "").strip()

    if not name or not city:
        return jsonify({
            "success": False,
            "message": "Name and city are required."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Prevent changing the profile to another user's name
        cursor.execute(
            """
            SELECT id FROM users
            WHERE LOWER(TRIM(name)) = LOWER(%s) AND id != %s
            LIMIT 1
            """,
            (name, user_id)
        )

        if cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "This name is already in use. Choose another name."
            }), 409

        cursor.execute(
            """
            UPDATE users
            SET name = %s, phone = %s, city = %s
            WHERE id = %s
            """,
            (name, phone, city, user_id)
        )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Profile updated successfully."
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        auth.logger.exception("Profile update failed")

        return jsonify({
            "success": False,
            "message": "Profile update failed. Please try again."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


from flask import Flask, jsonify, session
import mysql.connector
from config import DB_CONFIG
from flask_cors import CORS
from routes.products import products
from routes.auth import auth

app = Flask(__name__)

app.secret_key = "thriftbuy-secret-key"

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False

CORS(
    app,
    supports_credentials=True,
    origins=["http://127.0.0.1:5500"]
)


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


# =========================
# HOME
# =========================

@app.route("/")
def home():
    return "Welcome to THRIFTBUY!"


# =========================
# DATABASE TEST
# =========================

@app.route("/test-db")
def test_db():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()

        return f"Connected to database: {database[0]}"

    except Exception:
        return "Database connection failed", 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# ADMIN STATISTICS
# =========================

@app.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Verify admin role using the database.
        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user or user["role"] != "admin":
            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        # Count registered users.
        cursor.execute("SELECT COUNT(*) AS total FROM users")
        total_users = cursor.fetchone()["total"]

        # Count listed products.
        cursor.execute("SELECT COUNT(*) AS total FROM products")
        total_products = cursor.fetchone()["total"]

        return jsonify({
            "success": True,
            "total_users": total_users,
            "total_products": total_products
        }), 200

    except Exception:
        app.logger.exception("Failed to load admin statistics")
        return jsonify({
            "success": False,
            "message": "Unable to load admin statistics"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# ADMIN - MANAGE USERS
# =========================

@app.route("/api/admin/users", methods=["GET"])
def admin_users():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Verify admin access using the database.
        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (user_id,)
        )
        admin = cursor.fetchone()

        if not admin or admin["role"] != "admin":
            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        cursor.execute("""
            SELECT id, name, email, phone, city, role, created_at
            FROM users
            ORDER BY id DESC
        """)

        users = cursor.fetchall()

        # Return only fields needed by the admin page.
        for user in users:
            if user.get("created_at"):
                user["created_at"] = user["created_at"].strftime("%Y-%m-%d")

        return jsonify({
            "success": True,
            "users": users
        }), 200

    except Exception:
        app.logger.exception("Failed to load admin users")
        return jsonify({
            "success": False,
            "message": "Unable to load users"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# ADMIN - MANAGE PRODUCTS
# =========================


@app.route("/api/admin/products", methods=["GET"])
def admin_products():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (user_id,)
        )
        admin = cursor.fetchone()

        if not admin or admin["role"] != "admin":
            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        cursor.execute("""
            SELECT
                p.id,
                p.title,
                p.price,
                p.condition_type,
                p.description,
                p.seller_id,
                p.status AS listing_status,
                c.name AS category,
                u.name AS seller,
                u.city AS city
            FROM products AS p
            LEFT JOIN categories AS c ON p.category_id = c.id
            LEFT JOIN users AS u ON p.seller_id = u.id
            ORDER BY p.id DESC
        """)

        products_list = cursor.fetchall()

        return jsonify({
            "success": True,
            "products": products_list
        }), 200

    except Exception:
        app.logger.exception("Failed to load admin products")
        return jsonify({
            "success": False,
            "message": "Unable to load products"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()



@app.route("/api/admin/products/<int:product_id>", methods=["DELETE"])
def admin_delete_product(product_id):
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Please log in first"
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT role FROM users WHERE id = %s",
            (user_id,)
        )
        admin = cursor.fetchone()

        if not admin or admin["role"] != "admin":
            return jsonify({
                "success": False,
                "message": "Admin access only"
            }), 403

        cursor.execute(
            "SELECT id FROM products WHERE id = %s",
            (product_id,)
        )

        if not cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Product not found"
            }), 404

        # Remove related image records first.
        cursor.execute(
            "DELETE FROM product_images WHERE product_id = %s",
            (product_id,)
        )

        # Remove cart references if this product is in a cart.
        cursor.execute(
            "DELETE FROM cart_items WHERE product_id = %s",
            (product_id,)
        )

        cursor.execute(
            "DELETE FROM products WHERE id = %s",
            (product_id,)
        )

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Product deleted successfully"
        }), 200

    except Exception:
        if connection:
            connection.rollback()

        app.logger.exception("Failed to delete admin product")
        return jsonify({
            "success": False,
            "message": "Unable to delete product"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# REGISTER BLUEPRINTS
# =========================

app.register_blueprint(auth, url_prefix="/api/auth")
app.register_blueprint(products, url_prefix="/api")


if __name__ == "__main__":
    app.run(debug=True)

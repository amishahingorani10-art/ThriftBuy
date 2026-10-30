
from flask import Blueprint, request, jsonify, session, send_from_directory
import mysql.connector
from config import DB_CONFIG
from werkzeug.utils import secure_filename
import os
import uuid

products = Blueprint("products", __name__)

# =========================
# IMAGE UPLOAD CONFIGURATION
# =========================

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "uploads"
)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


def allowed_image(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_IMAGE_EXTENSIONS
    )


# =========================
# SERVE UPLOADED IMAGES
# =========================

@products.route("/uploads/<path:filename>", methods=["GET"])
def get_uploaded_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# =========================
# ADD PRODUCT WITH IMAGE
# =========================

@products.route("/products", methods=["POST"])
def add_product():
    connection = None
    cursor = None
    saved_filename = None

    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Please login first"
            }), 401

        data = request.form

        title = data.get("title", "").strip()
        description = data.get("description", "").strip()
        price = data.get("price")
        original_price = data.get("original_price") or None
        condition_type = data.get("condition_type") or None
        brand = data.get("brand", "").strip()
        category_id = data.get("category_id")
        is_negotiable = data.get(
            "is_negotiable", ""
        ).lower() in ("true", "1", "on", "yes")

        if not title or not price or not category_id:
            return jsonify({
                "success": False,
                "message": "Title, price and category are required"
            }), 400

        try:
            price_value = float(price)
            category_id_value = int(category_id)

            if price_value <= 0 or category_id_value <= 0:
                raise ValueError()

            original_price_value = (
                float(original_price) if original_price else None
            )

            if (
                original_price_value is not None
                and original_price_value < 0
            ):
                raise ValueError()

        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Enter a valid price and category"
            }), 400

        # Read selected product image.
        image = request.files.get("productImage")

        if image and image.filename:
            if not allowed_image(image.filename):
                return jsonify({
                    "success": False,
                    "message": "Only JPG, JPEG, PNG and WebP images are allowed"
                }), 400

            image_bytes = image.read(MAX_IMAGE_SIZE + 1)

            if not image_bytes:
                return jsonify({
                    "success": False,
                    "message": "The selected image is empty"
                }), 400

            if len(image_bytes) > MAX_IMAGE_SIZE:
                return jsonify({
                    "success": False,
                    "message": "Image must be 5 MB or smaller"
                }), 400

            safe_name = secure_filename(image.filename)
            extension = safe_name.rsplit(".", 1)[1].lower()
            saved_filename = f"{uuid.uuid4().hex}.{extension}"

            image_location = os.path.join(
                UPLOAD_FOLDER, saved_filename
            )

            with open(image_location, "wb") as image_file:
                image_file.write(image_bytes)

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO products (
                seller_id, category_id, title, description,
                price, original_price, condition_type,
                brand, is_negotiable
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            category_id_value,
            title,
            description,
            price_value,
            original_price_value,
            condition_type,
            brand,
            is_negotiable
        ))

        product_id = cursor.lastrowid

        if saved_filename:
            cursor.execute("""
                INSERT INTO product_images (product_id, image_path)
                VALUES (%s, %s)
            """, (
                product_id,
                f"/api/uploads/{saved_filename}"
            ))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Product added successfully",
            "product_id": product_id
        }), 201

    except Exception as e:
        if connection:
            connection.rollback()

        if saved_filename:
            try:
                os.remove(
                    os.path.join(UPLOAD_FOLDER, saved_filename)
                )
            except OSError:
                pass

        print("Add product error:", repr(e))

        return jsonify({
            "success": False,
            "message": "Unable to add product. Check backend terminal."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# GET ALL PRODUCTS + IMAGE
# =========================

@products.route("/products", methods=["GET"])
def get_products():
    connection = None
    cursor = None

    try:
        search = request.args.get("search", "").strip()
        category = request.args.get("category", "").strip()
        min_price = request.args.get("min_price", "").strip()
        max_price = request.args.get("max_price", "").strip()
        condition = request.args.get("condition", "").strip()
        sort = request.args.get("sort", "latest").strip()

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                p.id,
                p.title,
                p.description,
                p.price,
                p.original_price,
                p.condition_type,
                p.brand,
                p.is_negotiable,
                p.status,
                p.views,
                p.created_at,
                p.city,
                c.name AS category,
                u.name AS seller,
                (
                    SELECT pi.image_path
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.id ASC
                    LIMIT 1
                ) AS image_path
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.seller_id = u.id
            WHERE p.status = 'ACTIVE'
        """

        params = []

        if search:
            query += """
                AND (
                    p.title LIKE %s
                    OR p.description LIKE %s
                    OR p.brand LIKE %s
                )
            """
            value = f"%{search}%"
            params.extend([value, value, value])

        if category:
            query += " AND c.id = %s"
            params.append(category)

        if min_price:
            query += " AND p.price >= %s"
            params.append(min_price)

        if max_price:
            query += " AND p.price <= %s"
            params.append(max_price)

        if condition:
            query += " AND p.condition_type = %s"
            params.append(condition)

        if sort == "price_low":
            query += " ORDER BY p.price ASC"
        elif sort == "price_high":
            query += " ORDER BY p.price DESC"
        else:
            query += " ORDER BY p.created_at DESC"

        cursor.execute(query, params)
        product_list = cursor.fetchall()

        return jsonify({
            "success": True,
            "products": product_list
        }), 200

    except Exception as e:
        print("Get products error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Unable to load products"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# GET SINGLE PRODUCT + IMAGE
# =========================

@products.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            
        SELECT
        p.*,
        c.name AS category,
        u.name AS seller,
        u.phone AS seller_phone,
        u.city AS seller_city,
        (
        SELECT pi.image_path
        FROM product_images AS pi
        WHERE pi.product_id = p.id
        ORDER BY pi.id ASC
        LIMIT 1
        ) AS image_path
        FROM products AS p
        LEFT JOIN categories AS c ON p.category_id = c.id
        LEFT JOIN users AS u ON p.seller_id = u.id
        WHERE p.id = %s
        LIMIT 1

        """, (product_id,))

        product = cursor.fetchone()

        if not product:
            return jsonify({
                "success": False,
                "message": "Product not found"
            }), 404

        return jsonify({
            "success": True,
            "product": product
        }), 200

    except Exception as e:
        print("Get product error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Unable to load product"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# PRODUCTS BY CITY + IMAGE
# =========================

@products.route("/products/city", methods=["GET"])
def products_by_city():
    connection = None
    cursor = None

    try:
        city = request.args.get("city", "").strip()

        if not city:
            return jsonify({
                "success": False,
                "message": "City is required"
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                p.id,
                p.title,
                p.description,
                p.price,
                p.original_price,
                p.condition_type,
                p.brand,
                p.city,
                p.created_at,
                c.name AS category,
                u.name AS seller,
                u.phone AS seller_phone,
                (
                    SELECT pi.image_path
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.id ASC
                    LIMIT 1
                ) AS image_path
            FROM products p
            JOIN categories c ON p.category_id = c.id
            JOIN users u ON p.seller_id = u.id
            WHERE p.status = 'ACTIVE'
              AND LOWER(p.city) = LOWER(%s)
            ORDER BY p.created_at DESC
        """, (city,))

        product_list = cursor.fetchall()

        return jsonify({
            "success": True,
            "city": city,
            "products": product_list
        }), 200

    except Exception as e:
        print("Products by city error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Unable to load city products"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# UPDATE OWN PRODUCT
# =========================

@products.route("/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    connection = None
    cursor = None
    saved_filename = None

    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Please login first"
            }), 401

        data = request.form
        title = data.get("title", "").strip()
        description = data.get("description", "").strip()
        price = data.get("price", "").strip()
        original_price = data.get("original_price") or None
        brand = data.get("brand", "").strip()
        category_id = data.get("category_id", "").strip()
        condition_type = data.get("condition_type", "").strip()
        city = data.get("city", "").strip()
        is_negotiable = data.get("is_negotiable", "").lower() in (
            "true", "1", "on", "yes"
        )

        if not title or not price or not category_id or not city:
            return jsonify({
                "success": False,
                "message": "Title, price, category and city are required"
            }), 400

        try:
            price_value = float(price)
            category_id_value = int(category_id)
            original_price_value = (
                float(original_price) if original_price else None
            )

            if (
                price_value <= 0
                or category_id_value <= 0
                or (
                    original_price_value is not None
                    and original_price_value < 0
                )
            ):
                raise ValueError()

        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Enter valid price values and category"
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id
            FROM products
            WHERE id = %s AND seller_id = %s
        """, (product_id, user_id))

        if not cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Product not found or you cannot edit it"
            }), 404

        image = request.files.get("productImage")

        if image and image.filename:
            if not allowed_image(image.filename):
                return jsonify({
                    "success": False,
                    "message": "Only JPG, JPEG, PNG and WebP images are allowed"
                }), 400

            image_bytes = image.read(MAX_IMAGE_SIZE + 1)

            if not image_bytes:
                return jsonify({
                    "success": False,
                    "message": "The selected image is empty"
                }), 400

            if len(image_bytes) > MAX_IMAGE_SIZE:
                return jsonify({
                    "success": False,
                    "message": "Image must be 5 MB or smaller"
                }), 400

            safe_name = secure_filename(image.filename)
            extension = safe_name.rsplit(".", 1)[1].lower()
            saved_filename = f"{uuid.uuid4().hex}.{extension}"

            with open(
                os.path.join(UPLOAD_FOLDER, saved_filename), "wb"
            ) as image_file:
                image_file.write(image_bytes)

        cursor.execute("""
            UPDATE products
            SET title = %s,
                description = %s,
                price = %s,
                original_price = %s,
                brand = %s,
                category_id = %s,
                condition_type = %s,
                city = %s,
                is_negotiable = %s
            WHERE id = %s AND seller_id = %s
        """, (
            title,
            description,
            price_value,
            original_price_value,
            brand,
            category_id_value,
            condition_type,
            city,
            is_negotiable,
            product_id,
            user_id
        ))

        if saved_filename:
            cursor.execute("""
                SELECT id
                FROM product_images
                WHERE product_id = %s
                ORDER BY id ASC
                LIMIT 1
            """, (product_id,))
            existing_image = cursor.fetchone()

            image_path = f"/api/uploads/{saved_filename}"

            if existing_image:
                cursor.execute("""
                    UPDATE product_images
                    SET image_path = %s
                    WHERE id = %s
                """, (image_path, existing_image["id"]))
            else:
                cursor.execute("""
                    INSERT INTO product_images (product_id, image_path)
                    VALUES (%s, %s)
                """, (product_id, image_path))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Product updated successfully",
            "product_id": product_id
        }), 200

    except Exception as e:
        if connection:
            connection.rollback()

        if saved_filename:
            try:
                os.remove(os.path.join(UPLOAD_FOLDER, saved_filename))
            except OSError:
                pass

        print("Update product error:", repr(e))

        return jsonify({
            "success": False,
            "message": "Unable to update product"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# MY PRODUCTS
# =========================

@products.route("/my-products", methods=["GET"])
def my_products():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "success": False,
            "message": "Not logged in"
        }), 401

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                p.id,
                p.title,
                p.description,
                p.price,
                p.original_price,
                p.condition_type,
                p.brand,
                p.city,
                p.status,
                p.is_negotiable,
                c.name AS category,
                (
                    SELECT pi.image_path
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.id ASC
                    LIMIT 1
                ) AS image_path
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.seller_id = %s
            ORDER BY p.created_at DESC
        """, (user_id,))

        return jsonify({
            "success": True,
            "products": cursor.fetchall()
        }), 200

    except Exception as e:
        print("My products error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Unable to load your products"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# ADD TO CART
# =========================

@products.route("/cart", methods=["POST"])
def add_to_cart():
    connection = None
    cursor = None

    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Please login first"
            }), 401

        data = request.get_json(silent=True) or {}

        try:
            product_id = int(data.get("product_id"))
            if product_id <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Valid product ID is required"
            }), 400

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, seller_id, status
            FROM products
            WHERE id = %s
        """, (product_id,))

        product = cursor.fetchone()

        if not product or product["status"] != "ACTIVE":
            return jsonify({
                "success": False,
                "message": "Product is unavailable"
            }), 404

        if int(product["seller_id"]) == int(user_id):
            return jsonify({
                "success": False,
                "message": "You cannot add your own product to the cart"
            }), 403

        cursor.execute("""
            SELECT id FROM cart_items
            WHERE user_id = %s AND product_id = %s
        """, (user_id, product_id))

        if cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Product is already in your cart"
            }), 409

        cursor.execute("""
            INSERT INTO cart_items (user_id, product_id)
            VALUES (%s, %s)
        """, (user_id, product_id))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Product added to cart"
        }), 201

    except mysql.connector.IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "Product is already in your cart or is no longer available"
        }), 409

    except Exception as e:
        if connection:
            connection.rollback()

        print("Add to cart error:", repr(e))

        return jsonify({
            "success": False,
            "message": "Unable to add product to cart"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# VIEW CART
# =========================

@products.route("/cart", methods=["GET"])
def get_cart():
    connection = None
    cursor = None

    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Please login first"
            }), 401

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                ci.id AS cart_item_id,
                ci.product_id,
                ci.quantity,
                ci.added_at,
                p.title,
                p.price,
                p.original_price,
                p.condition_type,
                p.brand,
                p.city,
                p.status,
                u.name AS seller,
                (
                    SELECT pi.image_path
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                    ORDER BY pi.id ASC
                    LIMIT 1
                ) AS image_path
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            JOIN users u ON p.seller_id = u.id
            WHERE ci.user_id = %s
              AND p.status = 'ACTIVE'
            ORDER BY ci.added_at DESC
        """, (user_id,))

        items = cursor.fetchall()

        total = sum(
            float(item["price"]) * int(item["quantity"])
            for item in items
        )

        return jsonify({
            "success": True,
            "items": items,
            "total": round(total, 2),
            "count": len(items)
        }), 200

    except Exception as e:
        print("Get cart error:", repr(e))
        return jsonify({
            "success": False,
            "message": "Unable to load cart"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# =========================
# REMOVE FROM CART
# =========================

@products.route("/cart/<int:product_id>", methods=["DELETE"])
def remove_from_cart(product_id):
    connection = None
    cursor = None

    try:
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "success": False,
                "message": "Please login first"
            }), 401

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            DELETE FROM cart_items
            WHERE user_id = %s AND product_id = %s
        """, (user_id, product_id))

        connection.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "message": "Product was not found in your cart"
            }), 404

        return jsonify({
            "success": True,
            "message": "Product removed from cart"
        }), 200

    except Exception as e:
        if connection:
            connection.rollback()

        print("Remove from cart error:", repr(e))

        return jsonify({
            "success": False,
            "message": "Unable to remove product from cart"
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

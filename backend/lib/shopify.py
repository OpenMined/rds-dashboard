import pandas as pd


def shopify_json_to_dataframe(data):
    """
    Convert Shopify products JSON data to a pandas DataFrame.

    Parameters:
    data (dict): Shopify products JSON data with 'products' key

    Returns:
    pd.DataFrame: DataFrame containing product and variant information
    """

    # List to store all rows
    rows = []

    # Process each product
    for product in data.get("products", []):
        # Get the main image URL if available
        image_src = (
            product.get("image", {}).get("src", "") if product.get("image") else ""
        )

        # Process each variant (since products can have multiple variants)
        for variant in product.get("variants", []):
            row = {
                "product_id": product["id"],
                "title": product["title"],
                "vendor": product.get("vendor", ""),
                "product_type": product.get("product_type", ""),
                "handle": product.get("handle", ""),
                "status": product.get("status", ""),
                "tags": product.get("tags", ""),
                "created_at": product.get("created_at", ""),
                "updated_at": product.get("updated_at", ""),
                "published_at": product.get("published_at", ""),
                "variant_id": variant["id"],
                "variant_title": variant.get("title", ""),
                "sku": variant.get("sku", ""),
                "price": variant.get("price", ""),
                "compare_at_price": variant.get("compare_at_price", ""),
                "inventory_quantity": variant.get("inventory_quantity", ""),
                "weight": variant.get("weight", ""),
                "weight_unit": variant.get("weight_unit", ""),
                "requires_shipping": variant.get("requires_shipping", ""),
                "taxable": variant.get("taxable", ""),
                "barcode": variant.get("barcode", ""),
                "image_src": image_src,
            }
            rows.append(row)

    # Create DataFrame from rows
    df = pd.DataFrame(rows)

    # Convert price columns to numeric (they come as strings from Shopify)
    if "price" in df.columns:
        df["price"] = pd.to_numeric(df["price"], errors="coerce")
    if "compare_at_price" in df.columns:
        df["compare_at_price"] = pd.to_numeric(df["compare_at_price"], errors="coerce")

    # Convert datetime columns to datetime objects
    datetime_columns = ["created_at", "updated_at", "published_at"]
    for col in datetime_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df

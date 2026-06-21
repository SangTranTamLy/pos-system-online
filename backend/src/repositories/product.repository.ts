import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "../config/database";
import type { CreateProductBody, Product, UpdateProductBody, SaveProductRecipeIngredient, ProductRecipeIngredient } from "../types/product.types";
import crypto from "crypto";
type ProductRow = RowDataPacket & {
    id: string;
    category_id: string;
    category_name: string;
    sku: string;
    name: string;
    import_price: string;
    sale_price: string;
    stock_quantity: number;
    status: Product["status"];
    description: string | null;
    image_url: string | null;
    created_at: Date;
    updated_at: Date; 
    requires_preparation: number;
    is_stock_returnable: number;
};

function mapProduct(row: ProductRow): Product{
    return{
        id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    requiresPreparation: Boolean(row.requires_preparation),
    isStockReturnable: Boolean(row.is_stock_returnable),
    sku: row.sku,
    name: row.name,
    importPrice: Number(row.import_price),
    salePrice: Number(row.sale_price),
    stockQuantity: row.stock_quantity,
    status: row.status,
    description: row.description,
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    };
}
/*ham lay theo ds */
export async function findProducts(): Promise<Product[]>{
    const [rows] = await db.execute<ProductRow[]>(
        `SELECT
            products.id,
            products.category_id,
            categories.name AS category_name,
            products.sku,
            products.name,
            products.import_price,
            products.sale_price,
            products.stock_quantity,
            products.status,
            products.description,
            products.image_url,
            products.created_at,
            products.updated_at,
            products.requires_preparation,
            products.is_stock_returnable
        FROM products
        JOIN categories ON products.category_id = categories.id
        ORDER BY products.created_at DESC`
    );
    return rows.map(mapProduct);
}
/*ham lay theo id */
export async function findProductById(id: string): Promise<Product | null> {
    const [rows] = await db.execute<ProductRow[]>(
        `
        SELECT
        products.id,
        products.category_id,
        categories.name AS category_name,
        products.sku,
        products.name,
        products.import_price,
        products.sale_price,
        products.stock_quantity,
        products.status,
        products.description,
        products.image_url,
        products.created_at,
        products.updated_at,
        products.requires_preparation,
        products.is_stock_returnable
        FROM products
        JOIN categories ON products.category_id = categories.id
        WHERE products.id = ?
        LIMIT 1
        `,
        [id]
    );

    return rows[0] ? mapProduct(rows[0]) : null;
}

export async function findProductBySku(sku: string): Promise<Product | null> {
    const [rows] = await db.execute<ProductRow[]>(
        `
        SELECT
        products.id,
        products.category_id,
        categories.name AS category_name,
        products.sku,
        products.name,
        products.import_price,
        products.sale_price,
        products.stock_quantity,
        products.status,
        products.description,
        products.image_url,
        products.created_at,
        products.updated_at,
        products.requires_preparation,
        products.is_stock_returnable
        FROM products
        JOIN categories ON products.category_id = categories.id
        WHERE products.sku = ?
        LIMIT 1
        `,
        [sku]
    );

    return rows[0] ? mapProduct(rows[0]) : null;
}

export async function createProduct(data: CreateProductBody): Promise<Product> {
    const id = crypto.randomUUID();

    await db.execute(
        `
        INSERT INTO products (
        id,
        category_id,
        requires_preparation,
        is_stock_returnable,
        sku,
        name,
        import_price,
        sale_price,
        stock_quantity,
        status,
        description,
        image_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
        id,
        data.categoryId,
        data.requiresPreparation ? 1 : 0,
        data.isStockReturnable ? 1 : 0,
        data.sku,
        data.name,
        data.importPrice ?? 0,
        data.salePrice,
        data.stockQuantity ?? 0,
        data.status ?? "active",
        data.description ?? null,
        data.imageUrl ?? null,
        ]
    );

    const product = await findProductById(id);

    if (!product) {
        throw new Error("Create product failed");
    }

    return product;
}
export async function updateProductById(
    id: string,
    data: UpdateProductBody
): Promise<Product | null> {
    await db.execute(
        `
        UPDATE products
        SET
        category_id = ?,
        requires_preparation = ?,
        is_stock_returnable = ?,
        sku = ?,
        name = ?,
        import_price = ?,
        sale_price = ?,
        stock_quantity = ?,
        status = ?,
        description = ?,
        image_url = ?
        WHERE id = ?
        `,
        [
        data.categoryId ?? null,
        data.requiresPreparation ? 1 : 0,
        data.isStockReturnable ? 1 : 0,
        data.sku ?? null,
        data.name ?? null,
        data.importPrice ?? 0,
        data.salePrice ?? 0,
        data.stockQuantity ?? 0,
        data.status ?? "active",
        data.description ?? null,
        data.imageUrl ?? null,
        id,
        ]
    );

    return findProductById(id);
}

export async function updateProductStatusById(
    id: string,
    status: Product["status"]
): Promise<Product | null> {
    await db.execute(
        `
        UPDATE products
        SET status = ?
        WHERE id = ?
        `,
        [status, id]
    );

    return findProductById(id);
}
export async function countOrderDetailsByProductId(id: string): Promise<number> {
    const [rows] = await db.execute<(RowDataPacket & { total: number })[]>(
        `
        SELECT COUNT(*) AS total
        FROM order_details
        WHERE product_id = ?
        `,
        [id]
    );

    return rows[0]?.total ?? 0;
}

export async function deleteProductById(id: string): Promise<boolean> {
    const [result] = await db.execute<ResultSetHeader>(
        `
        DELETE FROM products
        WHERE id = ?
        `,
        [id]
    );

    return result.affectedRows > 0;
}

export async function findProductRecipe(productId: string): Promise<ProductRecipeIngredient[]> {
    const [rows] = await db.execute<RowDataPacket[]>(
        `
        SELECT 
          recipes.ingredient_id AS ingredientId,
          raw_materials.name AS ingredientName,
          recipes.quantity_needed AS quantityNeeded,
          raw_materials.unit AS unit
        FROM recipes
        JOIN raw_materials ON recipes.ingredient_id = raw_materials.id
        WHERE recipes.product_id = ?
        `,
        [productId]
    );

    return rows.map(row => ({
        ingredientId: String(row.ingredientId),
        ingredientName: String(row.ingredientName),
        quantityNeeded: Number(row.quantityNeeded),
        unit: String(row.unit)
    }));
}

export async function saveProductRecipe(
    productId: string, 
    ingredients: SaveProductRecipeIngredient[]
): Promise<void> {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Bước 1: Xóa công thức cũ để ghi đè tránh uq_product_ingredient UNIQUE constraint error
        await connection.execute(
            `DELETE FROM recipes WHERE product_id = ?`,
            [productId]
        );

        // Bước 2: Thêm công thức mới
        for (const item of ingredients) {
            await connection.execute(
                `INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed) VALUES (?, ?, ?, ?)`,
                [
                    crypto.randomUUID(),
                    productId,
                    item.ingredientId,
                    item.quantityNeeded
                ]
            );
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

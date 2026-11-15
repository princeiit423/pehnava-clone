import mongoose from "mongoose";
import Product from "../models/Product.js";

export async function restoreOrderStock(order, { skipUnavailable = false, session } = {}) {
  if (order.stockRestoredAt) return [];
  const unavailableItems = [];
  const appliedRestorations = [];

  try {
    for (const item of order.items || []) {
      if (!item.productId || item.productId === "offline") continue;
      if (!mongoose.isValidObjectId(item.productId)) {
        if (skipUnavailable) {
          unavailableItems.push(item.title || "A product with an invalid inventory reference");
          continue;
        }
        throw new Error(`Unable to restore stock because product ${item.productId} has an invalid ID.`);
      }
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
        if (skipUnavailable) {
          unavailableItems.push(item.title || "A product with an invalid quantity");
          continue;
        }
        throw new Error(`Unable to restore stock because ${item.title || "an order item"} has an invalid quantity.`);
      }

      const productQuery = Product.findById(item.productId).select("soldOut variantStock colors");
      if (session) productQuery.session(session);
      const product = await productQuery;
      if (!product) {
        if (skipUnavailable) {
          unavailableItems.push(item.title || "An unavailable product");
          continue;
        }
        throw new Error(`Unable to restore stock because product ${item.productId} no longer exists.`);
      }

      const variant = product.variantStock?.find(
        (entry) => String(entry.size || "").trim() === String(item.size || "").trim()
          && String(entry.color || "").trim() === String(item.color || "").trim()
      );
      if (product.variantStock?.length && !variant) {
        if (skipUnavailable) {
          unavailableItems.push(item.title || "A product with an unavailable variant");
          continue;
        }
        throw new Error(`Unable to locate the ordered inventory variant for ${item.title}.`);
      }

      const color = product.colors?.find((entry) => entry.name === item.color);
      const hasColorStock = color?.stock !== undefined && color?.stock !== null;
      const filter = { _id: product._id };
      const increment = { stock: item.quantity };
      const options = {};
      const previousSoldOut = product.soldOut;

      if (variant) {
        filter.variantStock = { $elemMatch: { size: item.size, color: item.color } };
        increment["variantStock.$.stock"] = item.quantity;
        if (hasColorStock) {
          filter.colors = { $elemMatch: { name: item.color } };
          increment["colors.$[color].stock"] = item.quantity;
          options.arrayFilters = [{ "color.name": item.color }];
        }
      } else if (hasColorStock) {
        filter.colors = { $elemMatch: { name: item.color } };
        increment["colors.$.stock"] = item.quantity;
      }

      const result = await Product.updateOne(
        filter,
        { $inc: increment, $set: { soldOut: false } },
        { ...options, ...(session ? { session } : {}) }
      );
      if (!result.modifiedCount) {
        if (skipUnavailable) {
          unavailableItems.push(item.title || "A product with unavailable inventory");
          continue;
        }
        throw new Error(`Unable to restore stock for product ${item.productId}.`);
      }
      appliedRestorations.push({
        filter,
        increment,
        options,
        soldOut: previousSoldOut,
      });
    }

    order.stockRestoredAt = new Date();
    await order.save(session ? { session } : undefined);
    return unavailableItems;
  } catch (error) {
    if (session) throw error;

    const rollbackErrors = [];
    for (const restoration of appliedRestorations.reverse()) {
      const decrement = Object.fromEntries(
        Object.entries(restoration.increment).map(([field, amount]) => [field, -amount])
      );
      try {
        const result = await Product.updateOne(
          restoration.filter,
          {
            $inc: decrement,
            $set: { soldOut: restoration.soldOut },
          },
          restoration.options
        );
        if (!result.modifiedCount) {
          rollbackErrors.push(new Error(`Unable to roll back stock for product ${restoration.filter._id}.`));
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (rollbackErrors.length) {
      const rollbackError = new Error(
        `Stock restoration failed and ${rollbackErrors.length} inventory rollback operation(s) also failed.`,
        { cause: error }
      );
      rollbackError.rollbackErrors = rollbackErrors;
      throw rollbackError;
    }
    throw error;
  }
}

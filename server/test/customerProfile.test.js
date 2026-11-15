import assert from "node:assert/strict";
import test from "node:test";
import Customer from "../models/Customer.js";
import { normalizeShippingAddress } from "../utils/orderCheckout.js";

const shippingAddress = {
  name: "Test Customer",
  phone: "7004281547",
  email: "customer@example.com",
  address: "12 Example Road",
  city: "Bokaro",
  state: "Jharkhand",
  pinCode: "827001",
};

test("customer profiles persist a validated shipping address and product wishlist", () => {
  const customer = new Customer({
    name: "Test Customer",
    phone: "7004281547",
    email: "customer@example.com",
    passwordHash: "hashed-password",
    shippingAddress,
    wishlist: ["507f1f77bcf86cd799439011"],
  });

  assert.equal(customer.validateSync(), undefined);
  assert.equal(customer.shippingAddress.city, "Bokaro");
  assert.deepEqual(customer.wishlist, ["507f1f77bcf86cd799439011"]);
});

test("customer wishlist defaults to empty and shipping address can be updated", () => {
  const customer = new Customer({
    name: "Test Customer",
    phone: "7004281547",
    email: "customer@example.com",
    passwordHash: "hashed-password",
  });

  assert.deepEqual(customer.wishlist, []);
  customer.shippingAddress = normalizeShippingAddress({
    ...shippingAddress,
    city: "Dhanbad",
  });
  assert.equal(customer.validateSync(), undefined);
  assert.equal(customer.shippingAddress.city, "Dhanbad");
});

test("saved customer shipping addresses reject incomplete or invalid data", () => {
  assert.throws(
    () => normalizeShippingAddress({ ...shippingAddress, pinCode: "123" }),
    (error) => error.status === 400
  );
  assert.throws(
    () => normalizeShippingAddress({ ...shippingAddress, email: "not-an-email" }),
    (error) => error.status === 400
  );
});

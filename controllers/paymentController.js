import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import nodemailer from "nodemailer";
import sendEmail from "../utils/sendEmail.js";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create payment intent for Stripe
export const createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    // Find the order
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to user
    if (order.userId.toString() !== userId) {
      return res.json({
        success: false,
        message: "Unauthorized access to order",
      });
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return res.json({ success: false, message: "Order is already paid" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.amount * 100), // Convert to cents
      currency: "usd",
      metadata: {
        orderId: order._id.toString(),
        userId: userId,
      },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: order.amount,
    });
  } catch (error) {
    console.error("Create Payment Intent Error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Confirm payment and update order status
export const confirmPayment = async (req, res) => {
  try {
    console.log(" Body:", req.body);
    console.log(" User:", req.user);

    const { orderId, paymentIntentId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User không hợp lệ (thiếu token)",
      });
    }

    // Tìm đơn hàng
    const order = await orderModel.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // Kiểm tra quyền
    if (order.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xác nhận đơn hàng này",
      });
    }

    // Cập nhật trạng thái đơn
    order.paymentStatus = "paid";
    order.status = "confirmebạn{
            order.address.lastName
          },</h2>
            <p>Bạn đã thanh toán thành công đơn hàng <b>#${order._id}</b>.</p>
            <p>Tổng tiền / Total amount: <b>${amountVND.toLocaleString(
              "vi-VN"
            )} ₫</b></p>
            <p>Chúng tôi sẽ sớm giao hàng cho bạn.<br>We will deliver your order soon.</p>
            <br>
            <p>Trân trọng / Best regards,<br>HL_Sports</p>
          `,
        });

        console.log("Email sent to:", order.address.email);
      } catch (mailErr) {
        console.error(" Gửi email thất bại:", mailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Thanh toán thành công và đã gửi email xác nhận",
      order,
    });
  } catch (error) {
    console.error(" Lỗi confirmPayment:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xác nhận thanh toán",
      error: error.message,
    });
  }
};

// Handle Stripe webhook for payment updates
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;

      // Update order status
      await orderModel.findByIdAndUpdate(orderId, {
        paymentStatus: "paid",
        status: "confirmed",
      });
      break;

    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      const failedOrderId = failedPayment.metadata.orderId;

      // Update order status
      await orderModel.findByIdAndUpdate(failedOrderId, {
        paymentStatus: "failed",
      });
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

// Create order with payment method selection
export const createOrder = async (req, res) => {
  try {
    const { items, address, paymentMethod = "cod" } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, message: "Order items are required" });
    }

    if (!address) {
      return res.json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // Validate address required fields
    const requiredAddressFields = [
      "firstName",
      "lastName",
      "email",
      "street",
      "city",
      "state",
      "zipcode",
      "country",
      "phone",
    ];
    const missingFields = requiredAddressFields.filter((field) => {
      const value =
        address[field] || address[field === "zipcode" ? "zipCode" : field];
      return !value || value.trim() === "";
    });

    if (missingFields.length > 0) {
      return res.json({
        success: false,
        message: `Missing required address fields1: ${missingFields.join(
          ", "
        )}`,
      });
    }

    // Validate items have productId
    const itemsWithoutProductId = items.filter(
      (item) => !item._id && !item.productId
    );
    if (itemsWithoutProductId.length > 0) {
      return res.json({
        success: false,
        message: "All items must have a valid product ID",
      });
    }

    // Calculate total amount
    const totalAmount = items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

    // Create order
    const order = new orderModel({
      userId,
      items: items.map((item) => ({
        productId: item._id || item.productId,
        name: item.name || item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.images?.[0] || item.image,
      })),
      amount: totalAmount,
      address: {
        firstName: address.firstName || address.name?.split(" ")[0] || "",
        lastName:
          address.lastName || address.name?.split(" ").slice(1).join(" ") || "",
        email: address.email || "",
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zipcode: address.zipcode || address.zipCode || "",
        country: address.country || "",
        phone: address.phone || "",
      },
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      status: "pending",
    });

    await order.save();

    // Add order to user's orders array
    await userModel.findByIdAndUpdate(userId, {
      $push: { orders: order._id },
    });

    res.json({
      success: true,
      message: "Order created successfully",
      orderId: order._id,
      order: order,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.json({ success: false, message: error.message });
  }
};
// send email
export const sendConfirmationEmail = async (req, res) => {
  const { orderId, paymentIntentId } = req.body;
  if (!orderId || !paymentIntentId)
    return res
      .status(400)
      .json({ success: false, message: "Missing order info" });

  try {
    const order = await Order.findById(orderId);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.address.email,
      subject: "Payment Confirmation",
      html: `<h2>Payment Successful </h2>
             <p>Order ID: ${orderId}</p>
             <p>Payment ID: ${paymentIntentId}</p>
             <p>Thank you for your purchase!</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Confirmation email sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

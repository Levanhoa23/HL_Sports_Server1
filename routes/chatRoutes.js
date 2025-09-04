import express from "express";
import Product from "../models/productModel.js"; // mongoose model

const router = express.Router();

router.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage = messages[messages.length - 1].content.toLowerCase();

    console.log("✅ User message:", userMessage);

    // Danh sách brand phổ biến
    const brands = ["nike", "adidas", "puma", "asics", "mizuno"];
    let keyword = "";

    // Tìm brand trong câu hỏi
    for (const brand of brands) {
      if (userMessage.includes(brand)) {
        keyword = brand;
        break;
      }
    }

    // Nếu không có brand, lấy từ cuối cùng làm keyword
    if (!keyword) {
      const words = userMessage.split(" ");
      keyword = words[words.length - 1];
    }

    // Tìm sản phẩm theo keyword
    const products = await Product.find({
      name: { $regex: keyword, $options: "i" },
    }).limit(5);

    if (!products.length) {
      return res.json({ reply: "Không tìm thấy sản phẩm nào phù hợp." });
    }

    // format reply giống chatbot
    const reply =
      `Mình tìm thấy ${products.length} sản phẩm:\n` +
      products.map((p) => `- ${p.name} (${p.price} VND)`).join("\n");

    res.json({ reply, products });
  } catch (err) {
    console.error("❌ Chat error:", err.message);
    res.status(500).json({ reply: "Có lỗi xảy ra, thử lại sau nhé." });
  }
});

export default router;


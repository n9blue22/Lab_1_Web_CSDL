require('dotenv').config();
console.log('Mật khẩu Node.js đọc được là:', process.env.DB_PASSWORD);
require('dotenv').config();
const mysql = require('mysql2/promise');

// Khởi tạo Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Hàm khởi tạo bảng và chèn dữ liệu mẫu
async function setupDatabaseAndSeedData() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      price DECIMAL(12,2) NOT NULL,
      quantity INT DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );
  `);

  // Truncate dữ liệu cũ để tránh trùng lặp khi chạy lại
  await pool.query('SET FOREIGN_KEY_CHECKS = 0;');
  await pool.query('TRUNCATE TABLE items;');
  await pool.query('TRUNCATE TABLE categories;');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

  await pool.query(`
    INSERT INTO categories (name, description) VALUES
    ('Food', 'Daily essentials and groceries'),
    ('Electronics', 'Gadgets, phones and computers'),
    ('Clothing', 'Apparel and fashion items'),
    ('Books', 'Educational and entertainment books'),
    ('Home & Living', 'Furniture and home appliances'),
    ('Sports & Outdoors', 'Sporting goods and outdoor equipment');
  `);

  await pool.query(`
    INSERT INTO items (category_id, item_name, price, quantity) VALUES
    (1, 'Apple', 25000.00, 100),
    (1, 'Milk', 32000.00, 50),
    (1, 'Bread', 15000.00, 30),
    (2, 'Smartphone', 5500000.00, 15),
    (2, 'Wireless Mouse', 250000.00, 40),
    (3, 'T-Shirt', 120000.00, 60),
    (3, 'Jeans', 350000.00, 25),
    (4, 'Node.js Programming', 180000.00, 20),
    (5, 'Desk Lamp', 150000.00, 35),
    (5, 'Coffee Mug', 45000.00, 80);
  `);
  console.log('-> Dữ liệu mẫu cho categories và items đã được tạo thành công.');
}

// Câu 2 mở rộng: Lọc sản phẩm theo từ khóa (LIKE)
async function searchProductsByKeyword(keywords) {
  const sql = `SELECT * FROM items WHERE item_name LIKE ? OR item_name LIKE ?`;
  const params = keywords.map(kw => `%${kw}%`);
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function main() {
  try {
    await setupDatabaseAndSeedData();

    console.log('\n--- EXERCISE 2 CƠ BẢN ---');
    // Thêm danh mục bằng Prepared Statement
    const insertSql = 'INSERT INTO categories (name, description) VALUES (?, ?)';
    const [insertResult] = await pool.execute(insertSql, ['Toys', 'Children toys']);
    console.log(`-> Inserted category ID: ${insertResult.insertId}`);

    // Cập nhật dữ liệu
    const updateSql = 'UPDATE categories SET description = ? WHERE id = ?';
    const [updateResult] = await pool.execute(updateSql, ['Educational & fun toys', insertResult.insertId]);
    console.log(`-> Affected rows: ${updateResult.affectedRows}`);

    console.log('\n--- 4 CÂU MỞ RỘNG CỦA EXERCISE 2 ---');

    // Question 1: Filter & sort
    // Giải thích: Sử dụng điều kiện WHERE để lọc giá sản phẩm >= 500,000 và số lượng > 0, kết hợp ORDER BY price DESC để sắp xếp giảm dần theo giá.
    const [q1Rows] = await pool.execute(
      'SELECT * FROM items WHERE price >= ? AND quantity > ? ORDER BY price DESC',
      [500000, 0]
    );
    console.log('Q1 (Lọc & Sắp xếp giá >= 500k, số lượng > 0):', q1Rows);

    // Question 2: Wildcard / LIKE search
    // Giải thích: Hàm truyền mảng tham số có định dạng `%keyword%` vào truy vấn SQL chứa toán tử LIKE để tránh SQL Injection.
    const q2Rows = await searchProductsByKeyword(['Gaming', 'Wireless']);
    console.log('Q2 (Tìm kiếm chứa "Gaming" hoặc "Wireless"):', q2Rows);

    // Question 3: Aggregate functions
    // Giải thích: Sử dụng hàm gom nhóm SUM, AVG, COUNT trên toàn bộ bảng items để tính tổng số lượng tồn, giá trung bình và tổng số mặt hàng.
    const [q3Rows] = await pool.execute(
      'SELECT SUM(quantity) AS total_stock, AVG(price) AS avg_price, COUNT(*) AS total_items FROM items'
    );
    console.log('Q3 (Thống kê tổng kho, giá trung bình, tổng mặt hàng):', q3Rows[0]);

    // Question 4: Category statistics - GROUP BY & HAVING
    // Giải thích: Nhóm sản phẩm theo category_id, tính tổng số lượng mặt hàng và tổng giá trị tồn kho (price * quantity). Dùng HAVING để lọc ra các nhóm có tổng giá trị lớn hơn 10,000,000 VNĐ.
    const [q4Rows] = await pool.execute(`
      SELECT category_id, COUNT(*) AS item_count, SUM(price * quantity) AS total_inventory_value
      FROM items
      GROUP BY category_id
      HAVING total_inventory_value > 10000000
    `);
    console.log('Q4 (Thống kê theo danh mục có giá trị kho > 10 triệu):', q4Rows);

  } catch (error) {
    console.error('MySQL error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
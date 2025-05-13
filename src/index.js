require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const port = process.env.PORT || 3001;
// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Database Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "12345",
  database: process.env.DB_NAME || "ecommerce",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.stack);
    process.exit(1); // Exit the process if the database connection fails
  }
  console.log("Connected to the database.");
});

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "natnaelSisay1234",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Secure cookies in production
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Login Endpoint
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }
  const query = "SELECT * FROM customers WHERE username = ?";
  db.query(query, [username], (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Password comparison error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      req.session.user = { id: user.id, username: user.username };
      res.json({ status: "Login successful", role: "customer" });
    });
  });
});

//register Endpoint
app.post("/api/register", (req, res) => {
  const { fullName, username, email, password, image } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const query =
    "INSERT INTO customers (fullName, username, email, password, image) VALUES (?, ?, ?, ?, ?)";
  db.query(
    query,
    [fullName, username, email, hashedPassword, image],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      res.status(201).json({ message: "User registered successfully" });
    }
  );
});

app.get("/api/products", (req, res) => {
  const query = "SELECT pid, pname, price,category FROM products";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});

app.post("/api/cart", (req, res) => {
  const { productId } = req.body;

  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "User not logged in" });
  }

  const userId = req.session.user.id;

  const cartItem = {
    pid: productId,
    quantity: 1,
  };
  const cartQuery =
    "INSERT INTO carts (user_id, pid, quantity) VALUES (?, ?, ?)";
  db.query(
    cartQuery,
    [userId, cartItem.pid, cartItem.quantity],
    (err, result) => {
      if (err) {
        console.error("Database insert error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      res.status(201).json({ message: "Product added to cart successfully" });
    }
  );
});

app.get("/api/cart", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "User not logged in" });
  }

  const userId = req.session.user.id;

  const cartProductQuery =
    "SELECT p.pname, p.price, p.category, c.quantity FROM products p JOIN carts c ON p.pid = c.pid WHERE c.user_id = ? ";
  db.query(cartProductQuery, [userId], (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length === 0) {
      return res.json({ cartItems: [] });
    }

    // Format the results into the structure expected by the frontend
    const cartItems = results.map((item) => ({
      pname: item.pname,
      category: item.category,
      price: item.price,
      quantity: item.quantity,
    }));

    res.json({ cartItems });
  });
});

//search Endpoint
app.get("/api/products", (req, res) => {
  const query = "SELECT pid, pname, price, image FROM products"; // Removed category
  db.query(query, (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(results);
  });
});

//change password Endpoint
app.put("/api/customers", (req, res) => {
  const { userId, username, password } = req.body;

  // Ensure all required fields are provided
  if (!userId || !username || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const query = "UPDATE customers SET username = ?, password = ? WHERE id = ?";
  db.query(query, [username, password, userId], (err, result) => {
    if (err) {
      console.error("Database update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({ message: "Account details updated successfully." });
  });
});

//customer info to change account Endpoint
app.get("/api/customers", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "User not logged in" });
  }

  const userId = req.session.user.id;

  const query = "SELECT username FROM customers WHERE id = ?";
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ username: results[0].username });
  });
});

app.put("/api/customers", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "User not logged in" });
  }

  const userId = req.session.user.id;
  const { username, password } = req.body;

  // Ensure all required fields are provided
  if (!username || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  const query = "UPDATE customers SET username = ?, password = ? WHERE id = ?";
  db.query(query, [username, hashedPassword, userId], (err, result) => {
    if (err) {
      console.error("Database update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({ message: "Account details updated successfully." });
  });
});

// Logout Endpoint
app.post("/api/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res
          .status(500)
          .json({ error: "Failed to log out. Please try again." });
      }
      res.clearCookie("connect.sid"); // Clear the session cookie
      res.status(200).json({ message: "Logout successful" });
    });
  } else {
    res.status(400).json({ error: "No active session to log out" });
  }
});

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

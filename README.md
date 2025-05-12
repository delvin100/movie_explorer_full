# 🎬 Movie Explorer

## 🌟 Project Overview
**Movie Explorer** is a full-stack web application that lets users:
- 🔍 Explore movies
- 🎞️ Manage watchlists
- ✍️ Write reviews
- 📥 Request movies

It features both **User** and **Admin** interfaces with tailored access and control.

---

## 🛠️ Tech Stack

### 🔧 Backend
- ⚙️ **Node.js** – Runtime Environment
- 🚀 **Express.js** – Web Framework
- 🗄️ **MongoDB + Mongoose** – NoSQL Database
- 🔐 **JWT** – Authentication
- 🔑 **bcryptjs** – Password Hashing
- 📬 **Custom Email Module**
- 🌐 **CORS** – Cross-Origin Resource Sharing

### 🎨 Frontend
- 🧱 **HTML5 / CSS3** – Structure & Styling
- 🧠 **Vanilla JavaScript** – Client-side Interactions
- 📁 **Express Static Middleware** – File Serving
- 📱 **Responsive Design** via Media Queries

---

## 👥 User Features

### 🔐 Authentication System
- ✅ Email-verified registration
- 🔐 JWT-based login
- 🔒 Secure password hashing
- 📝 Profile management
- 🗑️ Account deletion

### 🎞️ Movie Management
- 📚 Browse and view details
- ➕ Add / ➖ Remove from watchlist
- 📈 Track watch status

### ⭐ Review System
- ✍️ Write, 🖊️ Edit, and 🗑️ Delete own reviews
- 🌟 Rate movies (1-5 stars)
- 📖 View all reviews for a movie

### 🎥 Movie Request System
- 📨 Submit custom requests (language, quality)
- 📬 Track status with email notifications

### 👤 User Profile
- ✨ Custom bio & avatar (DiceBear API)
- ❤️ Favorite genres
- ⏱️ Watch time & activity tracking

### 🗣️ Feedback System
- 📩 Submit feedback
- 🕒 Timestamped entries

---

## 🛡️ Admin Features

### 🧑‍💼 User Management
- 📋 View / 🔍 Search / 🗑️ Delete users
- 🔍 Inspect user activity & profiles

### 👀 Review Management
- 📖 View all reviews
- 🧼 Delete inappropriate content

### 🎬 Movie Request Management
- ✅ Approve / ❌ Reject requests
- 📎 Add download links
- 📧 Email status notifications

### 📊 Dashboard Stats
- 👥 Total users
- 📮 Requests & reviews
- 🕵️ Monitor user activity

### 💬 Feedback Management
- 📜 View & sort feedback

---

## 🛡️ Security Features
- 🛂 Role-based Access Control
- ⏲️ Token Expiration: 2h (User), 24h (Admin)
- 🧼 Input validation & sanitization
- 🌍 Strict CORS Policy
- 🧱 Rate limiting
- 🚷 Inactivity detection (15 days)

---

## 📬 Email Notifications
Automatic emails are sent for:
- 📧 Welcome registration
- ✅ Request approvals
- ❌ Request rejections
- 🗑️ Account deletions

---

## 🗃️ Database Schemas

### 👤 User
- Username, Email, Password
- Bio, Avatar, Join Date
- Activity & Admin flag

### 🎞️ Watchlist
- Linked to user
- Movie info, Watch status, Timestamps

### ⭐ Review
- Linked to user and movie
- Rating, Review text, Timestamps
- Soft delete support

### 🎥 Movie Request
- Movie & user info
- Status, Download link, Timestamps

### 💬 Feedback
- Feedback content
- Timestamps, Linked user

---

## 🔌 API Endpoints

### 👤 Authentication
- `POST /api/register` → Register  
- `POST /api/login` → User login  
- `POST /api/admin/login` → Admin login  

### 👥 User Management
- `GET /api/profile` → Fetch profile  
- `PATCH /api/profile` → Update profile  
- `DELETE /api/profile` → Delete account  

### 📽️ Watchlist
- `POST /api/watchlist` → Add to watchlist  
- `GET /api/watchlist` → View watchlist  
- `PATCH /api/watchlist/:movieId` → Update status  
- `DELETE /api/watchlist/:movieId` → Remove movie  

### ⭐ Reviews
- `POST /api/reviews` → Add review  
- `GET /api/reviews/:movieId` → Get reviews  
- `GET /api/user/reviews` → My reviews  
- `PATCH /api/reviews/:movieId` → Edit review  
- `DELETE /api/reviews/:movieId` → Delete review  

### 🎬 Movie Requests
- `POST /api/movie-request` → Submit request  
- `GET /api/movie-requests/user` → My requests  
- `GET /api/movie-requests` → All requests (admin)  
- `PATCH /api/movie-request/:id` → Update status  
- `DELETE /api/movie-request/:id` → Delete request  

### 🧑‍💼 Admin
- `GET /api/admin/users` → All users  
- `GET /api/admin/users/search` → Search users  
- `GET /api/admin/users/:id` → User details  
- `GET /api/admin/stats` → Dashboard stats  
- `DELETE /api/admin/users/:id` → Delete user  
- `GET /api/feedbacks` → View feedback  

---

## 🖥️ Frontend Pages

### Main Pages
- 🏠 `index.html` – Home
- 🔐 `login.html` – Login / Register
- 👤 `profile.html` – Profile
- 🎬 `movie.html` – Movie Details
- ➕ `more.html` – Extra Features

### Admin Pages
- 📊 `admin.html` – Admin Dashboard
- ✅ `adminapprove.html` – Movie Requests
- 📝 `adminreview.html` – Review Moderation

### Utility Pages
- 📝 `form.html` – General Forms
- 💬 `feedback.html` – Submit Feedback

---

## 🚀 Performance & Optimization

### ⚡ Caching
- Static assets: 1h
- HTML: No-cache
- CORS Preflight: 24h

### 🧠 Database
- Indexed fields
- Optimized schema & relations

### 🛡️ Security
- Rate limiting
- Secure headers
- Sanitized inputs
- Restricted CORS
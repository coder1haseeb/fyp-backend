# LocalBiz Backend API

A production-ready Node.js + Express.js REST API for LocalBiz - an AI-powered multi-role web platform for local businesses in Pakistan.

## 🚀 Features

- **Multi-Role Architecture**: Customers, Business Admins, and Super Admins
- **JWT Authentication**: Stateless, role-based access control
- **AI Recommendations**: Collaborative filtering engine for personalized recommendations
- **Payment Integration**: JazzCash and Easypaisa sandbox support
- **Inventory Management**: Real-time stock tracking and low-stock alerts
- **Order Management**: Full order lifecycle with status tracking
- **Business Analytics**: Sales trends, top products, and customer insights
- **PDF Invoice Generation**: Automatic invoice PDF generation for orders
- **In-app Notifications**: Real-time notifications for all user roles
- **Rate Limiting**: Security measures for auth endpoints
- **File Uploads**: Cloudinary integration for image uploads

## 📋 Tech Stack

- **Runtime**: Node.js v20+
- **Framework**: Express.js v4
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Email**: Nodemailer (for OTP emails)
- **File Storage**: Cloudinary
- **PDF Generation**: pdfkit
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting

## 📁 Project Structure

```
localbiz-backend/
├── server.js                          # App entry point
├── package.json                       # Dependencies
├── .env.example                       # Environment template
│
├── config/
│   ├── db.js                          # MongoDB connection
│   ├── cloudinary.js                  # Cloudinary config
│   └── mailer.js                      # Nodemailer setup
│
├── middleware/
│   ├── auth.js                        # JWT verification
│   ├── authorize.js                   # Role-based access
│   ├── validate.js                    # Validation error handler
│   └── errorHandler.js                # Global error handling
│
├── models/                            # Mongoose schemas (14 models)
│   ├── Admin.js
│   ├── BusinessOwner.js
│   ├── Customer.js
│   ├── Business.js
│   ├── Product.js
│   ├── Cart.js
│   ├── Order.js
│   ├── Payment.js
│   ├── Return.js
│   ├── Category.js
│   ├── ServiceArea.js
│   ├── Notification.js
│   └── Interaction.js
│
├── controllers/                       # Business logic (17 controllers)
│   ├── auth.controller.js
│   ├── customer.controller.js
│   ├── store.controller.js
│   ├── product.controller.js
│   ├── cart.controller.js
│   ├── order.controller.js
│   ├── payment.controller.js
│   ├── return.controller.js
│   ├── recommendation.controller.js
│   ├── business.controller.js
│   ├── inventory.controller.js
│   ├── analytics.controller.js
│   ├── admin.controller.js
│   ├── category.controller.js
│   ├── platformReports.controller.js
│   ├── notification.controller.js
│   └── invoice.controller.js
│
├── routes/                            # API routes (18 route files)
│   ├── index.js                       # Main router
│   ├── auth.routes.js
│   ├── customer.routes.js
│   ├── store.routes.js
│   ├── product.routes.js
│   ├── cart.routes.js
│   ├── order.routes.js
│   ├── payment.routes.js
│   ├── return.routes.js
│   ├── recommendation.routes.js
│   ├── business.routes.js
│   ├── inventory.routes.js
│   ├── analytics.routes.js
│   ├── admin.routes.js
│   ├── category.routes.js
│   ├── platformReports.routes.js
│   ├── notification.routes.js
│   └── invoice.routes.js
│
└── utils/                             # Utility functions
    ├── ApiResponse.js                 # Standardized responses
    ├── generateToken.js               # JWT generation
    ├── generateOTP.js                 # OTP generation
    ├── sendEmail.js                   # Email sending
    ├── generateInvoicePDF.js          # PDF invoice builder
    ├── createNotification.js          # Notification creation
    ├── collaborativeFilter.js         # AI recommendation engine
    └── stockAlertChecker.js           # Low-stock alerts
```

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd localbiz-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/localbiz
   JWT_SECRET=your_super_secret_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   JAZZCASH_MERCHANT_ID=your_merchant_id
   JAZZCASH_PASSWORD=your_password
   JAZZCASH_HASH_KEY=your_hash_key
   EASYPAISA_STORE_ID=your_store_id
   EASYPAISA_HASH_KEY=your_hash_key
   CLIENT_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   npm run dev     # Development with nodemon
   npm start       # Production
   ```

   The server will run on `http://localhost:5000`

## 📚 API Documentation

### Authentication Routes `/api/v1/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register/customer` | Register new customer |
| POST | `/register/business` | Register business owner + store |
| POST | `/login` | Customer/Business login |
| POST | `/admin/login` | Super admin login |
| POST | `/verify-email` | Verify email with OTP |
| POST | `/forgot-password` | Request password reset OTP |
| POST | `/reset-password` | Reset password with OTP |
| POST | `/logout` | Logout (client-side token removal) |

### Customer Routes `/api/v1/customer`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get customer profile |
| PUT | `/profile` | Update profile |
| POST | `/addresses` | Add delivery address |
| PUT | `/addresses/:addressId` | Update address |
| DELETE | `/addresses/:addressId` | Delete address |
| PUT | `/change-password` | Change password |
| GET | `/insights` | Get spending insights |

### Store Routes `/api/v1/stores`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Browse all stores |
| GET | `/:storeId` | Get store details |
| GET | `/:storeId/products` | Get store products |

### Product Routes `/api/v1/products`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:productId` | Get product details |

### Cart Routes `/api/v1/cart`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get cart |
| POST | `/` | Add to cart |
| PUT | `/:cartItemId` | Update item quantity |
| DELETE | `/:cartItemId` | Remove item |
| DELETE | `/` | Clear cart |

### Order Routes `/api/v1/orders`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Place order |
| GET | `/` | Get order history |
| GET | `/:orderId` | Get order details |
| PUT | `/:orderId/cancel` | Cancel pending order |

### Payment Routes `/api/v1/payments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jazzcash/initiate` | Initiate JazzCash payment |
| POST | `/easypaisa/initiate` | Initiate Easypaisa payment |
| GET | `/:paymentId/status` | Check payment status |

### Return Routes `/api/v1/returns`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create return request |
| GET | `/` | Get return requests |

### Recommendation Routes `/api/v1/recommendations`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get personalized recommendations |
| GET | `/similar/:productId` | Get similar products |
| POST | `/interaction` | Log user interaction |

### Business Admin Routes `/api/v1/business`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get business profile |
| PUT | `/profile` | Update profile |
| GET | `/products` | Get products |
| POST | `/products` | Add product |
| PUT | `/products/:productId` | Update product |
| DELETE | `/products/:productId` | Delete product |
| GET | `/orders` | Get store orders |
| GET | `/orders/:orderId` | Get order detail |
| PUT | `/orders/:orderId/status` | Update order status |
| PUT | `/returns/:returnId` | Approve/reject return |

### Inventory Routes `/api/v1/business/inventory`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get inventory |
| GET | `/alerts` | Get low-stock alerts |
| PUT | `/:productId/stock` | Update stock |
| GET | `/export` | Export inventory CSV |

### Analytics Routes `/api/v1/business/analytics`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/summary` | Dashboard summary |
| GET | `/sales` | Sales trends |
| GET | `/top-products` | Top products |
| GET | `/payments` | Payment breakdown |
| GET | `/customers` | Customer insights |

### Admin Routes `/api/v1/admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Platform dashboard |
| GET | `/businesses` | Get businesses for review |
| GET | `/businesses/:businessId` | Business details |
| PUT | `/businesses/:businessId/decision` | Approve/reject business |
| GET | `/users` | Get all users |
| PUT | `/users/:userId/suspend` | Suspend user |
| PUT | `/users/:userId/activate` | Activate user |
| DELETE | `/users/:userId` | Delete user |

### Category Routes `/api/v1/categories`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all categories (public) |

### Admin Category Routes `/api/v1/admin/categories`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create category |
| PUT | `/:categoryId` | Update category |
| DELETE | `/:categoryId` | Delete category |

### Platform Reports `/api/v1/admin/reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/growth` | Growth statistics |
| GET | `/top-stores` | Top stores report |
| GET | `/export` | Export platform report CSV |

### Notification Routes `/api/v1/notifications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get notifications |
| PUT | `/:notificationId/read` | Mark as read |
| PUT | `/read-all` | Mark all as read |

### Invoice Routes `/api/v1/invoices`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:orderId` | Get invoice data |
| GET | `/:orderId/download` | Download invoice PDF |

## 🔐 Authentication

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

JWT payload structure:
```json
{
  "userId": "mongo_object_id",
  "role": "customer|business_admin|super_admin",
  "businessId": "mongo_object_id or null",
  "iat": 1234567890,
  "exp": 1234654290
}
```

## 📊 Database Models

### Key Relationships

- **Customer** → Orders, Cart, Interactions
- **BusinessOwner** → Business, Products
- **Business** → Products, Orders, Returns
- **Product** → Orders, Cart, Interactions
- **Order** → Payments, Returns, Items
- **User** → Notifications

## 🤖 AI Recommendation Engine

Uses user-based collaborative filtering:

1. Analyzes customer interaction patterns (views, adds to cart, purchases)
2. Computes similarity with other customers
3. Recommends products from similar users
4. Falls back to trending products for new users

## 💳 Payment Integration

### JazzCash (Sandbox)
- HMAC-SHA256 secure hash generation
- Sandbox endpoint for testing
- Transaction reference tracking

### Easypaisa (Sandbox)
- Secure hash validation
- Sandbox payment processing
- Auto-redirect support

### COD & Pay-at-Store
- No external API call required
- Manual payment marking by business admin

## 📧 Email Service

- **OTP Emails**: Verification and password reset
- **Notification Emails**: Order updates (optional expansion)
- Uses Gmail SMTP via Nodemailer

## 🔔 Notification System

Automatic notifications created for:
- New order received
- Order status updates
- Order delivered
- Low stock alerts
- Business approval/rejection
- Return request approval/rejection

## ⚡ Performance Optimizations

- MongoDB indexes on frequently queried fields
- Lean queries for read-only operations
- Pagination on all list endpoints
- CSV export for bulk data
- PDF generation with streaming

## 🛡️ Security Features

- Helmet middleware for security headers
- CORS configuration
- Rate limiting on auth endpoints (10 req/15min)
- Password hashing with bcryptjs (12 rounds)
- JWT expiration (7 days)
- SQL/NoSQL injection prevention via validation
- XSS protection via helmet

## 📝 Standard Response Format

### Success Response
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

## 🚀 Deployment

1. Set `NODE_ENV=production`
2. Use a process manager (PM2)
3. Set up MongoDB Atlas cluster
4. Configure Cloudinary production account
5. Set production email credentials
6. Use HTTPS in production

Example PM2 start:
```bash
pm2 start server.js --name "localbiz-api" --instances 2
```

## 📖 Additional Features

- Order ID generation: `ORD-YYYY-XXXXX`
- Invoice ID generation: `INV-YYYY-XXXXX`
- Return ID generation: `RET-XXXXX`
- Low stock threshold: 5 units (configurable)
- Pagination defaults: 10 items per page, max 50

## 🤝 Contributing

When adding new features:
1. Follow existing code structure
2. Add proper validation with express-validator
3. Include error handling with try/catch
4. Use lean() for read-only queries
5. Create appropriate models with indexes
6. Add pagination to list endpoints
7. Document new API endpoints

## 📞 Support

For issues or questions, create an issue in the repository.

## 📄 License

MIT License - See LICENSE file for details

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Production Ready ✅

# LocalBiz Backend - Quick Reference Guide

## 🚀 Quick Start

```bash
# Install
npm install

# Setup env
cp .env.example .env
# Edit .env with your credentials

# Run dev
npm run dev

# Run production
npm start
```

Server: `http://localhost:5000`  
Health check: `GET http://localhost:5000/health`

---

## 📍 API Base URL

```
http://localhost:5000/api/v1
```

---

## 🔑 Authentication

All protected routes require header:
```
Authorization: Bearer <jwt_token>
```

### Get Token (Login)

**Customer:**
```bash
POST /auth/login
{
  "email": "customer@example.com",
  "password": "password123"
}
```

**Business Admin:**
```bash
POST /auth/login
{
  "email": "owner@example.com",
  "password": "password123"
}
```

**Super Admin:**
```bash
POST /auth/admin/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "...",
      "fullName": "...",
      "role": "customer|business_admin|super_admin"
    }
  }
}
```

---

## 👤 Customer Endpoints

### Register
```bash
POST /auth/register/customer
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "pass123",
  "phone": "03001234567",
  "city": "Karachi"
}
```

### Verify Email
```bash
POST /auth/verify-email
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Get Profile
```bash
GET /customer/profile
Authorization: Bearer <token>
```

### Browse Stores
```bash
GET /stores?city=Karachi&category=restaurants&rating=4&page=1&limit=10
```

### Get Store Details
```bash
GET /stores/:storeId
```

### Get Products in Store
```bash
GET /stores/:storeId/products?category=burgers&page=1&limit=10
```

### Get Product Detail
```bash
GET /products/:productId
```

### Add to Cart
```bash
POST /cart
Authorization: Bearer <token>
{
  "productId": "...",
  "quantity": 2
}
```

### Get Cart
```bash
GET /cart
Authorization: Bearer <token>
```

### Place Order
```bash
POST /orders
Authorization: Bearer <token>
{
  "deliveryAddress": {
    "street": "123 Main St",
    "city": "Karachi"
  },
  "paymentMethod": "jazzcash|easypaisa|cod|pay_at_store"
}
```

### Get Orders
```bash
GET /orders?status=pending&page=1&limit=10
Authorization: Bearer <token>
```

### Get Order Detail
```bash
GET /orders/:orderId
Authorization: Bearer <token>
```

### Get Recommendations
```bash
GET /recommendations?limit=10
Authorization: Bearer <token>
```

### Get Invoice
```bash
GET /invoices/:orderId
Authorization: Bearer <token>
```

### Download Invoice PDF
```bash
GET /invoices/:orderId/download
Authorization: Bearer <token>
```

---

## 🏪 Business Admin Endpoints

### Get Business Profile
```bash
GET /business/profile
Authorization: Bearer <token>
```

### Update Business Profile
```bash
PUT /business/profile
Authorization: Bearer <token>
{
  "storeName": "My Store",
  "description": "...",
  "phone": "...",
  "address": "...",
  "city": "..."
}
```

### Add Product
```bash
POST /business/products
Authorization: Bearer <token>
{
  "name": "Burger",
  "description": "Delicious burger",
  "price": 500,
  "category": "food",
  "images": ["url1", "url2"],
  "stockQty": 50
}
```

### Get Products
```bash
GET /business/products?status=active&category=food&page=1&limit=10
Authorization: Bearer <token>
```

### Update Product
```bash
PUT /business/products/:productId
Authorization: Bearer <token>
{
  "name": "New Name",
  "price": 600,
  "stockQty": 40
}
```

### Delete Product
```bash
DELETE /business/products/:productId
Authorization: Bearer <token>
```

### Get Orders
```bash
GET /business/orders?status=pending&page=1&limit=10
Authorization: Bearer <token>
```

### Update Order Status
```bash
PUT /business/orders/:orderId/status
Authorization: Bearer <token>
{
  "status": "processing|ready|delivered"
}
```

### Get Inventory
```bash
GET /business/inventory
Authorization: Bearer <token>
```

### Get Low Stock Alerts
```bash
GET /business/inventory/alerts
Authorization: Bearer <token>
```

### Update Stock
```bash
PUT /business/inventory/:productId/stock
Authorization: Bearer <token>
{
  "operation": "set|increment|decrement",
  "quantity": 10
}
```

### Get Dashboard Summary
```bash
GET /business/analytics/summary
Authorization: Bearer <token>
```

### Get Sales Trend
```bash
GET /business/analytics/sales?period=day|week|month
Authorization: Bearer <token>
```

### Get Top Products
```bash
GET /business/analytics/top-products?limit=10
Authorization: Bearer <token>
```

---

## 👨‍💼 Super Admin Endpoints

### Get Dashboard
```bash
GET /admin/dashboard
Authorization: Bearer <token>
```

### Get Businesses for Review
```bash
GET /admin/businesses?approvalStatus=pending&page=1&limit=10
Authorization: Bearer <token>
```

### Approve Business
```bash
PUT /admin/businesses/:businessId/decision
Authorization: Bearer <token>
{
  "decision": "approved"
}
```

### Reject Business
```bash
PUT /admin/businesses/:businessId/decision
Authorization: Bearer <token>
{
  "decision": "rejected",
  "rejectionReason": "Reason for rejection"
}
```

### Get Users
```bash
GET /admin/users?role=customer&status=active&page=1&limit=10
Authorization: Bearer <token>
```

### Suspend User
```bash
PUT /admin/users/:userId/suspend
Authorization: Bearer <token>
```

### Get Growth Stats
```bash
GET /admin/reports/growth
Authorization: Bearer <token>
```

### Get Top Stores
```bash
GET /admin/reports/top-stores?limit=10
Authorization: Bearer <token>
```

### Create Category
```bash
POST /admin/categories
Authorization: Bearer <token>
{
  "name": "Restaurants",
  "icon": "🍽️"
}
```

---

## 📊 Query Parameters

### Pagination
```
?page=1&limit=10  # page: default 1, limit: default 10, max 50
```

### Filters
```
?status=pending&category=food&city=Karachi&rating=4
```

### Search
```
?search=burger
```

### Sorting
```
?sort=-createdAt  # Results sorted by creation date descending
```

---

## 📝 Common Response Formats

### Success (200, 201)
```json
{
  "success": true,
  "message": "Success message",
  "data": {
    "id": "...",
    "name": "...",
    ...
  }
}
```

### Success with Pagination (200)
```json
{
  "success": true,
  "message": "Data retrieved",
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "total": 47,
      "limit": 10
    }
  }
}
```

### Error (400, 401, 403, 404, 500)
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

---

## 🔄 Common Workflows

### Customer Registration & First Order

1. Register
   ```bash
   POST /auth/register/customer
   ```

2. Verify Email
   ```bash
   POST /auth/verify-email
   ```

3. Login
   ```bash
   POST /auth/login
   ```

4. Browse Stores
   ```bash
   GET /stores
   ```

5. Browse Store Products
   ```bash
   GET /stores/:storeId/products
   ```

6. Add to Cart
   ```bash
   POST /cart
   ```

7. Place Order
   ```bash
   POST /orders
   ```

8. Initiate Payment
   ```bash
   POST /payments/jazzcash/initiate
   ```

### Business Admin Setup & Operations

1. Register Business
   ```bash
   POST /auth/register/business
   ```
   *Wait for super admin approval*

2. Login
   ```bash
   POST /auth/login
   ```

3. Add Products
   ```bash
   POST /business/products
   ```

4. Check Orders
   ```bash
   GET /business/orders
   ```

5. Update Order Status
   ```bash
   PUT /business/orders/:orderId/status
   ```

6. Monitor Analytics
   ```bash
   GET /business/analytics/summary
   ```

---

## 🔐 Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Request validation failed |
| INVALID_CREDENTIALS | 401 | Wrong email/password |
| UNAUTHORIZED | 401 | No/invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| EMAIL_EXISTS | 409 | Email already registered |
| INSUFFICIENT_STOCK | 400 | Product out of stock |
| EMPTY_CART | 400 | Cannot checkout with empty cart |
| INTERNAL_ERROR | 500 | Server error |

---

## 💡 Tips & Best Practices

### Always Include Content-Type
```bash
Content-Type: application/json
```

### Test with cURL
```bash
curl -X GET "http://localhost:5000/api/v1/stores" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Use Postman Collection
Import the provided Postman collection for easier testing

### Rate Limiting
Auth endpoints: 10 requests per 15 minutes per IP

### Token Expiration
JWT tokens expire after 7 days. Re-login to get new token.

### Payment Testing
- JazzCash: Use sandbox credentials from .env
- Easypaisa: Use sandbox credentials from .env
- COD/Pay-at-Store: No external API call needed

### Low Stock Threshold
Default: 5 units (configurable in .env)

---

## 🆘 Troubleshooting

### Issue: "Unauthorized"
**Solution**: Ensure token is included in Authorization header

### Issue: "Business not approved"
**Solution**: Wait for super admin approval at /admin/businesses

### Issue: "Insufficient stock"
**Solution**: Check inventory at /business/inventory or /business/inventory/alerts

### Issue: "Email already exists"
**Solution**: Try login instead of register

### Issue: "CORS Error"
**Solution**: Ensure CLIENT_URL in .env matches your frontend

### Issue: "MongoDB connection error"
**Solution**: Check MONGO_URI in .env and verify MongoDB Atlas whitelist

---

## 📚 Additional Resources

- **Full Documentation**: See `README.md`
- **Build Manifest**: See `BUILD_MANIFEST.md`
- **Environment Template**: See `.env.example`
- **Models**: See `models/` directory
- **Controllers**: See `controllers/` directory
- **Routes**: See `routes/` directory

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Production Ready ✅

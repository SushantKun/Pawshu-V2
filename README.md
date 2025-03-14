# Pawshu - Pet Service Application

Pawshu is a comprehensive pet service application that allows users to browse and purchase pet products, book services, and more.

## Features

- User authentication (register, login, profile)
- Product browsing and filtering by category
- Shopping cart and wishlist functionality
- Admin panel for product management
- Cloudinary integration for image uploads
- MongoDB database for data storage

## Project Structure

The project is divided into two main parts:

1. **Client** (React/TypeScript frontend)
2. **Server** (Node.js/Express/TypeScript backend)

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Cloudinary account

## Environment Variables

Create a `.env` file in the server directory with the following variables:

```
# MongoDB
MONGODB_URI=mongodb://localhost:27017/pawshu

# JWT
JWT_SECRET=your_jwt_secret_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Installation

### Client

```bash
cd pawshu
npm install
```

### Server

```bash
cd server
npm install
```

## Running the Application

### Server

```bash
cd server
npm run dev
```

### Client

```bash
cd pawshu
npm start
```

## Creating an Admin User

To create an admin user for accessing the admin panel:

```bash
cd server
npm run create-admin
```

This will create an admin user with the following credentials:

- Email: admin@pawshu.com
- Password: admin123

## Admin Panel

Access the admin panel at `/admin/login` with the admin credentials.

The admin panel allows you to:

- Manage products (add, edit, delete)
- View and manage users
- Configure application settings

## API Endpoints

### Authentication

- `POST /api/register` - Register a new user
- `POST /api/login` - Login a user
- `POST /api/admin/login` - Login an admin user
- `GET /api/profile` - Get user profile (protected)

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get a single product
- `POST /api/products` - Create a new product (admin only)
- `PUT /api/products/:id` - Update a product (admin only)
- `DELETE /api/products/:id` - Delete a product (admin only)

## Technologies Used

### Frontend

- React
- TypeScript
- Tailwind CSS
- Axios
- React Router
- Headless UI

### Backend

- Node.js
- Express
- TypeScript
- MongoDB/Mongoose
- JWT Authentication
- Cloudinary

## License

This project is licensed under the MIT License.

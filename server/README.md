# Pawshu Backend Server

This is the backend server for the Pawshu application, built with Express, TypeScript, and MongoDB.

## Features

- User authentication (register/login)
- JWT-based authorization
- Protected routes
- MongoDB database integration
- TypeScript support

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or a MongoDB Atlas connection string)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/pawshu
   JWT_SECRET=your-secret-key
   ```

## Development

To start the development server with hot-reload:

```bash
npm run dev
```

## Production

To build and start the production server:

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/register` - Register a new user

  - Body: `{ email, password, name }`
  - Returns: JWT token

- `POST /api/login` - Login user
  - Body: `{ email, password }`
  - Returns: JWT token

### Protected Routes

- `GET /api/profile` - Get user profile
  - Requires: Authorization header with JWT token
  - Returns: User profile (excluding password)

## Error Handling

The server returns appropriate HTTP status codes and error messages:

- 400: Bad Request (invalid input)
- 401: Unauthorized (invalid/missing token)
- 404: Not Found
- 500: Server Error

## Security

- Passwords are hashed using bcrypt
- JWT tokens are used for authentication
- CORS is enabled for frontend communication
- Environment variables are used for sensitive data

## Payment Integrations

### Khalti Payment Gateway

This project integrates the Khalti Payment Gateway using the Web Checkout method. The integration follows these steps:

1. **Server Side Integration**

   - The server initiates a payment through the Khalti API (`/epayment/initiate/`)
   - When the user completes the payment, Khalti redirects to our callback URL
   - The server verifies the payment using Khalti's lookup API (`/epayment/lookup/`)

2. **Client Side Integration**

   - The client redirects the user to Khalti's payment URL
   - After payment completion, the user is redirected back to our success page
   - The success page verifies the payment status with our server

3. **Environment Variables**

   - `KHALTI_SECRET_KEY`: Your Khalti secret key for API authentication
   - `KHALTI_PUBLIC_KEY`: Your Khalti public key (used on the client side)

4. **Testing**

   - Use Khalti's sandbox environment (`https://dev.khalti.com/api/v2/`) for testing
   - Use test phone numbers: 9800000000-9800000005
   - Use test MPIN: 1111
   - Use test OTP: 987654

5. **API Endpoints**
   - POST `/orders/khalti-payment`: Initiates a Khalti payment
   - GET `/orders/verify-khalti`: Verifies a Khalti payment

### eSewa Payment Gateway

// ... existing eSewa documentation if any ...

## License

// ... existing license information ...

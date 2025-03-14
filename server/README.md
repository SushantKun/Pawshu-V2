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

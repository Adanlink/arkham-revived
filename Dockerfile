# Stage 1: Build dependencies
FROM node:20-alpine AS builder

# Install build dependencies for native modules like better-sqlite3
# python3, make, and g++ are required by node-gyp
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

# Copy package files and install dependencies
# This layer is cached to speed up subsequent builds if dependencies don't change
COPY package.json package-lock.json ./
RUN npm install

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
# This should match the HTTP_PORT in your .env file or the default in index.js
EXPOSE 8080

# Define the command to run the application
CMD ["node", "index.js"]

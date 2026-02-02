# Deployment Guide

The environment where this code is currently hosted lacks `node` and `npm`, so direct local deployment is not possible. 
However, I have created a `Dockerfile` that allows you to deploy this application anywhere (Local Docker, Vercel, AWS, DigitalOcean, etc.).

## Option 1: Docker (Recommended)

1.  **Build the Image**:
    ```bash
    docker build -t keturah-stone .
    ```

2.  **Run the Container**:
    ```bash
    docker run -p 3000:3000 -e DATABASE_URL="mysql://..." keturah-stone
    ```

## Option 2: Manual Deployment

If you move this code to a machine with Node.js 22+:

1.  **Install pnpm**:
    ```bash
    npm install -g pnpm
    ```

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Build**:
    ```bash
    pnpm run build
    ```

4.  **Start**:
    ```bash
    pnpm start
    ```

## Environment Variables

Make sure to set the following variables in your production environment:
- `DATABASE_URL`: Connection string for your MySQL database.
- `JWT_SECRET`: Secret key for session cookies.
- `BUILT_IN_FORGE_API_URL` / `KEY`: (If using the existing storage proxy).

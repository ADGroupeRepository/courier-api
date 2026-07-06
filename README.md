# Courier API (Bara API Backend)

A modern, modular SaaS backend built on top of **AdonisJS 7** and **TypeScript**. This API acts as the core engine for managing organizations, directories, subscriptions, and specialized courier features (including courier assignments, real-time chats, and automated replies), powered by **Appwrite** and **Redis**.

---

## 🚀 Tech Stack

- **AdonisJS v7**: Core framework providing the MVC structure, routing, middleware, and developer experience.
- **Appwrite Node SDK**: Serves as the primary data store and database manager.
- **Redis**: Handles distributed locks, cache storage, and request rate-limiting.
- **Resend**: Integrated for sending transactional and system emails.
- **VineJS**: Used for strict request validation schemas.
- **Japa**: Testing framework for unit and integration tests.

---

## 📂 Modular Architecture

The application codebase uses a domain-driven modular structure found under `app/modules/`. Each module encapsulates its routes, validators, controllers, and services:

- **`auth`**: Handles authentication workflows, user sessions, and registration.
- **`organisations`**: Manages tenants, workspaces, and team memberships/roles.
- **`directory`**: Handles employee listings, department assignments, and profile data.
- **`courier`**: The core logic of the application, managing:
  - Courier assignments and status tracking.
  - Interactive chat (`courier_chat_controller.ts` & `courier_chat_service.ts`).
  - Automated replies and responses (`courier_replies_controller.ts` & `courier_reply_service.ts`).
- **`external_contacts`**: Directory for managing external clients, vendors, and partners.
- **`plans`**: Deals with subscription tier allocations and system features limits.
- **`admin`**: System administration actions and dashboard statistics.

---

## 🛠️ Configuration & Setup

### Prerequisites

- Node.js (v20+ recommended)
- Redis Server (local or cloud instance)
- Appwrite project and API credentials

### Installation

1. Clone the repository and navigate into the project root:
   ```bash
   npm install
   ```

2. Duplicate the environment variables template:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and configure your keys:
   - **`APP_KEY`**: Run `node ace generate:key` to generate a secure application key.
   - **Appwrite Credentials**: Provide your Appwrite API endpoint, project ID, and secret API key.
   - **Redis Instance**: Configure your host, port, and authentication credentials.
   - **Resend Config**: Add your transactional email API key and sender address.

---

## 🏃 Running the Application

- **Development Server (with Hot Reloading)**:
  ```bash
  npm run dev
  ```

- **TypeScript Compilation Check**:
  ```bash
  npm run typecheck
  ```

- **Linter & Formatting**:
  ```bash
  npm run lint
  npm run format
  ```

- **Build for Production**:
  ```bash
  npm run build
  ```

- **Start Production Server**:
  ```bash
  npm run start
  ```
